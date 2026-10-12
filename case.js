// Case study pages. The page is complete without this file.
(() => {
  const bar = document.querySelector('.cs-bar i');
  const progress = () => { const max = document.documentElement.scrollHeight - innerHeight; if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`; };
  progress(); addEventListener('scroll', progress, { passive: true }); addEventListener('resize', progress);

  // Click or tap any screen to open it in the viewer. It first fits the screen; another tap zooms to full detail,
  // and it can then be dragged or scrolled around, so nothing in a screenshot is lost on a phone.
  const box = document.querySelector('.lightbox');
  if (box) {
    const big = box.querySelector('img'), stage = document.createElement('div'); stage.className = 'lb-stage';
    box.appendChild(stage); stage.appendChild(big);
    const x = document.createElement('button'); x.type = 'button'; x.className = 'lb-x'; x.textContent = 'Close'; box.appendChild(x);
    const hint = document.createElement('p'); hint.className = 'lb-hint'; box.appendChild(hint);
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Picture viewer');
    const touch = matchMedia('(pointer: coarse)').matches;
    let opener = null, pushed = false;
    const zoom = (on, cx, cy) => {
      const before = big.getBoundingClientRect(), fx = cx === undefined ? 0.5 : (cx - before.left) / before.width, fy = cy === undefined ? 0.5 : (cy - before.top) / before.height;
      box.style.setProperty('--zw', Math.round(Math.max(innerWidth * 1.6, Math.min(big.naturalWidth || 2400, innerWidth * (touch ? 3.2 : 2.2)))) + 'px');
      box.classList.toggle('is-zoomed', on);
      if (!on) { box.scrollTo(0, 0); return; }
      // keep the point that was tapped under the finger
      const after = big.getBoundingClientRect();
      box.scrollLeft = after.left + box.scrollLeft + fx * after.width - innerWidth / 2;
      box.scrollTop = after.top + box.scrollTop + fy * after.height - innerHeight / 2;
    };
    const shut = (fromHistory) => {
      if (box.hidden) return; box.hidden = true; box.classList.remove('is-zoomed'); big.removeAttribute('src'); document.body.style.overflow = '';
      if (pushed && !fromHistory) { pushed = false; history.back(); } pushed = false;
      if (opener) opener.focus({ preventScroll: true });
    };
    document.querySelectorAll('.zoom').forEach((b) => b.addEventListener('click', () => {
      const small = b.querySelector('img'); opener = b;
      // show the copy already on the page at once, then swap in the full-size file when it has arrived
      big.src = small.currentSrc || small.src; big.alt = small.alt;
      const ready = touch ? 'Tap to zoom in, then drag to look around' : 'Click to zoom in, scroll to look around';
      hint.textContent = 'Loading full size'; box.classList.add('is-loading');
      const full = new Image();
      full.onload = () => { if (!box.hidden && opener === b) { big.src = full.src; hint.textContent = ready; box.classList.remove('is-loading'); } };
      full.onerror = () => { if (!box.hidden && opener === b) { hint.textContent = "Full size didn't load. This is the smaller copy."; box.classList.remove('is-loading'); } };
      full.src = b.dataset.full;
      box.hidden = false; box.scrollTo(0, 0); document.body.style.overflow = 'hidden'; x.focus({ preventScroll: true });
      try { history.pushState({ viewer: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
    }));
    big.addEventListener('click', (e) => { e.stopPropagation(); zoom(!box.classList.contains('is-zoomed'), e.clientX, e.clientY); });
    x.addEventListener('click', (e) => { e.stopPropagation(); shut(); });
    stage.addEventListener('click', (e) => { if (e.target === stage) shut(); });
    addEventListener('keydown', (e) => { if (e.key === 'Escape') shut(); });
    addEventListener('popstate', () => { if (pushed) { pushed = false; shut(true); } });
  }

  // Recordings play only while they are on screen, and each has its own pause button.
  // With reduced motion they do not start until asked.
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.querySelectorAll('.vid').forEach((box) => {
    const v = box.querySelector('video'), b = box.querySelector('.vid-b');
    let held = calm, seen = false;
    const label = () => { b.textContent = v.paused ? 'Play' : 'Pause'; b.setAttribute('aria-pressed', String(v.paused)); };
    const sync = () => { if (seen && !held) v.play().catch(() => {}); else v.pause(); };
    v.addEventListener('play', label); v.addEventListener('pause', label); label();
    // Loading state: while the recording is still arriving the button says so, then goes back to Pause.
    const busy = (on) => { box.classList.toggle('is-loading', on); if (on && !v.paused) b.textContent = 'Loading'; else label(); };
    v.addEventListener('waiting', () => busy(true)); v.addEventListener('loadstart', () => { if (seen && !held) busy(true); });
    ['playing', 'canplay', 'error', 'pause'].forEach((ev) => v.addEventListener(ev, () => busy(false)));
    b.addEventListener('click', () => { held = !v.paused; sync(); });
    // Full screen, so a recording of a desktop screen can be watched at a readable size on a phone.
    const f = box.querySelector('.vid-f');
    if (f) {
      const can = v.requestFullscreen || v.webkitRequestFullscreen || v.webkitEnterFullscreen;
      if (!can) f.hidden = true;
      else f.addEventListener('click', () => { try { v.controls = true; const p = can.call(v); if (p && p.catch) p.catch(() => { v.controls = false; }); } catch (e) { v.controls = false; } });
      const out = () => { if (!document.fullscreenElement && !document.webkitFullscreenElement) v.controls = false; };
      document.addEventListener('fullscreenchange', out); document.addEventListener('webkitfullscreenchange', out); v.addEventListener('webkitendfullscreen', () => { v.controls = false; sync(); });
    }
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => es.forEach((e) => { seen = e.isIntersecting; sync(); }), { threshold: 0.35 }).observe(v);
    else { seen = true; sync(); }
  });

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const root = document.documentElement; root.classList.add('js'); window.__reveals = 1;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.add('is-ready')));
  const targets = [...document.querySelectorAll('[data-wipe], [data-rise]')];
  // opens two frames later, so the closed state has always been drawn first and the movement can never be skipped
  const open = (el) => requestAnimationFrame(() => requestAnimationFrame(() => { el.classList.add('in'); }));
  // A frame only opens once the picture inside it has arrived, so the animation is always of the picture itself
  // and never of an empty frame. If the picture is very slow the frame opens anyway and the picture fades in.
  const show = (el) => {
    if (el.dataset.shown) return; el.dataset.shown = '1';
    const late = [...el.querySelectorAll('img')].filter((i) => !i.closest('.tv-screen') && !(i.complete && i.naturalWidth > 0));
    if (!late.length) { open(el); return; }
    let left = late.length, done = false;
    const go = () => { if (done) return; done = true; open(el); };
    late.forEach((i) => {
      if (i.loading === 'lazy') i.loading = 'eager';
      const one = () => { if (--left <= 0) { if (i.decode) i.decode().then(go, go); else go(); } };
      i.addEventListener('load', one, { once: true }); i.addEventListener('error', one, { once: true });
    });
    setTimeout(go, 3000);
  };
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) show(e.target); }), { rootMargin: '0px 0px -24px 0px' });
  // Everything animates once, on the way down, and then stays open for good. Anything that comes into view from the
  // top of the screen instead (scrolling back up, or after a jump down the page) is simply there: it is put in place
  // with its movement switched off for a moment, so nothing plays again on the way back up.
  const gone = (el) => { const r = el.getBoundingClientRect(); return r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth; };
  const place = (el) => {
    el.dataset.shown = '1'; el.classList.add('no-anim', 'in'); void el.offsetWidth;
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('no-anim')));
  };
  const settle = () => targets.forEach((el) => { if (!el.dataset.shown && el.getBoundingClientRect().top < 0) place(el); });
  let queued = false;
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(() => { queued = false; settle(); }); } }, { passive: true });
  targets.forEach((el) => io.observe(el));
  // pictures start downloading a screen and a half before they reach the line, so a frame never waits empty
  const ahead = new IntersectionObserver((es) => es.forEach((e) => { if (!e.isIntersecting) return;
    e.target.querySelectorAll('img[loading="lazy"]').forEach((i) => { i.loading = 'eager'; }); ahead.unobserve(e.target); }), { rootMargin: '0px 0px 150% 0px' });
  targets.forEach((el) => ahead.observe(el));
  // The safety net only opens what is on screen right now, with the observer's own line; what a jump skipped past
  // is put in place by settle() above.
  const onScreen = (el) => { const r = el.getBoundingClientRect(); return r.top < innerHeight - 24 && r.bottom > 0 && r.left < innerWidth && r.right > 0; };
  const net = () => { settle(); targets.forEach((el) => { if (onScreen(el)) show(el); }); };
  // Once scrolling has stopped at the foot of the page, anything still below the line opens, because there is no
  // more scrolling to lift it and nothing may stay hidden while it can be seen. Anywhere else a pause does not open
  // things early at the screen edge: they wait for the line, so the movement happens where the eye is.
  const atFoot = () => scrollY + innerHeight >= document.documentElement.scrollHeight - 4;
  const atRest = () => { settle(); const foot = atFoot(); targets.forEach((el) => { if (onScreen(el) || (foot && !gone(el))) show(el); }); };
  let rest = 0; const later = () => { clearTimeout(rest); rest = setTimeout(atRest, 700); };
  addEventListener('load', () => setTimeout(atRest, 1200));
  addEventListener('scroll', later, { passive: true }); document.addEventListener('scroll', later, { passive: true, capture: true });
  // More safety nets: coming back to the tab, a restored page, a rotated phone, and a slow first few seconds.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) later(); });
  addEventListener('pageshow', later); addEventListener('resize', later);
  let checks = 0; const timer = setInterval(() => { net(); if (++checks > 8) clearInterval(timer); }, 1500);
})();
