## Récupérer le texte d'un ElementHandle
Si une fonction Puppeteer retourne un ElementHandle (ex: searchEventByTeams), utilisez evaluate pour obtenir le texte :
```js
const res = await agent.searchEventByTeams('Dortmund', 'Heidenheim');
if (res) {
  const text = await res.evaluate(el => el.textContent);
  console.log(text);
}
```
# Guide Essentiel Puppeteer

Ce guide présente les fonctions principales de Puppeteer pour l'automatisation web, avec des exemples concrets.

## 1. Lancement du navigateur
```js
import puppeteer from 'puppeteer';
const browser = await puppeteer.launch({ headless: true });
```

## 2. Ouverture d'une nouvelle page
```js
const page = await browser.newPage();
```

## 3. Navigation vers une URL
```js
await page.goto('https://www.example.com', { waitUntil: 'domcontentloaded' });
```

## 4. Attendre un sélecteur
```js
await page.waitForSelector('h1');
```


## 5. Évaluer du code dans le contexte de la page
### page.evaluate
Permet d'exécuter du JavaScript dans le contexte du navigateur (DOM).
```js
const title = await page.evaluate(() => document.title);
```

### page.$eval
Exécute une fonction sur le premier élément correspondant au sélecteur.
```js
const text = await page.$eval('h1', el => el.textContent);
```

### page.$$eval
Exécute une fonction sur tous les éléments correspondant au sélecteur et retourne le résultat.
```js
const items = await page.$$eval('li.item', els => els.map(e => e.textContent));
```

### page.evaluateHandle
Retourne un handle JS (ElementHandle) utilisable pour manipuler le DOM.
```js
const handle = await page.evaluateHandle(() => document.body);
```

### Exemple avancé : extraire plusieurs infos
```js
const infos = await page.evaluate(() => {
  const title = document.querySelector('h1').textContent;
  const links = Array.from(document.querySelectorAll('a')).map(a => a.href);
  return { title, links };
});
```

## 6. Cliquer sur un élément
```js
await page.click('button.submit');
```

## 7. Saisir du texte dans un champ
```js
await page.type('input[name=email]', 'test@example.com');
```

## 8. Prendre une capture d'écran
```js
await page.screenshot({ path: 'capture.png' });
```

## 9. Récupérer tous les éléments correspondants
```js
const items = await page.$$('li.item');
```

## 10. Fermer le navigateur
```js
await browser.close();
```

---

## Exemple complet : connexion et récupération de données
```js
import puppeteer from 'puppeteer';

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();
  await page.goto('https://www.example.com/login');
  await page.type('#username', 'monuser');
  await page.type('#password', 'monmotdepasse');
  await page.click('button.login');
  await page.waitForNavigation();
  const infos = await page.$eval('.user-info', el => el.textContent);
  console.log('Infos utilisateur:', infos);
  await browser.close();
})();
```

---

## Ressources
- [Documentation officielle Puppeteer](https://pptr.dev/)
- [API Reference](https://pptr.dev/api/)
