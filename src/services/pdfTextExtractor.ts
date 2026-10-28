/**
 * Décode les séquences d'échappement d'une chaîne littérale PDF `(...)`
 * (ex: `\n`, `\r`, `\t`, `\(`, `\)`, `\\` et séquences octales `\ddd`).
 */
export const decodePdfLiteralString = (raw: string): string => {
  return raw
    .replace(/\\(\d{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\\(/g, '(')
    .replace(/\\\)/g, ')')
    .replace(/\\\\/g, '\\');
};

/**
 * Extrait les segments de texte depuis le contenu décompressé d'un flux d'opérateurs PDF (`BT ... ET`, `Tj`, `TJ`).
 */
export const extractTextOperatorsFromPdfChunk = (chunkText: string): string => {
  if (!chunkText) return '';
  const pieces: string[] = [];

  // Parcourir les blocs texte BT ... ET (ou l'ensemble du flux s'il n'y a pas de délimiteur BT explicite)
  const btBlocks = [...chunkText.matchAll(/\bBT\b([\s\S]*?)\bET\b/g)];
  const targets = btBlocks.length > 0 ? btBlocks.map((m) => m[1]) : [chunkText];

  for (const block of targets) {
    // 1. Tableaux TJ : [(...) -20 (...) ...] TJ
    const tjArrayMatches = block.matchAll(/\[([\s\S]*?)\]\s*TJ/g);
    for (const match of tjArrayMatches) {
      const inner = match[1];
      const strParts: string[] = [];
      const litMatches = inner.matchAll(/\((?:\\.|[^\\()])*\)/g);
      for (const lit of litMatches) {
        const content = lit[0].slice(1, -1);
        strParts.push(decodePdfLiteralString(content));
      }
      if (strParts.length > 0) {
        pieces.push(strParts.join(''));
      }
    }

    // 2. Opérateurs simples : (...) Tj ou (...) '
    const singleTjMatches = block.matchAll(/\((?:\\.|[^\\()])*\)\s*(?:Tj|')/g);
    for (const match of singleTjMatches) {
      const parenEnd = match[0].lastIndexOf(')');
      if (parenEnd > 0) {
        const content = match[0].slice(1, parenEnd);
        pieces.push(decodePdfLiteralString(content));
      }
    }
  }

  return pieces
    .join('\n')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim();
};

/**
 * Tente de décompresser un flux binaire FlateDecode via l'API Web standard `DecompressionStream`.
 */
const tryInflatePdfStream = async (bytes: Uint8Array): Promise<string | null> => {
  if (typeof DecompressionStream === 'undefined' || bytes.byteLength < 2) {
    return null;
  }

  for (const format of ['deflate', 'deflate-raw'] as const) {
    try {
      const ds = new DecompressionStream(format);
      const writer = ds.writable.getWriter();
      const writePromise = writer
        .write(new Uint8Array(bytes))
        .then(() => writer.close())
        .catch(() => {});
      const response = new Response(ds.readable);
      const arrayBuffer = await response.arrayBuffer();
      await writePromise;
      const decoded = new TextDecoder('latin1').decode(arrayBuffer);
      if (decoded && decoded.trim()) {
        return decoded;
      }
    } catch {
      // Essayer le format suivant
    }
  }

  return null;
};

/**
 * Extrait le texte natif d'un fichier PDF à partir de son `ArrayBuffer` ou `Uint8Array`.
 * Supporte les flux PDF non compressés ainsi que les flux compressés `FlateDecode`.
 */
export const extractTextFromPdfBuffer = async (
  buffer: ArrayBuffer | Uint8Array
): Promise<string> => {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  if (bytes.byteLength === 0) return '';

  const rawLatin1 = new TextDecoder('latin1').decode(bytes);
  const extractedSections: string[] = [];

  // 1. Extraire les opérateurs texte directement visibles en clair
  const directText = extractTextOperatorsFromPdfChunk(rawLatin1);
  if (directText) {
    extractedSections.push(directText);
  }

  // 2. Parcourir les flux compressés `FlateDecode` (`stream ... endstream`)
  const streamRegex = /stream\r?\n/g;
  let match: RegExpExecArray | null;
  let streamCount = 0;

  while ((match = streamRegex.exec(rawLatin1)) !== null && streamCount < 40) {
    streamCount++;
    const headerStart = Math.max(0, match.index - 250);
    const dictHeader = rawLatin1.slice(headerStart, match.index);
    if (!/\/FlateDecode\b/i.test(dictHeader)) {
      continue;
    }

    const startOffset = match.index + match[0].length;
    const endIdx = rawLatin1.indexOf('endstream', startOffset);
    if (endIdx === -1) break;

    let streamEnd = endIdx;
    if (rawLatin1[streamEnd - 1] === '\n') streamEnd--;
    if (rawLatin1[streamEnd - 1] === '\r') streamEnd--;

    if (streamEnd > startOffset && streamEnd - startOffset <= 2 * 1024 * 1024) {
      const subBytes = bytes.subarray(startOffset, streamEnd);
      const inflated = await tryInflatePdfStream(subBytes);
      if (inflated) {
        const textFromStream = extractTextOperatorsFromPdfChunk(inflated);
        if (textFromStream) {
          extractedSections.push(textFromStream);
        }
      }
    }
  }

  return extractedSections.join('\n').trim();
};

/**
 * Extrait le texte natif d'un objet `File` ou `Blob` PDF.
 */
export const extractTextFromPdfFile = async (file: Blob): Promise<string> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    return await extractTextFromPdfBuffer(arrayBuffer);
  } catch {
    return '';
  }
};
