import fs from 'fs/promises';
import axios from 'axios';



/**
 * Classe utilitaire fournissant des méthodes d'aide pour les opérations courantes
 * telles que les délais, les tentatives de réexécution, la gestion des cookies
 * et le parsing de données.
 * 
 * @class Helper
 * @example
 * // Attendre 1 seconde
 * await Helper.sleep(1000);
 * 
 * // Réessayer une fonction avec délai
 * await Helper.retry(myFunction, [arg1, arg2], 2, 3);
 * 
 * // Sauvegarder des cookies
 * await Helper.saveCookies(cookieData);
*/
export default class Helper {
    static ascii_lowercase = 'abcdefghijklmnopqrstuvwxyz'
    static ascii_uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    static digits = '0123456789'

    /**
     * Préfixes utilisés pour les tickets générés
     * Distribution réelle observée : 4j (~67%), 4d (~17%), 1s (~17%)
     */
    static ticketPrefixes = [
        '4j', '4j', '4j', '4j',  // poids x4
        '4d',
        '1s',
    ];

    /**
     * @param {object} option
     * {
     *   code:   code existant à transformer
     *   revert: mélange les caractères du corps en conservant le préfixe
     *           ex: 4jzfngw → 4jznfwg
     *   upper:  tout en majuscules
     *   lower:  tout en minuscules
     *   minLen: longueur totale minimale (défaut: 5, préfixe inclus)
     *   maxLen: longueur totale maximale (défaut: 7, préfixe inclus)
     * }
     * @returns {string} Le code généré ou modifié
     */
    static makeTicket(option = {}) {
        const { code, revert, upper, lower, minLen, maxLen } = Object.assign(
            { minLen: 4, maxLen: 7, lower: true },
            option
        );

        // Détermine le charset à utiliser selon les options
        let charset = '';
        if (upper && !lower) {
            charset = Helper.ascii_uppercase + Helper.digits;
        } else if (lower && !upper) {
            charset = Helper.ascii_lowercase + Helper.digits;
        } else {
            charset = Helper.ascii_lowercase + Helper.ascii_uppercase + Helper.digits;
        }

        const generateRandom = (length) => {
            let result = '';
            for (let i = 0; i < length; i++) {
                result += charset.charAt(Math.floor(Math.random() * charset.length));
            }
            return result;
        };

        const applyCase = (str) => {
            if (upper && !lower) return str.toUpperCase();
            if (lower && !upper) return str.toLowerCase();
            return str;
        };

        // Mélange (Fisher-Yates) les caractères du corps en préservant le préfixe
        const shuffleBody = (str) => {
            const prefix = Helper.ticketPrefixes
                .slice()
                .sort((a, b) => b.length - a.length)
                .find(p => str.startsWith(p)) || '';
            const head = str.slice(0, prefix.length);
            const body = str.slice(prefix.length).split('');
            for (let i = body.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [body[i], body[j]] = [body[j], body[i]];
            }
            return head + body.join('');
        };

        let result;

        if (!code) {
            // Choisir un préfixe aléatoire
            const prefix = Helper.ticketPrefixes[Math.floor(Math.random() * Helper.ticketPrefixes.length)];

            const safeMin = Math.max(minLen, prefix.length + 1);
            const safeMax = Math.max(maxLen, safeMin);
            const totalLen = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;

            const bodyLen = Math.max(0, totalLen - prefix.length);
            result = prefix + generateRandom(bodyLen);
        } else {
            result = revert ? shuffleBody(code) : applyCase(code);
        }

        return result;
    }

    static async sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms * 1000));
    }

    static async retry(fn, args = [], timeout = 1, maxRetries = 3) {
        let retries = 0;
        while (true) {
            try {
                return await fn(...args);
            } catch (error) {
                if (retries >= maxRetries) {
                    throw error;
                }
                await this.sleepHuman(timeout);
                retries++;
                console.log('ressaie ', retries);
                
            }
        }
    }

    static async retryPlus(fn, args = [], timeout = 1, maxRetries = 3) {
        try {
            return await this.retry(fn, args, timeout, maxRetries);
        } catch (error) {
            console.error(error.message);
        }
    }

    /**
     * Attente "humaine" (variation aléatoire)
     * @param {number} min Millisecondes min
     * @param {number} [max] Millisecondes max
     */
    static async sleepHuman(min = 1, max) {
        min = min * 1000
        max = max ? max * 1000 : max
        const delay = max && max > min
            ? Math.floor(Math.random() * (max - min + 1)) + min
            : min + Math.floor(Math.random() * 400);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    /**
     * Génère un délai réaliste pour l'écriture clavier
     */
    static humanDelay() {
        return 60 + Math.floor(Math.random() * 40);
    }

    /**
     * save file json
     * @param {*} datas 
     * @param {string} path 
     */
    static async saveJson(datas, path) {
        await fs.writeFile(path, JSON.stringify(datas, null, 4));
    }

    /**
     * Lit un fichier JSON et retourne son contenu formaté
     * @param {string} path Chemin du fichier JSON à lire
     * @returns {Promise<any>} Le contenu JSON parsé
     */
    static async readJson(path) {
        const data = await fs.readFile(path, 'utf-8');
        return JSON.parse(data);
    }

    /**
     * Vérifie si un fichier existe
     * @param {string} path Chemin du fichier à vérifier
     * @returns {Promise<boolean>} true si le fichier existe, false sinon
     */
    static async fileExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * parse l'amount
     * @param {number} amount 
     */
    static parseAmount(amount) {
        amount = amount.slice(0, amount.length - 2)

        let amountParse = [];
        for (const el of amount) {
            const num = parseInt(el);
            if (typeof num === 'number' && !isNaN(num)) {
                amountParse.push(num);
            }
        }

        return parseInt(amountParse.join(''));
    }

    /**
     * 
     * @param {{eq1: string, eq2: string, time: string, score: string}} data 
     */
    static parseDataMatch(data) {
        if (data.score) {
            const score = data.score.split('-').map(el => parseInt(el.trim()));
            data.score = score
        }
        if (data.time) {
            const time = data.time.split("'")[0].trim()
            data.time = parseInt(time)
        }
        return data
    }

    /**
     * Vérifie la connexion en tentant un GET HTTP sur des URLs fiables.
     * Essaie jusqu'à `retries` fois avec un délai entre chaque essai.
     * @param {number} retries Nombre de tentatives (défaut: 3)
     * @returns {Promise<boolean>}
     */
    static async isOnline(retries = 3) {
        const PING_URLS = [
            'http://www.google.com',
            'http://1.1.1.1',
            'http://www.cloudflare.com',
        ];

        for (let tentative = 1; tentative <= retries; tentative++) {
            for (const url of PING_URLS) {
                try {
                    await axios.get(url, { timeout: 5000 });
                    return true;
                } catch (_) {
                    // URL inaccessible, essayer la suivante
                }
            }
            if (tentative < retries) {
                console.log(`🔴 Hors ligne (essai ${tentative}/${retries}) — attente 3s...`);
                await Helper.sleep(3);
            }
        }
        return false;
    }

    /**
     * Attend que la connexion internet soit rétablie.
     * Si le WiFi est tombé (système de défense côté hotspot), attend plus longtemps.
     * @param {number} maxAttentes Nombre max d'attentes avant abandon (défaut: 20)
     * @returns {Promise<boolean>}
     */
    static async attendreConnexion(maxAttentes = 20) {
        let compteur = 0;
        while (compteur < maxAttentes) {
            const ok = await Helper.isOnline(3);
            if (ok) {
                if (compteur > 0) console.log('🟢 Connexion rétablie !');
                return true;
            }
            compteur++;
            // Délai croissant : commence à 30s, monte jusqu'à 4min
            const delaiSec = Math.min(30 + compteur * 15, 240);
            console.log(`⏳ WiFi indisponible (attente ${compteur}/${maxAttentes}) — pause ${delaiSec}s...`);
            await Helper.sleep(delaiSec);
        }
        console.log('❌ Connexion toujours absente après toutes les tentatives.');
        return false;
    }

    /**
     * @description Vérifie si l'agent est en mode headless
     * @returns {boolean}
     */
    static getHeadlessValue() {
        const headless = process.env.BROWSER_HEASLESS
        return headless.toLocaleLowerCase() == 'true'
    }


}