import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createStage } from './stage.js';
import { LOGO_SVG } from './logo.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const abs = (src) => new URL(src, document.baseURI).href;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = () => window.innerWidth <= 812;
const root = document.documentElement;

// ───────────── logo + image slots ─────────────
$$('[data-logo]').forEach((el) => (el.innerHTML = LOGO_SVG));
$$('[data-img]').forEach((el) => (el.style.backgroundImage = `url("${abs(el.dataset.img)}")`));

// 5x7 pixel glyphs (original bitmaps) for the service initials
const GLYPHS = {
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
};
const glyphCells = (ch) => GLYPHS[ch].join('').split('').map((b) => `<i class="${b === '1' ? '' : 'off'}"></i>`).join('');
$$('.pcard__glyph').forEach((el) => (el.innerHTML = glyphCells(el.dataset.glyph)));

// ───────────── smooth scroll ─────────────
const lenis = new Lenis({ lerp: 0.08, wheelMultiplier: 0.9, smoothWheel: !reduced });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
window.scrollTo(0, 0);
const ease4 = (x) => 1 - Math.pow(1 - x, 4);
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href');
  if (id.length < 2) return;
  e.preventDefault();
  closeMenu();
  lenis.scrollTo(id === '#top' ? 0 : id, { duration: 2, easing: ease4 });
}));

// scroll indicator: visible while scrolling
const bar = $('#scroll-bar');
let hideT;
lenis.on('scroll', ({ progress }) => {
  gsap.set(bar, { yPercent: (progress || 0) * 400 });
  root.classList.add('is-scrolling');
  clearTimeout(hideT);
  hideT = setTimeout(() => root.classList.remove('is-scrolling'), 700);
});

// ───────────── WebGL stage ─────────────
let stage = null;
try {
  const cv = $('#stage');
  stage = createStage(cv, { valley: abs(cv.dataset.valley), faces: cv.dataset.faces.split('|').map(abs) });
  root.classList.add('webgl');
} catch (e) {
  $('#stage').remove();
}

// ───────────── giant wordmark: one SVG per letter so each can tilt in 3D ─────────────
const mainLogo = $('.who__main-logo');
const letters = [];
(function splitWordmark() {
  const src = mainLogo.querySelector('svg');
  const vb = src.getAttribute('viewBox');
  mainLogo.innerHTML = '';
  mainLogo.style.position = 'relative';
  src.querySelectorAll(':scope > .logo__l').forEach((node) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', vb);
    svg.setAttribute('class', 'logo wm-letter');
    svg.setAttribute('aria-hidden', 'true');
    svg.appendChild(node.cloneNode(true));
    mainLogo.appendChild(svg);
    letters.push(svg);
  });
  mainLogo.setAttribute('role', 'img');
  mainLogo.setAttribute('aria-label', 'HOBBYTAN AI');
  const [vx, vy, vw, vh] = vb.split(/\s+/).map(Number);
  letters.forEach((svg, i) => {
    Object.assign(svg.style, { position: i ? 'absolute' : 'relative', left: 0, top: 0, width: '100%', height: 'auto' });
    const bb = svg.firstChild.getBBox();
    // pivot at the bottom-centre of the letter
    svg.style.transformOrigin = `${((bb.x + bb.width / 2 - vx) / vw) * 100}% ${((bb.y + bb.height - vy) / vh) * 100}%`;
  });
})();

// ───────────── preloader ─────────────
const digits = $$('#preloader-digits .d');
function setDigits(n) {
  const s = String(n).padStart(3, '0');
  digits.forEach((d, i) => {
    const cur = d.lastElementChild;
    if (cur.textContent === s[i]) return;
    const next = document.createElement('b');
    next.textContent = s[i];
    d.appendChild(next);
    gsap.fromTo(d.children, { yPercent: 0 }, { yPercent: -100, duration: 0.35, ease: 'power2.out', onComplete: () => { while (d.children.length > 1) d.firstElementChild.remove(); gsap.set(d.children, { yPercent: 0 }); } });
  });
}
function preload() {
  const cv = $('#stage');
  const srcs = cv ? [abs(cv.dataset.valley), abs(cv.dataset.faces.split('|')[0])] : [];
  const tasks = [document.fonts.ready, ...srcs.map((s) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = s; }))];
  const st = { v: 0 };
  let done = 0, shown = 0;
  return new Promise((resolve) => {
    const tick = () => {
      const target = (done / tasks.length) * 100;
      st.v += (target - st.v) * 0.08 + 0.35;
      st.v = Math.min(st.v, target);
      const v = Math.round(st.v);
      if (v !== shown) { shown = v; setDigits(v); $('.pm--bar').style.setProperty('--p', v / 100); }
      if (v >= 100) { gsap.ticker.remove(tick); setTimeout(resolve, 350); }
    };
    gsap.ticker.add(tick);
    tasks.forEach((t) => Promise.resolve(t).then(() => done++));
  });
}

function intro() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  // bar becomes the crossbar of an H, then the mark fills the screen
  tl.to('.pm--l, .pm--r', { scaleY: 1, duration: 0.5, ease: 'power3.out' })
    .to('.pm--bar', { backgroundColor: '#fff', duration: 0.1 }, '<')
    .to('#preloader-digits', { yPercent: 110, duration: 0.6, ease: 'power3.in' }, '<')
    .to('#preloader-mark', { scale: 14, duration: 1.1, ease: 'power4.in' }, '+=0.15')
    .to('#preloader', { autoAlpha: 0, duration: 0.5, ease: 'power2.out' }, '-=0.25')
    .add(() => { document.body.classList.remove('is-loading'); lenis.start(); })
    .to(stage || {}, { intro: 1, duration: 3.2, ease: 'power3.out' }, '-=0.4')
    .fromTo(letters, { yPercent: 120, rotationX: -80, rotationZ: (i) => (i % 2 ? 8 : -6), opacity: 0 }, { yPercent: 0, rotationX: 0, rotationZ: 0, opacity: 1, duration: 1.6, stagger: 0.07, transformPerspective: 900 }, '<0.2')
    .fromTo('.header > *', { y: -40, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 1.2, stagger: 0.1 }, '<0.3')
    .from('.who__main-scroll, .who .crosses i', { autoAlpha: 0, y: 10, duration: 1, stagger: 0.05 }, '<0.4');
  return tl;
}

// ───────────── WHO: pinned story ─────────────
function who() {
  // hidden states must hold at any width: hide the containers outright and push
  // lines a full viewport away (a partial offset leaks on narrow screens)
  gsap.set('.who__title, .who__desc', { autoAlpha: 0 });
  gsap.set('.who__title .ln > span', { yPercent: 130 });
  gsap.set('.who__desc-top .ln > span', { x: '110vw' });
  gsap.set('.who__desc-bottom .ln > span', { x: '-110vw' });

  ScrollTrigger.create({ trigger: '#who', start: 'top top', end: 'bottom bottom', onUpdate: (s) => stage && stage.setWho(s.progress) });

  const tl = gsap.timeline({ defaults: { ease: 'none' }, scrollTrigger: { trigger: '#who', start: 'top top', end: 'bottom bottom', scrub: 0.6 } });
  tl.to(letters, { yPercent: 140, rotationX: 75, rotationZ: (i) => (i % 2 ? -14 : 12), opacity: 0, stagger: 0.006, duration: 0.07, transformPerspective: 900, ease: 'power2.in' }, 0.005)
    .to('.who__main-scroll', { autoAlpha: 0, duration: 0.03 }, 0)
    .set('.who__title', { autoAlpha: 1 }, 0.105)
    .to('.who__left .ln > span', { yPercent: 0, stagger: 0.012, duration: 0.07, ease: 'power3.out' }, 0.11)
    .to('.who__right .ln > span', { yPercent: 0, stagger: 0.012, duration: 0.07, ease: 'power3.out' }, 0.14)
    .to('.who__title', { x: () => -window.innerWidth * 1.05, duration: 0.1, ease: 'power2.in' }, 0.58)
    .to('.who .crosses', { autoAlpha: 0.35, duration: 0.05 }, 0.58)
    .set('.who__title', { autoAlpha: 0 }, 0.69)
    .set('.who__desc', { autoAlpha: 1 }, 0.635)
    .to('.who__desc-top .ln > span', { x: 0, stagger: 0.01, duration: 0.1, ease: 'power3.out' }, 0.64)
    .to('.who__desc-bottom .ln > span', { x: 0, stagger: 0.01, duration: 0.1, ease: 'power3.out' }, 0.67)
    .to('.who__desc', { yPercent: -18, autoAlpha: 0, duration: 0.06, ease: 'power2.in' }, 0.94);
}

// ───────────── SERVICES viewer ─────────────
const SERVICES = [
  { name: 'AI 전환 전략', job: 'AI를 적용할 업무와 우선순위를 정합니다', desc: '현재 업무와 AI 활용 수준을 진단하고, 우선 적용 과제와 기대 효과를 정의해 실행 계획과 완료 기준을 세웁니다.', g: 'S' },
  { name: '슈퍼AI워크샵', job: '조직의 AI 활용을 이끌 사내 실무자를 키웁니다', desc: 'AI의 원리와 한계를 이해하고, 우리 업무로 도구를 만들고 결과를 검증하며, 동료에게 활용법을 전하는 슈퍼유저가 됩니다.', g: 'W' },
  { name: '업무 도구 구현', job: '실제 문서와 데이터로 필요한 도구를 함께 만듭니다', desc: '업무에 맞는 대시보드와 자동화를 구현하고, 담당자가 결과 검증과 예외 처리에 참여하며 업무 변경에 맞춰 도구를 고칩니다.', g: 'B' },
  { name: '운영 내재화', job: '고객의 팀이 직접 운영하고 개선하도록 이관합니다', desc: '내부 운영 담당자를 교육하고 문서·권한·관리 기준을 정리해, 팀이 수정과 개선을 이어가도록 운영을 이관합니다.', g: 'O' },
];
function services() {
  const pin = $('.svc__pin');
  const cursor = $('#svc-cursor');
  const letter = $('#svc-letter');
  const progress = $('#svc-progress');
  let idx = 0, busy = false, active = false;

  const renderLetter = (g) => {
    letter.innerHTML = glyphCells(g);
    gsap.from(letter.children, { scale: 0, duration: 0.5, ease: 'back.out(2)', stagger: { each: 0.012, from: 'random' } });
  };
  renderLetter(SERVICES[0].g);

  const auto = gsap.to(progress, { scaleX: 1, duration: 7, ease: 'none', paused: true, onComplete: () => go(1) });

  function go(dir) {
    if (busy) return;
    busy = true;
    idx = (idx + dir + SERVICES.length) % SERVICES.length;
    const s = SERVICES[idx];
    const nameT = $('.svc__name-t'), job = $('#svc-job'), desc = $('#svc-desc');
    const tl = gsap.timeline({ onComplete: () => (busy = false) });
    tl.to([nameT, job, desc], { yPercent: -60, autoAlpha: 0, duration: 0.35, ease: 'power2.in', stagger: 0.04 })
      .add(() => {
        nameT.textContent = s.name; job.textContent = s.job; desc.textContent = s.desc;
        $('#svc-num').textContent = String(idx + 1).padStart(2, '0');
        renderLetter(s.g);
      })
      .fromTo([nameT, job, desc], { yPercent: 60, autoAlpha: 0 }, { yPercent: 0, autoAlpha: 1, duration: 0.7, ease: 'expo.out', stagger: 0.05 });
    stage && stage.showFace(idx);
    auto.restart(); if (!active) auto.pause();
  }

  // cursor follows the pointer; left half = previous, right half = next
  const qx = gsap.quickTo(cursor, 'x', { duration: 0.45, ease: 'power3.out' });
  const qy = gsap.quickTo(cursor, 'y', { duration: 0.45, ease: 'power3.out' });
  pin.addEventListener('pointerenter', () => gsap.to(cursor, { scale: 1, duration: 0.5, ease: 'expo.out' }));
  pin.addEventListener('pointerleave', () => gsap.to(cursor, { scale: 0, duration: 0.4, ease: 'expo.out' }));
  pin.addEventListener('pointermove', (e) => {
    const r = pin.getBoundingClientRect();
    qx(e.clientX - r.left); qy(e.clientY - r.top);
    cursor.classList.toggle('is-left', e.clientX < r.left + r.width / 2);
  });
  pin.addEventListener('click', (e) => {
    if (e.target.closest('.svc__btn')) return;
    const r = pin.getBoundingClientRect();
    gsap.fromTo(cursor, { scale: 0.8 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    go(e.clientX < r.left + r.width / 2 ? -1 : 1);
  });
  let sx = null;
  pin.addEventListener('touchstart', (e) => (sx = e.touches[0].clientX), { passive: true });
  pin.addEventListener('touchend', (e) => { if (sx === null) return; const dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1); sx = null; });
  $$('.svc__btn').forEach((b) => b.addEventListener('click', () => go(Number(b.dataset.dir))));

  // crossfade the stage from the valley to the navy team scene
  ScrollTrigger.create({
    trigger: '#services', start: 'top 85%', end: 'top top', scrub: true,
    onUpdate: (s) => stage && stage.setTeam(s.progress),
  });
  ScrollTrigger.create({
    trigger: '#services', start: 'top 40%', end: 'bottom 60%',
    onToggle: (s) => { active = s.isActive; active ? auto.play() : auto.pause(); },
  });
  gsap.from('.svc__word span', { yPercent: 100, autoAlpha: 0, duration: 1.2, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '#services', start: 'top 30%' } });
  gsap.from('.svc__info > *, .svc__desc, .svc__rulers i', { y: 30, autoAlpha: 0, duration: 1.2, stagger: 0.06, ease: 'expo.out', scrollTrigger: { trigger: '#services', start: 'top 20%' } });
  // stop rendering WebGL once it is fully covered
  ScrollTrigger.create({ trigger: '#clients', start: 'top top', onEnter: () => stage && stage.pause(), onLeaveBack: () => stage && stage.resume() });
}

// ───────────── generic line reveals ─────────────
function reveals() {
  $$('.split, .cap__title').forEach((el) => gsap.from($$('.ln > span', el), { yPercent: 110, duration: 1.4, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } }));
  $$('.clients__desc, .cap__sub, .cat__head, .end__sub, .end__mail').forEach((el) => gsap.from(el, { y: 40, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 90%' } }));
}

// ───────────── clients carousel (scroll-velocity aware) ─────────────
function clients() {
  const rows = $$('.crow').map((row) => {
    const track = $('.crow__track', row);
    track.innerHTML += track.innerHTML + track.innerHTML;
    return { track, dir: Number(row.dataset.dir), x: 0, w: 0 };
  });
  const measure = () => rows.forEach((r) => (r.w = r.track.scrollWidth / 3));
  measure();
  window.addEventListener('resize', measure);
  let boost = 0;
  lenis.on('scroll', ({ velocity }) => (boost = gsap.utils.clamp(-60, 60, velocity)));
  let visible = false;
  ScrollTrigger.create({ trigger: '#clients', start: 'top bottom', end: 'bottom top', onToggle: (s) => (visible = s.isActive) });
  gsap.ticker.add((_, dt) => {
    if (!visible) return;
    boost *= 0.94;
    rows.forEach((r) => {
      r.x -= r.dir * (0.04 * dt + Math.abs(boost) * 0.18);
      r.x = ((r.x % r.w) - r.w) % r.w;
      r.track.style.transform = `translate3d(${r.x}px,0,0)`;
    });
  });
  gsap.from('.crow', { y: 60, autoAlpha: 0, duration: 1.4, stagger: 0.12, ease: 'expo.out', scrollTrigger: { trigger: '.clients__rows', start: 'top 85%' } });
}

// ───────────── results lists ─────────────
function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const target = parseFloat(el.dataset.count), suffix = el.dataset.suffix || '';
  const o = { v: 0 };
  gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => (el.textContent = Math.round(o.v) + suffix) });
}
function results() {
  $$('.results__words span').forEach((w, i) => {
    gsap.fromTo(w, { xPercent: i % 2 ? 10 : -10 }, { xPercent: i % 2 ? -18 : 18, ease: 'none', scrollTrigger: { trigger: '.results', start: 'top bottom', end: 'bottom top', scrub: true } });
  });
  // the last outline word fills solid as the blue section arrives
  gsap.to('.results__words .last', { color: '#ffffff', webkitTextStrokeColor: '#ffffff', ease: 'none', scrollTrigger: { trigger: '.cap', start: 'top 95%', end: 'top 40%', scrub: true } });
  $$('.cat').forEach((cat) => {
    gsap.from($$('.cat__group', cat), { y: 40, autoAlpha: 0, duration: 1.2, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: cat, start: 'top 80%', onEnter: () => $$('.count', cat).forEach(countUp) } });
  });
}

// ───────────── capability cards: fanned backs → flip → row ─────────────
function capability() {
  const cards = $$('.pcard');
  const inner = cards.map((c) => $('.pcard__inner', c));
  const fan = [-14, -5, 5, 14];
  gsap.set(cards, { x: (i) => (i - 1.5) * 34, y: (i) => Math.abs(i - 1.5) * 16, rotation: (i) => fan[i] });
  // final layout: one row on wide screens, a 2x2 grid on narrow ones (cards must stay on screen)
  const cw = () => cards[0].offsetWidth;
  const finalX = (i) => (mobile() ? (i % 2 ? 1 : -1) * cw() * 0.56 : (i - 1.5) * Math.min(window.innerWidth * 0.19, 340) * 1.08);
  const finalY = (i) => (mobile() ? (i < 2 ? -1 : 1) * cw() * 1.4 * 0.53 : 0);
  const tl = gsap.timeline({ scrollTrigger: { trigger: '.cap__cards', start: 'top top', end: '+=180%', scrub: 0.8, pin: true, invalidateOnRefresh: true } });
  tl.from(cards, { y: '60vh', rotation: (i) => fan[i] * 2.5, duration: 0.3, stagger: 0.04, ease: 'power3.out' }, 0)
    .to(cards, { x: finalX, y: finalY, rotation: 0, duration: 0.35, ease: 'power2.inOut' }, 0.35)
    .to(inner, { rotationY: 180, duration: 0.3, stagger: 0.08, ease: 'power2.inOut' }, 0.5);
}

// ───────────── end CTA: wavy title + particle mound ─────────────
function endCta() {
  const lines = $$('.end__line > span');
  lines.forEach((l) => (l.innerHTML = [...l.textContent].map((c) => `<span class="ch">${c === ' ' ? '&nbsp;' : c}</span>`).join('')));
  const chars = $$('.end__line .ch');
  gsap.from(chars, { yPercent: 100, autoAlpha: 0, duration: 1.2, stagger: 0.03, ease: 'expo.out', scrollTrigger: { trigger: '.end__title', start: 'top 85%' } });
  const title = $('#end-title');
  title.addEventListener('pointermove', (e) => {
    chars.forEach((c) => {
      const r = c.getBoundingClientRect();
      const d = (e.clientX - (r.left + r.width / 2)) / 120;
      gsap.to(c, { y: Math.sin(d) * 18 * Math.exp(-d * d * 0.15), duration: 0.5, ease: 'power3.out', overwrite: 'auto' });
    });
  });
  title.addEventListener('pointerleave', () => gsap.to(chars, { y: 0, duration: 0.8, ease: 'elastic.out(1, 0.4)' }));

  // mound of small white squares and crosses that settles and dodges the pointer
  const cv = $('#end-mound');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, pts = [];
  const dpr = Math.min(window.devicePixelRatio, 2);
  const mouse = { x: -1e4, y: -1e4 };
  function build() {
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    const n = Math.round((W * H) / (mobile() ? 700 : 520));
    pts = [];
    for (let i = 0; i < n; i++) {
      const u = Math.random() * 2 - 1;
      // mound profile: tall in the middle, rising again at the edges
      const x = (u * 0.5 + 0.5) * W;
      const prof = Math.exp(-u * u * 7) * 0.95 + Math.pow(Math.abs(u), 5) * 0.75 + 0.12;
      const y = H - Math.pow(Math.random(), 0.6) * prof * H;
      pts.push({ hx: x, hy: y, x, y: H + Math.random() * H, vx: 0, vy: 0, s: 2 + Math.random() * 3.2, k: Math.random() < 0.18 });
    }
  }
  build();
  window.addEventListener('resize', build);
  cv.parentElement.addEventListener('pointermove', (e) => { const r = cv.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  cv.parentElement.addEventListener('pointerleave', () => (mouse.x = mouse.y = -1e4));
  let on = false;
  ScrollTrigger.create({ trigger: '.end', start: 'top bottom', end: 'bottom top', onToggle: (s) => (on = s.isActive) });
  gsap.ticker.add(() => {
    if (!on) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#ffffff';
    for (const p of pts) {
      const dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
      if (d2 < 9000) { const f = (9000 - d2) / 9000 * 2.2; p.vx += (dx / Math.sqrt(d2 + 1)) * f; p.vy += (dy / Math.sqrt(d2 + 1)) * f; }
      p.vx += (p.hx - p.x) * 0.02; p.vy += (p.hy - p.y) * 0.02;
      p.vx *= 0.86; p.vy *= 0.86;
      p.x += p.vx; p.y += p.vy;
      if (p.k) { ctx.fillRect(p.x - p.s, p.y - 0.6, p.s * 2, 1.2); ctx.fillRect(p.x - 0.6, p.y - p.s, 1.2, p.s * 2); }
      else ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
    }
  });
}

// ───────────── footer (light) + next-page strip ─────────────
function footer() {
  ScrollTrigger.create({ trigger: '.footer', start: 'top 60px', end: 'bottom 60px', onToggle: (s) => root.classList.toggle('is-light', s.isActive) });
  gsap.from('.footer__col, .footer__news', { y: 50, autoAlpha: 0, duration: 1.2, stagger: 0.08, ease: 'expo.out', scrollTrigger: { trigger: '.footer', start: 'top 70%' } });
  gsap.from('.footer__mark', { yPercent: 40, autoAlpha: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: '.footer__mark', start: 'top 95%' } });
  let fired = false;
  gsap.to('#next-bar', {
    scaleX: 1, ease: 'none',
    scrollTrigger: {
      trigger: '#next', start: 'top bottom', end: 'bottom bottom', scrub: true,
      onUpdate: (s) => {
        if (s.progress > 0.995 && !fired) {
          fired = true;
          setTimeout(() => lenis.scrollTo(0, { duration: 2.6, easing: ease4, onComplete: () => (fired = false) }), 400);
        }
      },
    },
  });
}

// ───────────── menu ─────────────
const menuBtn = $('#menu-toggle');
function openMenu() {
  root.classList.add('menu-open');
  menuBtn.setAttribute('aria-expanded', 'true');
  $('#menu').setAttribute('aria-hidden', 'false');
  $$('.menu-label').forEach((l) => (l.textContent = 'CLOSE'));
  gsap.to('.menu > *', { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.07, ease: 'expo.out' });
}
function closeMenu() {
  if (!root.classList.contains('menu-open')) return;
  root.classList.remove('menu-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  $('#menu').setAttribute('aria-hidden', 'true');
  $$('.menu-label').forEach((l) => (l.textContent = 'MENU'));
  gsap.to('.menu > *', { autoAlpha: 0, y: '-1em', scale: 0.97, duration: 0.4, stagger: 0.04, ease: 'power3.in' });
}
menuBtn.addEventListener('click', () => (root.classList.contains('menu-open') ? closeMenu() : openMenu()));
window.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());
$$('#menu-news, #footer-news').forEach((f) => f.addEventListener('submit', (e) => {
  e.preventDefault();
  const input = $('input', f), msg = $('.field__msg', f);
  msg.textContent = input.value && input.checkValidity()
    ? '구독 기능은 준비 중이에요. pablo@hobbytan.com으로 연락 주세요.'
    : '이메일 주소를 확인해 주세요.';
}));

// ───────────── ambient sound (synthesised) ─────────────
let audio = null;
$('#sound-toggle').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const on = btn.getAttribute('aria-pressed') !== 'true';
  btn.setAttribute('aria-pressed', String(on));
  if (!audio) {
    const ctx = new AudioContext();
    const master = ctx.createGain(); master.gain.value = 0;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
    lp.connect(master).connect(ctx.destination);
    [55, 82.4, 110, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator(); o.type = i % 2 ? 'triangle' : 'sine'; o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain(); g.gain.value = 0.16 / (i + 1); o.connect(g).connect(lp); o.start();
    });
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 0.07; lg.gain.value = 240; lfo.connect(lg).connect(lp.frequency); lfo.start();
    audio = { ctx, master };
  }
  audio.ctx.resume();
  audio.master.gain.setTargetAtTime(on ? 0.32 : 0, audio.ctx.currentTime, 0.6);
  stage && stage.setVoice(on ? 1 : 0);
});

// ───────────── boot ─────────────
who();
services();
reveals();
clients();
results();
capability();
endCta();
footer();
preload().then(() => { intro(); ScrollTrigger.refresh(); });
