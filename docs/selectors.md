# Adapter les sélecteurs CSS à un autre portail

Chaque portail captif WiFi a sa propre structure HTML. Ce guide explique comment trouver les bons sélecteurs et configurer le programme pour un portail différent de `hotspot.ci`.

---

## Étape 1 — Inspecter le portail

1. Connecter l'ordinateur au WiFi concerné
2. Ouvrir le navigateur → il redirige vers la page de login du portail
3. Ouvrir les outils développeurs (`F12`)
4. Utiliser l'outil de sélection d'élément (icône curseur en haut à gauche des DevTools)

---

## Étape 2 — Trouver les sélecteurs

### Champ du code voucher (`SELECTOR_INPUT`)

Cliquer sur le champ de saisie du code. Dans les DevTools, repérer l'élément `<input>` et ses attributs :

```html
<!-- Exemple 1 : champ avec id -->
<input id="username" type="text" />
→ SELECTOR_INPUT='input#username'

<!-- Exemple 2 : champ avec name -->
<input name="voucher" type="text" />
→ SELECTOR_INPUT='input[name="voucher"]'

<!-- Exemple 3 : classe spécifique -->
<input class="voucher-input" type="text" />
→ SELECTOR_INPUT=.voucher-input
```

### Bouton de soumission (`SELECTOR_BUTTON`)

```html
<!-- Exemple 1 -->
<button type="submit" class="btn btn-primary">Se connecter</button>
→ SELECTOR_BUTTON='button[type="submit"]'

<!-- Exemple 2 -->
<input type="submit" value="Login" />
→ SELECTOR_BUTTON='input[type="submit"]'
```

### Zone d'erreur (`SELECTOR_ERROR`)

La zone qui affiche "code invalide", "mot de passe incorrect", etc. :

```html
<!-- Exemple 1 -->
<div class="error-message">...</div>
→ SELECTOR_ERROR=.error-message

<!-- Exemple 2 -->
<span id="login-error">...</span>
→ SELECTOR_ERROR='#login-error'

<!-- Exemple 3 (hotspot.ci) -->
<form name="login"><div class="error">...</div></form>
→ SELECTOR_ERROR='form[name="login"] .error'
```

### Texte de bienvenu (`SELECTOR_SUCCESS_TEXT`)

Sur certains portails, après une connexion réussie, un message apparaît sur la même page avant la redirection :

```html
<p>Connexion réussie. <a href="...">Cliquer ici</a> pour continuer.</p>
→ SELECTOR_SUCCESS_TEXT=cliquer ici|connexion réussie
```

C'est une expression régulière (sans les `/`). Utiliser `|` pour plusieurs alternatives.

---

## Étape 3 — Trouver les URLs

### URL de login (`HOTSPOT_URL`)

C'est l'URL sur laquelle le portail vous redirige. La copier depuis la barre d'adresse :
```
http://192.168.1.1/login
http://wifi.hotel.com/hotspot
→ HOTSPOT_URL=http://192.168.1.1/login
```

### URLs de succès (`HOTSPOT_SUCCESS_URLS`)

Après connexion réussie, noter l'URL finale du navigateur :
```
http://192.168.1.1/status
→ HOTSPOT_SUCCESS_URLS=http://192.168.1.1/status
```

---

## Exemples de configurations par type de portail

### UniFi (Ubiquiti)

```env
HOTSPOT_URL=http://192.168.1.1/guest/s/default/
HOTSPOT_SUCCESS_URLS=http://192.168.1.1/guest/s/default/status
SELECTOR_INPUT="input#username"
SELECTOR_BUTTON='button[type="submit"]'
SELECTOR_ERROR=".alert-error"
SELECTOR_SUCCESS_TEXT="authorized|connecté"
```

### MikroTik HotSpot

```env
HOTSPOT_URL=http://192.168.88.1/login
HOTSPOT_SUCCESS_URLS=http://192.168.88.1/status
SELECTOR_INPUT='input[name="username"]'
SELECTOR_BUTTON='input[type="submit"]'
SELECTOR_ERROR=td.err
SELECTOR_SUCCESS_TEXT="logged in|connecté"
```

### hotspot.ci (configuration par défaut)

```env
HOTSPOT_URL=http://hotspot.ci/login
HOTSPOT_SUCCESS_URLS=http://hotspot.ci/status,http://hotspot.ci/success.html
SELECTOR_INPUT="input#username"
SELECTOR_BUTTON="form button.btn"
SELECTOR_ERROR='form[name="login"] .error'
SELECTOR_SUCCESS_TEXT="cliquer ici|click here"
```

---

## Vérifier que les sélecteurs sont corrects

Dans la console des DevTools (onglet Console), tester :

```js
// Vérifie que le sélecteur trouve bien l'élément
document.querySelector('input#username')
// → doit retourner l'élément <input>, pas null

document.querySelector('form button.btn')
// → doit retourner le bouton
```

Si le résultat est `null`, le sélecteur est incorrect.
