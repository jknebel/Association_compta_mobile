# 📲 Guide : Installation de la Web App Mobile (PWA) par les Membres (Sans Apple / Google Store)

Grâce à l'architecture **PWA (Progressive Web App)**, vous n'avez **aucun compte Apple Developer (99 \$/an) ni Google Play (25 \$) à payer**, et aucune validation de Store à attendre.

---

## 1. Comment les membres reçoivent-ils l'application ?

1. Le caissier ou l'administrateur attribue le rôle **`📸 Déposant de factures`** (ou un autre rôle) au membre dans `AssoCompta AI`.
2. Le membre scanne le **QR Code** (affiché dans `AssoCompta AI` ou envoyé sur le groupe WhatsApp / email de l'association) ou ouvre l'URL de la Web App sur son téléphone.

---

## 2. Comment fonctionne le bouton « 📲 Installer l'application (Créer un raccourci) » ? (Ticket `MOB-09`)

Tant que l'application est ouverte dans le navigateur normal (Chrome ou Safari) et non depuis l'icône de l'écran d'accueil, une bannière ou un bouton bien visible **« 📲 Installer l'application sur mon téléphone »** s'affiche en haut de l'écran :

### 🤖 Sur Android (Chrome / Samsung Internet)
1. Le membre clique sur le bouton **« 📲 Installer l'application »**.
2. La boîte de dialogue officielle d'Android s'ouvre automatiquement (`beforeinstallprompt`).
3. Le membre appuie sur **« Installer »** -> L'icône **AssoCompta Scan** est créée sur son écran d'accueil et dans son tiroir d'applications !

### 🍎 Sur iPhone (iOS Safari)
1. Le membre clique sur le bouton **« 📲 Installer l'application »**.
2. Une modale illustrée avec une flèche vers le bas de l'écran lui indique les 2 gestes simples :
   - **Étape 1** : Appuyer sur l'icône **Partager** (`⬆️`) en bas de Safari.
   - **Étape 2** : Faire défiler et appuyer sur **« Sur l'écran d'accueil » (`➕`)** puis **« Ajouter »**.
3. L'icône **AssoCompta Scan** est créée sur l'écran d'accueil de son iPhone !

---

## 3. Que se passe-t-il une fois le raccourci créé ?

- Quand le membre touche l'icône **AssoCompta Scan** sur son téléphone :
  - L'application s'ouvre **en plein écran** (`display-mode: standalone`), sans barre d'adresse Safari/Chrome.
  - Le bouton *« Installer l'application »* se masque automatiquement puisque l'application détecte qu'elle tourne déjà en mode installé (`window.matchMedia('(display-mode: standalone)').matches`).
  - Sa session Firebase reste connectée en permanence.
  - Chaque mise à jour que vous déployez sur **Firebase Hosting** est disponible **instantanément** pour tous les membres dès qu'ils ouvrent leur raccourci !
