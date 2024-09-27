const puppeteer = require('puppeteer');

// Sleep function to pause execution
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  try {
    // Navigate to Microsoft login page
    await page.goto('https://go.microsoft.com/fwlink/p/?LinkID=2125442&deeplink=owa%2F0%2F%3Fstate%3D1%26redirectTo%3DaHR0cHM6Ly9vdXRsb29rLmxpdmUuY29tL21haWwvMC8', { waitUntil: 'networkidle2' });

    // Fill in the email input field
    await page.waitForSelector('#i0116', { visible: true });
    await page.click('#i0116');
    await page.keyboard.type('jhony_boss@hotmail.com', { delay: 100 });  // Simulates typing email with a delay

    // Click the "Next" button
    await page.click('#idSIButton9');

    // Wait for the password input field to appear
    await page.waitForSelector('#i0118', { visible: true });

    // Fill in the password
    await page.click('#i0118');
    await page.keyboard.type('3mpr3nd3dor01', { delay: 100 });
    await page.click('#idSIButton9');
    try {
      await page.waitForSelector('#acceptButton', { timeout: 10000 });

      await page.click('#acceptButton');
      console.log('Clicked "Yes" on the Stay Signed In prompt');
    } catch (e) {
      console.log('Stay Signed In prompt not found or skipped');
    }
    await page.goto('https://go.microsoft.com/fwlink/p/?LinkID=2125442&deeplink=owa%2F0%2F%3Fstate%3D1%26redirectTo%3DaHR0cHM6Ly9vdXRsb29rLmxpdmUuY29tL21haWwvMC8');

    await page.waitForSelector('#topSearchInput');

    await page.type('#topSearchInput', 'from:"no-reply@spotify.com"');

    await page.click('button[aria-label="Search"]', { timeout: 2000 });

    try {
      await page.waitForSelector('.jGG6V.gDC9O', { timeout: 5000 });
      const results = await page.$$eval('.jGG6V.gDC9O', elements => elements.length);
      console.log(`Found ${results} result(s).`);
    } catch (e) {
      console.log('No search results found or search timed out.');
    }

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {

    // await sleep(60000); // Keeps the browser open for manual inspection if needed
    // await browser.close();
  }
})();
