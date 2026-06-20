# hotforce — Testeur de vouchers hotspot

Automatise les tentatives de connexion sur un portail captif WiFi (type UniFi/hotspot.ci) en générant et testant des codes vouchers par brute-force.

## Fonctionnement résumé

1. Génère un code voucher selon les préfixes et longueurs configurés
2. Ouvre Chrome (via Puppeteer) sur la page de login du portail
3. Saisit le code et détecte si la connexion réussit
4. Entre chaque essai, vérifie si le WiFi est toujours disponible — si non, attend sa réactivation avant de continuer
5. Sauvegarde tout code valide trouvé dans `code-valide.json`

## Prérequis

- [Node.js](https://nodejs.org/) v18+
- Google Chrome installé sur la machine
- Être connecté au réseau WiFi du portail ciblé

## Installation

```bash
npm install
cp .env.example .env
# Éditer .env avec vos paramètres
```

## Lancement

```bash
npm start
```

## Configuration rapide

Toute la configuration se fait dans `.env`. Les variables essentielles :

| Variable | Description |
|----------|-------------|
| `HOTSPOT_URL` | URL de la page de login du portail |
| `CODE_PREFIXES` | Préfixes des codes (ex: `4j,4j,4j,4j,4d,1s`) |
| `CODE_MIN_LEN` / `CODE_MAX_LEN` | Longueur totale min/max du code |
| `BROWSER_HEADLESS` | `true` = Chrome invisible, `false` = visible |
| `VERBOSE` | `true` = tous les logs, `false` = actions importantes uniquement |

Voir [docs/configuration.md](docs/configuration.md) pour la liste complète.

## Structure du projet

```
.
├── index.js                  # Point d'entrée — boucle principale
├── dependance/
│   ├── config.js             # Lecture et validation du .env
│   ├── agent.js              # Contrôle Chrome via Puppeteer
│   └── Helper.js             # Utilitaires (génération codes, ping, délais)
├── docs/
│   ├── architecture.md       # Fonctionnement interne détaillé
│   ├── configuration.md      # Toutes les variables .env documentées
│   └── selectors.md          # Adapter les sélecteurs CSS à d'autres portails
├── .env.example              # Modèle de configuration à copier
└── code-valide.json          # Codes valides trouvés (généré au runtime, gitignored)
```

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration](docs/configuration.md)
- [Adapter à un autre portail](docs/selectors.md)
