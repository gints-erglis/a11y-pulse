// A11Y Bot: Puppeteer + axe-core + PDF Report + AI Suggestions + Focus Trap Check

const puppeteer = require('puppeteer');
const { AxePuppeteer } = require('@axe-core/puppeteer');
const fs = require('fs/promises');
const path = require('path');
const { simulateFocusTrap } = require('./checks/focusTrapCheck');

// Utility to sanitize unsafe characters for HTML
function sanitizeText(input) {
  if (typeof input !== 'string') {
    try {
      input = JSON.stringify(input);
    } catch (e) {
      input = String(input);
    }
  }

  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '');
}

// Core reusable function
async function runA11yTest(url, outputPath) {
  if (!url || !outputPath) {
    throw new Error("❌ Missing 'url' or 'outputPath'");
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();

  try {
    console.log(`Opening: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 60000 });

    console.log(`Running axe-core...`);
    const axeResults = await new AxePuppeteer(page).analyze();

    console.log(`Collecting AI suggestions...`);
    const aiSuggestions = await getAISuggestions(page);

    console.log(`Running focus trap checks...`);
    const focusTrapResults = await simulateFocusTrap(page);

    console.log(`Building report HTML...`);
    const reportHTML = await generateReport(url, axeResults, aiSuggestions, focusTrapResults);

    console.log(`Generating PDF at: ${outputPath}`);
    await generatePDF(reportHTML, outputPath);

    return {
      score: calculateScore(axeResults),
      critical: countByImpact(axeResults, "critical"),
      serious: countByImpact(axeResults, "serious"),
      moderate: countByImpact(axeResults, "moderate"),
      minor: countByImpact(axeResults, "minor")
    };

  } catch (err) {
    console.error("A11Y Bot Error:", err);
    throw err;
  } finally {
    await browser.close();
  }
}

// Generate report from analysis results
async function generateReport(url, axeResults, aiSuggestions, focusTrapResults) {
  let reportHTML = `<h1>A11Y BOT Atzinums – ${url}</h1>`;

  // 1. axe-core pārkāpumi
  axeResults.violations.forEach((violation, i) => {
    const count = violation.nodes.length;
    reportHTML += `<h2>🔴 Problēma #${i + 1}: ${violation.help} <span style="font-weight:normal;">(${count} elementi)</span></h2>`;
    reportHTML += `<p><b>Ieteikums:</b> ${violation.description}</p>`;
    violation.nodes.forEach((node) => {
      reportHTML += `<p>➤ Elementa selektors: <code>${node.target.join(", ")}</code></p>`;
    });
  });

  // 2. AI ieteikumi
  reportHTML += `<h2>AI Ieteikumi</h2>`;
  aiSuggestions.suggestions.forEach(s => reportHTML += `<p>${s}</p>`);
  aiSuggestions.aria.forEach(s => reportHTML += `<p>${s}</p>`);
  if (aiSuggestions.contrast && aiSuggestions.contrast.length > 0) {
    aiSuggestions.contrast.forEach(s => reportHTML += `<p>${sanitizeText(s)}</p>`);
  }

  // 3. Focus Trap Testi
  reportHTML += `<h2>Focus Trap Tests</h2>`;
  if (focusTrapResults && focusTrapResults.length > 0) {
    focusTrapResults.forEach(s => reportHTML += `<p>${sanitizeText(s)}</p>`);
  } else {
    reportHTML += `<p>✅ No focus trap issues detected.</p>`;
  }

  return reportHTML;
}

// Convert HTML to PDF
async function generatePDF(reportHTML, outputPath) {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  const outputDir = path.dirname(outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  await page.setContent(reportHTML, { waitUntil: 'networkidle0' });
  await page.pdf({
    path: outputPath,
    format: 'A4',
    printBackground: true
  });

  await browser.close();
  console.log(`PDF saglabāts: ${outputPath}`);
}

// 🧠 AI helpers from page context
async function getAISuggestions(page) {
  return await page.evaluate(() => {
    const suggestions = [];
    const aria = [];
    const contrast = [];

    document.querySelectorAll('img').forEach((img, i) => {
      const src = img.getAttribute('src') || "";
      const alt = img.getAttribute('alt') || "";
      if (!alt || /^(image|img|photo|picture)[0-9]*$/i.test(alt)) {
        suggestions.push(`🧠 Ieteikums attēlam #${i + 1}: Alt teksts '${alt}' nav aprakstošs. Ieteikums: 'Attēlā redzams objekts no '${src}'.`);
      }
    });

    document.querySelectorAll('[role]').forEach((el) => {
      const role = el.getAttribute('role');
      if (!/^(button|navigation|main|dialog|alert|checkbox|tab|tooltip)$/.test(role)) {
        aria.push(`⚠️ Nestandarta ARIA loma '<b>${role}</b>' elementam <${el.tagName.toLowerCase()}>.`);
      }
    });

    document.querySelectorAll('*').forEach((el) => {
      const style = window.getComputedStyle(el);
      const fg = style.color;
      const bg = style.backgroundColor;

      function parseRGB(color) {
        const match = color.match(/rgba?\((\d+), (\d+), (\d+)/);
        return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : null;
      }

      function luminance([r, g, b]) {
        const a = [r, g, b].map((v) => {
          v /= 255;
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
        });
        return a[0] * 0.2126 + a[1] * 0.7152 + a[2] * 0.0722;
      }

      function contrastRatio(rgb1, rgb2) {
        const lum1 = luminance(rgb1);
        const lum2 = luminance(rgb2);
        const brightest = Math.max(lum1, lum2);
        const darkest = Math.min(lum1, lum2);
        return (brightest + 0.05) / (darkest + 0.05);
      }

      const fgRGB = parseRGB(fg);
      const bgRGB = parseRGB(bg);

      if (fgRGB && bgRGB) {
        const ratio = contrastRatio(fgRGB, bgRGB);
        if (ratio < 4.5) {
          contrast.push(`⚠️ Zems kontrasts (${ratio.toFixed(2)}:1) starp tekstu <b>${fg}</b> un fonu <b>${bg}</b> elementam <${el.tagName.toLowerCase()}>.`);
        }
      }
    });

    return { suggestions, aria, contrast };
  });
}

function countByImpact(results, level) {
  return results.violations.filter(v => v.impact === level).length;
}

function calculateScore(results) {
  const total = results.violations.length;
  if (total === 0) return 100;

  const weights = {
    critical: 5,
    serious: 3,
    moderate: 2,
    minor: 1
  };

  let penalty = 0;
  results.violations.forEach(v => {
    penalty += weights[v.impact] || 1;
  });

  return Math.max(0, 100 - penalty);
}

// Exports for reuse
module.exports = runA11yTest;

// CLI Support
if (require.main === module) {
  const [,, url, outputPath] = process.argv;

  if (!url || !outputPath) {
    console.error("Usage: node a11y-bot.js <url> <outputPath>");
    process.exit(1);
  }

  runA11yTest(url, outputPath)
    .then(fp => console.log(`PDF report generated at: ${fp}`))
    .catch(err => {
      console.error("Script failed:", err.message);
      process.exit(1);
    });
}
