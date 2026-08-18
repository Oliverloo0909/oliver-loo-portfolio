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

  // Crossfade the globe out and the orbital sunrise in as Hire
  // approaches, so the background reads as one continuous move rather
  // than a cut between two images.
  var hireSec = document.getElementById('hire');
  function horizon() {
    if (!hireSec) return;
    var r = hireSec.getBoundingClientRect(), vh = window.innerHeight;
    // 0 while Hire is a screen away, 1 once its top reaches mid-viewport.
    var h = 1 - (r.top - vh * 0.45) / (vh * 0.95);
    h = Math.min(1, Math.max(0, h));
    var e = h * h * (3 - 2 * h);
    root.style.setProperty('--horizon-op', e.toFixed(3));
    root.style.setProperty('--horizon-y', ((1 - e) * 16).toFixed(2) + '%');
    root.style.setProperty('--globe-op', (1 - e * 0.92).toFixed(3));
  }

  function queueTheme() {
    if (queued) return;
    queued = true;
    window.requestAnimationFrame(function () { applyTheme(); horizon(); });
  }

  window.addEventListener('scroll', queueTheme, { passive: true });
  window.addEventListener('resize', queueTheme, { passive: true });
  applyTheme();
  horizon();

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

  /* ── 4. rain in the title ────────────────────────────────────
     Splits the design headline into letters and drops them in when the
     section arrives, so the text lands on the water rather than fading
     up into place. Re-arms on exit so it plays again on a second pass. */

  var afloat = document.querySelector('.afloat');

  if (afloat && !reduced && hasIO) {
    var title = afloat.querySelector('.afloat-title');
    var words = title.textContent.split(' ');
    title.textContent = '';

    words.forEach(function (word, wi) {
      if (wi) title.appendChild(document.createTextNode(' '));
      for (var i = 0; i < word.length; i++) {
        var sp = document.createElement('span');
        sp.textContent = word[i];
        title.appendChild(sp);
      }
    });

    var drops = [].slice.call(title.querySelectorAll('span'));
    drops.forEach(function (sp, i) {
      // Slightly uneven delays so it reads as rain, not a wave.
      sp.style.animationDelay = (i * 0.055 + (i % 3) * 0.02).toFixed(3) + 's';
    });

    new IntersectionObserver(function (entries) {
      var e = entries[0];
      if (e.isIntersecting && e.intersectionRatio >= 0.3) afloat.classList.add('rain');
      else if (!e.isIntersecting) afloat.classList.remove('rain');
    }, { threshold: [0, 0.3] }).observe(afloat);
  }

  /* ── 5. avatar + chat ────────────────────────────────────────
     The avatar changes persona with the section, and opens a panel of
     canned questions. Answers are local, so this works with no API key
     and no network. ANSWERS is the only thing to edit to change what
     he says; swapping in a live model later means replacing reply()
     and leaving the rest alone. */

  var avatar = document.getElementById('avatar');
  var chat   = document.getElementById('chat');

  if (avatar && chat) {
    var layers   = [].slice.call(avatar.querySelectorAll('.av-layer'));
    var faceBtn  = document.getElementById('hireFace');
    var front    = 0;
    var roleTag  = document.getElementById('chatRole');
    var log      = document.getElementById('chatLog');
    var asksWrap = document.getElementById('chatAsks');
    var closeBtn = document.getElementById('chatX');

    // Persona per section. Drop matching files into assets/avatar/ and
    // they appear; until then the monogram shows and nothing breaks.
    var PERSONA = {
      thesis: { role: 'AI engineer',   img: 'assets/avatar/oliver.jpg' },
      build:  { role: 'builder',       img: 'assets/avatar/builder.jpg' },
      break:  { role: 'hacker',        img: '' },
      feel:   { role: 'artist',        img: '' },
      path:   { role: 'off the clock', img: '' },
      hire:   { role: 'available',     img: 'assets/avatar/oliver.jpg' }
    };

    var ANSWERS = [
      { q: 'What are you looking for?',
        a: "AI engineering or product engineering, Singapore or remote, from September 2026. I'm best somewhere I get to build the model layer <b>and</b> the thing around it." },
      { q: 'What have you shipped?',
        a: "<b>Levanta</b>, an AI personal trainer live on the App Store. <b>funhop</b>, a Singapore night-planner that's live right now. Two language games on one engine, and <b>Bao Bae</b>, a RAG therapy platform. All solo." },
      { q: "What's the AI work?",
        a: "A Gemini coach in Levanta that parses plain-text workouts. An LLM pipeline in funhop that turns messy Telegram posts into structured events. RAG over clinical material with FAISS. At HTX I ran lightweight LLMs in virtualised Linux and worked with vision-language models." },
      { q: 'Are you actually into security?',
        a: "Yes. It's my degree track. Proving Grounds, HackSmarter and Hack The Box in my own time, the <i>Practical Malware Analysis</i> labs, and a PCAP intrusion detection agent I built around an LLM analyst loop. No OSCP, and I won't pretend otherwise." },
      { q: 'Best bug you ever found?',
        a: "85% of funhop's events table was silently corrupt for weeks. No errors, no alerts. Signed image URLs were losing their query strings, and I'd been faking detail URLs from title slugs that had 404'd since launch. Both fixes are encoded in the pipeline now." },
      { q: 'Why generalist and not specialist?',
        a: "Because the handoffs are where things die. Knowing security, AI, mobile and design means I can take a model from a notebook to the App Store myself, and I know what breaks at each seam." },
      { q: 'What do you do outside work?',
        a: "I coach <b>tennis</b>, I ski, and I'm in the gym most days. I model on the side and make content. It's all the same instinct as the work: pick something hard, get properly good at it." },
      { q: 'Give me a fun fact',
        a: "I can hit a forehand on <b>both</b> sides. No backhand required. It confuses everyone I coach, and occasionally it wins me points." },
      { q: 'How do I reach you?',
        a: "<a href=\"mailto:oliverloo09@gmail.com\">oliverloo09@gmail.com</a>, or <a href=\"https://www.linkedin.com/in/oliver-loo-8ab131157\">LinkedIn</a>. Résumé is at the bottom of this page. Instagram is <a href=\"https://www.instagram.com/yutasakthefirst/\">@yutasakthefirst</a>." }
    ];

    function bubble(kind, html) {
      var d = document.createElement('div');
      d.className = 'bub bub-' + kind;
      d.innerHTML = html;
      log.appendChild(d);
      log.scrollTop = log.scrollHeight;
      return d;
    }

    function reply(item) {
      bubble('me', item.q);
      var wait = bubble('him', '<span class="bub-typing"><span></span><span></span><span></span></span>');
      window.setTimeout(function () {
        wait.innerHTML = item.a;
        log.scrollTop = log.scrollHeight;
      }, 420 + Math.min(item.a.length, 420));
    }

    function buildAsks() {
      asksWrap.innerHTML = '';
      ANSWERS.forEach(function (item) {
        var b = document.createElement('button');
        b.type = 'button';
        b.className = 'ask';
        b.textContent = item.q;
        b.addEventListener('click', function () { reply(item); });
        asksWrap.appendChild(b);
      });
    }

    var greeted = false;
    function open() {
      killNudge(true);
      chat.hidden = false;
      avatar.classList.add('open');
      avatar.setAttribute('aria-expanded', 'true');
      if (!greeted) {
        greeted = true;
        buildAsks();
        bubble('him', "Hey. I'm Oliver. Ask me anything, or pick one below.");
      }
    }
    function close() {
      chat.hidden = true;
      avatar.classList.remove('open');
      avatar.setAttribute('aria-expanded', 'false');
    }

    /* ── placement, docking and dragging ──────────────────────
       The bubble is positioned entirely by transform from a top-left
       origin, which lets one element travel and scale into the Hire
       portrait slot instead of a second element fading in. While it is
       docked the slot only reserves space; the bubble is the portrait. */

    var GAP = 22;
    var dragDX = 0, dragDY = 0;          // where the reader parked it
    var docked = false;

    function baseXY() {
      var size = avatar.offsetWidth || 74;
      var x = window.innerWidth  - size - GAP + dragDX;
      var y = window.innerHeight - size - GAP + dragDY;
      // Never let it end up off screen after a drag or a resize.
      x = Math.min(Math.max(x, GAP), window.innerWidth  - size - GAP);
      y = Math.min(Math.max(y, GAP), window.innerHeight - size - GAP);
      return { x: x, y: y, size: size };
    }

    function place() {
      var b = baseXY(), x = b.x, y = b.y, sc = 1;
      if (docked && faceBtn) {
        var r = faceBtn.getBoundingClientRect();
        if (r.width > 0) { x = r.left; y = r.top; sc = r.width / b.size; }
      }
      avatar.style.setProperty('--av-x', x.toFixed(1) + 'px');
      avatar.style.setProperty('--av-y', y.toFixed(1) + 'px');
      avatar.style.setProperty('--av-s', sc.toFixed(4));
    }

    function glide() {
      avatar.classList.add('gliding');
      place();
      window.setTimeout(function () { avatar.classList.remove('gliding'); }, 780);
    }

    function setDocked(on) {
      if (docked === on) return;
      docked = on;
      avatar.classList.toggle('docked', on);
      if (faceBtn) faceBtn.classList.toggle('occupied', on);
      glide();
    }

    // Docked target moves with the page, so track it while scrolling.
    window.addEventListener('scroll', function () { if (docked) place(); }, { passive: true });
    window.addEventListener('resize', place, { passive: true });
    place();

    var downX = 0, downY = 0, startDX = 0, startDY = 0, moved = false, dragging = false;

    avatar.addEventListener('pointerdown', function (e) {
      if (docked) return;                       // parked in Hire, leave it be
      dragging = true; moved = false;
      downX = e.clientX; downY = e.clientY;
      startDX = dragDX; startDY = dragDY;
      avatar.classList.add('dragging');
      avatar.setPointerCapture(e.pointerId);
    });

    avatar.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - downX, dy = e.clientY - downY;
      if (!moved && Math.abs(dx) + Math.abs(dy) > 4) moved = true;
      if (!moved) return;
      dragDX = startDX + dx; dragDY = startDY + dy;
      place();
    });

    function endDrag(e) {
      if (!dragging) return;
      dragging = false;
      avatar.classList.remove('dragging');
      if (e && e.pointerId != null && avatar.hasPointerCapture(e.pointerId)) {
        avatar.releasePointerCapture(e.pointerId);
      }
      if (!moved) { chat.hidden ? open() : close(); }   // a tap, not a drag
    }
    avatar.addEventListener('pointerup', endDrag);
    avatar.addEventListener('pointercancel', endDrag);

    // Docked in Hire the bubble stops taking pointer events of its own,
    // so the slot forwards the click through to the same panel.
    avatar.addEventListener('click', function (e) { if (docked) { e.preventDefault(); } });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !chat.hidden) close();
    });

    // Persona follows the section theme, cross-fading between the two
    // image layers. An empty img means no photo for that persona yet, so
    // it fades back to the monogram rather than showing a broken frame.
    var showing = null;

    function dressUp() {
      var key = root.getAttribute('data-section') || 'thesis';
      var p = PERSONA[key] || PERSONA.thesis;
      if (roleTag) roleTag.textContent = p.role;

      // In Hire the bubble flies into the portrait slot and becomes it.
      setDocked(key === 'hire');

      if (p.img === showing) return;
      showing = p.img;

      if (!p.img) {
        layers.forEach(function (l) { l.classList.remove('on'); });
        avatar.classList.remove('has-shot');
        return;
      }

      var next = layers[1 - front];
      next.onload = function () {
        avatar.classList.add('has-shot');
        next.classList.add('on');
        layers[front].classList.remove('on');
        front = 1 - front;
      };
      next.onerror = function () { avatar.classList.remove('has-shot'); };
      next.setAttribute('src', p.img);
    }

    if (faceBtn) faceBtn.addEventListener('click', function () {
      if (chat.hidden) open(); else close();
    });

    /* ── nudge ────────────────────────────────────────────────
       One prompt so the bubble reads as something you can talk to.
       Dismissed for the session once closed or once the chat is used. */
    var nudge = document.getElementById('nudge');
    var nudgeX = document.getElementById('nudgeX');

    function killNudge(remember) {
      if (!nudge) return;
      nudge.hidden = true;
      if (remember) { try { sessionStorage.setItem('ol-nudge', '1'); } catch (err) {} }
    }

    if (nudge) {
      var seen = false;
      try { seen = sessionStorage.getItem('ol-nudge') === '1'; } catch (err) {}
      if (!seen) window.setTimeout(function () {
        if (chat.hidden && !docked) nudge.hidden = false;
      }, 3800);
      if (nudgeX) nudgeX.addEventListener('click', function () { killNudge(true); });
      nudge.addEventListener('click', function (e) {
        if (e.target !== nudgeX) { killNudge(true); open(); }
      });
    }
    new MutationObserver(dressUp).observe(root, { attributes: true, attributeFilter: ['data-section'] });
    dressUp();
  }

  /* ── 6. matrix rain ──────────────────────────────────────────
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
