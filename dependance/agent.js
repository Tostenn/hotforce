
`
    
`
import path from 'path';
import os from 'os';
import puppeteer from 'puppeteer-extra';
import StealthPlugin from 'puppeteer-extra-plugin-stealth';
import dotenv from 'dotenv';

dotenv.config();

// Pour __dirname et __filename
import { fileURLToPath } from 'url';
import Helper from './Helper.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);



/**
 * * @class # Agent
 * * @description Classe représentant un agent qui interagit avec WhatsApp Web via Puppeteer.
 * * @property {import('puppeteer').Browser} browser - Instance de Puppeteer pour contrôler le navigateur.
 * * @property {import('puppeteer').Page} page - Instance de Page de Puppeteer pour interagir avec le navigateur.
 */
export default class Agent {
    /**
     * chemin du fichier setting .json
     * @param {string} setting 
     */
    constructor() {
        this.browser = null;
        /**
         * @type {import('puppeteer').Page}
         */
        this.page = null;
        this.maxRetries = 3;
        this.retryDelay = 5;
        this.platform = {
            url: 'http://hotspot.ci/login',
            path_cookie: 'cookies/cookies_hotspot.json',
            successUrls: [
                'http://hotspot.ci/status',
                'http://hotspot.ci/success.html',
            ]
        };
    }

    /**
     * Vérifie si on est déjà connecté :
     * - URL de succès (/status, /success.html)
     * - OU page /login affichant "Bienvenu" (état transitoire avant redirection)
     * @returns {Promise<boolean>}
     */
    async isConnected() {
        try {
            const url = this.page.url();
            if (this.platform.successUrls.some(u => url.startsWith(u))) return true;

            // Sur /login mais avec le message de bienvenu (avant redirection)
            if (url.includes('/login')) {
                const bienvenu = await this.page.evaluate(() => {
                    const body = document.body?.innerText || '';
                    return /cliquer ici|click here/i.test(body);
                }).catch(() => false);

                if (bienvenu) {
                    // Attendre la redirection automatique (max 8s)
                    await this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 8000 }).catch(() => null);
                    const afterUrl = this.page.url();
                    return this.platform.successUrls.some(u => afterUrl.startsWith(u));
                }
            }

            return false;
        } catch {
            return false;
        }
    }

    /**
     * * @description Attendre qu'un sélecteur soit présent dans la page
     */
    async waitForSelectorSafely(selector, options = {}) {
        try {
            await this.page.waitForSelector(selector, { ...options, timeout: options.timeout || 30000 });
            return true;
        } catch (error) {
            console.log(`Élément non trouvé: ${selector}`);
            return false;
        }
    }

    /**
     * * @description Initialise l'agent
     * * @throws {Error} - Lance une erreur si l'initialisation échoue
     * @returns {Promise<void>}
     */
    async initialize() {

        try {
            // Vérifier la connexion internet
            // await Helper.isOnline();

            // Vérifier si le navigateur est déjà lancé
            if (this.browser) {
                await this.browser.close();
            }

            console.log("Lancement de Chrome...");

            puppeteer.use(StealthPlugin());
            this.browser = await puppeteer.launch({
                headless: Helper.getHeadlessValue(),
                product: 'chrome',
                channel: 'chrome',
                userDataDir: this.userDataDir,
                args: [
                    '--no-sandbox',
                    // '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                    '--window-size=1920x1080',
                    '--start-maximized',
                    '--disable-blink-features=AutomationControlled',
                    '--disable-features=IsolateOrigins,site-per-process',
                    '--disable-web-security',
                    '--disable-features=VizDisplayCompositor'
                ],
                ignoreDefaultArgs: ['--enable-automation'],
                defaultViewport: null
            });

            const pages = await this.browser.pages();
            this.page = pages[0] || await this.browser.newPage();

            // Masquer les traces d'automatisation
            await this.page.evaluateOnNewDocument(() => {
                Object.defineProperty(navigator, 'webdriver', {
                    get: () => false,
                });

                // Masquer les propriétés headless
                Object.defineProperty(navigator, 'plugins', {
                    get: () => [1, 2, 3, 4, 5],
                });

                Object.defineProperty(navigator, 'languages', {
                    get: () => ['fr-FR', 'fr', 'en-US', 'en'],
                });

                window.chrome = {
                    runtime: {},
                };
            });

            await this.page.setUserAgent(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) " +
                "AppleWebKit/537.36 (KHTML, like Gecko) " +
                "Chrome/91.0.4472.124 Safari/537.36"
            );

            // Écouter les erreurs dans la page (ex : erreur JS)
            this.page.on('pageerror', error => {
                console.error('📛 Erreur JS dans la page:', error.message);
            });

            // Erreurs générales de la page
            this.page.on('error', error => {
                console.error('📛 Erreur dans Puppeteer:', error.message);
            });

            // Vérifier que les cookies sont présents
            if (await Helper.fileExists(this.platform.path_cookie)) {
                // Charger les cookies
                console.log('cookies présents');
                const cookies = await Helper.readJson(this.platform.path_cookie);
                await this.setCookies(cookies);
            }

            await this.goToUrl(this.platform.url)

            // Gérer les cookies et les popups
            await this.handleCookiesAndPopups(false);

        } catch (error) {
            console.error('Error during initialization:', error);
            // Ne pas arrêter le bot, juste logger l'erreur
            console.log("Tentative de continuer malgré l'erreur...");
        }
    }

    /**
     * @param {string} ticket
     * @returns {Promise<[boolean, string]>}
     */
    async loginWithTicket(ticket) {
        try {
            // Initialisation paresseuse si la page n'est pas encore prête
            if (!this.page) await this.initialize();

            // Déjà connecté ? (URL succès ou page Bienvenu avant redirection)
            if (await this.isConnected()) {
                return [true, 'Déjà connecté'];
            }

            // S'assurer qu'on est sur la page de login avant toute interaction
            const currentUrl = this.page.url();
            if (!currentUrl.includes(this.platform.url)) {
                await this.goToUrl(this.platform.url, { force: true });
            }

            // Après navigation vers login, re-vérifier (cas redirection /status)
            if (await this.isConnected()) {
                return [true, 'Déjà connecté'];
            }

            // Attendre que le champ soit présent
            await this.page.waitForSelector('input#username', { timeout: 10000 });

            const champsTicket = await this.page.$('input#username');

            // Vider le champ via triple-clic puis saisie (évite les vieux handlers JS)
            await champsTicket.click({ clickCount: 3 });
            await Helper.sleepHuman(0.1, 0.2);
            await this.page.keyboard.press('Backspace');
            await Helper.sleepHuman(0.1, 0.2);

            // Taper le ticket caractère par caractère
            await this.page.keyboard.type(ticket, { delay: Helper.humanDelay() });
            await Helper.sleepHuman(0.2, 0.5);

            // Envoyer le formulaire
            const button = await this.page.$('form button.btn');

            // Effacer l'erreur résiduelle du ticket précédent pour que waitForSelector
            // ne se résolve pas prématurément sur un ancien message
            await this.page.evaluate(() => {
                const el = document.querySelector('form[name="login"] .error');
                if (el) el.textContent = '';
            }).catch(() => null);

            // Cliquer et attendre soit la navigation soit le nouveau message d'erreur
            await Promise.all([
                Promise.race([
                    this.page.waitForNavigation({ waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => null),
                    this.page.waitForSelector('form[name="login"] .error:not(:empty)', { timeout: 15000 }).catch(() => null)
                ]),
                button.click()
            ]);

            // Laisser le DOM se stabiliser
            await Helper.sleepHuman(0.5, 1);

            // Si on n'est plus sur la page login → connexion réussie
            const afterUrl = this.page.url();
            if (!afterUrl.includes('/login')) {
                return [true, 'Connexion réussie'];
            }

            // Toujours sur login → lire le message d'erreur
            const errorText = await this.page.evaluate(() => {
                const el = document.querySelector('form[name="login"] .error');
                return el ? el.textContent : null;
            }).catch(() => null);

            if (errorText !== null) {
                const trimmed = errorText.trim();
                console.log('text => ' + trimmed);
                const isValid = trimmed !== "nom d'utilisateur ou mot de passe invalide";
                return [isValid, trimmed];
            }

            // Pas de message d'erreur visible → connexion réussie
            return [true, 'Connexion réussie'];

        } catch (error) {
            const isContextError = error.message.includes('Execution context was destroyed')
                || error.message.includes('context was destroyed')
                || error.message.includes('Protocol error (Runtime.callFunctionOn)');

            if (!isContextError) {
                console.error('Erreur loginWithTicket:', error.message);
            }

            // Une navigation a probablement eu lieu — attendre la stabilisation puis relire
            await Helper.sleepHuman(0.4, 0.7);

            try {
                const afterUrl = this.page.url();

                // Page différente de login → connexion réussie
                if (!afterUrl.includes('/login')) {
                    return [true, 'Connexion réussie'];
                }

                // Toujours sur login — relire le message d'erreur
                const errorText = await this.page.evaluate(() => {
                    const el = document.querySelector('form[name="login"] .error');
                    return el ? el.textContent : null;
                }).catch(() => null);

                if (errorText !== null) {
                    const trimmed = errorText.trim();
                    console.log('text => ' + trimmed);
                    const isValid = trimmed !== "nom d'utilisateur ou mot de passe invalide";
                    return [isValid, trimmed];
                }
            } catch (_) {
                // Si la page est toujours instable, recharger
                await this.goToUrl(this.platform.url, { force: true });
            }

            return [false, error.message];
        }
    }


    async getCookies() {
        return this.page.cookies();
    }

    async updateCookies() {
        // obtenir les cookies
        const cookies = await this.getCookies()
        console.log('get cookies');

        // save cookies
        Helper.saveJson(cookies, this.platform.path_cookie)
        console.log('save cookies');
    }

    async setCookies(cookies) {
        await this.page.setCookie(...cookies);
    }

    async close() {
        if (this.browser) await this.browser.close();
    }

    /**
     * Navigue vers une URL et attend que le DOM soit chargé
     * @param {string} url URL vers laquelle naviguer
     * @param {object} options Options de navigation
     * @param {boolean} options.force Force la navigation même si déjà sur l'URL
     * @returns {Promise<boolean>} true si la navigation réussit, false sinon
     */
    async goToUrl(url, options = {}) {
        try {
            // Vérifier si on est déjà sur cette URL
            const currentUrl = this.page.url();
            if (!options.force && currentUrl === url) {
                console.log('✅ Déjà sur cette URL:', url);
                return true;
            }

            console.log('Navigation vers:', url);

            // Utiliser la config de navigation de la plateforme si disponible
            const navConfig = this.platform?.navigation || {};
            const waitUntil = options.waitUntil || navConfig.waitUntil || 'domcontentloaded';
            const timeout = options.timeout || navConfig.timeout || 120000;
            const delayAfterLoad = navConfig.delayAfterLoad || 0;

            await Helper.retry(async () => {
                await this.page.goto(url, {
                    waitUntil: waitUntil,
                    timeout: timeout
                });
            }, [], 1, options.maxRetries || 3);

            console.log('✅ Navigation réussie');

            // Délai supplémentaire après le chargement si configuré
            if (delayAfterLoad > 0) {
                console.log(`⏱️ Attente de ${delayAfterLoad}ms pour la finalisation du chargement...`);
                await Helper.sleep(delayAfterLoad / 1000);
            }

            // save cookie
            await this.updateCookies()

            return true;
        } catch (error) {
            console.error('❌ Erreur de navigation vers', url, ':', error.message);
            return false;
        }
    }


}
