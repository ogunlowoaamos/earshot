(async () => {
 try {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const log = [];
  const step = (name, ok, detail) => log.push((ok ? 'PASS ' : 'FAIL ') + name + (detail ? ' :: ' + detail : ''));

  const btnByText = (re, root = document) =>
    [...root.querySelectorAll('button, a')].find((el) => re.test((el.textContent || '').trim()) && el.offsetParent !== null);

  const setInput = (el, value) => {
    try {
      const proto = el.tagName === 'SELECT' ? window.HTMLSelectElement.prototype
        : el.tagName === 'TEXTAREA' ? window.HTMLTextAreaElement.prototype
        : window.HTMLInputElement.prototype;
      const desc = Object.getOwnPropertyDescriptor(proto, 'value');
      if (desc && desc.set) desc.set.call(el, value);
      else el.value = value;
    } catch (err) {
      el.value = value;
      log.push('note: native setter failed on ' + el.id + ' (' + err.message + ')');
    }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  const go = async (path) => {
    history.pushState({}, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await wait(900);
  };

  // ---- 1. add to cart from the menu ----
  await go('/menu');
  const firstCard = document.querySelector('.menu-card');
  if (!firstCard) return 'FAIL no menu cards';
  const dishName = (firstCard.querySelector('h3') || {}).textContent || '(unknown)';
  const addBtn = btnByText(/^Add$/i, firstCard);
  if (!addBtn) step('find Add button', false);
  else {
    addBtn.click();
    await wait(700);
    const badge = document.querySelector('.cart-btn__badge');
    step('add to cart updates badge', badge && badge.textContent.trim() === '1', 'badge=' + (badge && badge.textContent.trim()) + ' dish=' + dishName.trim());
  }

  // ---- 2. open the cart drawer ----
  const cartBtn = document.querySelector('.cart-btn');
  cartBtn.click();
  await wait(600);
  const drawer = document.querySelector('.cart-drawer');
  step('cart drawer opens', !!drawer && drawer.classList.contains('is-open'));

  const line = document.querySelector('.cart-line');
  step('cart line rendered', !!line, line ? line.textContent.trim().slice(0, 60) : 'no .cart-line');

  // ---- 3. quantity steppers ----
  const inc = line && [...line.querySelectorAll('button')].find((b) => /increase/i.test(b.getAttribute('aria-label') || ''));
  const dec = line && [...line.querySelectorAll('button')].find((b) => /decrease/i.test(b.getAttribute('aria-label') || ''));
  if (inc && dec) {
    inc.click();
    await wait(500);
    const qty2 = (line.querySelector('.qty span') || {}).textContent;
    dec.click();
    await wait(500);
    const qty1 = (line.querySelector('.qty span') || {}).textContent;
    step('qty steppers work', String(qty2).trim() === '2' && String(qty1).trim() === '1', 'after+=' + qty2 + ' after-=' + qty1);
  } else step('qty steppers present', false);

  // ---- 4. go to checkout ----
  const toCheckout = btnByText(/checkout/i, drawer);
  step('checkout link in drawer', !!toCheckout, toCheckout ? toCheckout.textContent.trim() : 'none');
  if (toCheckout) {
    toCheckout.click();
    await wait(900);
    step('checkout route', location.pathname === '/checkout', location.pathname);
  }

  // ---- 5. fill the form ----
  const submit0 = document.querySelector('.checkout__grid button[type="submit"]') || btnByText(/place order|pay|submit/i);
  step('submit button exists', !!submit0, submit0 && submit0.textContent.trim());

  const name = document.querySelector('#name');
  const phone = document.querySelector('#phone');
  const email = document.querySelector('#email');
  const address = document.querySelector('#address');
  if (name && phone && email && address) {
    setInput(name, 'Ada Obi');
    setInput(phone, '08031234567');
    setInput(email, 'ada@example.com');
    setInput(address, '12 Ademola Adetokunbo Crescent, Wuse 2');
    await wait(300);
    step('form accepts input', name.value === 'Ada Obi' && email.value === 'ada@example.com', name.value + ' / ' + phone.value);
  } else step('form fields present', false, [!!name, !!phone, !!email, !!address].join(','));

  const stateSel = document.querySelector('#state');
  if (stateSel) {
    const opts = [...stateSel.options].map((o) => o.value).filter(Boolean);
    setInput(stateSel, opts[0] || 'abuja');
    await wait(400);
    step('state select works', !!stateSel.value, 'options=' + opts.join(',') + ' chosen=' + stateSel.value);
  } else step('state select present', false);

  const delivery = document.querySelector('input[value="delivery"]');
  if (delivery) { delivery.click(); await wait(500); step('delivery radio selectable', delivery.checked); }

  // ---- 6. submit ----
  const submit = document.querySelector('.checkout__grid button[type="submit"]') || btnByText(/place order|submit/i);
  if (submit) {
    const before = location.pathname;
    submit.click();
    await wait(3500);
    const after = location.pathname;
    const bodyText = document.body.innerText;
    const confirmed = after !== before || /thank|confirmed|order\s*(number|no|#)|reference/i.test(bodyText);
    step('order submitted', confirmed, before + ' -> ' + after + ' | ' + bodyText.replace(/\s+/g, ' ').slice(0, 140));
  } else step('submit clicked', false);

  return log.join('\n');
 } catch (err) {
  log.push('ERROR ' + err.message + ' @ ' + String(err.stack || '').split('\n')[1]);
  return log.join('\n');
 }
})()
