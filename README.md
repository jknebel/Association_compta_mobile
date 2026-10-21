# 📱 AssoCompta Scan (`Association_compta_mobile`)

Application mobile **React Native (Expo — iOS & Android)** connectée au projet Firebase d'[**AssoCompta AI**](https://github.com/jknebel/Association_compta).

Elle permet aux membres et responsables d'une association de :
1. **💶 Faire une demande de remboursement** (avance de frais personnelle) avec photo du justificatif.
2. **💳 Déposer un justificatif pour une dépense payée avec la carte de débit** du compte de l'association.

---

## ✨ Fonctionnalités Cibles

- **a) Authentification partagée** : Connexion avec le même compte Firebase Auth qu'`AssoCompta AI` (vérification de l'email et de l'appartenance à l'association).
- **b) Rôle minimal `uploader` (« Déposant de factures »)** : Le comptable/caissier d'une comptabilité peut attribuer ce rôle minimal à un membre pour lui donner uniquement le droit d'envoyer des pièces justificatives dans cette comptabilité.
- **c) Sélection de la comptabilité & du type de dépense** :
  - Choix de la comptabilité cible (ex. *Louveteaux 26-27*, *Pionnier 26-27*, *Groupe 25-26*).
  - Choix du mode : **`💳 Carte de débit`** ou **`💶 Demande de remboursement`**.
- **d) Prise de photo & OCR IA automatique** :
  - Photo du ticket de caisse ou sélection depuis la galerie.
  - Extraction automatique du **Montant TTC** et de la **Date** via OCR, présentés à l'utilisateur pour vérification/correction avant envoi.
- **e) Synchronisation temps réel** :
  - Upload dans Firebase Storage (`/receipts/{orgId}/{comptaId}/...`) et création du document dans Firestore (`organizations/{orgId}/comptabilites/{comptaId}/receipts`).
  - Apparition immédiate dans l'onglet **Pièces Justificatives** de l'application web.
- **f) Réaffectation inter-comptabilités** :
  - Si une pièce est déposée dans la mauvaise comptabilité, le comptable peut la transférer vers une autre comptabilité avec un mécanisme de confirmation.

---

## 🗂️ Structure du Dépôt

```text
Association_compta_mobile/
├── App.tsx                         # Point d'entrée de l'application Expo
├── app.json                        # Configuration Expo (iOS / Android, permissions caméra)
├── eas.json                        # Profils de build EAS (development, preview APK, production)
├── package.json                    # Dépendances React Native / Expo / Firebase
├── tsconfig.json                   # Configuration TypeScript stricte
├── .env.example                    # Modèle des variables d'environnement Firebase
├── docs/
│   └── PLAN_ET_ARCHITECTURE.md     # Architecture complète, modèle Firestore & plan de déploiement
└── src/
    ├── config/
    │   └── firebase.ts             # Initialisation Firebase Auth / Firestore / Storage (à compléter - MOB-02)
    ├── types/
    │   └── receipt.ts              # Interfaces partagées avec AssoCompta AI (Receipt, ComptaRole, etc.)
    ├── services/                   # Services Firebase, OCR et compression d'image (MOB-03 à MOB-07)
    ├── screens/                    # Écrans Login, Scan/Vérification, Historique (MOB-02, MOB-06, MOB-08)
    └── components/                 # Composants UI réutilisables
```

---

## 🚀 Démarrage Rapide (Pour les Développeurs)

### 1. Prérequis
- **Node.js 20+**
- Application **Expo Go** installée sur votre téléphone (iOS / Android) ou un émulateur Android Studio / Xcode.

### 2. Installation
```bash
git clone https://github.com/jknebel/Association_compta_mobile.git
cd Association_compta_mobile
npm install
```

### 3. Configuration Firebase
Copiez le fichier `.env.example` en `.env` et renseignez les clés du projet Firebase **Staging/Test** d'`AssoCompta AI` :
```bash
cp .env.example .env
```

### 4. Lancer l'application
```bash
npx expo start
```

---

## 🎫 Backlog & Tickets Juniors

Tous les tickets de développement sont disponibles dans l'onglet [**Issues**](https://github.com/jknebel/Association_compta_mobile/issues) de ce dépôt :
- **EPIC 1 (`WEB-01` à `WEB-03`)** : Préparation côté Web (`Association_compta` — rôle `uploader`, affichage `ReceiptsView`, transfert inter-comptabilités).
- **EPIC 2 (`MOB-01` à `MOB-03`)** : Socle Mobile Expo, Authentification Firebase & Liste des comptabilités autorisées.
- **EPIC 3 (`MOB-04` à `MOB-06`)** : Caméra, compression d'image, OCR IA (Montant + Date) & Écran de vérification.
- **EPIC 4 (`MOB-07`, `MOB-08`, `SEC-01`)** : Upload Firebase Storage/Firestore, Historique des remboursements & Règles de sécurité Firebase.
