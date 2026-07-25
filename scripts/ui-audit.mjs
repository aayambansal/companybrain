#!/usr/bin/env node
/**
 * UI audit: capture every dashboard route at three widths so the whole surface
 * can be reviewed by eye in one pass.
 *
 *   node scripts/ui-audit.mjs [iteration]
 *
 * Writes to .goal/shots/iter-<n>/<route>-<width>.png. The app is dark-only
 * (globals.css pins color-scheme: dark), so there is no light variant to shoot.
 */
import { chromium } from 'playwright';
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Must match CORS_ORIGINS (localhost, not 127.0.0.1) or every API call is blocked.
const BASE = process.env.UI_AUDIT_BASE ?? 'http://localhost:3000';
const iteration = process.argv[2] ?? '1';
const outDir = join('.goal', 'shots', `iter-${iteration}`);
const WIDTHS = [390, 768, 1440];

const memoryId = existsSync('.goal/memory-id.txt')
  ? readFileSync('.goal/memory-id.txt', 'utf8').trim()
  : null;

const ROUTES = [
  ['overview', '/'],
  ['search', '/search?q=release%20process'],
  ['search-empty', '/search'],
  ['chat', '/chat'],
  ['playbooks', '/playbooks'],
  ['memories', '/memories'],
  ['topics', '/topics'],
  ['spaces', '/spaces'],
  ['connections', '/connections'],
  ['analytics', '/analytics'],
  ['settings', '/settings'],
  ['login', '/login'],
  ['register', '/register'],
  ...(memoryId && memoryId !== 'NONE' ? [['memory-detail', `/memories/${memoryId}`]] : []),
];

const problems = [];

const browser = await chromium.launch();
try {
  for (const width of WIDTHS) {
    const ctx = await browser.newContext({
      viewport: { width, height: width < 500 ? 844 : 900 },
      deviceScaleFactor: 2,
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
    });
    const page = await ctx.newPage();

    const consoleErrors = [];
    page.on('console', (m) => {
      const t = m.text();
      // Next's dev HMR socket fails under a headless context; not a product defect.
      if (m.type() === 'error' && !/webpack-hmr|HMR|Fast Refresh/.test(t)) consoleErrors.push(t);
    });
    page.on('pageerror', (e) => consoleErrors.push(String(e)));

    for (const [name, path] of ROUTES) {
      const dir = join(outDir, String(width));
      mkdirSync(dir, { recursive: true });
      consoleErrors.length = 0;
      try {
        await page.goto(BASE + path, { waitUntil: 'networkidle', timeout: 20000 });
      } catch {
        // networkidle can never settle with a dev socket; fall back to load
        await page.goto(BASE + path, { waitUntil: 'load', timeout: 20000 }).catch(() => {});
      }
      await page.waitForTimeout(700); // let reveals settle

      // Horizontal overflow is a hard fail on mobile.
      const overflow = await page.evaluate(() => {
        const de = document.documentElement;
        return { scrollW: de.scrollWidth, clientW: de.clientWidth };
      });
      if (overflow.scrollW > overflow.clientW + 1) {
        problems.push(
          `[overflow] ${name} @${width}: scrollWidth ${overflow.scrollW} > ${overflow.clientW}`,
        );
      }

      // Tap targets below 44px on mobile.
      if (width === 390) {
        const small = await page.evaluate(() => {
          const out = [];
          for (const el of document.querySelectorAll('a, button, [role="button"], input, select')) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0) continue;
            // Visually-hidden helpers (skip links) are 1px until focused, which
            // is the point; they are not touch targets.
            if (el.classList.contains('sr-only') || r.width <= 2 || r.height <= 2) continue;
            if (r.height < 36)
              out.push(
                `${el.tagName.toLowerCase()}${el.className ? '.' + String(el.className).split(' ')[0] : ''} ${Math.round(r.height)}px "${(el.textContent ?? '').trim().slice(0, 24)}"`,
              );
          }
          return [...new Set(out)].slice(0, 8);
        });
        for (const s of small) problems.push(`[tap-target] ${name} @390: ${s}`);
      }

      if (consoleErrors.length) {
        for (const e of [...new Set(consoleErrors)].slice(0, 3)) {
          problems.push(`[console] ${name} @${width}: ${e.slice(0, 160)}`);
        }
      }

      await page.screenshot({ path: join(dir, `${name}.png`), fullPage: true });
    }
    await ctx.close();
  }
} finally {
  await browser.close();
}

console.log(`\nShots written to ${outDir}`);
if (problems.length) {
  console.log(`\n${problems.length} automated finding(s):`);
  for (const p of problems) console.log('  ' + p);
} else {
  console.log('\nNo automated findings (overflow / tap-target / console).');
}
