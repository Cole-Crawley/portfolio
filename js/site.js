// Panels wipe in once as they enter the viewport, and the contents page lands
// panel by panel. CSS only hides things when the `js` class is present and the
// visitor hasn't asked for reduced motion, so the page is complete without this.
(() => {
  const targets = document.querySelectorAll('[data-reveal], .page');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    targets.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.classList.add('is-in');
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.1 });

  targets.forEach((el) => observer.observe(el));
})();
