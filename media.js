// Shared by every page. Its only job is to make sure pictures and recordings always arrive.
// The pages work without it: every picture has a plain address and every recording has a poster.
(() => {
  const once = (fn) => { try { fn(); } catch (e) { /* one failure must never stop the rest */ } };

  // ---------- Pictures ----------
  // If a picture fails, step down until one works: drop the newer format, then the sized copies, then try the
  // plain file again after a pause. Only if all of that fails is the frame marked, with its description shown.
  const stepDown = (img) => {
    const n = +(img.dataset.tries || 0); img.dataset.tries = n + 1;
    const plain = img.dataset.fallback || img.getAttribute('src');
    const pic = img.parentElement && img.parentElement.tagName === 'PICTURE' ? img.parentElement : null;
    if (n === 0 && pic && pic.querySelector('source')) { pic.querySelectorAll('source').forEach((s) => s.remove()); img.src = plain; return; }
    if (n <= 1) { img.removeAttribute('srcset'); img.removeAttribute('sizes'); img.src = plain.split('?')[0] + '?retry=' + Date.now(); return; }
    if (n === 2) { setTimeout(() => { img.src = plain.split('?')[0] + '?retry=' + Date.now(); }, 2500); return; }
    // Error state: say what happened in plain words and offer a way to recover.
    img.classList.add('is-missing', 'is-in');
    const box = img.closest('figure, .plate, li') || img.parentElement;
    if (!box || box.querySelector('.media-msg')) return;
    box.classList.add('media-failed');
    const msg = document.createElement('p'); msg.className = 'media-msg small'; msg.setAttribute('role', 'status');
    msg.append("This picture didn't load" + (img.alt ? ': ' + img.alt.charAt(0).toLowerCase() + img.alt.slice(1) + '. ' : '. '));
    const again = document.createElement('button'); again.type = 'button'; again.className = 'u'; again.textContent = 'Try again';
    again.addEventListener('click', (e) => { e.stopPropagation(); e.preventDefault(); again.textContent = 'Trying'; img.dataset.tries = 1; img.src = plain.split('?')[0] + '?retry=' + Date.now(); setTimeout(() => { again.textContent = 'Try again'; }, 2500); });
    msg.append(again); box.append(msg);
  };
  const watch = (img) => {
    if (img.dataset.watched) return; img.dataset.watched = '1';
    img.addEventListener('error', () => stepDown(img));
    img.addEventListener('load', () => {
      img.classList.remove('is-missing'); img.classList.add('is-in');
      // once the fade has finished, drop the blurred copy behind it so it can never show at the edges
      const ph = img.closest('picture.ph'); if (ph) setTimeout(() => ph.classList.add('is-in'), 900);
      const b = img.closest('.media-failed'); if (b) { b.classList.remove('media-failed'); const msg = b.querySelector('.media-msg'); if (msg) msg.remove(); }
    });
    if (img.complete && img.naturalWidth > 0) { img.classList.add('is-in'); const ph = img.closest('picture.ph'); if (ph) ph.classList.add('is-in'); }
    if (img.complete && img.naturalWidth === 0 && img.currentSrc) stepDown(img);
  };
  const all = () => [...document.querySelectorAll('img')];
  once(() => {
    all().forEach(watch);
    // Pictures fade in over their blurred copy. The class goes on only now, after every picture is being watched,
    // and anything still hidden after eight seconds is shown regardless.
    if (!matchMedia('(prefers-reduced-motion: reduce)').matches) document.documentElement.classList.add('fade-media');
    setTimeout(() => once(() => all().forEach((i) => { if (i.complete) i.classList.add('is-in'); })), 8000);
  });

  // A picture that has been on screen for a while and still has not arrived is asked for again.
  const nudge = () => once(() => all().forEach((img) => {
    const r = img.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200 || r.width === 0) return;
    if (img.complete && img.naturalWidth > 0) return;
    if (img.loading === 'lazy') img.loading = 'eager';
    if (img.complete && img.naturalWidth === 0) stepDown(img);
  }));

  // Once the page itself has loaded, fetch the rest of the pictures quietly in the background, nearest first,
  // so they are already there when someone scrolls to them. Skipped when the visitor has asked to save data.
  const conn = navigator.connection || {};
  const frugal = conn.saveData || /(^|-)2g$/.test(conn.effectiveType || '');
  const warm = () => once(() => {
    if (frugal) return;
    const lazy = all().filter((i) => i.loading === 'lazy').sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
    let k = 0;
    const next = () => { const batch = lazy.slice(k, k + 3); k += 3; batch.forEach((i) => { i.loading = 'eager'; }); if (k < lazy.length) setTimeout(next, 350); };
    next();
  });
  const afterLoad = () => { setTimeout(warm, 1200); setTimeout(nudge, 4000); };
  if (document.readyState === 'complete') afterLoad(); else addEventListener('load', afterLoad);
  let t = 0; addEventListener('scroll', () => { clearTimeout(t); t = setTimeout(nudge, 1500); }, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) setTimeout(nudge, 600); });
  addEventListener('online', nudge);
  addEventListener('pageshow', (e) => { if (e.persisted) nudge(); });

  // ---------- Copying the email address ----------
  // Success and failure are both said out loud (and to screen readers) next to the button.
  once(() => document.querySelectorAll('.copy').forEach((b) => {
    const msg = b.parentElement.querySelector('.copy-msg'); let t = 0;
    const say = (text, good) => { msg.textContent = text; b.classList.toggle('is-done', !!good); clearTimeout(t); t = setTimeout(() => { msg.textContent = ''; b.classList.remove('is-done'); }, 4000); };
    b.addEventListener('click', async () => {
      const text = b.dataset.copy;
      try { await navigator.clipboard.writeText(text); say('Copied. Paste it into your email.', true); }
      catch (e) {
        // older browsers, or copying blocked: select the address on the page so one key press finishes the job
        const mail = document.querySelector('.mail span'); const sel = getSelection();
        if (mail && sel) { const r = document.createRange(); r.selectNodeContents(mail); sel.removeAllRanges(); sel.addRange(r); say("Couldn't copy automatically. The address is selected: press Ctrl+C, or Cmd+C on a Mac."); }
        else say("Couldn't copy. The address is " + text);
      }
    });
  }));

  // ---------- Losing the connection ----------
  // A small notice while offline, and a fresh attempt at anything missing once the connection is back.
  once(() => {
    const bar = document.createElement('p'); bar.className = 'net-note'; bar.setAttribute('role', 'status'); bar.hidden = true; document.body.appendChild(bar);
    let t = 0;
    const show = (text, stay) => { bar.textContent = text; bar.hidden = false; clearTimeout(t); if (!stay) t = setTimeout(() => { bar.hidden = true; }, 3500); };
    addEventListener('offline', () => show("You're offline. What's on screen still works; new pictures will load when you're back.", true));
    addEventListener('online', () => { show('Back online.'); once(() => document.querySelectorAll('img.is-missing').forEach((i) => { i.dataset.tries = 1; i.src = (i.dataset.fallback || i.src).split('?')[0] + '?retry=' + Date.now(); })); });
    if (navigator.onLine === false) show("You're offline. What's on screen still works; new pictures will load when you're back.", true);
  });

  // ---------- Recordings ----------
  // If a recording cannot play, its poster picture takes its place, so the frame is never empty.
  once(() => document.querySelectorAll('video').forEach((v) => {
    const swap = () => {
      if (v.dataset.swapped) return; v.dataset.swapped = '1';
      const img = new Image(); img.alt = v.getAttribute('aria-label') || ''; img.width = v.width; img.height = v.height; img.className = 'clip';
      img.src = v.dataset.poster || v.poster; v.replaceWith(img); watch(img);
      const box = img.closest('.vid');
      if (box) { box.classList.add('no-video'); const note = document.createElement('p'); note.className = 'media-msg small'; note.setAttribute('role', 'status'); note.textContent = "This recording couldn't play here, so this is a still from it."; box.after(note); }
    };
    let tries = 0;
    const fail = () => { if (tries++ < 1) { setTimeout(() => once(() => v.load()), 1500); return; } swap(); };
    v.addEventListener('error', fail);
    const srcs = v.querySelectorAll('source'); if (srcs.length) srcs[srcs.length - 1].addEventListener('error', fail);
    if (!v.canPlayType || !v.canPlayType('video/mp4')) swap();
  }));
})();
