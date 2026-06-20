import fs from 'fs/promises';
import axios from 'axios';
import config from './config.js';

export default class Helper {
    static ascii_lowercase = 'abcdefghijklmnopqrstuvwxyz'
    static ascii_uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
    static digits = '0123456789'

    /**
     * @param {object} option
     * {
     *   code:   code existant à transformer
     *   revert: mélange les caractères du corps en conservant le préfixe
     *   minLen: longueur totale minimale (préfixe inclus)
     *   maxLen: longueur totale maximale (préfixe inclus)
     *   charset: 'lower' | 'upper' | 'both'
     * }
     * @returns {string}
     */
    static makeTicket(option = {}) {
        const {
            code,
            revert,
            minLen   = config.code.minLen,
            maxLen   = config.code.maxLen,
            charset  = config.code.charset,
        } = option;

        const lower = charset !== 'upper';
        const upper = charset !== 'lower';

        let chars = '';
        if (upper && !lower)      chars = Helper.ascii_uppercase + Helper.digits;
        else if (lower && !upper) chars = Helper.ascii_lowercase + Helper.digits;
        else                      chars = Helper.ascii_lowercase + Helper.ascii_uppercase + Helper.digits;

        const rand = (len) => {
            let r = '';
            for (let i = 0; i < len; i++) r += chars[Math.floor(Math.random() * chars.length)];
            return r;
        };

        const applyCase = (str) => {
            if (upper && !lower) return str.toUpperCase();
            if (lower && !upper) return str.toLowerCase();
            return str;
        };

        const shuffleBody = (str) => {
            const prefix = config.code.prefixes
                .slice()
                .sort((a, b) => b.length - a.length)
                .find(p => str.startsWith(p)) ?? '';
            const body = str.slice(prefix.length).split('');
            for (let i = body.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [body[i], body[j]] = [body[j], body[i]];
            }
            return prefix + body.join('');
        };

        if (code) return revert ? shuffleBody(code) : applyCase(code);

        const prefix   = config.code.prefixes[Math.floor(Math.random() * config.code.prefixes.length)];
        const safeMin  = Math.max(minLen, prefix.length + 1);
        const safeMax  = Math.max(maxLen, safeMin);
        const totalLen = Math.floor(Math.random() * (safeMax - safeMin + 1)) + safeMin;
        return prefix + rand(totalLen - prefix.length);
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
                if (retries >= maxRetries) throw error;
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

    static async sleepHuman(min = 1, max) {
        const minMs = min * 1000;
        const maxMs = max ? max * 1000 : null;
        const delay = maxMs && maxMs > minMs
            ? Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs
            : minMs + Math.floor(Math.random() * 400);
        return new Promise(resolve => setTimeout(resolve, delay));
    }

    static humanDelay() {
        return 60 + Math.floor(Math.random() * 40);
    }

    static async saveJson(datas, path) {
        await fs.writeFile(path, JSON.stringify(datas, null, 4));
    }

    static async readJson(path) {
        const data = await fs.readFile(path, 'utf-8');
        return JSON.parse(data);
    }

    static async fileExists(path) {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Vérifie la connexion via requêtes HTTP sur les URLs configurées dans PING_URLS.
     * Tente jusqu'à PING_RETRIES fois avec un délai de 3s entre chaque cycle.
     * @returns {Promise<boolean>}
     */
    static async isOnline() {
        const { urls, retries, timeoutMs } = config.ping;

        for (let tentative = 1; tentative <= retries; tentative++) {
            for (const url of urls) {
                try {
                    await axios.get(url, { timeout: timeoutMs });
                    return true;
                } catch (_) { /* essayer la suivante */ }
            }
            if (tentative < retries) {
                console.log(`🔴 Hors ligne (essai ${tentative}/${retries}) — attente 3s...`);
                await Helper.sleep(3);
            }
        }
        return false;
    }

    /**
     * Attend que la connexion soit rétablie.
     * Le délai entre chaque vérification monte progressivement (30s → 4min).
     * @returns {Promise<boolean>}
     */
    static async attendreConnexion() {
        const { wifiDownMaxWaits, reconnectExtraMin, reconnectExtraMax } = config.delays;
        let compteur = 0;

        while (compteur < wifiDownMaxWaits) {
            const ok = await Helper.isOnline();
            if (ok) {
                if (compteur > 0) console.log('🟢 Connexion rétablie !');
                return true;
            }
            compteur++;
            const delaiSec = Math.min(30 + compteur * 15, 240);
            console.log(`⏳ WiFi indisponible (${compteur}/${wifiDownMaxWaits}) — pause ${delaiSec}s...`);
            await Helper.sleep(delaiSec);
        }

        console.log('❌ Connexion toujours absente après toutes les tentatives.');
        return false;
    }

    // Retourne le délai supplémentaire aléatoire après reconnexion
    static randomReconnectExtra() {
        const { reconnectExtraMin, reconnectExtraMax } = config.delays;
        return reconnectExtraMin + Math.floor(Math.random() * (reconnectExtraMax - reconnectExtraMin + 1));
    }

    static parseAmount(amount) {
        amount = amount.slice(0, amount.length - 2);
        let amountParse = [];
        for (const el of amount) {
            const num = parseInt(el);
            if (!isNaN(num)) amountParse.push(num);
        }
        return parseInt(amountParse.join(''));
    }

    static parseDataMatch(data) {
        if (data.score) {
            data.score = data.score.split('-').map(el => parseInt(el.trim()));
        }
        if (data.time) {
            data.time = parseInt(data.time.split("'")[0].trim());
        }
        return data;
    }
}
