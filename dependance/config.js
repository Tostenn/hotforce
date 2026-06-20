import dotenv from 'dotenv';
dotenv.config();

const e = process.env;

function parseList(val, fallback) {
    if (!val) return fallback;
    return val.split(',').map(s => s.trim()).filter(Boolean);
}

function parseIntEnv(val, fallback) {
    const n = parseInt(val);
    return isNaN(n) ? fallback : n;
}

export default {
    browser: {
        headless: (e.BROWSER_HEADLESS ?? 'false').toLowerCase() === 'true',
    },

    verbose: (e.VERBOSE ?? 'false').toLowerCase() === 'true',

    hotspot: {
        url:         e.HOTSPOT_URL         ?? 'http://hotspot.ci/login',
        successUrls: parseList(e.HOTSPOT_SUCCESS_URLS, [
            'http://hotspot.ci/status',
            'http://hotspot.ci/success.html',
        ]),
        cookiePath:  e.HOTSPOT_COOKIE_PATH ?? 'cookies/cookies_hotspot.json',
    },

    selectors: {
        input:       e.SELECTOR_INPUT   ?? 'input#username',
        button:      e.SELECTOR_BUTTON  ?? 'form button.btn',
        error:       e.SELECTOR_ERROR   ?? 'form[name="login"] .error',
        // Regex (pattern only) pour détecter le message de bienvenue après connexion
        successText: e.SELECTOR_SUCCESS_TEXT ?? 'cliquer ici|click here',
    },

    code: {
        // Répéter un préfixe pour augmenter sa probabilité d'apparition
        prefixes: parseList(e.CODE_PREFIXES, ['4j', '4j', '4j', '4j', '4d', '1s']),
        minLen:   parseIntEnv(e.CODE_MIN_LEN, 6),
        maxLen:   parseIntEnv(e.CODE_MAX_LEN, 7),
        // 'lower' | 'upper' | 'both'
        charset:  e.CODE_CHARSET ?? 'lower',
    },

    ping: {
        urls:      parseList(e.PING_URLS, [
            'http://www.google.com',
            'http://1.1.1.1',
            'http://www.cloudflare.com',
        ]),
        retries:   parseIntEnv(e.PING_RETRIES,    3),
        timeoutMs: parseIntEnv(e.PING_TIMEOUT_MS, 5000),
    },

    delays: {
        minSec:              parseIntEnv(e.DELAY_MIN_SEC,               15),
        maxSec:              parseIntEnv(e.DELAY_MAX_SEC,               45),
        wifiDownMaxWaits:    parseIntEnv(e.WIFI_DOWN_MAX_WAITS,         20),
        reconnectExtraMin:   parseIntEnv(e.WIFI_RECONNECT_EXTRA_MIN_SEC, 10),
        reconnectExtraMax:   parseIntEnv(e.WIFI_RECONNECT_EXTRA_MAX_SEC, 30),
    },

    loop: {
        maxIterations: parseIntEnv(e.MAX_ITERATIONS, 1000),
    },
};
