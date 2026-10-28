# 📱💻 AssoCompta Justificatifs (`Association_compta_mobile`) — Web App Mobile & PC (PWA)

Application **Web Universelle (Mobile PWA & Bureau PC)** en **React + TypeScript + Vite + Tailwind**, connectée au même projet Firebase qu'[**AssoCompta AI**](https://github.com/jknebel/Association_compta) (branche `ameliorationv2`).

> **💡 Zéro Store, 0 CHF, utilisable sur iPhone, Android et PC :**
> L'application s'ouvre depuis un simple lien web (2e adresse Firebase Hosting du même projet Firebase) et intègre un **bouton « 📲 Installer l'application »** qui crée une icône plein écran sur l'écran d'accueil du téléphone (Android & iPhone) ou sur le bureau PC.

---

## ✨ Fonctionnalités Implémentées (14/14 Tickets Complétés)

- **1. Authentification partagée (`MOB-02`)** : Connexion Google ou Email/Mot de passe sur le même projet Firebase Auth qu'`AssoCompta AI`.
- **2. Rôle minimal `uploader` (« Déposant de justificatifs ») (`WEB-01`, `SEC-01`)** : Permet à un membre d'envoyer des justificatifs dans les comptabilités autorisées et de suivre ses demandes de remboursement, sans aucun accès aux écritures bancaires.
- **3. Sélection intelligente de la comptabilité (`MOB-03`)** : Liste uniquement les comptabilités où l'utilisateur possède un rôle (`uploader`, `caissier`, `admin`), sélectionne automatiquement s'il n'y en a qu'une, et mémorise la dernière comptabilité choisie.
- **4. Capture Photo, Galerie & Import PDF + Drag & Drop PC (`MOB-04`, `MOB-09`)** :
  - **Sur Mobile** : Caméra arrière (`capture="environment"`), Galerie photos, ou Import de facture `.pdf`. Compression automatique `< 800 Ko` pour les photos.
  - **Sur PC / Mac** : Mise en page 2 colonnes avec grande zone de **Glisser-Déposer (`Drag & Drop`)** pour déposer ses factures PDF ou images reçues par e-mail.
- **5. Extraction IA & Lecture native des PDF (`MOB-05`)** :
  - Extraction locale instantanée du texte des PDF numériques + analyse **Gemini 2.5 Flash** pour pré-remplir la **Date**, le **Montant TTC (CHF)** et le **Fournisseur**.
- **6. Choix Carte vs À Rembourser + Mémorisation de l'IBAN (`MOB-06`)** :
  - Choix obligatoire entre **`💳 Payé avec la carte`** (`DEBIT_CARD`) et **`💶 À rembourser`** (`REIMBURSEMENT`).
  - En mode **`💶 À rembourser`**, saisie et validation de l'**IBAN** (Suisse `CH`/`LI` 21 caractères ou international), mémorisé dans le profil utilisateur (`users/{uid}.reimbursementIban`) et pré-rempli automatiquement aux envois suivants.
- **7. Envoi atomique Storage + Firestore & Historique temps réel (`MOB-07`, `MOB-08`)** :
  - Upload dans Firebase Storage (`receipts/{orgId}/{comptaId}/...`) et écriture Firestore (`organizations/{orgId}/comptabilites/{comptaId}/receipts/...`).
  - Suivi en direct du statut : `⏳ En attente de remboursement` -> `✅ Remboursé`, ou `🔄 En cours de transfert`.
- **8. Côté Comptabilité Web (`WEB-02`, `WEB-03`, `WEB-04`)** :
  - **Onglet « Remboursements » dédié** : affiche toutes les demandes `💶 À rembourser` avec **Nom, Prénom, E-mail, IBAN copiable**, aperçu du justificatif (Image/PDF) et bouton **Biffer (`✅ Remboursé`)** lorsque le virement est fait.
  - **Rapprochement bancaire intelligent** :
    - Pour **`💳 Payé avec la carte`** : rapprochement sur le **jour même (`J`) ou le jour suivant (`J+1`)**.
    - Pour **`💶 À rembourser`** : ignore l'écart entre la date de la facture et la date du virement de remboursement, et privilégie la correspondance sur le **montant + Nom/Prénom/E-mail** du membre.
  - **Transfert inter-comptabilités** : permet au caissier de réaffecter en 2 clics un justificatif envoyé par erreur dans la mauvaise comptabilité.

---

## 🛠️ Guide Pas-à-Pas : Tester & Déployer sur Firebase Hosting

### 1. Architecture : 1 seul projet Firebase, 2 adresses Web
Vous n'avez **pas** besoin de créer un nouveau projet Firebase. Les deux applications partagent le même projet Firebase (Auth, Firestore, Storage) via deux sites Firebase Hosting :
- **Site 1 (Comptabilité complète)** : `https://TON-PROJET.web.app` (dépôt `Association_compta`, branche `ameliorationv2`)
- **Site 2 (Web App Justificatifs Mobile & PC)** : `https://TON-PROJET-justificatifs.web.app` (ce dépôt `Association_compta_mobile`, branche `main`)

---

### 2. Installation & Configuration locale (`.env`)

```powershell
git clone https://github.com/jknebel/Association_compta_mobile.git
cd Association_compta_mobile
npm install
cp .env.example .env
```

Ouvrez le fichier `.env` et renseignez **exactement les mêmes clés Firebase** que celles de votre projet `Association_compta` :

```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=ton-projet.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=ton-projet
VITE_FIREBASE_STORAGE_BUCKET=ton-projet.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=1234567890
VITE_FIREBASE_APP_ID=1:1234567890:web:abcdef123456
VITE_GEMINI_API_KEY=AIzaSy...
```

---

### 3. Tester immédiatement en local (PC + Téléphone en Wi-Fi)

```powershell
npm run dev
```

- **Sur votre PC** : ouvrez `http://localhost:5173` (interface Bureau 2 colonnes avec Glisser-Déposer PDF/Image).
- **Sur votre téléphone** (connecté au même Wi-Fi) : ouvrez l'adresse `Network: http://192.168.x.x:5173` affichée dans le terminal.
- *Astuce : sans fichier `.env`, un bouton **« Continuer en mode démo local »** permet de tester toute l'interface hors-ligne.*

---

### 4. Déployer en Production sur une 2e adresse Firebase Hosting

Le fichier [`firebase.json`](./firebase.json) est déjà configuré dans ce dépôt avec la cible `mobile`.

#### Étape 4.1 — Déployer les règles Firestore & Storage (`SEC-01`) depuis `Association_compta`
Depuis le dépôt principal `Association_compta` (branche `ameliorationv2`) :
```powershell
cd ../Association_compta
git checkout ameliorationv2
git pull origin ameliorationv2
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules,storage --project TON_PROJECT_ID
```

#### Étape 4.2 — Créer le 2e site Firebase Hosting et déployer `Association_compta_mobile`
Revenez dans `Association_compta_mobile` :
```powershell
cd ../Association_compta_mobile

# 1. Créer le second site web dans votre projet Firebase (à ne faire qu'une seule fois)
npx firebase-tools hosting:sites:create ton-projet-justificatifs --project TON_PROJECT_ID

# 2. Lier la cible "mobile" de firebase.json à ce site
npx firebase-tools target:apply hosting mobile ton-projet-justificatifs --project TON_PROJECT_ID

# 3. Compiler et déployer la Web App
npm run build
npx firebase-tools deploy --only hosting:mobile --project TON_PROJECT_ID
```

#### Étape 4.3 — Autoriser le domaine pour la connexion Google
Dans la [Console Firebase](https://console.firebase.google.com/) -> **Authentication** -> **Settings** -> **Authorized domains (Domaines autorisés)**, vérifiez que `ton-projet-justificatifs.web.app` est présent dans la liste.

---

### 5. Installer la Web App sur votre Téléphone (iPhone / Android)

Ouvrez `https://ton-projet-justificatifs.web.app` sur votre téléphone :
- **Sur Android (Chrome)** : appuyez sur le bouton **« 📲 Installer l'application »** en haut de l'écran.
- **Sur iPhone (Safari)** : appuyez sur **Partager `⬆️`** puis **« Sur l'écran d'accueil `➕` »**.

---

## 🧪 Tests Automatisés

```powershell
# Exécuter les suites de tests unitaires (Node native TypeScript runner)
node --experimental-transform-types --test src/services/__tests__/*.test.mjs
```

Consultez également [`GUIDE_DEPLOIEMENT_FIREBASE.md`](./GUIDE_DEPLOIEMENT_FIREBASE.md) pour le guide détaillé exportable.
