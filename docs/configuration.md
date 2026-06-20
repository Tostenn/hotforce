# Configuration — Variables d'environnement

Toute la configuration se fait dans le fichier `.env` à la racine du projet.  
Copier `.env.example` vers `.env` et ajuster les valeurs.

---

## Logs

### `VERBOSE`
- Type : `true` | `false`
- Défaut : `false`
- `false` = affiche uniquement les actions importantes : code testé, résultat, pauses, statut WiFi, succès/échec
- `true` = affiche tout : navigation Chrome, cookies, détails ping, messages du portail, retries

---

## Navigateur

### `BROWSER_HEADLESS`
- Type : `true` | `false`
- Défaut : `false`
- `false` = Chrome s'ouvre visuellement (recommandé pour déboguer)
- `true` = Chrome tourne en arrière-plan (recommandé en production)

---

## Portail captif

### `HOTSPOT_URL`
- Type : URL
- Défaut : `http://hotspot.ci/login`
- Page de connexion du portail. Le programme y navigue au démarrage et avant chaque essai.

### `HOTSPOT_SUCCESS_URLS`
- Type : liste d'URLs séparées par des virgules
- Défaut : `http://hotspot.ci/status,http://hotspot.ci/success.html`
- Si l'URL du navigateur commence par l'une de ces valeurs, la connexion est considérée réussie.

### `HOTSPOT_COOKIE_PATH`
- Type : chemin de fichier
- Défaut : `cookies/cookies_hotspot.json`
- Fichier où les cookies de session sont stockés entre les relances.

---

## Sélecteurs CSS

Ces sélecteurs permettent d'adapter le programme à n'importe quel portail.  
Voir [selectors.md](selectors.md) pour savoir comment les trouver.

### `SELECTOR_INPUT`
- Défaut : `input#username`
- Champ où entrer le code voucher.

### `SELECTOR_BUTTON`
- Défaut : `form button.btn`
- Bouton de soumission du formulaire.

### `SELECTOR_ERROR`
- Défaut : `form[name="login"] .error`
- Zone d'affichage des messages d'erreur après soumission.

### `SELECTOR_SUCCESS_TEXT`
- Type : pattern regex (sans les `/`)
- Défaut : `cliquer ici|click here`
- Texte qui apparaît sur la page de login en cas de connexion réussie, avant la redirection.

---

## Génération des codes

### `CODE_PREFIXES`
- Type : liste de valeurs séparées par des virgules
- Défaut : `4j,4j,4j,4j,4d,1s`
- Répéter un préfixe pour augmenter sa probabilité d'apparition.  
  Exemple : `4j` apparaît 4 fois → probabilité de 4/6 ≈ 67%.

### `CODE_MIN_LEN`
- Type : entier
- Défaut : `6`
- Longueur totale minimale du code généré (préfixe inclus).

### `CODE_MAX_LEN`
- Type : entier
- Défaut : `7`
- Longueur totale maximale du code généré (préfixe inclus).

### `CODE_CHARSET`
- Type : `lower` | `upper` | `both`
- Défaut : `lower`
- `lower` = minuscules + chiffres (ex: `4jzfngw`)
- `upper` = majuscules + chiffres
- `both`  = minuscules + majuscules + chiffres

---

## Vérification de connexion (ping)

### `PING_URLS`
- Type : liste d'URLs séparées par des virgules
- Défaut : `http://www.google.com,http://1.1.1.1,http://www.cloudflare.com`
- URLs testées pour détecter si Internet est disponible. Le programme essaie chaque URL jusqu'à en trouver une qui répond.

### `PING_RETRIES`
- Type : entier
- Défaut : `3`
- Nombre de cycles complets (toutes les PING_URLS) avant de déclarer la connexion absente.

### `PING_TIMEOUT_MS`
- Type : entier (millisecondes)
- Défaut : `5000`
- Durée max d'attente par requête ping.

---

## Délais entre tentatives

### `DELAY_MIN_SEC`
- Type : entier (secondes)
- Défaut : `15`
- Pause minimale entre deux essais de code quand le WiFi est disponible.

### `DELAY_MAX_SEC`
- Type : entier (secondes)
- Défaut : `45`
- Pause maximale entre deux essais de code quand le WiFi est disponible.

> La pause réelle est tirée aléatoirement entre `DELAY_MIN_SEC` et `DELAY_MAX_SEC` pour simuler un comportement humain.

### `WIFI_DOWN_MAX_WAITS`
- Type : entier
- Défaut : `20`
- Nombre maximum de vérifications avant d'abandonner quand le WiFi est coupé.

### `WIFI_RECONNECT_EXTRA_MIN_SEC`
- Type : entier (secondes)
- Défaut : `10`
- Pause supplémentaire minimale après rétablissement du WiFi.

### `WIFI_RECONNECT_EXTRA_MAX_SEC`
- Type : entier (secondes)
- Défaut : `30`
- Pause supplémentaire maximale après rétablissement du WiFi.

---

## Boucle principale

### `MAX_ITERATIONS`
- Type : entier
- Défaut : `1000`
- Nombre maximum de codes testés avant arrêt automatique.
