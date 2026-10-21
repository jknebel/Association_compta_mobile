# Architecture & Plan de Déploiement — AssoCompta Scan

Ce document détaille l'architecture partagée entre le dépôt Web (`jknebel/Association_compta`) et ce dépôt Mobile (`jknebel/Association_compta_mobile`).

## 1. Principe Clé : Même Projet Firebase

L'application mobile se connecte **au même projet Firebase** que l'application web :
- **Firebase Authentication** : Les membres utilisent leurs identifiants existants.
- **Cloud Firestore** :
  - Lecture des droits dans `organizations/{orgId}/members/{uid}`.
  - Écriture des pièces justificatives dans `organizations/{orgId}/comptabilites/{comptaId}/receipts/{receiptId}`.
- **Firebase Storage** :
  - Stockage des photos compressées dans `/receipts/{orgId}/{comptaId}/{timestamp}_{fileName}.jpg`.

## 2. Ordre de Réalisation des Tickets (Issues GitHub)

1. **Semaine 1 (Web + Socle Mobile)** :
   - `WEB-01` : Rôle minimal `uploader` (« Déposant de factures »)
   - `WEB-02` : Badges `Carte de débit` / `À rembourser` dans `ReceiptsView.tsx`
   - `WEB-03` : Transfert d'une pièce justificative vers une autre comptabilité avec confirmation
   - `MOB-01` : Navigation & Thème sombre React Native
   - `MOB-02` : Authentification Firebase Auth avec persistance `AsyncStorage`
2. **Semaine 2 (Fonctionnalités Cœur Mobile)** :
   - `MOB-03` : Récupération des comptabilités autorisées pour l'utilisateur connecté
   - `MOB-04` : Prise de photo caméra / galerie & compression JPEG (< 400 Ko)
   - `MOB-05` : Extraction OCR IA automatique (Montant TTC + Date du ticket)
3. **Semaine 3 (Vérification, Envoi & Sécurité)** :
   - `MOB-06` : Écran de vérification utilisateur (Montant, Date, Comptabilité, Carte vs Remboursement, IBAN mémorisé)
   - `MOB-07` : Upload Firebase Storage + création temps réel dans Firestore
   - `MOB-08` : Onglet « Mes envois & Mes remboursements »
   - `SEC-01` : Règles de sécurité `firestore.rules` & `storage.rules` pour le rôle `uploader`
