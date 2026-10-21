# 📦 Guide : Comment transmettre l'application aux membres ? (Firebase vs Apple App Store & Google Play)

Le choix du canal de distribution dépend d'une réalité technique importante : **Android est ouvert**, tandis qu'**Apple (iOS) verrouille strictement l'installation d'applications hors de son écosystème**.

---

## 1. Comparatif Direct : Firebase App Distribution vs Stores Officiels

| Critère | 🔥 Firebase App Distribution | 🏪 Google Play Store + Apple App Store / TestFlight | ⚡ Expo Go (EAS Update) |
| :--- | :--- | :--- | :--- |
| **Coût** | **0 CHF** sur Android *(mais exige quand même le compte Apple à 99 $/an sur iPhone !)* | **Google Play** : 25 $ une seule fois à vie<br>**Apple** : 99 $/an *(gratuit possible pour association à but non lucratif)* | **0 CHF** (100% gratuit sur Android et iPhone) |
| **Expérience utilisateur sur Android** | ⭐⭐⭐⭐☆ Très simple (lien par email -> téléchargement APK -> *"Autoriser cette source"*) | ⭐⭐⭐⭐⭐ Parfait (1 clic dans le Play Store, mises à jour automatiques) | ⭐⭐⭐⭐☆ Installer *Expo Go* sur le Store puis scanner le QR code de l'asso |
| **Expérience utilisateur sur iPhone (iOS)** | ⭐☆☆☆☆ **Très complexe** : Apple oblige chaque membre à trouver l'`UDID` de son iPhone, vous l'envoyer, et vous devez **recompiler l'app** pour chaque nouvel iPhone ! | ⭐⭐⭐⭐⭐ **Parfait** : installation en 1 clic sur l'App Store ou via un simple lien **TestFlight**, sans jamais demander l'UDID ! | ⭐⭐⭐⭐☆ Installer *Expo Go* sur l'App Store puis ouvrir le lien de l'association |
| **Validation par Apple / Google** | Aucune validation (instantané) | **TestFlight / Google Play Interne** : 1h à 24h (très souple)<br>**Stores Publics** : 1 à 3 jours | Aucune validation (instantané) |
| **Mises à jour** | Le membre reçoit un email et doit réinstaller l'APK | **100% automatiques** en arrière-plan | **100% automatiques** à l'ouverture de l'app |

---

## 2. Pourquoi « Firebase seul » pose problème sur iPhone (iOS)

Beaucoup d'équipes pensent pouvoir distribuer une application iOS via **Firebase App Distribution** aussi facilement que sur Android. En réalité :
- **Sur Android**, Firebase génère un fichier `.apk` que n'importe quel membre peut installer en 30 secondes.
- **Sur iPhone**, Apple interdit d'installer une application issue de Firebase sauf si le numéro de série matériel unique (`UDID`) de l'iPhone du membre a été manuellement ajouté dans votre compte Apple Developer **avant** de compiler l'application (profil *Ad Hoc*, limité à 100 appareils).
- **Conclusion** : Pour des membres d'association (chefs, caissiers, parents) qui ont des iPhones, **Firebase App Distribution est trop compliqué**. Il faut utiliser **TestFlight / App Store** (ou **Expo Go** pendant la phase initiale).

---

## 3. La Stratégie Recommandée en 3 Phases pour votre Association

### 🟢 Phase 1 (Développement & Premiers Tests — Coût : 0 CHF)
- **Sur Android** : **Firebase App Distribution** (envoi automatique de l'APK aux testeurs à chaque nouveauté).
- **Sur iPhone** : Application gratuite **Expo Go** (disponible sur l'App Store). Vos testeurs iPhone scannent simplement un QR code et utilisent l'application immédiatement sans que vous ayez à payer un compte Apple Developer pendant le développement des juniors.

### 🟡 Phase 2 (Déploiement aux membres de l'association — Le meilleur compromis « Zéro tracas »)
Plutôt que de publier l'application au grand public mondial (ce qui demande des captures d'écran marketing, une politique de confidentialité publique stricte et un compte de démo pour les inspecteurs d'Apple), utilisez les **canaux privés officiels des Stores** :
1. **Sur iPhone -> Apple TestFlight (Lien Public d'invitation)** :
   - Vous générez un lien unique (ex. `https://testflight.apple.com/join/AbCdEf`).
   - Vous mettez ce lien ou son QR code dans l'application web `AssoCompta AI`.
   - Jusqu'à **10 000 membres** peuvent installer l'application en 1 clic sur leur iPhone, sans donner leur UDID, et avec une vérification Apple ultra-allégée (< 24h).
2. **Sur Android -> Google Play Console (Piste « Tests fermés / Internes ») OU Firebase App Distribution** :
   - Avec Google Play (25 $ une seule fois), les membres téléchargent l'application directement depuis le Google Play Store officiel (sans message d'alerte *"Source inconnue"* sur leur téléphone) et reçoivent les mises à jour automatiquement.

### 🔵 Phase 3 (Publication Grand Public sur App Store & Google Play Store)
Une fois l'application rodée au sein du groupe :
- Vous basculez en **1 clic** la version TestFlight vers l'**App Store public** et la version Google Play vers la **Production publique**.
- N'importe quel membre tape **« AssoCompta Scan »** dans l'App Store ou le Play Store et l'installe comme n'importe quelle application bancaire.

---

## 💡 Bon à savoir : Gratuité du compte Apple Developer pour une Association (99 $/an -> 0 $)
Apple propose un programme officiel d'**exonération des frais de 99 $/an pour les organisations à but non lucratif (associations suisses incluses)** :
- Lien : [Apple Developer Program Fee Waivers](https://developer.apple.com/support/Membership-Fee-Waiver/)
- Il suffit que l'association possède un numéro **D-U-N-S** (gratuit) et ses statuts d'association à but non lucratif pour que le compte Apple Developer soit **100 % gratuit** chaque année.

---

## 🔗 Comment transmettre concrètement l'application aux utilisateurs depuis le Web ?

Nous ajouterons directement dans l'interface web d'`AssoCompta AI` (dans l'onglet **Pièces Comptables** et sur l'écran d'accueil d'un membre ayant le rôle `📸 Déposant Factures`) un bouton **« 📱 Installer l'application mobile »** qui affiche :
1. **Un QR Code Android** (pointant vers Google Play ou Firebase APK).
2. **Un QR Code iPhone** (pointant vers TestFlight / App Store).
3. Le rappel de son email de connexion pour qu'il soit opérationnel en moins d'une minute.
