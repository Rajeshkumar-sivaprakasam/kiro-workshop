const puppeteer = require('puppeteer');
const readline = require('readline');

const args = process.argv.slice(2);
const isLoginMode = args.includes('--login');

// Find the URL in the command-line arguments (excluding --login)
const urlArg = args.find(arg => arg !== '--login' && (arg.startsWith('http://') || arg.startsWith('https://')));

if (!urlArg && !isLoginMode) {
  console.log('Usage: node generate-pdf.js <url> [--login]');
  console.log('Example: node generate-pdf.js https://catalog.us-east-1.prod.workshops.aws/...');
  process.exit(1);
}

const targetUrl = urlArg || 'https://catalog.us-east-1.prod.workshops.aws/event/dashboard/en-US/workshop/02-vibe/00-environment-setup';

// Extract segments after 'workshop' to create a unique and descriptive filename
const urlObj = new URL(targetUrl);
const pathSegments = urlObj.pathname.split('/').filter(Boolean);
const workshopIdx = pathSegments.indexOf('workshop');
let nameSegments = [];
if (workshopIdx !== -1 && workshopIdx < pathSegments.length - 1) {
  nameSegments = pathSegments.slice(workshopIdx + 1);
} else {
  nameSegments = [pathSegments[pathSegments.length - 1] || 'output'];
}
const defaultPdfName = `${nameSegments.join('-')}.pdf`;

(async () => {
  const browser = await puppeteer.launch({
    headless: !isLoginMode,
    userDataDir: './user_data',
    defaultViewport: null // Allows page resizing
  });

  const page = await browser.newPage();

  if (isLoginMode) {
    console.log('--- LOGIN MODE ---');
    console.log('1. A browser window has opened.');
    console.log('2. Please log in to your AWS Workshop Studio account in that window.');
    console.log('3. Once you are logged in and see the dashboard/content, come back here and press ENTER to save session and close.');

    await page.goto(targetUrl, {
      waitUntil: 'networkidle2'
    });

    // Wait for user to press Enter in terminal
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    await new Promise(resolve => rl.question('Press ENTER here after logging in...', () => {
      rl.close();
      resolve();
    }));

    console.log('Session saved successfully. You can now run the script without --login.');
    await browser.close();
    process.exit(0);
  }

  await page.goto(targetUrl, {
    waitUntil: 'networkidle2'
  });

  // Wait 8 seconds for the SPA content/dashboard to finish loading dynamically
  console.log('Waiting for content to load...');
  await new Promise(r => setTimeout(r, 8000));

  // Scroll to load lazy-loaded content
  await page.evaluate(async () => {
    await new Promise((resolve) => {
      let totalHeight = 0;
      const distance = 500;

      const timer = setInterval(() => {
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= document.body.scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);
    });
  });

  const height = await page.evaluate(() =>
    document.documentElement.scrollHeight
  );

  console.log(`Page height: ${height}px`);

  try {
    await page.screenshot({ path: 'debug.png', fullPage: true });
    console.log('Saved debug screenshot as debug.png');
  } catch (err) {
    console.warn('Could not save debug screenshot:', err.message);
  }

  let pdfPath = defaultPdfName;
  try {
    await page.pdf({
      path: pdfPath,
      width: '1280px',
      height: `${height}px`,
      printBackground: true
    });
    console.log(`PDF generated successfully as ${pdfPath}`);
  } catch (error) {
    if (error.code === 'EBUSY' || error.message.includes('EBUSY')) {
      const timestamp = Math.floor(Date.now() / 1000);
      const baseName = nameSegments.join('-');
      pdfPath = `${baseName}_${timestamp}.pdf`;
      console.warn(`WARNING: ${defaultPdfName} is locked or open in another program.`);
      console.log(`Saving to fallback file: ${pdfPath}`);
      await page.pdf({
        path: pdfPath,
        width: '1280px',
        height: `${height}px`,
        printBackground: true
      });
      console.log(`PDF generated successfully as ${pdfPath}`);
    } else {
      throw error;
    }
  }

  await browser.close();
})();