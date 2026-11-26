/**
 * SEC-15 helpers: Firebase ID token sanitization, Authorization: Bearer header construction,
 * Blob->Base64 conversion, and authenticated POST /analyze-receipt execution.
 */

export const sanitizeBearerToken = (token?: string | null): string | null => {
  if (typeof token !== 'string') return null;
  const trimmed = token.trim();
  if (!trimmed || /[\r\n\0]/.test(trimmed)) {
    return null;
  }
  return trimmed;
};

export const buildAnalyzeReceiptHeaders = (idToken?: string | null): Record<string, string> => {
  const cleanToken = sanitizeBearerToken(idToken);
  return {
    'Content-Type': 'application/json',
    ...(cleanToken ? { Authorization: `Bearer ${cleanToken}` } : {}),
  };
};

export const normalizeBackendBaseUrl = (
  configuredUrl: string | undefined,
  defaultUrl: string
): string => {
  const raw = typeof configuredUrl === 'string' && configuredUrl.trim() ? configuredUrl.trim() : defaultUrl;
  return raw.replace(/\/+$/, '');
};

export const blobToBase64Pure = async (file: Blob): Promise<string> => {
  if (typeof file?.arrayBuffer === 'function') {
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }
  if (typeof FileReader !== 'undefined') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = typeof reader.result === 'string' ? reader.result : '';
        const commaIdx = result.indexOf(',');
        resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
      };
      reader.onerror = () => reject(new Error('Impossible de lire le fichier pour analyse.'));
      reader.readAsDataURL(file);
    });
  }
  throw new Error('Impossible de lire le fichier pour analyse.');
};

export interface AnalyzeVisionRequestParams {
  file: Blob;
  mimeType: string;
  backendUrl: string;
  getIdToken?: () => Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
}

export interface AnalyzeVisionBackendPayload {
  date?: string | null;
  amount?: number | string | null;
  merchantName?: string | null;
}

export const requestBackendReceiptAnalysis = async (
  params: AnalyzeVisionRequestParams
): Promise<AnalyzeVisionBackendPayload> => {
  const base64Data = await blobToBase64Pure(params.file);
  let idToken: string | null | undefined = null;
  if (typeof params.getIdToken === 'function') {
    try {
      idToken = await params.getIdToken();
    } catch {
      idToken = null;
    }
  }

  const fetchFn = params.fetchImpl ?? fetch;
  const targetUrl = `${params.backendUrl.replace(/\/+$/, '')}/analyze-receipt`;
  const headers = buildAnalyzeReceiptHeaders(idToken);

  const response = await fetchFn(targetUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({ base64Data, mimeType: params.mimeType }),
  });

  if (!response.ok) {
    throw new Error(`Erreur backend (${response.status})`);
  }

  return (await response.json()) as AnalyzeVisionBackendPayload;
};

export interface NotifyInvoicePaymentParams {
  orgId: string;
  comptaId: string;
  receiptId: string;
  backendUrl: string;
  getIdToken?: () => Promise<string | null | undefined>;
  fetchImpl?: typeof fetch;
}

export const requestInvoicePaymentNotification = async (
  params: NotifyInvoicePaymentParams
): Promise<boolean> => {
  const orgId = typeof params?.orgId === 'string' ? params.orgId.trim() : '';
  const comptaId = typeof params?.comptaId === 'string' ? params.comptaId.trim() : '';
  const receiptId = typeof params?.receiptId === 'string' ? params.receiptId.trim() : '';
  if (!orgId || !comptaId || !receiptId) {
    return false;
  }

  let idToken: string | null | undefined = null;
  if (typeof params.getIdToken === 'function') {
    try {
      idToken = await params.getIdToken();
    } catch {
      idToken = null;
    }
  }
  const cleanToken = sanitizeBearerToken(idToken);
  if (!cleanToken) {
    return false;
  }

  const fetchFn = params.fetchImpl ?? fetch;
  const targetUrl = `${params.backendUrl.replace(/\/+$/, '')}/api/notify-invoice-payment`;
  try {
    const response = await fetchFn(targetUrl, {
      method: 'POST',
      headers: buildAnalyzeReceiptHeaders(cleanToken),
      body: JSON.stringify({ orgId, comptaId, receiptId }),
    });
    return response.ok;
  } catch {
    return false;
  }
};
