/* Theme: dark by default, light when the user toggles. The choice is applied before
   first paint by the inline script in each page head; this only wires the button. */
const KEY = 'sb_theme';

export function wireTheme(btn) {
  if (!btn) return;
  btn.addEventListener('click', () => {
    const light = document.documentElement.dataset.theme !== 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    try { localStorage.setItem(KEY, light ? 'light' : 'dark'); } catch {}
  });
}
