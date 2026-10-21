# Architecture & Plan de Déploiement — AssoCompta Scan (Web App Mobile / PWA)

Ce document détaille l'architecture partagée entre le dépôt principal (`jknebel/Association_compta`) et ce dépôt Mobile PWA (`jknebel/Association_compta_mobile`).

## 1. Principe Clé : Web App Mobile (PWA) + Même Projet Firebase (0 CHF)

Plutôt que de passer par l'App Store d'Apple (99 \$/an) et le Google Play Store (25 \$), **AssoCompta Scan** est conçu comme une **Progressive Web App (PWA) mobile-first** hébergée gratuitement sur **Firebase Hosting** :
- **Bouton « 📲 Installer l'application » intégré (`MOB-09`)** : permet à chaque membre de créer l'icône/raccourci de l'application sur l'écran d'accueil de son iPhone ou de son Android. Une fois lancée depuis l'icône, elle s'ouvre en plein écran (`display: standalone`) sans barre de navigateur.
- **Appareil photo natif** : ouverture directe de la caméra arrière via `<input type="file" accept="image/*" capture="environment" />`.
- **Même projet Firebase** : partage en temps réel de Firebase Auth, Cloud Firestore et Firebase Storage avec l'application web comptable.

## 2. Ordre de Réalisation des Tickets (Issues GitHub)

1. **Semaine 1 (Web + Socle PWA)** :
   - `WEB-01` : Rôle minimal `uploader` (« Déposant de factures »)
   - `WEB-02` : Badges `Carte de débit` / `À rembourser` dans `ReceiptsView.tsx`
   - `WEB-03` : Transfert d'une pièce justificative vers une autre comptabilité avec confirmation
   - `MOB-01` : Navigation mobile-first (`Bottom Tabs`) & Thème sombre
   - `MOB-02` : Authentification Firebase Auth & persistance de session
   - `MOB-09` : Bouton **« 📲 Installer l'application / Créer un raccourci »** (Android `beforeinstallprompt` + guide visuel iPhone Safari)
2. **Semaine 2 (Fonctionnalités Cœur Mobile)** :
   - `MOB-03` : Récupération des comptabilités autorisées pour l'utilisateur connecté
   - `MOB-04` : Prise de photo caméra mobile & compression d'image HTML5 Canvas (< 400 Ko)
   - `MOB-05` : Extraction OCR IA automatique (Montant TTC + Date du ticket)
3. **Semaine 3 (Vérification, Envoi & Sécurité)** :
   - `MOB-06` : Écran de vérification utilisateur (Montant, Date, Comptabilité, Carte vs Remboursement, IBAN mémorisé)
   - `MOB-07` : Upload Firebase Storage + création temps réel dans Firestore
   - `MOB-08` : Onglet « Mes envois & Mes remboursements »
   - `SEC-01` : Règles de sécurité `firestore.rules` & `storage.rules` pour le rôle `uploader`
