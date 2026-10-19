// Shared by every page: the slim bar that slides in when you scroll back up.
(() => {
  const dock = document.querySelector('.dock'); if (!dock) return;
  const links = [...dock.querySelectorAll('a')];
  let last = scrollY, on = false;
  const set = (v) => { if (v === on) return; on = v; dock.classList.toggle('is-on', v); dock.inert = !v; };
  addEventListener('scroll', () => {
    if (document.querySelector('.lightbox:not([hidden])')) return; // the picture viewer is open, and it decides what can be reached
    const y = scrollY, up = y < last - 4, down = y > last + 4;
    if (y < innerHeight * 0.9) set(false); else if (up) set(true); else if (down) set(false);
    if (up || down) last = y;
  }, { passive: true });
})();
