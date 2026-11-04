// Audits ONE route so the call stays short on a slow real phone.
// Caller sets window.__ffRoute first, e.g. "window.__ffRoute='/menu';" + script.
(async () => {
  try {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const raise = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    const parse = (c) => {
      const m = String(c).match(/rgba?\(([^)]+)\)/);
      if (!m) return null;
      const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
      return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
    };
    const lum = ({ r, g, b }) => 0.2126 * raise(r) + 0.7152 * raise(g) + 0.0722 * raise(b);
    const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
    const cls = (el) => (typeof el.className === 'string' && el.className.trim() ? '.' + el.className.trim().split(/\s+/)[0] : '');

    const bgOf = (el) => {
      let cur = el, acc = null, grad = false;
      while (cur) {
        const cs = getComputedStyle(cur);
        if (cs.backgroundImage !== 'none') grad = true;
        const c = parse(cs.backgroundColor);
        if (c && c.a > 0) { acc = acc ? over(acc, c) : c; if (acc.a >= 0.99) return { bg: acc, grad }; }
        cur = cur.parentElement;
      }
      return { bg: acc || { r: 255, g: 255, b: 255, a: 1 }, grad };
    };

    // A hidden ancestor (closed drawer, faded panel) makes the text invisible,
    // so judging its contrast is meaningless. Children report their own
    // opacity:1 even when the parent is transparent, so walk up.
    const hiddenByAncestor = (el) => {
      let cur = el
      while (cur && cur !== document.documentElement) {
        const s = getComputedStyle(cur)
        if (s.visibility === 'hidden' || s.display === 'none') return true
        const op = parseFloat(s.opacity)
        if (!Number.isNaN(op) && op < 0.05) return true
        cur = cur.parentElement
      }
      return false
    }

    const contrastFails = () => {
      const out = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 4 || r.height < 4) return;
        if (el.closest('[aria-hidden="true"]')) return;
        if (hiddenByAncestor(el)) return;
        if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim().length > 1)) return;
        const cs = getComputedStyle(el);
        if (cs.visibility === 'hidden' || cs.opacity === '0' || cs.display === 'none') return;
        const fg = parse(cs.color);
        if (!fg) return;
        const { bg, grad } = bgOf(el);
        if (grad) return;
        const f = fg.a < 1 ? over(fg, bg) : fg;
        const a = lum(f), b = lum(bg);
        const ratio = (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
        const size = parseFloat(cs.fontSize);
        const weight = parseInt(cs.fontWeight, 10) || 400;
        const large = size >= 24 || (size >= 18.66 && weight >= 700);
        const need = large ? 3 : 4.5;
        if (ratio + 0.01 < need) out.push(el.tagName.toLowerCase() + cls(el) + ' "' + el.textContent.trim().slice(0, 16) + '" ' + ratio.toFixed(2));
      });
      return [...new Set(out)];
    };

    const overflow = () => {
      const vw = document.documentElement.clientWidth;
      const docW = document.documentElement.scrollWidth;
      if (docW <= vw + 1) return null;
      const bad = [];
      document.querySelectorAll('body *').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 8) return;
        if (r.right <= vw + 1 && r.left >= -1) return;
        const cs = getComputedStyle(el);
        if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.opacity === '0') return;
        bad.push(el.tagName.toLowerCase() + cls(el) + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
      });
      return 'docW=' + docW + ' > vw=' + vw + ' :: ' + [...new Set(bad)].slice(0, 5).join(' ; ');
    };

    const targets = () => {
      const fail = [], soft = [];
      document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role="button"]').forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) return;
        if (el.closest('[aria-hidden="true"]') || el.hasAttribute('disabled')) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden') return;
        const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || el.getAttribute('name') || el.tagName).trim().slice(0, 18);
        const desc = el.tagName.toLowerCase() + cls(el) + ' "' + label + '" ' + Math.round(r.width) + 'x' + Math.round(r.height);
        if (r.height < 24 || r.width < 24) fail.push(desc);
        else if (r.height < 44) soft.push(desc);
      });
      return { fail: [...new Set(fail)], soft: [...new Set(soft)] };
    };

    const nameless = () => {
      const out = [];
      document.querySelectorAll('button, a[href], [role="button"]').forEach((el) => {
        const name = (
          el.getAttribute('aria-label') ||
          el.getAttribute('title') ||
          el.textContent ||
          [...el.querySelectorAll('img[alt]')].map((i) => i.alt).join(' ')
        ).trim();
        if (!name) out.push(el.tagName.toLowerCase() + cls(el) + ' @y' + Math.round(el.getBoundingClientRect().top + scrollY));
      });
      return [...new Set(out)];
    };

    const scrollAll = async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += Math.round(innerHeight * 0.75)) { window.scrollTo(0, y); await wait(70); }
      window.scrollTo(0, 0);
      await wait(200);
    };

    const p = window.__ffRoute || location.pathname;
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await wait(800);
    await scrollAll();
    const ov = overflow();
    const t = targets();
    const nm = nameless();
    const cf = contrastFails();
    const out = [
      '### ' + p + ' [' + document.documentElement.dataset.theme + '] ' + innerWidth + 'x' + innerHeight +
      ' ovf=' + (ov || 'ok') + ' tgtFAIL=' + t.fail.length + ' tgtSOFT=' + t.soft.length +
      ' nameless=' + nm.length + ' contrast=' + cf.length,
    ];
    if (ov) out.push('   OVF: ' + ov);
    if (t.fail.length) out.push('   FAIL: ' + t.fail.slice(0, 6).join(' ; '));
    if (t.soft.length) out.push('   soft: ' + t.soft.slice(0, 5).join(' ; '));
    if (nm.length) out.push('   NAME: ' + nm.slice(0, 4).join(' ; '));
    if (cf.length) out.push('   CONTRAST: ' + cf.slice(0, 5).join(' ; '));
    return out.join('\n');
  } catch (e) {
    return 'AUDIT ERROR: ' + (e && e.message ? e.message : String(e));
  }
})()
