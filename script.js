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

  /* ── 4. rubble: word physics ─────────────────────────────────
     A small rigid-body solver for the design section. Bodies are
     oriented boxes (the word chips), integrated under gravity and
     separated with sequential impulses. Rendered as DOM transforms
     rather than canvas so the words stay real, styled, selectable
     text and the pile is something you can actually grab. */

  var pen = document.getElementById('rubble');

  if (pen && !reduced) {
    var chips  = [].slice.call(pen.querySelectorAll('.chip'));
    var bodies = [];
    var W = 0, H = 0;
    var GRAV = 1900, REST = 0.18, FRIC = 0.42, ITER = 6;
    var held = null, grabX = 0, grabY = 0, ptrX = 0, ptrY = 0;
    var running = false, lastT = 0;

    function Body(el, i) {
      this.el = el;
      this.hw = el.offsetWidth / 2;
      this.hh = el.offsetHeight / 2;
      this.x  = 0; this.y = 0; this.a = 0;
      this.vx = 0; this.vy = 0; this.va = 0;
      var m = Math.max(this.hw * this.hh * 0.006, 0.6);
      this.im = 1 / m;
      this.iI = 1 / (m * (4 * this.hw * this.hw + 4 * this.hh * this.hh) / 12);
      this.i  = i;
    }

    // Local axes of the box, given its rotation.
    Body.prototype.axis = function (k) {
      var c = Math.cos(this.a), s2 = Math.sin(this.a);
      return k === 0 ? { x: c, y: s2 } : { x: -s2, y: c };
    };

    Body.prototype.corners = function () {
      var u = this.axis(0), v = this.axis(1), out = [];
      for (var sx = -1; sx <= 1; sx += 2) {
        for (var sy = -1; sy <= 1; sy += 2) {
          out.push({
            x: this.x + u.x * this.hw * sx + v.x * this.hh * sy,
            y: this.y + u.y * this.hw * sx + v.y * this.hh * sy
          });
        }
      }
      return out;
    };

    function dot(a, b) { return a.x * b.x + a.y * b.y; }
    function cross(a, b) { return a.x * b.y - a.y * b.x; }

    function project(b, n) {
      var cs = b.corners(), lo = Infinity, hi = -Infinity;
      for (var i = 0; i < 4; i++) {
        var d = dot(cs[i], n);
        if (d < lo) lo = d;
        if (d > hi) hi = d;
      }
      return { lo: lo, hi: hi };
    }

    // Separating-axis test across both boxes' face normals. Returns the
    // axis of least penetration, pointing from A toward B.
    function sat(A, B) {
      var axes = [A.axis(0), A.axis(1), B.axis(0), B.axis(1)];
      var best = Infinity, bn = null;
      for (var i = 0; i < 4; i++) {
        var n = axes[i];
        var pa = project(A, n), pb = project(B, n);
        var o = Math.min(pa.hi, pb.hi) - Math.max(pa.lo, pb.lo);
        if (o <= 0) return null;
        if (o < best) { best = o; bn = n; }
      }
      var d = { x: B.x - A.x, y: B.y - A.y };
      if (dot(d, bn) < 0) bn = { x: -bn.x, y: -bn.y };
      return { n: bn, depth: best };
    }

    // Deepest vertex of each box along the contact normal, averaged.
    // One point is enough at this scale and keeps stacks settling.
    function contact(A, B, n) {
      var ca = A.corners(), cb = B.corners();
      var pa = ca[0], da = -Infinity, pb = cb[0], db = Infinity, i, d;
      for (i = 0; i < 4; i++) { d = dot(ca[i], n); if (d > da) { da = d; pa = ca[i]; } }
      for (i = 0; i < 4; i++) { d = dot(cb[i], n); if (d < db) { db = d; pb = cb[i]; } }
      return { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2 };
    }

    function applyImpulse(b, p, jx, jy) {
      if (b === held) return;
      b.vx += jx * b.im;
      b.vy += jy * b.im;
      b.va += cross({ x: p.x - b.x, y: p.y - b.y }, { x: jx, y: jy }) * b.iI;
    }

    function solvePair(A, B) {
      var m = sat(A, B);
      if (!m) return;
      var n = m.n;

      var imA = A === held ? 0 : A.im, imB = B === held ? 0 : B.im;
      var sum = imA + imB;
      if (sum === 0) return;

      var corr = Math.max(m.depth - 0.5, 0) / sum * 0.7;
      A.x -= n.x * corr * imA; A.y -= n.y * corr * imA;
      B.x += n.x * corr * imB; B.y += n.y * corr * imB;

      var p = contact(A, B, n);
      var ra = { x: p.x - A.x, y: p.y - A.y }, rb = { x: p.x - B.x, y: p.y - B.y };
      var rv = {
        x: (B.vx - B.va * rb.y) - (A.vx - A.va * ra.y),
        y: (B.vy + B.va * rb.x) - (A.vy + A.va * ra.x)
      };
      var vn = dot(rv, n);
      if (vn > 0) return;

      var rnA = cross(ra, n), rnB = cross(rb, n);
      var iiA = A === held ? 0 : A.iI, iiB = B === held ? 0 : B.iI;
      var denom = sum + rnA * rnA * iiA + rnB * rnB * iiB;
      if (denom <= 0) return;

      var j = -(1 + REST) * vn / denom;
      applyImpulse(A, p, -n.x * j, -n.y * j);
      applyImpulse(B, p,  n.x * j,  n.y * j);

      var t = { x: rv.x - n.x * vn, y: rv.y - n.y * vn };
      var tl = Math.hypot(t.x, t.y);
      if (tl < 0.0001) return;
      t.x /= tl; t.y /= tl;
      var jt = -dot(rv, t) / denom;
      var max = j * FRIC;
      if (jt > max) jt = max; else if (jt < -max) jt = -max;
      applyImpulse(A, p, -t.x * jt, -t.y * jt);
      applyImpulse(B, p,  t.x * jt,  t.y * jt);
    }

    // Walls as immovable half-planes; resolve the deepest corner only.
    function solveWall(b, nx, ny, limit) {
      if (b === held) return;
      var cs = b.corners(), worst = 0, pt = null;
      for (var i = 0; i < 4; i++) {
        var d = limit - (cs[i].x * nx + cs[i].y * ny);
        if (d > worst) { worst = d; pt = cs[i]; }
      }
      if (!pt) return;

      b.x += nx * worst; b.y += ny * worst;

      var r = { x: pt.x - b.x, y: pt.y - b.y };
      var rvx = b.vx - b.va * r.y, rvy = b.vy + b.va * r.x;
      var vn = rvx * nx + rvy * ny;
      if (vn > 0) return;

      var rn = cross(r, { x: nx, y: ny });
      var denom = b.im + rn * rn * b.iI;
      var j = -(1 + REST) * vn / denom;
      applyImpulse(b, pt, nx * j, ny * j);

      var tx = rvx - nx * vn, ty = rvy - ny * vn;
      var tl = Math.hypot(tx, ty);
      if (tl < 0.0001) return;
      tx /= tl; ty /= tl;
      var jt = -(rvx * tx + rvy * ty) / denom;
      var max = j * FRIC;
      if (jt > max) jt = max; else if (jt < -max) jt = -max;
      applyImpulse(b, pt, tx * jt, ty * jt);
    }

    function layout() {
      W = pen.clientWidth;
      H = pen.clientHeight;
      for (var i = 0; i < bodies.length; i++) {
        var b = bodies[i];
        b.hw = b.el.offsetWidth / 2;
        b.hh = b.el.offsetHeight / 2;
        b.x = b.hw + 20 + Math.abs(((i * 137) % Math.max(W - b.hw * 2 - 40, 1)));
        b.y = -60 - i * 78;
        b.a = ((i % 5) - 2) * 0.32;
        b.vx = b.vy = b.va = 0;
      }
    }

    function step(dt) {
      var i, b;
      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        if (b === held) continue;
        b.vy += GRAV * dt;
        b.x += b.vx * dt; b.y += b.vy * dt; b.a += b.va * dt;
        b.vx *= 0.995; b.vy *= 0.995; b.va *= 0.97;
      }

      if (held) {
        // Pull the grabbed chip toward the pointer rather than teleporting
        // it, so throwing it carries real momentum into the pile.
        var tx = ptrX - grabX, ty = ptrY - grabY;
        held.vx = (tx - held.x) / Math.max(dt, 0.001) * 0.42;
        held.vy = (ty - held.y) / Math.max(dt, 0.001) * 0.42;
        held.x += held.vx * dt; held.y += held.vy * dt;
        held.va *= 0.8;
      }

      for (var k = 0; k < ITER; k++) {
        for (i = 0; i < bodies.length; i++) {
          b = bodies[i];
          solveWall(b,  1,  0, 0);
          solveWall(b, -1,  0, -W);
          solveWall(b,  0, -1, -H);
          if (b.y > H + 400) { b.y = -80; b.vy = 0; b.x = W / 2; }
        }
        for (i = 0; i < bodies.length; i++) {
          for (var jx = i + 1; jx < bodies.length; jx++) solvePair(bodies[i], bodies[jx]);
        }
      }

      for (i = 0; i < bodies.length; i++) {
        b = bodies[i];
        b.el.style.transform = 'translate(' + (b.x - b.hw).toFixed(1) + 'px,' +
          (b.y - b.hh).toFixed(1) + 'px) rotate(' + b.a.toFixed(3) + 'rad)';
      }
    }

    function frame(t) {
      if (!running) return;
      window.requestAnimationFrame(frame);
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.032) : 0.016;
      lastT = t;
      step(dt);
    }

    function pick(cx, cy) {
      for (var i = bodies.length - 1; i >= 0; i--) {
        var b = bodies[i];
        var dx = cx - b.x, dy = cy - b.y;
        var c = Math.cos(-b.a), s2 = Math.sin(-b.a);
        var lx = dx * c - dy * s2, ly = dx * s2 + dy * c;
        if (Math.abs(lx) <= b.hw && Math.abs(ly) <= b.hh) return b;
      }
      return null;
    }

    function toLocal(e) {
      var r = pen.getBoundingClientRect();
      ptrX = e.clientX - r.left;
      ptrY = e.clientY - r.top;
    }

    pen.addEventListener('pointerdown', function (e) {
      toLocal(e);
      var b = pick(ptrX, ptrY);
      if (!b) return;
      held = b; grabX = ptrX - b.x; grabY = ptrY - b.y;
      // Bring the grabbed chip to the front of the pile visually.
      b.el.style.zIndex = 2;
      pen.setPointerCapture(e.pointerId);
      e.preventDefault();
    });

    pen.addEventListener('pointermove', function (e) { if (held) toLocal(e); });

    function drop(e) {
      if (!held) return;
      held.el.style.zIndex = '';
      held = null;
      if (e && e.pointerId != null && pen.hasPointerCapture(e.pointerId)) {
        pen.releasePointerCapture(e.pointerId);
      }
    }
    pen.addEventListener('pointerup', drop);
    pen.addEventListener('pointercancel', drop);

    for (var c = 0; c < chips.length; c++) bodies.push(new Body(chips[c], c));
    layout();

    window.addEventListener('resize', layout, { passive: true });

    function kick() {
      if (running) return;
      running = true; lastT = 0;
      window.requestAnimationFrame(frame);
    }

    // Only simulate while the section is on screen.
    if (hasIO) {
      new IntersectionObserver(function (entries) {
        if (entries[0].isIntersecting) kick(); else running = false;
      }, { threshold: 0.05 }).observe(pen);
    }

    // Safety net, same reasoning as the reveals: if the observer never
    // delivers, the chips would sit parked off-canvas forever and the
    // section would render as an empty box. Start regardless.
    window.setTimeout(kick, 2500);
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
    var shot     = document.getElementById('avatarImg');
    var roleTag  = document.getElementById('chatRole');
    var log      = document.getElementById('chatLog');
    var asksWrap = document.getElementById('chatAsks');
    var closeBtn = document.getElementById('chatX');

    // Persona per section. Drop matching files into assets/avatar/ and
    // they appear; until then the monogram shows and nothing breaks.
    var PERSONA = {
      thesis: { role: 'AI engineer',  img: 'assets/avatar/thesis.jpg' },
      build:  { role: 'builder',      img: 'assets/avatar/builder.jpg' },
      break:  { role: 'hacker',       img: 'assets/avatar/hacker.jpg' },
      feel:   { role: 'artist',       img: 'assets/avatar/artist.jpg' },
      path:   { role: 'off the clock', img: 'assets/avatar/life.jpg' },
      hire:   { role: 'available',    img: 'assets/avatar/hire.jpg' }
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

    avatar.addEventListener('click', function () { chat.hidden ? open() : close(); });
    closeBtn.addEventListener('click', close);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && !chat.hidden) close();
    });

    // Persona follows the section theme.
    function dressUp() {
      var key = root.getAttribute('data-section') || 'thesis';
      var p = PERSONA[key] || PERSONA.thesis;
      if (roleTag) roleTag.textContent = p.role;
      if (shot && shot.getAttribute('src') !== p.img) {
        shot.onload  = function () { avatar.classList.add('has-shot'); };
        shot.onerror = function () { avatar.classList.remove('has-shot'); };
        shot.setAttribute('src', p.img);
      }
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
