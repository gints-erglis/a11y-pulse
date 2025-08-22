// lib/puppeteer.ts
import puppeteer, { type Browser, type PuppeteerLaunchOptions, type Page } from 'puppeteer';

const args =
  (process.env.PUPPETEER_ARGS ?? '--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage')
    .split(/\s+/)
    .filter(Boolean);

const launchOptions: PuppeteerLaunchOptions = {
  headless: 'new',
  args,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
};

let browserPromise: Promise<Browser> | null = null;

/** Returns the same Browser instance for the next calls */
export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = puppeteer.launch(launchOptions);
  return browserPromise;
}

/** Handy “withPage” helper: open page, do things, close page */
export async function withPage<T>(fn: (page: Page) => Promise<T>): Promise<T> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    return await fn(page);
  } finally {
    await page.close().catch(() => {});
  }
}

/** Safe close the browser, when process is stopped (dev/PM2/Docker stop) */
export function hookPuppeteerShutdown() {

  if ((globalThis as any).__PUP_HOOKED__) return;
  (globalThis as any).__PUP_HOOKED__ = true;

  const close = async () => {
    try {
      if (browserPromise) {
        const b = await browserPromise;
        await b.close();
      }
    } catch {}
    process.exit(0);
  };

  process.on('SIGINT', close);
  process.on('SIGTERM', close);
  process.on('beforeExit', close);
}
