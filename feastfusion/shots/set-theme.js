// Forces the app theme to light by clicking the real header toggle, so the
// measurement uses the exact code path a user does.
(async () => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  for (let i = 0; i < 4; i++) {
    if (document.documentElement.dataset.theme === 'light') break;
    const btn = document.querySelector('.theme-btn');
    if (!btn) return 'NO THEME BUTTON';
    btn.click();
    await wait(400);
  }
  return 'theme=' + document.documentElement.dataset.theme +
    ' stored=' + localStorage.getItem('feastfusion.theme');
})();
