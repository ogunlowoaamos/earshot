(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const step = (n, ok, d) => log.push((ok ? 'PASS ' : 'FAIL ') + n + (d ? ' :: ' + d : ''));
  const go = async (p) => { history.pushState({}, '', p); window.dispatchEvent(new PopStateEvent('popstate')); await wait(900); };
  const vis = (el) => el && el.offsetParent !== null;
  const btn = (re, root = document) => [...root.querySelectorAll('button, a')].find((e) => re.test((e.textContent || '').trim()) && vis(e));

  try {
    // ---- clean slate ----
    localStorage.removeItem('feastfusion.cart');
    await go('/');
    await go('/menu');
    let cards = document.querySelectorAll('.menu-card');
    step('menu renders cards', cards.length > 0, cards.length + ' cards');

    // ---- search filter ----
    const search = document.querySelector('.menu-search input');
    if (search) {
      const before = cards.length;
      const proto = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value');
      proto.set.call(search, 'jollof');
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(800);
      cards = document.querySelectorAll('.menu-card');
      const names = [...cards].map((c) => (c.querySelector('h3') || {}).textContent || '');
      step('search filters', cards.length < before && names.length > 0, before + ' -> ' + cards.length + ' [' + names.join(' | ').slice(0, 60) + ']');
      proto.set.call(search, '');
      search.dispatchEvent(new Event('input', { bubbles: true }));
      await wait(700);
      step('search clears', document.querySelectorAll('.menu-card').length === before, 'back to ' + document.querySelectorAll('.menu-card').length);
    } else step('search input found', false);

    // ---- category chips ----
    const chips = [...document.querySelectorAll('button.chip')];
    step('category chips present', chips.length > 1, chips.map((c) => c.textContent.trim()).join(' | '));
    const grill = chips.find((c) => /grill/i.test(c.textContent));
    if (grill) {
      const before = document.querySelectorAll('.menu-card').length;
      grill.click();
      await wait(900);
      const after = document.querySelectorAll('.menu-card').length;
      const active = grill.className.includes('is-active') || grill.getAttribute('aria-pressed') === 'true';
      step('chip filters + marks active', active && after !== before, 'active=' + active + ' ' + before + ' -> ' + after);
      const all = chips.find((c) => /^all$/i.test(c.textContent.trim()));
      if (all) { all.click(); await wait(800); }
    }

    // ---- add to cart: exact count ----
    const card = document.querySelector('.menu-card');
    const add = btn(/^Add$/i, card);
    add.click();
    await wait(800);
    let badge = (document.querySelector('.cart-btn__badge') || {}).textContent || '';
    step('badge 0 -> 1', badge.trim() === '1', 'badge=' + badge.trim());

    document.querySelector('.cart-btn').click();
    await wait(600);
    const line = document.querySelector('.cart-line');
    const qtyText = () => (document.querySelector('.cart-line .qty span') || {}).textContent;
    step('line qty starts at 1', String(qtyText()).trim() === '1', 'qty=' + qtyText());
    const inc = [...line.querySelectorAll('button')].find((b) => /increase/i.test(b.getAttribute('aria-label') || ''));
    inc.click(); await wait(600);
    step('increase -> 2', String(qtyText()).trim() === '2', 'qty=' + qtyText());
    const dec = [...line.querySelectorAll('button')].find((b) => /decrease/i.test(b.getAttribute('aria-label') || ''));
    dec.click(); await wait(600);
    step('decrease -> 1', String(qtyText()).trim() === '1', 'qty=' + qtyText());
    const rm = [...line.querySelectorAll('button')].find((b) => /remove/i.test((b.textContent || '') + (b.getAttribute('aria-label') || '')));
    if (rm) {
      rm.click(); await wait(700);
      step('remove empties cart', document.querySelectorAll('.cart-line').length === 0, 'lines=' + document.querySelectorAll('.cart-line').length);
    } else step('remove button found', false);
    const close = [...document.querySelectorAll('.cart-drawer button')].find((b) => /close/i.test(b.getAttribute('aria-label') || '') || /close/i.test(b.textContent || ''));
    if (close) { close.click(); await wait(500); step('drawer closes', !document.querySelector('.cart-drawer').classList.contains('is-open')); }

    // ---- three.js map legend ----
    await go('/');
    const map = document.querySelector('.coverage-map');
    step('map mounted', !!map, map ? map.querySelector('canvas') ? 'canvas ok' : 'no canvas' : 'missing');
    const legendBtns = [...document.querySelectorAll('.coverage-map__legend button, .coverage-map button')];
    step('legend buttons present', legendBtns.length > 0, legendBtns.length + ' buttons');
    if (legendBtns.length > 1) {
      legendBtns[1].click();
      await wait(700);
      const focused = document.querySelector('.coverage-map .is-focus') || legendBtns[1].className.includes('is-focus');
      step('legend click focuses a zone', !!focused, 'clicked=' + legendBtns[1].textContent.trim().slice(0, 24));
      let gl = null;
      const c = document.querySelector('.coverage-map__canvas canvas') || document.querySelector('.coverage-map canvas');
      if (c) { gl = c.getContext('webgl2') || c.getContext('webgl'); }
      step('webgl context healthy', !!gl && !gl.isContextLost(), gl ? 'err=' + gl.getError() : 'no ctx');
    }

    // ---- theme toggle ----
    const themeBtn = document.querySelector('.theme-btn');
    const t0 = document.documentElement.dataset.theme;
    themeBtn.click(); await wait(500);
    const t1 = document.documentElement.dataset.theme;
    themeBtn.click(); await wait(500);
    const t2 = document.documentElement.dataset.theme;
    step('theme toggles both ways', t0 !== t1 && t2 === t0, t0 + ' -> ' + t1 + ' -> ' + t2);

    // ---- burger menu ----
    const burger = document.querySelector('.burger');
    if (vis(burger)) {
      burger.click(); await wait(600);
      const nav = document.querySelector('.site-nav');
      step('burger opens nav', nav.classList.contains('is-open'));
      const cta = document.querySelector('.site-nav__cta');
      step('nav CTA tap size', cta && Math.round(cta.getBoundingClientRect().height) >= 44, cta ? Math.round(cta.getBoundingClientRect().width) + 'x' + Math.round(cta.getBoundingClientRect().height) : 'none');
      burger.click(); await wait(500);
      step('burger closes nav', !document.querySelector('.site-nav').classList.contains('is-open'));
    } else step('burger visible on phone', false);

    // ---- track page ----
    await go('/track');
    const refInput = document.querySelector('.track input, #ref, #order-ref');
    step('track input present', !!refInput, refInput ? refInput.id || refInput.name || refInput.className : 'none');
  } catch (err) {
    log.push('ERROR ' + err.message + ' @ ' + String(err.stack || '').split('\n')[1]);
  }
  return log.join('\n');
})()
