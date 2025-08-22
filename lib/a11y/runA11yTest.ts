// lib/a11y/runA11yTest.ts
// A11Y Bot: Puppeteer + axe-core + PDF Report + AI Suggestions + Focus Trap Check (TS + shared browser)

import path from 'path';
import { promises as fs } from 'fs';
import { AxePuppeteer } from '@axe-core/puppeteer';
import type { AxeResults, ImpactValue } from 'axe-core';
import { withPage, hookPuppeteerShutdown } from '@/lib/puppeteer';
import { simulateFocusTrap } from './checks/focusTrapCheck';

// Safe terminate (SIGINT/SIGTERM) once per process
hookPuppeteerShutdown();

// ────────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────────

export type A11yRunResult = {
  score: number;
  critical: number;
  serious: number;
  moderate: number;
  minor: number;
};

/**
 * Runs an accessibility test for the given URL and generates a PDF at outputPath.
 *
 * @param url - The page URL to test
 * @param outputPath - Path where the generated PDF will be saved
 * @returns An object with the score and impact counts to store in DB
 */
export async function runA11yTest(url: string, outputPath: string): Promise<A11yRunResult> {
  if (!url || !/^https?:\/\//i.test(url)) {
    throw new Error("❌ Missing or invalid 'url'");
  }
  if (!outputPath) {
    throw new Error("❌ Missing 'outputPath'");
  }

  // Axe + AI + focus-trap
  const { axeResults, aiSuggestions, focusTrapResults } = await withPage(async (page) => {
    console.log(`[A11Y] Opening: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60_000 });

    console.log(`[A11Y] Running axe-core...`);
    const axeResults = (await new AxePuppeteer(page).analyze()) as AxeResults;

    console.log(`[A11Y] Collecting AI suggestions...`);
    const aiSuggestions = await getAISuggestions(page);

    console.log(`[A11Y] Running focus-trap checks...`);
    const focusTrapResults = await simulateFocusTrap(page);

    return { axeResults, aiSuggestions, focusTrapResults };
  });

  // HTML report
  console.log(`[A11Y] Building report HTML...`);
  const reportHTML = await generateReport(url, axeResults, aiSuggestions, focusTrapResults);

  // PDF
  console.log(`[A11Y] Generating PDF at: ${outputPath}`);
  await withPage(async (page) => {
    const outputDir = path.dirname(outputPath);
    await fs.mkdir(outputDir, { recursive: true });

    await page.setContent(reportHTML, { waitUntil: 'networkidle0' });
    await page.pdf({
      path: outputPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '18mm', right: '14mm', bottom: '18mm', left: '14mm' },
    });
  });

  // DB
  return {
    score: calculateScore(axeResults),
    critical: countByImpact(axeResults, 'critical'),
    serious: countByImpact(axeResults, 'serious'),
    moderate: countByImpact(axeResults, 'moderate'),
    minor: countByImpact(axeResults, 'minor'),
  };
}

async function generateReport(
  url: string,
  axeResults: AxeResults,
  ai: AISuggestions,
  focusTrap: string[]
): Promise<string> {
  let html = `
    <meta charset="utf-8" />
    <title>A11Y BOT Report – ${escapeHtml(url)}</title>
    <style>
      body { font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; line-height: 1.5; color: #111; }
      h1,h2,h3 { margin: 0.6em 0 0.35em }
      h1 { font-size: 22px; }
      h2 { font-size: 18px; margin-top: 1.1em; }
      h3 { font-size: 16px; }
      code, pre { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
      .muted { color: #666; }
      .badge { display:inline-block; font-size:12px; padding:2px 6px; border-radius: 6px; margin-left: 8px; }
      .impact-critical { background:#fee2e2; color:#991b1b; }
      .impact-serious  { background:#ffedd5; color:#9a3412; }
      .impact-moderate { background:#fef9c3; color:#854d0e; }
      .impact-minor    { background:#dcfce7; color:#166534; }
      .box { border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin:10px 0; }
      ul { margin: 0.3em 0 0.6em 1.2em; }
    </style>
    <h1>A11Y BOT Atzinums – ${escapeHtml(url)}</h1>
    <p class="muted">Ģenerēts: ${new Date().toLocaleString()}</p>
  `;

  const totals = {
    total: axeResults.violations.length,
    critical: countByImpact(axeResults, 'critical'),
    serious: countByImpact(axeResults, 'serious'),
    moderate: countByImpact(axeResults, 'moderate'),
    minor: countByImpact(axeResults, 'minor'),
  };
  const score = calculateScore(axeResults);

  html += `
    <div class="box">
      <h2>Kopsavilkums</h2>
      <ul>
        <li><b>Score:</b> ${score}/100</li>
        <li><b>Kopā pārkāpumi:</b> ${totals.total}</li>
        <li><b>Critical:</b> ${totals.critical}</li>
        <li><b>Serious:</b> ${totals.serious}</li>
        <li><b>Moderate:</b> ${totals.moderate}</li>
        <li><b>Minor:</b> ${totals.minor}</li>
      </ul>
    </div>
  `;

  // Axe
  if (axeResults.violations.length > 0) {
    html += `<h2>axe-core pārkāpumi</h2>`;
    axeResults.violations.forEach((v, idx) => {
      const count = v.nodes?.length ?? 0;
      const badgeClass = impactBadgeClass(v.impact);
      html += `
        <div class="box">
          <h3>🔴 #${idx + 1}: ${escapeHtml(v.help)} 
            <span class="badge ${badgeClass}">${escapeHtml(v.impact ?? 'unknown')}</span>
            <span class="muted">(${count} elementi)</span>
          </h3>
          <p><b>Apraksts:</b> ${escapeHtml(v.description || '')}</p>
          <p><b>Palīdzība:</b> ${escapeHtml(v.helpUrl || '')}</p>
          ${v.nodes?.map(n => `
            <div class="box" style="background:#fafafa">
              <div><b>Selektors:</b> <code>${escapeHtml(n.target.join(', '))}</code></div>
              ${n.failureSummary ? `<div><b>Kopsavilkums:</b> ${escapeHtml(n.failureSummary)}</div>` : ''}
            </div>
          `).join('') ?? ''}
        </div>
      `;
    });
  } else {
    html += `<p>✅ Nav konstatētu axe-core pārkāpumu.</p>`;
  }

  // AI
  html += `<h2>AI suggestions</h2>`;
  const anyAISuggestions = (ai.suggestions.length + ai.aria.length + ai.contrast.length) > 0;
  if (!anyAISuggestions) {
    html += `<p>✅ Papildu ieteikumi nav nepieciešami.</p>`;
  } else {
    if (ai.suggestions.length) {
      html += `<h3>Semantika un alt teksti</h3><ul>${ai.suggestions.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
    }
    if (ai.aria.length) {
      html += `<h3>ARIA lietojums</h3><ul>${ai.aria.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
    }
    if (ai.contrast.length) {
      html += `<h3>Kontrasts</h3><ul>${ai.contrast.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
    }
  }

  // Focus trap
  html += `<h2>Focus Trap Tests</h2>`;
  if (focusTrap && focusTrap.length > 0) {
    html += `<ul>${focusTrap.map(s => `<li>${escapeHtml(s)}</li>`).join('')}</ul>`;
  } else {
    html += `<p>✅ Netika konstatēti focus trap riski.</p>`;
  }

  return html;
}

// ────────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────────

type AISuggestions = {
  suggestions: string[];
  aria: string[];
  contrast: string[];
};

async function getAISuggestions(page: import('puppeteer').Page): Promise<AISuggestions> {
  return page.evaluate(() => {
    const suggestions: string[] = [];
    const aria: string[] = [];
    const contrast: string[] = [];

    // ALT text
    document.querySelectorAll('img').forEach((img, i) => {
      const src = img.getAttribute('src') || '';
      const alt = img.getAttribute('alt') || '';
      if (!alt || /^(image|img|photo|picture)[0-9]*$/i.test(alt)) {
        suggestions.push(`Ieteikums attēlam #${i + 1}: alt='${alt}' nav aprakstošs. Pievieno jēgpilnu alt (piem., no '${src}').`);
      }
    });

    // ARIA
    document.querySelectorAll('[role]').forEach((el) => {
      const role = el.getAttribute('role') || '';
      if (!/^(button|navigation|main|dialog|alert|checkbox|tab|tooltip|link|list|listitem|grid|gridcell|row|table|banner|contentinfo|complementary)$/.test(role)) {
        aria.push(`Nestandarta ARIA loma '${role}' elementam <${el.tagName.toLowerCase()}> – pārliecinies, ka tā ir pareiza un nepieciešama.`);
      }
    });

    // Kontrasts (vienkāršota heuristika)
    function parseRGB(color: string): [number, number, number] | null {
      const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
      return m ? [parseInt(m[1]), parseInt(m[2]), parseInt(m[3])] : null;
    }
    function luminance([r, g, b]: [number, number, number]) {
      const a = [r, g, b].map((v) => {
        const n = v / 255;
        return n <= 0.03928 ? n / 12.92 : Math.pow((n + 0.055) / 1.055, 2.4);
      });
      return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
    }
    function ratio(rgb1: [number, number, number], rgb2: [number, number, number]) {
      const L1 = luminance(rgb1);
      const L2 = luminance(rgb2);
      const [brightest, darkest] = [Math.max(L1, L2), Math.min(L1, L2)];
      return (brightest + 0.05) / (darkest + 0.05);
    }

    document.querySelectorAll<HTMLElement>('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      const fg = parseRGB(style.color);
      const bg = parseRGB(style.backgroundColor);
      if (fg && bg) {
        const r = ratio(fg, bg);
        if (r < 4.5) {
          contrast.push(`Zems kontrasts (${r.toFixed(2)}:1) starp tekstu ${style.color} un fonu ${style.backgroundColor} elementam <${el.tagName.toLowerCase()}>.`);
        }
      }
    });

    return { suggestions, aria, contrast };
  });
}

function countByImpact(results: AxeResults, level: ImpactValue | 'unknown'): number {
  return results.violations.filter(v => (v.impact ?? 'unknown') === level).length;
}

function calculateScore(results: AxeResults): number {
  const total = results.violations.length;
  if (total === 0) return 100;

  const weights: Record<string, number> = {
    critical: 5,
    serious: 3,
    moderate: 2,
    minor: 1,
  };

  let penalty = 0;
  for (const v of results.violations) {
    penalty += weights[v.impact ?? 'minor'] ?? 1;
  }
  return Math.max(0, 100 - penalty);
}

/**
 * Escapes characters with special meaning in HTML (`&`, `<`, `>`, `"`, `'`)
 * so the result is safe to insert into HTML text nodes and attribute values.
 *
 * The value is first converted to a string using `String(input)`.
 *
 * @param input - The value to escape; may be any type.
 * @returns The HTML-escaped string.
 *
 * @example
 * escapeHtml('<div class="msg">Tom & Jerry</div>');
 * // → "&lt;div class=&quot;msg&quot;&gt;Tom &amp; Jerry&lt;/div&gt;"
 */
function escapeHtml(input: unknown): string {
  let s = '';
  if (typeof input === 'string') s = input;
  else {
    try { s = JSON.stringify(input); }
    catch { s = String(input); }
  }
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

function impactBadgeClass(impact?: ImpactValue | null): string {
  switch (impact) {
    case 'critical': return 'impact-critical';
    case 'serious':  return 'impact-serious';
    case 'moderate': return 'impact-moderate';
    case 'minor':    return 'impact-minor';
    default:         return 'impact-minor';
  }
}
