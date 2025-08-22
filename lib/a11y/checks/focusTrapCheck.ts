// checks/focusTrapCheck.js
// Uzlabots focus-trap tests Puppeteer vidē.
// Lietošana: const { simulateFocusTrap } = require('./checks/focusTrapCheck')

async function simulateFocusTrap(page, opts = {}) {
  const issues = [];
  const modalSelector = opts.modalSelector || '[role="dialog"], [role="alertdialog"]';

  // Atrodam PIRMĀ redzamā modāļa elementu
  const modalHandle = await page.$(modalSelector);
  if (!modalHandle) {
    issues.push('⚠️ Modal dialogs nav atrodams (role="dialog" vai "alertdialog").');
    return issues;
  }

  // Pārbaudes: aria-modal + accessible name
  const meta = await modalHandle.evaluate((el) => {
    const role = el.getAttribute('role') || '';
    const ariaModal = el.getAttribute('aria-modal');
    const label = el.getAttribute('aria-label');
    const labelledby = el.getAttribute('aria-labelledby');
    const labelledEl = labelledby ? document.getElementById(labelledby) : null;
    const accessibleName = (label && label.trim()) || (labelledEl && labelledEl.textContent.trim()) || '';
    return { role, ariaModal, hasAccessibleName: !!accessibleName };
  });

  if (!/^(dialog|alertdialog)$/.test(meta.role)) {
    issues.push(`⚠️ Modal elementam nav korekts role (atrasts: "${meta.role || 'nav'}").`);
  }
  if (meta.ariaModal !== 'true') {
    issues.push('⚠️ Ieteicams iestatīt aria-modal="true" modālim.');
  }
  if (!meta.hasAccessibleName) {
    issues.push('⚠️ Modālim trūkst pieejamais nosaukums (aria-label vai aria-labelledby).');
  }

  // Fokusējamo elementu atlase TIKAI modāļa iekšienē
  const FOCUSABLE_SELECTOR = [
    'a[href]',
    'area[href]',
    'input:not([disabled]):not([type="hidden"])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'details',
    'summary',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  let focusables = await modalHandle.$$(FOCUSABLE_SELECTOR);

  // Filtrējam neredzamos/ārpus plūsmas/aria-hidden/inert
  const visible = [];
  for (const h of focusables) {
    const ok = await h.evaluate((el) => {
      const style = window.getComputedStyle(el);
      const hiddenByStyle = style.display === 'none' || style.visibility === 'hidden';
      const rect = el.getBoundingClientRect();
      const invisibleGeom = rect.width === 0 || rect.height === 0;
      const disabled = el.hasAttribute('disabled');
      const ariaHidden = el.closest('[aria-hidden="true"]') !== null;
      const inert = el.closest('[inert]') !== null;
      return !(hiddenByStyle || invisibleGeom || disabled || ariaHidden || inert);
    });
    if (ok) visible.push(h);
    else await h.dispose().catch(() => {});
  }

  focusables = visible;

  if (focusables.length === 0) {
    issues.push('⚠️ Modāļa iekšienē nav fokusējamu elementu.');
    await modalHandle.dispose().catch(() => {});
    return issues;
  }

  // Papildu pārbaude: vai fons ir neinteraktīvs (inert vai aria-hidden)
  const backgroundOk = await page.evaluate((modalSel) => {
    const modal = document.querySelector(modalSel);
    if (!modal) return false;
    const root = document.body || document.documentElement;
    const siblings = Array.from(root.children).filter((n) => n !== modal && !modal.contains(n));
    // Ja ir vismaz viens siblings ar [inert] vai aria-hidden="true", uzskatām par OK (vienkāršota heurstika)
    return siblings.some((n) => n.hasAttribute('inert') || n.getAttribute('aria-hidden') === 'true');
  }, modalSelector);

  if (!backgroundOk) {
    issues.push('⚠️ Fons nav padarīts neinteraktīvs (apsver izmantot [inert] vai aria-hidden="true" ārpus modāļa).');
  }

  // Palīgfunkcijas
  const first = focusables[0];
  const last = focusables[focusables.length - 1];

  async function focusIsInsideModal() {
    return page.evaluate((sel) => {
      const m = document.querySelector(sel);
      return !!(m && document.activeElement && m.contains(document.activeElement));
    }, modalSelector);
  }

  // Sākotnējais fokuss uz first
  await first.focus();
  if (!(await focusIsInsideModal())) {
    issues.push('⚠️ Neizdevās iestatīt sākotnējo fokusu modālī.');
  }

  // TAB: ejam cauri un pārbaudām, ka fokuss neizbēg ārpus modāļa
  const steps = Math.min(focusables.length + 3, 50);
  let escaped = false;
  for (let i = 0; i < steps; i++) {
    await page.keyboard.press('Tab');
    if (!(await focusIsInsideModal())) {
      issues.push('❌ Fokuss aizbēga no modāļa, pārvietojoties ar TAB.');
      escaped = true;
      break;
    }
  }

  // Pārbaudām wrap (last → first) tikai ja nav jau izgāzies ar “escape”
  if (!escaped) {
    await last.focus();
    await page.keyboard.press('Tab'); // vajadzētu “apriņķot” uz first
    const wrappedToFirst = await page.evaluate((sel) => {
      const m = document.querySelector(sel);
      if (!m) return false;
      const focusables = m.querySelectorAll(
        'a[href],area[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),details,summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])'
      );
      return focusables.length > 0 && document.activeElement === focusables[0];
    }, modalSelector);

    if (!wrappedToFirst) {
      issues.push('⚠️ TAB no pēdējā elementa neapriņķo uz pirmo modālī.');
    }
  }

  // Shift+TAB: first → last
  await first.focus();
  await page.keyboard.down('Shift');
  await page.keyboard.press('Tab');
  await page.keyboard.up('Shift');

  const wrappedToLast = await page.evaluate((sel) => {
    const m = document.querySelector(sel);
    if (!m) return false;
    const list = m.querySelectorAll(
      'a[href],area[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),button:not([disabled]),details,summary,[contenteditable="true"],[tabindex]:not([tabindex="-1"])'
    );
    return list.length > 0 && document.activeElement === list[list.length - 1];
  }, modalSelector);

  if (!wrappedToLast) {
    issues.push('⚠️ Shift+TAB no pirmā elementa neapriņķo uz pēdējo modālī.');
  }

  if (!(await focusIsInsideModal())) {
    issues.push('❌ Fokuss nav modāļa iekšienē pēc navigācijas testa.');
  }

  // Ja nav nekas atrasts, viss ok
  if (issues.length === 0) {
    issues.push('✅ Focus trap darbojas korekti: TAB/Shift+TAB paliek modālī un apriņķo starp pirmo/pēdējo elementu.');
  }

  // Tīrīšana
  for (const h of focusables) await h.dispose().catch(() => {});
  await modalHandle.dispose().catch(() => {});

  return issues;
}

module.exports = { simulateFocusTrap };
