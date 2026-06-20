import path from 'path';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import { fileURLToPath } from 'url';
import Helper from './Helper.js';
import config from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class Agent {
    constructor() {
        this.browser = null;
        /** @type {import('puppeteer').Page} */
        this.page = null;
    }

    /**
     * Vérifie si on est déjà connecté :
     * - URL de succès configurée dans HOTSPOT_SUCCESS_URLS
     * - OU page /login affichant le texte de bienvenu (SELECTOR_SUCCESS_TEXT)
     * @returns {Promise<boolean>}
     */
    async isConnected() {
        try {
            const url = this.page.url();
            if (config.hotspot.successUrls.some(u => url.startsWith(u))) return true;

            if (url.includes('/login')) {
                const successRegex = new RegExp(config.selectors.successText, 'i');
                const bienvenu = await this.page.evaluate((pattern) => {
                    const body = document.body?.innerText || '';
                    return new RegExp(pattern, 'i').test(body);
                }, config.selectors.successText).catch(() => false);

                if (bienvenu) {
                    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => null);
                    const afterUrl = this.page.url();
                    return config.hotspot.successUrls.some(u => afterUrl.startsWith(u));
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    async waitForSelectorSafely(selector, options = {}) {
        try {
            await this.page.waitForSelector(selector, { ...options, timeout: options.timeout || 30000 });
            return true;
        } catch {
            console.log(`Élément non trouvé: ${selector}`);
            return false;
        }
    }

    async initialize() {
        try {
            if (this.browser) await this.browser.close();

            console.log('Lancement de Chrome...');
            puppeteer.use(StealthPlugin());

            this.browser = await puppeteer.launch({
                headless: config.browser.headless,
                product: 'chrome',
                channel: 'chrome',
                args: [
                    '--no-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920x1080',
                    '--start-maximized',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor',
                ],
                ignoreDefaultArgs: ['--enable-automation'],
                defaultViewport: null,
            });

            const pages = await this.browser.pages();
            this.page = pages[0] || await this.browser.newPage();

            await this.page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', { get: () => false });
                Object.defineProperty(navigator, 'plugins',   { get: () => [1, 2, 3, 4, 5] });
                Object.defineProperty(navigator, 'languages', { get: () => ['fr-FR', 'fr', 'en-US', 'en'] });
                window.chrome = { runtime: {} };
            });

            await this.page.setUserAgent(
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/91.0.4472.124 Safari/537.36'
            );

            this.page.on('pageerror', err => console.error('📛 Erreur JS page:', err.message));
            this.page.on('error',     err => console.error('📛 Erreur Puppeteer:', err.message));

            if (await Helper.fileExists(config.hotspot.cookiePath)) {
                console.log('cookies présents');
                const cookies = await Helper.readJson(config.hotspot.cookiePath);
                await this.setCookies(cookies);
            }

            await this.goToUrl(config.hotspot.url);
            await this.handleCookiesAndPopups(false);

        } catch (error) {
            console.error('Erreur initialisation:', error.message);
            console.log("Tentative de continuer malgré l'erreur...");
        }
    }

    /**
     * @param {string} ticket
     * @returns {Promise<[boolean, string]>}
     */
    async loginWithTicket(ticket) {
        const { input: SEL_INPUT, button: SEL_BUTTON, error: SEL_ERROR } = config.selectors;

        try {
            if (!this.page) await this.initialize();

            if (await this.isConnected()) return [true, 'Déjà connecté'];

            const currentUrl = this.page.url();
            if (!currentUrl.includes(config.hotspot.url)) {
                await this.goToUrl(config.hotspot.url, { force: true });
            }

            if (await this.isConnected()) return [true, 'Déjà connecté'];

            await this.page.waitForSelector(SEL_INPUT, { timeout: 10000 });
            const champsTicket = await this.page.$(SEL_INPUT);

            await champsTicket.click({ clickCount: 3 });
            await Helper.sleepHuman(0.1, 0.2);
            await this.page.keyboard.press('Backspace');
            await Helper.sleepHuman(0.1, 0.2);

            await this.page.keyboard.type(ticket, { delay: Helper.humanDelay() });
            await Helper.sleepHuman(0.2, 0.5);

            const button = await this.page.$(SEL_BUTTON);

            await this.page.evaluate((sel) => {
                const el = document.querySelector(sel);
                if (el) el.textContent = '';
            }, SEL_ERROR).catch(() => null);

            await Promise.all([
                Promise.race([
                    this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
                    this.page.waitForSelector(`${SEL_ERROR}:not(:empty)`, { timeout: 15000 }).catch(() => null),
                ]),
                button.click(),
            ]);

            await Helper.sleepHuman(0.5, 1);

            const afterUrl = this.page.url();
            if (!afterUrl.includes('/login')) return [true, 'Connexion réussie'];

            const errorText = await this.page.evaluate((sel) => {
                const el = document.querySelector(sel);
                return el ? el.textContent : null;
            }, SEL_ERROR).catch(() => null);

            if (errorText !== null) {
                const trimmed = errorText.trim();
                console.log('text => ' + trimmed);
                const isValid = trimmed !== "nom d'utilisateur ou mot de passe invalide";
                return [isValid, trimmed];
            }

            return [true, 'Connexion réussie'];

        } catch (error) {
            const isContextError = error.message.includes('Execution context was destroyed')
                || error.message.includes('context was destroyed')
                || error.message.includes('Protocol error (Runtime.callFunctionOn)');

            if (!isContextError) console.error('Erreur loginWithTicket:', error.message);

            await Helper.sleepHuman(0.4, 0.7);

            try {
                const afterUrl = this.page.url();
                if (!afterUrl.includes('/login')) return [true, 'Connexion réussie'];

                const errorText = await this.page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    return el ? el.textContent : null;
                }, SEL_ERROR).catch(() => null);

                if (errorText !== null) {
                    const trimmed = errorText.trim();
                    console.log('text => ' + trimmed);
                    const isValid = trimmed !== "nom d'utilisateur ou mot de passe invalide";
                    return [isValid, trimmed];
                }
            } catch (_) {
                await this.goToUrl(config.hotspot.url, { force: true });
            }

            return [false, error.message];
        }
    }

    async getCookies() {
        return this.page.cookies();
    }

    async updateCookies() {
        const cookies = await this.getCookies();
        await Helper.saveJson(cookies, config.hotspot.cookiePath);
    }

    async setCookies(cookies) {
        await this.page.setCookie(...cookies);
    }

    async close() {
        if (this.browser) await this.browser.close();
    }

    async goToUrl(url, options = {}) {
        try {
            const currentUrl = this.page.url();
            if (!options.force && currentUrl === url) {
                console.log('✅ Déjà sur cette URL:', url);
                return true;
            }

            console.log('Navigation vers:', url);

            await Helper.retry(async () => {
                await this.page.goto(url, {
                    waitUntil: options.waitUntil || 'domcontentloaded',
                    timeout:   options.timeout   || 120000,
                });
            }, [], 1, options.maxRetries || 3);

            console.log('✅ Navigation réussie');
            await this.updateCookies();
            return true;

        } catch (error) {
            console.error('❌ Erreur navigation vers', url, ':', error.message);
            return false;
        }
    }
}
