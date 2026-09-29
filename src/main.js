import Lenis from 'lenis';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createHero } from './hero.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// ───────────── Smooth scroll (Lenis → GSAP ticker) ─────────────
const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9, smoothWheel: !reduced });
lenis.stop();
lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((t) => lenis.raf(t * 1000));
gsap.ticker.lagSmoothing(0);
window.scrollTo(0, 0);

$$('a[href^="#"]').forEach((a) =>
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    e.preventDefault();
    closeMenu();
    lenis.scrollTo(id === '#top' ? 0 : id, { duration: 2, easing: (x) => 1 - Math.pow(1 - x, 4) });
  })
);

// ───────────── Custom scrollbar ─────────────
const thumb = $('#scrollbar-thumb');
lenis.on('scroll', ({ progress }) => {
  gsap.set(thumb, { y: (180 - 36) * (progress || 0) });
});

// ───────────── Hero WebGL ─────────────
const hero = createHero($('#hero-canvas'));

// ───────────── Image slots ─────────────
// Resolve each data-img against the document (not a stylesheet) so relative
// paths work from any host or sub-path, then paint it over the fallback gradient.
const FALLBACK_BG = 'radial-gradient(120% 90% at 50% 40%, #23262c 0%, #0d0e10 70%)';
const imageSlots = $$('[data-img]').map((el) => {
  const src = new URL(el.dataset.img, document.baseURI).href;
  el.style.backgroundImage = `url("${src}"), ${FALLBACK_BG}`;
  return src;
});

// ───────────── Preloader ─────────────
function preload() {
  const imgs = [...new Set(imageSlots)];
  const tasks = [document.fonts.ready, ...imgs.map((src) => new Promise((r) => { const i = new Image(); i.onload = i.onerror = r; i.src = src; }))];
  let done = 0;
  const state = { v: 0 };
  const count = $('#preloader-count');
  const bar = $('.preloader__bar span');
  const update = () => {
    count.textContent = String(Math.round(state.v)).padStart(3, '0');
    bar.style.transform = `scaleX(${state.v / 100})`;
  };
  return new Promise((resolve) => {
    const min = gsap.delayedCall(1.2, () => {});
    tasks.forEach((t) =>
      Promise.resolve(t).then(() => {
        done++;
        gsap.to(state, { v: (done / tasks.length) * 100, duration: 0.6, ease: 'power2.out', onUpdate: update, overwrite: true,
          onComplete: () => { if (done === tasks.length) gsap.delayedCall(Math.max(0, 1.2 - min.time()), resolve); } });
      })
    );
  });
}

function intro() {
  const tl = gsap.timeline({ defaults: { ease: 'expo.out' } });
  tl.to('#preloader', { autoAlpha: 0, duration: 0.9, ease: 'power2.inOut' })
    .to(hero.uniforms.uIntro, { value: 1, duration: 3.2, ease: 'power3.out' }, 0.2)
    .fromTo('.hero__bg', { scale: 1.25, autoAlpha: 0 }, { scale: 1.12, autoAlpha: 1, duration: 3 }, 0.2)
    .from('.header > *', { y: -30, autoAlpha: 0, duration: 1.4, stagger: 0.1 }, 0.6)
    .from('.hero__title .line > span, .hero__sub .line > span', { yPercent: 110, duration: 1.6, stagger: 0.07 }, 0.8)
    .from('.crosshairs i', { scale: 0, autoAlpha: 0, duration: 1, stagger: 0.06 }, 1)
    .from('.hero__scroll', { autoAlpha: 0, y: 20, duration: 1 }, 1.4)
    .add(() => { document.body.classList.remove('is-loading'); lenis.start(); }, 1);
  return tl;
}

// ───────────── Hero scroll choreography ─────────────
function heroScroll() {
  ScrollTrigger.create({
    trigger: '#hero',
    start: 'top top',
    end: 'bottom bottom',
    scrub: true,
    onUpdate: (self) => hero.setProgress(self.progress),
    onToggle: (self) => (self.isActive ? hero.resume() : hero.pause()),
  });
  // Keep rendering while the hero is visible at all
  ScrollTrigger.create({ trigger: '#hero', start: 'top bottom', end: 'bottom top', onToggle: (s) => (s.isActive ? hero.resume() : hero.pause()) });

  gsap.timeline({ scrollTrigger: { trigger: '#hero', start: 'top top', end: 'bottom bottom', scrub: 1 } })
    .to('.hero__bg', { scale: 1.0, yPercent: 6, ease: 'none', duration: 1 }, 0)
    .to('.hero__scroll', { autoAlpha: 0, duration: 0.1 }, 0)
    .to('.crosshairs', { autoAlpha: 0, duration: 0.3 }, 0.55)
    .to('.hero__title .line > span', { yPercent: -110, stagger: 0.02, duration: 0.2, ease: 'power2.in' }, 0.78)
    .to('.hero__sub .line > span', { yPercent: -110, stagger: 0.02, duration: 0.2, ease: 'power2.in' }, 0.8)
    .to('.hero__vignette', { opacity: 1.0, duration: 0.2 }, 0.8);
}

// ───────────── Statement: word-by-word scrub ─────────────
function statement() {
  const el = $('[data-words]');
  el.innerHTML = el.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  gsap.to($$('.w', el), {
    opacity: 1,
    stagger: 0.1,
    ease: 'none',
    scrollTrigger: { trigger: el, start: 'top 80%', end: 'bottom 45%', scrub: true },
  });
  gsap.from(el, { y: 80, ease: 'none', scrollTrigger: { trigger: el, start: 'top bottom', end: 'top 30%', scrub: true } });
}

// ───────────── Generic reveals ─────────────
function reveals() {
  $$('.reveal').forEach((el) =>
    gsap.from(el, { y: 60, autoAlpha: 0, duration: 1.4, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 88%' } })
  );
  $$('.split-lines').forEach((el) => {
    el.innerHTML = el.innerHTML.split(/<br\s*\/?>/i).map((l) => `<span class="line"><span>${l.trim()}</span></span>`).join('');
    gsap.from($$('.line > span', el), { yPercent: 110, duration: 1.4, stagger: 0.1, ease: 'expo.out', scrollTrigger: { trigger: el, start: 'top 85%' } });
  });
}

// ───────────── Agents: draggable card stack ─────────────
function agents() {
  const stack = $('#agent-stack');
  let cards = $$('.card', stack);
  const layout = (animate = true) => {
    cards.forEach((c, i) => {
      const props = { x: 0, y: i * -14, scale: 1 - i * 0.05, rotation: i === 0 ? 0 : (i % 2 ? 3 : -3) * i * 0.6, zIndex: cards.length - i, autoAlpha: i > 3 ? 0 : 1 };
      animate ? gsap.to(c, { ...props, duration: 0.9, ease: 'expo.out' }) : gsap.set(c, props);
    });
  };
  layout(false);

  gsap.from(stack, { y: 140, rotation: 6, autoAlpha: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: stack, start: 'top 85%' } });

  let startX = 0, startY = 0, dx = 0, dragging = false, active = null;
  stack.addEventListener('pointerdown', (e) => {
    active = cards[0];
    if (!active.contains(e.target)) return;
    dragging = true; startX = e.clientX; startY = e.clientY; dx = 0;
    active.setPointerCapture(e.pointerId);
  });
  stack.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    dx = e.clientX - startX;
    gsap.set(active, { x: dx, y: (e.clientY - startY) * 0.3, rotation: dx * 0.05 });
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    if (Math.abs(dx) > 90) {
      const dir = Math.sign(dx);
      gsap.to(active, {
        x: dir * window.innerWidth * 0.6, rotation: dir * 25, autoAlpha: 0, duration: 0.6, ease: 'power3.in',
        onComplete: () => {
          cards.push(cards.shift());
          stack.insertBefore(active, stack.querySelector('.agents__hint'));
          gsap.set(active, { x: 0, y: 0, rotation: 0 });
          layout();
        },
      });
      cards.slice(1).forEach((c, i) => gsap.to(c, { y: i * -14, scale: 1 - i * 0.05, rotation: 0, duration: 0.6, ease: 'expo.out' }));
    } else {
      gsap.to(active, { x: 0, y: 0, rotation: 0, duration: 0.9, ease: 'elastic.out(1, 0.6)' });
    }
  };
  stack.addEventListener('pointerup', release);
  stack.addEventListener('pointercancel', release);

  // subtle 3D tilt on hover
  stack.addEventListener('pointermove', (e) => {
    if (dragging) return;
    const r = stack.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    gsap.to(stack, { rotationY: px * 10, rotationX: -py * 10, transformPerspective: 900, duration: 0.8, ease: 'power3.out' });
  });
  stack.addEventListener('pointerleave', () => gsap.to(stack, { rotationY: 0, rotationX: 0, duration: 1, ease: 'power3.out' }));
}

// ───────────── Marquees (scroll-velocity aware) ─────────────
function marquees() {
  const rows = $$('.marquee').map((m) => {
    const track = $('.marquee__track', m);
    track.innerHTML += track.innerHTML; // duplicate for seamless loop
    return { track, dir: Number(m.dataset.dir), x: 0, w: 0 };
  });
  const measure = () => rows.forEach((r) => (r.w = r.track.scrollWidth / 2));
  measure();
  window.addEventListener('resize', measure);
  let boost = 0;
  lenis.on('scroll', ({ velocity }) => (boost = gsap.utils.clamp(-40, 40, velocity)));
  gsap.ticker.add((_, dt) => {
    boost *= 0.92;
    rows.forEach((r) => {
      r.x -= r.dir * (0.05 * dt + Math.abs(boost) * 0.25 * Math.sign(boost || 1));
      r.x = ((r.x % r.w) - r.w) % r.w;
      r.track.style.transform = `translate3d(${r.x}px,0,0)`;
    });
  });
}

// ───────────── Metrics accordion + counters ─────────────
function countUp(el) {
  if (el.dataset.done) return;
  el.dataset.done = 1;
  const target = parseFloat(el.dataset.count);
  const dec = Number(el.dataset.decimals || 0);
  const suffix = el.dataset.suffix || '';
  const o = { v: 0 };
  gsap.to(o, { v: target, duration: 1.8, ease: 'power3.out', onUpdate: () => (el.textContent = (dec ? o.v.toFixed(dec) : Math.round(o.v).toLocaleString('en-US')) + suffix) });
}

function metrics() {
  const rows = $$('[data-acc]');
  rows.forEach((row) => {
    const list = $('.metrics__list', row);
    $('.metrics__head', row).addEventListener('click', () => {
      const open = !row.classList.contains('open');
      rows.forEach((r) => {
        if (r !== row && r.classList.contains('open')) {
          r.classList.remove('open');
          gsap.to($('.metrics__list', r), { height: 0, duration: 0.8, ease: 'expo.out' });
        }
      });
      row.classList.toggle('open', open);
      gsap.to(list, { height: open ? 'auto' : 0, duration: 0.9, ease: 'expo.out', onComplete: () => ScrollTrigger.refresh() });
      if (open) $$('.count', list).forEach(countUp);
    });
    gsap.from(row, { y: 50, autoAlpha: 0, duration: 1.2, ease: 'expo.out', scrollTrigger: { trigger: row, start: 'top 92%', onEnter: () => $$('.metrics__head .count', row).forEach(countUp) } });
  });
  // open the first row once it scrolls in, like a teaser
  ScrollTrigger.create({ trigger: rows[0], start: 'top 70%', once: true, onEnter: () => $('.metrics__head', rows[0]).click() });
}

// ───────────── Capabilities: scroll-rotated cubes ─────────────
function capabilities() {
  $$('.cap').forEach((cap, i) => {
    gsap.fromTo($('.cube__inner', cap), { rotationY: -90 * (i + 1) }, {
      rotationY: 270, rotationX: 0, ease: 'none',
      scrollTrigger: { trigger: '.caps', start: 'top bottom', end: 'bottom top', scrub: 1 },
    });
    gsap.from($('.cap__img', cap), { scaleY: 0, duration: 1.6, ease: 'expo.out', scrollTrigger: { trigger: cap, start: 'top 80%' }, delay: i * 0.08 });
    gsap.from($$('h3, li', cap), { y: 30, autoAlpha: 0, duration: 1.2, stagger: 0.05, ease: 'expo.out', delay: 0.2 + i * 0.08, scrollTrigger: { trigger: cap, start: 'top 80%' } });
  });
}

// ───────────── CTA: parallax title + cursor-following button ─────────────
function cta() {
  const lines = $$('.cta__line > span');
  gsap.fromTo(lines[0], { xPercent: -12 }, { xPercent: 6, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo(lines[1], { xPercent: 12 }, { xPercent: -6, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });
  gsap.fromTo('.cta__bg', { scale: 1.3 }, { scale: 1, ease: 'none', scrollTrigger: { trigger: '.cta', start: 'top bottom', end: 'bottom top', scrub: true } });

  const title = $('#cta-title');
  const btn = $('#cta-btn');
  const qx = gsap.quickTo(btn, 'left', { duration: 0.6, ease: 'power3.out' });
  const qy = gsap.quickTo(btn, 'top', { duration: 0.6, ease: 'power3.out' });
  title.addEventListener('pointerenter', () => gsap.to(btn, { autoAlpha: 1, scale: 1, duration: 0.6, ease: 'expo.out' }));
  title.addEventListener('pointerleave', () => gsap.to(btn, { autoAlpha: 0, scale: 0.4, duration: 0.5, ease: 'expo.out' }));
  title.addEventListener('pointermove', (e) => {
    const r = title.getBoundingClientRect();
    qx(e.clientX - r.left);
    qy(e.clientY - r.top);
  });
}

// ───────────── Footer: continue-to-scroll loop ─────────────
function footer() {
  gsap.from('.footer__mark', { yPercent: 60, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
  let fired = false;
  gsap.to('#continue-bar', {
    scaleX: 1, ease: 'none',
    scrollTrigger: {
      trigger: '.footer__continue', start: 'top 85%', end: () => `+=${Math.max(1, document.documentElement.scrollHeight - window.innerHeight - ($('.footer__continue').getBoundingClientRect().top + window.scrollY - window.innerHeight * 0.85))}`, scrub: true,
      onLeave: () => {
        if (fired) return;
        fired = true;
        lenis.scrollTo(0, { duration: 2.4, easing: (x) => 1 - Math.pow(1 - x, 4), onComplete: () => (fired = false) });
      },
    },
  });
}

// ───────────── Menu ─────────────
const menuBtn = $('#menu-toggle');
function openMenu() {
  document.body.classList.add('menu-open');
  menuBtn.setAttribute('aria-expanded', 'true');
  $('#menu').setAttribute('aria-hidden', 'false');
  $$('.menu-label').forEach((l) => (l.textContent = 'Close'));
  gsap.to('.menu__panel > *', { autoAlpha: 1, y: 0, scale: 1, duration: 0.8, stagger: 0.08, ease: 'expo.out' });
  gsap.from('.menu__links li', { y: 20, autoAlpha: 0, duration: 0.8, stagger: 0.05, ease: 'expo.out', delay: 0.1 });
}
function closeMenu() {
  if (!document.body.classList.contains('menu-open')) return;
  document.body.classList.remove('menu-open');
  menuBtn.setAttribute('aria-expanded', 'false');
  $('#menu').setAttribute('aria-hidden', 'true');
  $$('.menu-label').forEach((l) => (l.textContent = 'Menu'));
  gsap.to('.menu__panel > *', { autoAlpha: 0, y: -16, scale: 0.98, duration: 0.5, stagger: 0.05, ease: 'power3.in' });
}
menuBtn.addEventListener('click', () => (document.body.classList.contains('menu-open') ? closeMenu() : openMenu()));
window.addEventListener('keydown', (e) => e.key === 'Escape' && closeMenu());

// ───────────── Ambient sound (synthesised, no audio files) ─────────────
let audio = null;
$('#sound-toggle').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const on = btn.getAttribute('aria-pressed') !== 'true';
  btn.setAttribute('aria-pressed', String(on));
  if (!audio) {
    const ctx = new AudioContext();
    const master = ctx.createGain();
    master.gain.value = 0;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 600;
    filter.connect(master).connect(ctx.destination);
    [55, 82.4, 110, 164.8].forEach((f, i) => {
      const o = ctx.createOscillator();
      o.type = i % 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.detune.value = (Math.random() - 0.5) * 12;
      const g = ctx.createGain();
      g.gain.value = 0.18 / (i + 1);
      o.connect(g).connect(filter);
      o.start();
    });
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.08;
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(filter.frequency);
    lfo.start();
    audio = { ctx, master };
  }
  audio.ctx.resume();
  audio.master.gain.setTargetAtTime(on ? 0.35 : 0, audio.ctx.currentTime, 0.6);
  hero.setVoice(on ? 1 : 0);
});

// ───────────── Boot ─────────────
heroScroll();
statement();
reveals();
agents();
marquees();
metrics();
capabilities();
cta();
footer();

preload().then(() => {
  intro();
  ScrollTrigger.refresh();
});
