/* C2NX site behaviour. No dependencies, no network requests.
   1. Hero dock (home): crosshair glides to the top-left and shrinks; title slides to top-centre.
   2. Click sound: synthesized "ting" (Web Audio), toggle stored per browser.
   3. Section reveals, FIG labels, target-lock card brackets, Austin/Zulu clock. */
(() => {
  "use strict";
  const doc = document.documentElement;
  const body = document.body;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } }
  };
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  /* ---------- 1. Hero dock ---------- */
  function initDock() {
    const emblem = document.querySelector(".dock-emblem");
    const title = document.querySelector(".dock-title");
    if (!emblem || !title || reduce) return;
    const slotE = emblem.parentElement, slotT = title.parentElement;
    const header = document.querySelector(".site-header");
    const nav = header && header.querySelector(".nav");
    const link = emblem.querySelector(".dock-link");
    const h1 = title.querySelector("h1");
    const strip = document.createElement("div");
    strip.className = "title-strip";
    strip.setAttribute("aria-hidden", "true");
    body.appendChild(strip);

    const HEADER_H = 68, MAX_DOCK = 140, HEADER_LOGO = 48, TITLE_PX = 17, PAD = 24;
    let m = null, raf = 0;

    function textWidth(el) {
      const r = document.createRange();
      r.selectNodeContents(el);
      let w = 0;
      for (const rect of r.getClientRects()) w = Math.max(w, rect.width);
      return w;
    }

    function measure() {
      body.classList.remove("docking");
      [emblem, title].forEach(d => { d.style.transform = ""; d.style.width = ""; });
      slotE.style.height = ""; slotT.style.height = "";
      const vw = doc.clientWidth;
      const eW = emblem.offsetWidth, eH = emblem.offsetHeight;
      const tW = title.offsetWidth, tH = title.offsetHeight;
      const fs = parseFloat(getComputedStyle(h1).fontSize);
      const lineW = textWidth(h1);
      slotE.style.height = eH + "px"; slotT.style.height = tH + "px";
      emblem.style.width = eW + "px"; title.style.width = tW + "px";

      // Emblem target: half size in the left gutter when there is room, else seated in the header as the logo.
      const contentLeft = Math.max(0, (vw - 1120) / 2) + 28;
      const room = contentLeft - PAD;
      const big = room >= MAX_DOCK;
      const eSize = big ? MAX_DOCK : HEADER_LOGO;
      const eScale = eSize / eW;
      const eX = big ? PAD : Math.max(16, contentLeft);
      const eY = big ? 14 : (HEADER_H - eSize) / 2;

      // Title target: centred in the header bar if it clears logo and nav, otherwise a strip just below.
      const tScale = (vw < 600 ? 13 : TITLE_PX) / fs;
      const shown = lineW * tScale;
      const navLeft = nav ? nav.getBoundingClientRect().left : vw;
      const logoRight = big ? 0 : eX + eSize;
      const fitsHeader = vw / 2 + shown / 2 + 20 < navLeft && vw / 2 - shown / 2 - 20 > logoRight;
      const tX = vw / 2 - (tW * tScale) / 2;
      const stripH = Math.max(38, Math.ceil(tH * tScale) + 14);
      strip.style.height = stripH + "px";
      const tY = fitsHeader ? (HEADER_H - tH * tScale) / 2 : HEADER_H + (stripH - tH * tScale) / 2;

      const sy = window.scrollY, r0E = slotE.getBoundingClientRect(), r0T = slotT.getBoundingClientRect();
      m = { e0x: r0E.left + (slotE.offsetWidth - eW) / 2, e0y: r0E.top + sy, t0x: r0T.left, t0y: r0T.top + sy, tH, eScale, eX, eY, tScale, tX, tY, fitsHeader, range: Math.max(280, window.innerHeight * 0.6) };
      body.classList.add("docking");
      frame();
    }

    function frame() {
      raf = 0;
      if (!m) return;
      const raw = clamp(window.scrollY / m.range, 0, 1);
      const p = ease(raw), q = easeOut(raw);
      const qe = easeOut(clamp(raw / 0.55, 0, 1)), pe = ease(clamp(raw / 0.7, 0, 1));
      emblem.style.transform = `translate(${lerp(m.e0x, m.eX, qe)}px,${lerp(m.e0y - window.scrollY * (1 - qe), m.eY, qe)}px) scale(${lerp(1, m.eScale, pe)})`;
      const ts = lerp(1, m.tScale, p);
      const tcy = lerp(m.t0y + m.tH / 2 - window.scrollY * (1 - q), m.tY + (m.tH * m.tScale) / 2, q);
      title.style.transform = `translate(${m.t0x}px,${tcy - m.tH / 2}px) scale(${ts})`;
      strip.style.opacity = m.fitsHeader ? 0 : clamp((p - 0.6) / 0.4, 0, 1);
      const docked = p > 0.98;
      body.classList.toggle("docked", docked);
      link.tabIndex = docked ? 0 : -1;
      const grid = document.querySelector(".hero .grid-bg");
      if (grid) grid.style.transform = `translateY(${window.scrollY * 0.3}px)`;
    }

    link.addEventListener("click", e => {
      e.preventDefault();
      if (body.classList.contains("docked")) window.scrollTo({ top: 0, behavior: "smooth" });
    });
    window.addEventListener("scroll", () => { if (!raf) raf = requestAnimationFrame(frame); }, { passive: true });
    let rt;
    window.addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(measure, 120); });
    // Measure after fonts settle so text widths are right.
    (document.fonts ? document.fonts.ready : Promise.resolve()).then(measure);
  }

  /* ---------- 2. Click sound ---------- */
  let ctx = null;
  let soundOn = store.get("c2nx-sound") !== "off";
  function ting(kind) {
    if (!soundOn) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!ctx) ctx = new AC();
    if (ctx.state === "suspended") ctx.resume();
    const t = ctx.currentTime;
    const out = ctx.createGain();
    out.gain.value = kind === "soft" ? 0.035 : 0.07;
    out.connect(ctx.destination);
    // Metallic strike: fundamental + inharmonic partial, fast exponential decay.
    const partials = kind === "soft" ? [[1760, 1, 0.09]] : [[2637, 1, 0.32], [3951, 0.45, 0.18], [6320, 0.18, 0.08]];
    for (const [f, a, d] of partials) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.setValueAtTime(f, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(a, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g); g.connect(out);
      o.start(t); o.stop(t + d + 0.02);
    }
    // Short mechanical click transient.
    const n = ctx.createBufferSource(), len = Math.floor(ctx.sampleRate * 0.012);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate), ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    const hp = ctx.createBiquadFilter(); hp.type = "highpass"; hp.frequency.value = 3000;
    const ng = ctx.createGain(); ng.gain.value = kind === "soft" ? 0.2 : 0.35;
    n.buffer = buf; n.connect(hp); hp.connect(ng); ng.connect(out); n.start(t);
  }

  function initSound() {
    const btn = document.querySelector(".sound-toggle");
    const render = () => { if (btn) { btn.setAttribute("aria-pressed", String(soundOn)); btn.textContent = soundOn ? "Sound on" : "Sound off"; } };
    render();
    if (btn) btn.addEventListener("click", () => { soundOn = !soundOn; store.set("c2nx-sound", soundOn ? "on" : "off"); render(); ting(); });

    document.addEventListener("click", e => {
      if (e.target.closest(".sound-toggle")) return;
      const a = e.target.closest("a, button");
      ting(a ? "hard" : "soft");
      // Give the ting time to sound before an in-site page change.
      if (!soundOn || !a || a.tagName !== "A" || e.defaultPrevented) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, location.href);
      const samePage = url.pathname === location.pathname && url.hash;
      if (url.origin !== location.origin || samePage) return;
      e.preventDefault();
      setTimeout(() => { location.href = url.href; }, 140);
    });
  }

  /* ---------- 3. Reveals, FIG labels, clock ---------- */
  function initDetails() {
    document.querySelectorAll("main section").forEach((sec, si) => {
      sec.querySelectorAll(".grid-3 > .card, .grid-2 > .card").forEach((card, ci) => {
        const fig = document.createElement("span");
        fig.className = "fig"; fig.setAttribute("aria-hidden", "true");
        fig.textContent = `FIG ${si + 1}.${ci + 1}`;
        card.appendChild(fig);
      });
    });

    if (!reduce && "IntersectionObserver" in window) {
      const items = document.querySelectorAll("main section .kicker, main section h2, main section .lead, main section .card, main section .actions, main section .callout, .page-hero .wrap > *");
      items.forEach(el => {
        el.classList.add("reveal");
        const sibs = el.parentElement ? [...el.parentElement.children].filter(c => c.classList.contains("card")) : [];
        const i = sibs.indexOf(el);
        if (i > 0) el.style.transitionDelay = `${i * 90}ms`;
      });
      const io = new IntersectionObserver(entries => entries.forEach(en => {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      }), { rootMargin: "0px 0px -8% 0px" });
      items.forEach(el => io.observe(el));
    }

    const clock = document.querySelector(".clock");
    if (clock) {
      const f = (tz) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: tz }).format(new Date());
      const tick = () => { clock.textContent = `Austin ${f("America/Chicago")} · Zulu ${f("UTC").replace(":", "")}Z`; };
      tick(); setInterval(tick, 20000);
    }
  }

  doc.classList.add("js");
  initDetails();
  initSound();
  initDock();
})();
