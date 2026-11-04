// Reads the rendered text of ONE route and reports banned characters and
// stale city names. Caller sets window.__ffRoute first, same as audit-one.js.
(async () => {
  try {
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const p = window.__ffRoute || location.pathname;
    history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
    await wait(900);

    const txt = document.body.innerText || '';
    const dash = (txt.match(/[\u2014\u2013]/g) || []).length;
    const stale = (txt.match(/Lagos|Yaba|Ikeja|Surulere|Lekki/gi) || []).length;
    const words = txt.trim().split(/\s+/).length;

    return `route=${p} dash=${dash} stale=${stale} words=${words} ` +
      `${dash === 0 && stale === 0 ? 'CLEAN' : 'FAIL'}`;
  } catch (e) {
    return 'ERROR ' + (e && e.message ? e.message : String(e));
  }
})();
