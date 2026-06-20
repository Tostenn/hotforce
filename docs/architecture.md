# Architecture

## Vue d'ensemble

Le projet est composé de trois couches :

```
┌─────────────────────────────────────────────────┐
│                  index.js                        │
│          Boucle principale + logique             │
└──────────────┬──────────────┬───────────────────┘
               │              │
     ┌─────────▼──────┐  ┌────▼──────────┐
     │   agent.js     │  │  Helper.js    │
     │  Chrome /      │  │  Génération   │
     │  Puppeteer     │  │  codes, ping, │
     │  Login portail │  │  délais       │
     └────────────────┘  └───────────────┘
               │                │
               └───────┬────────┘
                       │
              ┌────────▼────────┐
              │   config.js     │
              │  Lit le .env    │
              │  Exporte tout   │
              └─────────────────┘
```

## Flux d'exécution

```
Démarrage
    │
    ▼
agent.initialize()
  └─ Lance Chrome
  └─ Charge cookies si présents
  └─ Navigue vers HOTSPOT_URL
    │
    ▼
╔══════════════════════════════╗
║      Boucle principale       ║
║                              ║
║  1. Déjà connecté ?  ──YES──▶ ARRÊT (succès)
║         │ NO                 ║
║         ▼                    ║
║  2. Générer ticket           ║
║     (préfixe + corps random) ║
║         │                    ║
║         ▼                    ║
║  3. testTicket(ticket)       ║
║     ├─ essai normal          ║
║     └─ essai revert (shuffle)║
║         │                    ║
║         ▼                    ║
║  4. loginWithTicket()        ║
║     ├─ Saisit le code        ║
║     ├─ Clique Submit         ║
║     └─ Lit URL / message     ║
║         │                    ║
║         ├── SUCCÈS ─────────▶ saveCode() → ARRÊT
║         │                    ║
║         ▼                    ║
║  5. pauseEntreEssais()       ║
║     ├─ isOnline() ?          ║
║     │   ├─ OUI → sleep 15-45s║
║     │   └─ NON → attendreConnexion()
║     │         └─ Délai progressif (30s → 4min)
║         │                    ║
║         ▼                    ║
║  6. i >= MAX_ITERATIONS ? ──▶ ARRÊT (limite atteinte)
║     └─ NON → retour étape 1  ║
╚══════════════════════════════╝
```

## Modules

### `dependance/config.js`

Seul endroit qui lit `process.env`. Parse les listes (virgules), les entiers, les booléens, et exporte un objet structuré importé par tous les autres modules.

### `dependance/agent.js` — classe `Agent`

Encapsule tout ce qui touche à Puppeteer :

| Méthode | Rôle |
|---------|------|
| `initialize()` | Lance Chrome, charge cookies, ouvre la page de login |
| `isConnected()` | Vérifie l'URL ou le texte de bienvenu |
| `loginWithTicket(ticket)` | Saisit le code, soumet, lit le résultat |
| `goToUrl(url)` | Navigation avec retry automatique |
| `updateCookies()` | Sauvegarde les cookies après navigation |

### `dependance/Helper.js` — classe `Helper`

Utilitaires statiques :

| Méthode | Rôle |
|---------|------|
| `makeTicket(option)` | Génère un code avec préfixe et corps aléatoires |
| `isOnline()` | Ping HTTP sur plusieurs URLs (Google, Cloudflare, 1.1.1.1) |
| `attendreConnexion()` | Boucle d'attente avec délai progressif si WiFi absent |
| `sleep(sec)` | Pause fixe en secondes |
| `sleepHuman(min, max)` | Pause aléatoire (simule un humain) |
| `humanDelay()` | Délai entre frappes clavier (60–100ms) |
| `saveJson / readJson` | Lecture/écriture fichiers JSON |

### `index.js`

Point d'entrée. Orchestre la boucle, appelle les méthodes ci-dessus, gère les pauses.

## Génération des codes

```
CODE_PREFIXES = 4j, 4j, 4j, 4j, 4d, 1s
CODE_MIN_LEN  = 6
CODE_MAX_LEN  = 7

Exemple de résultat :
  → Préfixe tiré au sort : "4j"  (probabilité 4/6 ≈ 67%)
  → Longueur totale tirée : 7
  → Corps généré (5 chars) : "zfngw"
  → Code final : "4jzfngw"

Pour chaque code, deux tentatives :
  1. Le code tel quel          → 4jzfngw
  2. Corps mélangé (revert)    → 4jgnwfz  (même chars, ordre différent)
```

## Gestion des coupures WiFi

Le portail peut couper la connexion après trop de tentatives rapprochées (système de défense). Le programme le détecte et attend :

```
Coupure détectée
    │
    ▼
Tentative 1 → attendre 45s
Tentative 2 → attendre 60s
Tentative 3 → attendre 75s
    ...
Max → attendre 240s (4 min)

Après rétablissement → pause extra aléatoire (10–30s)
puis reprise normale (15–45s entre essais)
```
