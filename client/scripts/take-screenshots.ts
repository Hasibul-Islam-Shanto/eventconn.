import { chromium, type Browser, type Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

// --- Configuration ---
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const DEFAULT_TIMEOUT = Number(process.env.TIMEOUT_MS || 15000);

// Determine root repository directory
const findRepoRoot = (dir: string): string => {
  if (fs.existsSync(path.join(dir, '.git')) || fs.existsSync(path.join(dir, 'docker-compose.yml'))) {
    return dir;
  }
  const parent = path.dirname(dir);
  if (parent === dir) return process.cwd();
  return findRepoRoot(parent);
};

const REPO_ROOT = findRepoRoot(process.cwd());
const OUTPUT_DIR = process.env.SCREENSHOTS_DIR
  ? path.resolve(process.cwd(), process.env.SCREENSHOTS_DIR)
  : path.join(REPO_ROOT, 'screenshots');

const CUSTOMER_CREDENTIALS = {
  email: process.env.CUSTOMER_EMAIL || 'customer@eventconn.com',
  password: process.env.CUSTOMER_PASSWORD || 'Password123!',
};

const ORGANIZER_CREDENTIALS = {
  email: process.env.ORGANIZER_EMAIL || 'organizer@eventconn.com',
  password: process.env.ORGANIZER_PASSWORD || 'Password123!',
};

const FALLBACK_EVENT_ID = process.env.SAMPLE_EVENT_ID || '44444444-4444-4444-a444-444444444441';
const FALLBACK_BOOKING_ID = process.env.SAMPLE_BOOKING_ID || '66666666-6666-4666-a666-666666666661';

const VIEWPORTS = [
  { name: 'desktop', width: 1440, height: 900 },
  ...(process.env.INCLUDE_MOBILE === 'true' || process.argv.includes('--mobile')
    ? [{ name: 'mobile', width: 390, height: 844 }]
    : []),
];

// Ensure destination directories exist
function ensureDirs(categories: string[]) {
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }
  for (const cat of categories) {
    const catDir = path.join(OUTPUT_DIR, cat);
    if (!fs.existsSync(catDir)) {
      fs.mkdirSync(catDir, { recursive: true });
    }
  }
}

async function capture(page: Page, targetUrl: string, savePath: string, label: string) {
  try {
    console.log(`  📸 Capturing [${label}] from ${targetUrl}...`);
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT });

    // Give network / animations time to settle
    try {
      await page.waitForLoadState('networkidle', { timeout: 4000 });
    } catch {
      // It is normal for long-polling or analytics to not fully idle
    }

    // Short stabilization delay
    await page.waitForTimeout(600);

    await page.screenshot({ path: savePath, fullPage: true });
    console.log(`     ✓ Saved to: ${path.relative(REPO_ROOT, savePath)}`);
  } catch (error) {
    console.error(`     ✗ Failed capturing ${label}: ${(error as Error).message}`);
  }
}

async function loginUser(page: Page, email: string, password: string, roleName: string): Promise<boolean> {
  console.log(`\n🔑 Authenticating as ${roleName} (${email})...`);
  try {
    await page.goto(`${BASE_URL}/login`, { waitUntil: 'domcontentloaded', timeout: DEFAULT_TIMEOUT });
    await page.fill('#email', email);
    await page.fill('#password', password);
    await page.click('button:has-text("Sign in")');

    // Wait for redirect away from /login
    await page.waitForURL((url) => !url.pathname.startsWith('/login'), {
      timeout: DEFAULT_TIMEOUT,
    });
    console.log(`   ✓ Authenticated successfully.`);
    return true;
  } catch (error) {
    console.warn(`   ⚠️ Authentication failed or skipped for ${roleName}: ${(error as Error).message}`);
    return false;
  }
}

async function main() {
  console.log('====================================================');
  console.log('   📸 EventConn Automated Screenshot Generator');
  console.log('====================================================');
  console.log(`Target URL:     ${BASE_URL}`);
  console.log(`Output folder:  ${OUTPUT_DIR}`);
  console.log(`Device modes:   ${VIEWPORTS.map((v) => `${v.name} (${v.width}x${v.height})`).join(', ')}`);
  console.log('----------------------------------------------------\n');

  ensureDirs(['public', 'customer', 'organizer']);

  let browser: Browser;
  try {
    browser = await chromium.launch({ headless: true });
  } catch (err) {
    console.error('Failed to launch Playwright Chromium. Ensure `npx playwright install chromium` has run.');
    throw err;
  }

  for (const viewport of VIEWPORTS) {
    console.log(`\n🖥️  Processing Viewport: ${viewport.name.toUpperCase()} (${viewport.width}x${viewport.height})`);
    const prefix = VIEWPORTS.length > 1 ? `${viewport.name}-` : '';

    // ----------------------------------------------------
    // 1. PUBLIC PAGES
    // ----------------------------------------------------
    console.log('\n--- Section 1: Public Pages ---');
    const publicContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const publicPage = await publicContext.newPage();

    let dynamicEventId = FALLBACK_EVENT_ID;

    // 1.1 Home
    await capture(
      publicPage,
      `${BASE_URL}/`,
      path.join(OUTPUT_DIR, 'public', `${prefix}01-landing-page.png`),
      'Landing Page',
    );

    // 1.2 Event Catalog
    await capture(
      publicPage,
      `${BASE_URL}/events`,
      path.join(OUTPUT_DIR, 'public', `${prefix}02-event-catalog.png`),
      'Event Catalog',
    );

    // Inspect if dynamic event link is present on /events
    try {
      const eventHref = await publicPage
        .locator('a[href^="/events/"]')
        .first()
        .getAttribute('href');
      if (eventHref) {
        const extracted = eventHref.replace('/events/', '').split(/[?#]/)[0];
        if (extracted && extracted !== 'new') {
          dynamicEventId = extracted;
        }
      }
    } catch {
      // Use fallback
    }

    // 1.3 Event Details
    await capture(
      publicPage,
      `${BASE_URL}/events/${dynamicEventId}`,
      path.join(OUTPUT_DIR, 'public', `${prefix}03-event-details.png`),
      `Event Details (${dynamicEventId})`,
    );

    // 1.4 Login Page
    await capture(
      publicPage,
      `${BASE_URL}/login`,
      path.join(OUTPUT_DIR, 'public', `${prefix}04-login.png`),
      'Login Page',
    );

    // 1.5 Register Page
    await capture(
      publicPage,
      `${BASE_URL}/register`,
      path.join(OUTPUT_DIR, 'public', `${prefix}05-register.png`),
      'Register Page',
    );

    await publicContext.close();

    // ----------------------------------------------------
    // 2. CUSTOMER PROTECTED PAGES
    // ----------------------------------------------------
    console.log('\n--- Section 2: Customer Flow ---');
    const customerContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const customerPage = await customerContext.newPage();

    const customerAuthOk = await loginUser(
      customerPage,
      CUSTOMER_CREDENTIALS.email,
      CUSTOMER_CREDENTIALS.password,
      'Customer',
    );

    let dynamicBookingId = FALLBACK_BOOKING_ID;

    if (customerAuthOk) {
      // 2.1 My Bookings
      await capture(
        customerPage,
        `${BASE_URL}/bookings`,
        path.join(OUTPUT_DIR, 'customer', `${prefix}01-my-bookings.png`),
        'Customer Bookings',
      );

      // Attempt discovering live booking ID
      try {
        const bookingHref = await customerPage
          .locator('a[href^="/bookings/"]')
          .first()
          .getAttribute('href');
        if (bookingHref) {
          const extracted = bookingHref.replace('/bookings/', '').split(/[?#]/)[0];
          if (extracted) dynamicBookingId = extracted;
        }
      } catch {
        // Fallback
      }

      // 2.2 Booking Details & QR Tickets
      await capture(
        customerPage,
        `${BASE_URL}/bookings/${dynamicBookingId}`,
        path.join(OUTPUT_DIR, 'customer', `${prefix}02-booking-details.png`),
        `Booking Details (${dynamicBookingId})`,
      );

      // 2.3 Customer Profile
      await capture(
        customerPage,
        `${BASE_URL}/profile`,
        path.join(OUTPUT_DIR, 'customer', `${prefix}03-profile.png`),
        'Customer Profile',
      );
    } else {
      console.log('   ⚠️ Skipping customer protected pages due to authentication.');
    }
    await customerContext.close();

    // ----------------------------------------------------
    // 3. ORGANIZER PROTECTED PAGES
    // ----------------------------------------------------
    console.log('\n--- Section 3: Organizer Flow ---');
    const organizerContext = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
    });
    const organizerPage = await organizerContext.newPage();

    const organizerAuthOk = await loginUser(
      organizerPage,
      ORGANIZER_CREDENTIALS.email,
      ORGANIZER_CREDENTIALS.password,
      'Organizer',
    );

    if (organizerAuthOk) {
      // 3.1 Organizer Dashboard
      await capture(
        organizerPage,
        `${BASE_URL}/organizer`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}01-dashboard.png`),
        'Organizer Dashboard',
      );

      // 3.2 Organizer Events List
      await capture(
        organizerPage,
        `${BASE_URL}/organizer/events`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}02-events-list.png`),
        'Organizer Events List',
      );

      // 3.3 Create New Event
      await capture(
        organizerPage,
        `${BASE_URL}/organizer/events/new`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}03-create-event.png`),
        'Create Event Form',
      );

      // 3.4 Edit Event
      await capture(
        organizerPage,
        `${BASE_URL}/organizer/events/${dynamicEventId}/edit`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}04-edit-event.png`),
        `Edit Event (${dynamicEventId})`,
      );

      // 3.5 Organizer Bookings Management
      await capture(
        organizerPage,
        `${BASE_URL}/organizer/bookings`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}05-bookings-list.png`),
        'Organizer Bookings List',
      );

      // 3.6 Organizer Booking Details
      await capture(
        organizerPage,
        `${BASE_URL}/organizer/bookings/${dynamicBookingId}`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}06-booking-details.png`),
        `Organizer Booking Details (${dynamicBookingId})`,
      );

      // 3.7 Ticket Tiers Management
      await capture(
        organizerPage,
        `${BASE_URL}/organizer/tickets`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}07-ticket-management.png`),
        'Ticket Tiers Management',
      );

      // 3.8 QR Ticket Check-In Scanner
      await capture(
        organizerPage,
        `${BASE_URL}/organizer/scan`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}08-ticket-scanner.png`),
        'QR Ticket Scanner',
      );

      // 3.9 Organizer Profile
      await capture(
        organizerPage,
        `${BASE_URL}/organizer/profile`,
        path.join(OUTPUT_DIR, 'organizer', `${prefix}09-profile.png`),
        'Organizer Profile',
      );
    } else {
      console.log('   ⚠️ Skipping organizer protected pages due to authentication.');
    }
    await organizerContext.close();
  }

  await browser.close();
  console.log('\n====================================================');
  console.log(`🎉 Screenshot collection completed!`);
  console.log(`📁 Files are located at: ${OUTPUT_DIR}`);
  console.log('====================================================\n');
}

main().catch((err) => {
  console.error('Fatal error during screenshot execution:', err);
  process.exit(1);
});
