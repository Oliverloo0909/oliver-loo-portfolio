/* Oliver Loo — portfolio
   Three jobs: swap the page theme as you scroll, reveal blocks as they
   arrive, and run the matrix rain while Break is on screen. No deps. */

(function () {
  'use strict';

  var root    = document.documentElement;
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hasIO   = 'IntersectionObserver' in window;

  /* ── 1. theme switching ──────────────────────────────────────
     Whichever section covers the most of the viewport wins. Measured
     from the live rects on every frame we actually scroll, rather than
     from observer thresholds: a tall section only crosses a threshold
     rarely, which left the theme a step behind the reader. */

  var sections = [].slice.call(document.querySelectorAll('[data-theme]'));
  var dots     = [].slice.call(document.querySelectorAll('.rail a'));
  var queued   = false;

  function applyTheme() {
    queued = false;
    var vh = window.innerHeight, best = null, bestVal = -1;

    for (var i = 0; i < sections.length; i++) {
      var r = sections[i].getBoundingClientRect();
      // How much of the viewport this section currently fills.
      var visible = Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
      if (visible > bestVal) { bestVal = visible; best = sections[i].id; }
    }
    if (!best) return;

    if (root.getAttribute('data-section') !== best) root.setAttribute('data-section', best);
    for (var d = 0; d < dots.length; d++) {
      dots[d].classList.toggle('on', dots[d].getAttribute('data-dot') === best);
    }
  }

  function queueTheme() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(applyTheme);
  }

  window.addEventListener('scroll', queueTheme, { passive: true });
  window.addEventListener('resize', queueTheme, { passive: true });
  applyTheme();

  /* ── 2. reveal on scroll ─────────────────────────────────── */

  var reveals = [].slice.call(document.querySelectorAll('.reveal'));

  if (!hasIO || reduced) {
    reveals.forEach(function (el) { el.classList.add('in'); });
  } else {
    var revealIO = new IntersectionObserver(function (entries, obs) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('in');
        obs.unobserve(e.target);
      });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

    reveals.forEach(function (el, i) {
      // Small stagger so siblings arrive in sequence rather than as a block.
      el.style.transitionDelay = ((i % 4) * 70) + 'ms';
      revealIO.observe(el);
    });

    // Safety net. If the observer never delivers (odd browser, restored
    // session, prerender), show everything rather than leave a blank page.
    window.setTimeout(function () {
      reveals.forEach(function (el) { el.classList.add('in'); });
    }, 3000);
  }

  /* ── 3. scroll-scrubbed globe ────────────────────────────────
     The video never plays on its own. Its playhead is tied to how
     far down the page you are, so the globe turns because you
     scrolled, and stops when you stop. Eased toward the target
     rather than snapped, otherwise fast scrolling looks like a
     slideshow of keyframes. */

  var globe = document.getElementById('globe');

  if (globe && !reduced) {
    var want = 0, have = 0, ready = false, spin = null;

    // The video is often already loaded by the time this runs, in which
    // case loadedmetadata has fired and will never fire again. Check the
    // state directly as well as listening.
    function boot() {
      if (ready) return;
      globe.pause();
      ready = !!(globe.duration && isFinite(globe.duration));
      if (ready) window.requestAnimationFrame(drift);
    }
    if (globe.readyState >= 1) boot();
    globe.addEventListener('loadedmetadata', boot);

    // If seeking is not permitted (some mobile browsers refuse to
    // scrub without a gesture), fall back to a plain slow loop so
    // the hero is never a frozen frame.
    globe.addEventListener('error', loopInstead);
    window.setTimeout(function () { if (!ready) loopInstead(); }, 6000);

    function loopInstead() {
      if (spin) return;
      spin = true;
      globe.loop = true;
      var p = globe.play();
      if (p && p.catch) p.catch(function () {});
    }

    function measure() {
      var max = document.body.scrollHeight - window.innerHeight;
      var progress = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
      want = progress * globe.duration;
    }

    function drift() {
      window.requestAnimationFrame(drift);
      if (!ready || spin) return;
      measure();
      have += (want - have) * 0.12;
      if (Math.abs(want - have) > 0.004) {
        try { globe.currentTime = have; } catch (e) { loopInstead(); }
      }
    }
  }

  /* ── 4. matrix rain ──────────────────────────────────────────
     Falling glyph columns behind Break. Latin and symbols only, so
     nothing here depends on a CJK font being installed. Paused when
     the section is off screen or the tab is hidden. */

  var canvas = document.getElementById('rain');
  if (!canvas || reduced) return;

  var ctx    = canvas.getContext('2d');
  var GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>[]{}/\\|=+-*#$%&@!?_^~';
  var SIZE   = 15;
  var dpr    = Math.min(window.devicePixelRatio || 1, 2);
  var cols   = 0, drops = [], raf = null, last = 0;

  function resize() {
    canvas.width  = Math.floor(window.innerWidth  * dpr);
    canvas.height = Math.floor(window.innerHeight * dpr);
    canvas.style.width  = window.innerWidth  + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    cols  = Math.ceil(window.innerWidth / SIZE);
    drops = new Array(cols);
    for (var i = 0; i < cols; i++) {
      // Stagger the starts so the field doesn't fall as one flat line.
      drops[i] = -(((i * 37) % 60) + (i % 11) * 4);
    }
  }

  function frame(now) {
    raf = window.requestAnimationFrame(frame);
    if (now - last < 55) return;      // ~18fps: the classic effect is not smooth
    last = now;

    ctx.fillStyle = 'rgba(0,0,0,0.08)';   // translucent wipe leaves the tails
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    ctx.font = SIZE + 'px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'top';

    for (var i = 0; i < cols; i++) {
      var y = drops[i] * SIZE;
      if (y > 0) {
        ctx.fillStyle = '#d6ffe4';
        ctx.fillText(GLYPHS.charAt((Math.random() * GLYPHS.length) | 0), i * SIZE, y);
        ctx.fillStyle = 'rgba(0,255,112,0.7)';
        ctx.fillText(GLYPHS.charAt((Math.random() * GLYPHS.length) | 0), i * SIZE, y - SIZE);
      }
      drops[i]++;
      if (y > window.innerHeight && Math.random() > 0.975) drops[i] = 0;
    }
  }

  function start() {
    if (raf) return;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
    raf = window.requestAnimationFrame(frame);
  }
  function stop() { if (raf) { window.cancelAnimationFrame(raf); raf = null; } }

  function sync() {
    if (document.hidden) { stop(); return; }
    if (root.getAttribute('data-section') === 'break') start(); else stop();
  }

  resize();
  window.addEventListener('resize', resize, { passive: true });
  document.addEventListener('visibilitychange', sync);
  new MutationObserver(sync).observe(root, { attributes: true, attributeFilter: ['data-section'] });
  sync();
})();
