(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const h = () => getComputedStyle(document.querySelector('.site-header')).backgroundColor;
  const want = (t) => (t === 'dark' ? 'rgba(16, 14, 11, 0.82)' : 'rgba(250, 246, 240, 0.82)');
  const brand = () => getComputedStyle(document.querySelector('.brand__word')).color;
  const btn = document.querySelector('.theme-btn');
  const out = [];
  let bad = 0;
  for (let i = 1; i <= 6; i += 1) {
    btn.click();
    await wait(i % 2 === 0 ? 60 : 250);
    const t = document.documentElement.dataset.theme;
    const got = h();
    const ok = got === want(t);
    if (!ok) bad += 1;
    out.push('toggle ' + i + ' theme=' + t + ' header=' + got + ' brand=' + brand() + ' ok=' + ok);
  }
  out.push('mismatches=' + bad + ' classLeftOn=' + document.documentElement.classList.contains('theme-switching'));
  return out.join('\n');
})()
