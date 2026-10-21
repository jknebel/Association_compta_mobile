# 📱 AssoCompta Scan (`Association_compta_mobile`) — Web App Mobile (PWA)

Application **Web Mobile (PWA — Progressive Web App)** en **React + TypeScript + Vite + Tailwind**, connectée au même projet Firebase qu'[**AssoCompta AI**](https://github.com/jknebel/Association_compta).

> **💡 Zéro Store, 0 CHF, Installable en raccourci sur iPhone & Android :**
> L'application s'ouvre depuis un simple lien ou QR code et intègre un **bouton « 📲 Installer l'application »** qui crée une icône plein écran sur l'écran d'accueil du téléphone (Android & iPhone), sans avoir besoin de passer par l'App Store d'Apple ni le Google Play Store.

---

## ✨ Fonctionnalités Cibles

- **a) Authentification partagée** : Connexion avec le même compte Firebase Auth qu'`AssoCompta AI` (vérification de l'email et de l'appartenance à l'association).
- **b) Rôle minimal `uploader` (« Déposant de factures »)** : Le comptable/caissier d'une comptabilité peut attribuer ce rôle minimal à un membre pour lui donner uniquement le lien avec la comptabilité donnée.
- **c) Sélection de la comptabilité & du type de dépense** :
  - Choix de la comptabilité cible (ex. *Louveteaux 26-27*, *Pionnier 26-27*, *Groupe 25-26*).
  - Choix du mode : **`💳 Carte de débit`** ou **`💶 Demande de remboursement`**.
- **d) Prise de photo native & OCR IA automatique** :
  - Ouverture directe de l'appareil photo du téléphone (`capture="environment"`) ou sélection depuis la galerie.
  - Extraction automatique du **Montant TTC** et de la **Date** via OCR (Gemini Flash), présentés à l'utilisateur pour vérification/correction avant envoi.
- **e) Synchronisation temps réel** :
  - Upload dans Firebase Storage (`/receipts/{orgId}/{comptaId}/...`) et création du document dans Firestore (`organizations/{orgId}/comptabilites/{comptaId}/receipts`).
  - Apparition immédiate dans l'onglet **Pièces Justificatives** de l'application web.
- **f) Réaffectation inter-comptabilités** :
  - Si une pièce est déposée dans la mauvaise comptabilité, le comptable peut la transférer vers une autre comptabilité avec un mécanisme de confirmation.
- **g) Bouton « 📲 Installer l'application / Créer un raccourci » (`MOB-09`)** :
  - Sur **Android** : déclenche l'installation native PWA en 1 clic (`beforeinstallprompt`).
  - Sur **iPhone (Safari)** : affiche une bulle guidée (*Partager `⬆️` -> Sur l'écran d'accueil `➕`*) pour créer le raccourci plein écran.

---

## 🗂️ Structure du Dépôt

```text
Association_compta_mobile/
├── index.html                      # Entrée HTML mobile + balises PWA plein écran iOS/Android
├── public/
│   └── manifest.json               # Manifeste Web App (icône écran d'accueil, mode standalone)
├── vite.config.ts                  # Configuration Vite + PWA
├── package.json                    # Dépendances React / TypeScript / Firebase / Tailwind
├── tsconfig.json                   # Configuration TypeScript stricte
├── .env.example                    # Modèle des variables d'environnement Firebase
├── docs/
│   ├── PLAN_ET_ARCHITECTURE.md     # Architecture complète & ordre des tickets
│   └── GUIDE_DISTRIBUTION_UTILISATEURS.md # Guide d'installation du raccourci PWA sur iPhone & Android
└── src/
    ├── main.tsx                    # Bootstrap React
    ├── App.tsx                     # Composant racine
    ├── config/
    │   └── firebase.ts             # Initialisation Firebase Auth / Firestore / Storage (MOB-02)
    ├── types/
    │   └── receipt.ts              # Interfaces partagées avec AssoCompta AI (Receipt, ComptaRole, etc.)
    ├── services/                   # Services Firebase, OCR et compression d'image (MOB-03 à MOB-07)
    ├── screens/                    # Écrans Login, Scan/Vérification, Historique (MOB-02, MOB-06, MOB-08)
    └── components/                 # Composants UI + Bouton d'installation PWA (MOB-09)
```

---

## 🚀 Démarrage Rapide (Pour les Développeurs)

```bash
git clone https://github.com/jknebel/Association_compta_mobile.git
cd Association_compta_mobile
npm install
cp .env.example .env
npm run dev
```

---

## 🎫 Backlog & Tickets Juniors

Tous les tickets de développement sont disponibles dans l'onglet [**Issues**](https://github.com/jknebel/Association_compta_mobile/issues) de ce dépôt :
- **EPIC 1 (`WEB-01` à `WEB-03`)** : Préparation côté Web (`Association_compta` — rôle `uploader`, affichage `ReceiptsView`, transfert inter-comptabilités).
- **EPIC 2 (`MOB-01` à `MOB-03`, `MOB-09`)** : Socle Web App Mobile (PWA), Bouton *« Installer l'application / Créer un raccourci »*, Auth Firebase & Comptabilités autorisées.
- **EPIC 3 (`MOB-04` à `MOB-06`)** : Caméra mobile (`capture="environment"`), compression Canvas, OCR IA (Montant + Date) & Écran de vérification.
- **EPIC 4 (`MOB-07`, `MOB-08`, `SEC-01`)** : Upload Firebase Storage/Firestore, Historique des remboursements & Règles de sécurité Firebase.
