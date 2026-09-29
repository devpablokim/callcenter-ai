import * as THREE from 'three';

// One opaque, fixed WebGL canvas behind the page with two scenes:
//  - valley: tall backdrop photo the camera "tilts" down onto, a soft bokeh
//    particle cloud, a light beam, a rising glowing drop and floating rocks
//  - team:   a particle portrait (sampled from a photo), topographic glow
//            lines and falling particle rain on navy
// The canvas is opaque so additive layers always have real pixels to add onto.

const NOISE = /* glsl */ `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0);const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy));vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz);vec3 l=1.0-g;vec3 i1=min(g.xyz,l.zxy);vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx;vec3 x2=x0-i2+C.yyy;vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857;vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);vec4 x_=floor(j*ns.z);vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy;vec4 y=y_*ns.x+ns.yyyy;vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy);vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0;vec4 s1=floor(b1)*2.0+1.0;vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x);vec3 p1=vec3(a0.zw,h.y);vec3 p2=vec3(a1.xy,h.z);vec3 p3=vec3(a1.zw,h.w);
  vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}`;

const additive = (mat) => Object.assign(mat, { transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export function createStage(canvas, { valley, faces = [] } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
  const DPR = Math.min(window.devicePixelRatio, 1.75);
  renderer.setPixelRatio(DPR);
  renderer.setClearColor(0x000000, 1);
  renderer.autoClear = false;
  const mobile = window.innerWidth < 800;

  const S = {
    who: 0,          // 0..1 progress through the WHO story
    team: 0,         // 0..1 crossfade valley -> team
    voice: 0,
    intro: 0,
    mouse: new THREE.Vector2(), smouse: new THREE.Vector2(),
  };

  // ───────────────────────── VALLEY ─────────────────────────
  const U = {
    uTime: { value: 0 }, uIntro: { value: 0 }, uDPR: { value: DPR },
    uPan: { value: 0 }, uZoom: { value: 1.3 }, uDark: { value: 0 }, uBeam: { value: 0 },
    uCondense: { value: 0 }, uTopo: { value: 0 }, uVoice: { value: 0 },
  };

  // backdrop: cover-fit tall photo; uPan 0 = looking at the sky above it, 1 = the valley floor
  const bgU = { ...U, uTex: { value: null }, uHas: { value: 0 }, uTexAspect: { value: 0.667 }, uView: { value: 1 }, uOff: { value: new THREE.Vector2() } };
  const bgScene = new THREE.Scene();
  const orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bgU, depthTest: false, depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform sampler2D uTex; uniform float uHas, uTexAspect, uView, uZoom, uPan, uDark, uIntro, uTime, uTopo;
      uniform vec2 uOff; varying vec2 vUv;
      void main(){
        // width-fit the tall photo; the visible window slides from above the image (sky) to its lower part
        vec2 uv = vUv - 0.5;
        uv.y *= uTexAspect / uView;                      // image-space height of the viewport
        uv /= uZoom;
        float winH = 1.0 / uView * uTexAspect / uZoom;   // visible fraction of image height
        float centerY = mix(1.0 + winH * 0.35, 0.3, uPan);
        uv += vec2(0.5, centerY) + uOff;
        vec3 col = vec3(0.0);
        if (uHas > 0.5) {
          vec3 t = texture2D(uTex, clamp(uv, vec2(0.001), vec2(0.999))).rgb;
          float inside = smoothstep(1.02, 0.9, uv.y) * smoothstep(-0.02, 0.05, uv.y);
          col = t * inside;
        }
        // drifting mist
        float fog = snoise(vec3(vUv * vec2(2.0, 3.0) + vec2(uTime * 0.02, 0.0), uTime * 0.03)) * 0.5 + 0.5;
        col += vec3(0.55, 0.62, 0.72) * fog * 0.05 * smoothstep(0.1, 0.7, vUv.y);
        col = pow(col, vec3(1.08)) * vec3(0.93, 0.98, 1.06);
        float vig = smoothstep(1.2, 0.3, length((vUv - 0.5) * vec2(uView, 1.0)));
        col *= mix(0.35, 1.0, vig);
        col *= (1.0 - uDark * 0.8) * uIntro;
        gl_FragColor = vec4(col, 1.0);
      }`,
  })));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  // soft bokeh cloud: particles in a noisy volume, size grows away from the focus plane
  const N = mobile ? 5000 : 11000;
  const cloudPos = new Float32Array(N * 3), cloudRnd = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) {
    const u = Math.random(), v = Math.random();
    const th = u * Math.PI * 2, ph = Math.acos(2 * v - 1);
    const r = Math.pow(Math.random(), 0.55) * 2.6;
    cloudPos[i * 3] = Math.sin(ph) * Math.cos(th) * r * 1.35;
    cloudPos[i * 3 + 1] = Math.cos(ph) * r * 0.85;
    cloudPos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * r * 1.1;
    for (let k = 0; k < 4; k++) cloudRnd[i * 4 + k] = Math.random();
  }
  const cloudGeo = new THREE.BufferGeometry();
  cloudGeo.setAttribute('position', new THREE.BufferAttribute(cloudPos, 3));
  cloudGeo.setAttribute('aRnd', new THREE.BufferAttribute(cloudRnd, 4));
  const cloud = new THREE.Points(cloudGeo, additive(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uDPR, uIntro, uCondense, uVoice;
      attribute vec4 aRnd; varying float vA; varying float vBlur; varying float vCyan;
      void main(){
        vec3 p = position;
        float t = uTime * 0.07;
        // curl-ish drift so the cloud churns slowly
        p += vec3(snoise(p * 0.45 + t), snoise(p * 0.45 + t + 11.0), snoise(p * 0.45 - t + 23.0)) * (0.55 + uVoice * 0.25);
        // condense toward a tight core, keep a few stragglers
        float keep = step(0.94, aRnd.x);
        p = mix(p, p * mix(0.16, 0.7, keep), uCondense);
        // intro: gather from far away
        p *= mix(3.5, 1.0, uIntro);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float focus = 8.0;
        vBlur = clamp(abs(-mv.z - focus) * 0.45, 0.0, 1.0);
        float big = step(0.86, aRnd.y);
        float size = mix(1.4, 3.2, aRnd.z) + big * mix(6.0, 22.0, aRnd.w) * (0.4 + vBlur);
        gl_PointSize = size * uDPR * (9.0 / -mv.z);
        // dim as the cloud condenses so thousands of overlapping points don't blow out to white
        vA = mix(0.55, 0.12, big) * mix(1.0, 0.45, vBlur) * uIntro * mix(1.0, 0.16, uCondense);
        vCyan = step(0.985, aRnd.w) * (1.0 - big);
      }`,
    fragmentShader: /* glsl */ `
      varying float vA; varying float vBlur; varying float vCyan;
      void main(){
        float d = length(gl_PointCoord - 0.5) * 2.0;
        float disc = smoothstep(1.0, mix(0.55, 0.85, vBlur), d);
        float ring = smoothstep(0.7, 0.95, d) * smoothstep(1.0, 0.92, d) * 0.35 * vBlur;
        vec3 col = mix(vec3(0.9, 0.93, 0.98), vec3(1.0, 0.353, 0.122), vCyan);
        gl_FragColor = vec4(col * (disc + ring) * vA * (1.0 + vCyan * 2.0), 1.0);
      }`,
  })));
  scene.add(cloud);

  // light beam
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 16), additive(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uBeam, uIntro; varying vec2 vUv;
      void main(){
        float x = abs(vUv.x - 0.5) * 2.0;
        float core = exp(-x * x * 18.0) + exp(-x * x * 3.0) * 0.35;
        float flick = 0.85 + 0.15 * snoise(vec3(vUv.y * 4.0 - uTime * 0.5, x * 3.0, uTime * 0.2));
        float fy = smoothstep(0.0, 0.25, vUv.y) * smoothstep(1.0, 0.55, vUv.y);
        gl_FragColor = vec4(vec3(0.82, 0.92, 1.0) * core * flick * fy * uBeam * 0.75 * uIntro, 1.0);
      }`,
  })));
  beam.position.set(0, 1, -0.6);
  scene.add(beam);

  // glowing drop (rises along the beam)
  const drop = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), additive(new THREE.ShaderMaterial({
    uniforms: U,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uBeam, uTime; varying vec2 vUv;
      void main(){
        vec2 p = (vUv - 0.5) * 2.0;
        // teardrop: circle below, tapering point above
        float body = length(vec2(p.x, p.y + 0.12)) - 0.16;
        float tip = abs(p.x) - (0.16 - (p.y + 0.12) * 0.36) * step(-0.12, p.y) * step(p.y, 0.32);
        float sdf = min(body, max(tip, -p.y - 0.12 + 0.0));
        float core = smoothstep(0.02, -0.01, sdf);
        float glow = exp(-max(sdf, 0.0) * 9.0) * 0.55 + exp(-dot(p, p) * 3.0) * 0.35;
        vec3 col = vec3(1.0, 0.353, 0.122) * (core * 1.6 + glow) + vec3(1.0) * core * 0.35;
        gl_FragColor = vec4(col * uBeam * (0.9 + 0.1 * sin(uTime * 3.0)), 1.0);
      }`,
  })));
  scene.add(drop);

  // floating rocks
  const SH = mobile ? 30 : 70;
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ color: 0x4a5058, roughness: 0.9, flatShading: true }), SH);
  const rockData = Array.from({ length: SH }, () => ({
    x: (Math.random() - 0.5) * 12, y: Math.random() * 10 - 4, z: (Math.random() - 0.5) * 6 - 1,
    s: 0.015 + Math.pow(Math.random(), 4) * 0.2, r: Math.random() * 6, v: (Math.random() - 0.5) * 0.5, lift: 0.4 + Math.random(),
  }));
  const dummy = new THREE.Object3D();
  scene.add(rocks);
  scene.add(new THREE.AmbientLight(0x9fb3c8, 0.5));
  const key = new THREE.PointLight(0xe8f6ff, 30, 14, 1.4);
  key.position.set(0, 2, 2);
  scene.add(key);

  // topographic glow lines (visible under the description)
  const topo = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), additive(new THREE.ShaderMaterial({
    uniforms: { ...U, uView: bgU.uView },
    depthTest: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uTopo, uView; varying vec2 vUv;
      void main(){
        // fake perspective ground: rows compress toward the horizon
        float h = 0.62;
        if (vUv.y > h) { gl_FragColor = vec4(0.0); return; }
        float depth = 1.0 / max(h - vUv.y, 0.02);
        vec2 g = vec2((vUv.x - 0.5) * uView * depth * 0.55, depth * 0.35 - uTime * 0.05);
        float n = snoise(vec3(g * 0.7, uTime * 0.03)) * 0.6 + snoise(vec3(g * 1.6, 3.0)) * 0.25;
        float lines = abs(fract(n * 6.0) - 0.5) / fwidth(n * 6.0);
        float l = 1.0 - smoothstep(0.0, 1.4, lines);
        float fade = smoothstep(h, h - 0.35, vUv.y) * smoothstep(0.0, 0.08, vUv.y);
        gl_FragColor = vec4(vec3(0.78, 0.88, 1.0) * l * fade * uTopo * 0.55, 1.0);
      }`,
  })));
  topo.material.extensions = { derivatives: true };
  const topoScene = new THREE.Scene();
  topoScene.add(topo);

  // ───────────────────────── TEAM ─────────────────────────
  const T = { uTime: U.uTime, uDPR: U.uDPR, uMix: { value: 0 }, uScatter: { value: 0 }, uShow: { value: 0 } };
  const teamScene = new THREE.Scene();
  const teamCam = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
  teamCam.position.set(0, 0, 7);
  const GRID = mobile ? 150 : 210;
  const P = GRID * GRID;
  const facePos = [new Float32Array(P * 3), new Float32Array(P * 3)];
  const faceLum = [new Float32Array(P), new Float32Array(P)];
  const faceRnd = new Float32Array(P);
  for (let i = 0; i < P; i++) faceRnd[i] = Math.random();
  const faceGeo = new THREE.BufferGeometry();
  faceGeo.setAttribute('position', new THREE.BufferAttribute(facePos[0], 3));
  faceGeo.setAttribute('aTo', new THREE.BufferAttribute(facePos[1], 3));
  faceGeo.setAttribute('aL0', new THREE.BufferAttribute(faceLum[0], 1));
  faceGeo.setAttribute('aL1', new THREE.BufferAttribute(faceLum[1], 1));
  faceGeo.setAttribute('aRnd', new THREE.BufferAttribute(faceRnd, 1));
  const face = new THREE.Points(faceGeo, additive(new THREE.ShaderMaterial({
    uniforms: T,
    vertexShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uDPR, uMix, uScatter, uShow;
      attribute vec3 aTo; attribute float aL0, aL1, aRnd; varying float vL;
      void main(){
        float m = smoothstep(aRnd * 0.4, aRnd * 0.4 + 0.6, uMix);
        vec3 p = mix(position, aTo, m);
        float L = mix(aL0, aL1, m);
        float s = uScatter * (0.4 + aRnd);
        p += vec3(snoise(p * 1.3 + uTime * 0.2), snoise(p * 1.3 - uTime * 0.2 + 7.0), snoise(p + 13.0)) * s * 0.8;
        p.y -= (1.0 - uShow) * (1.5 + aRnd * 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (0.9 + L * 2.2) * uDPR * (7.0 / -mv.z);
        vL = L * uShow;
      }`,
    fragmentShader: /* glsl */ `
      varying float vL;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        if (vL < 0.02) discard;
        gl_FragColor = vec4(vec3(0.82, 0.88, 1.0) * smoothstep(0.5, 0.1, d) * vL * 0.9, 1.0);
      }`,
  })));
  teamScene.add(face);

  // rain streaks
  const RN = mobile ? 500 : 1400;
  const rain = new Float32Array(RN * 3), rainR = new Float32Array(RN);
  for (let i = 0; i < RN; i++) { rain[i * 3] = (Math.random() - 0.5) * 12; rain[i * 3 + 1] = Math.random() * 10 - 5; rain[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1; rainR[i] = Math.random(); }
  const rainGeo = new THREE.BufferGeometry();
  rainGeo.setAttribute('position', new THREE.BufferAttribute(rain, 3));
  rainGeo.setAttribute('aRnd', new THREE.BufferAttribute(rainR, 1));
  teamScene.add(new THREE.Points(rainGeo, additive(new THREE.ShaderMaterial({
    uniforms: T,
    vertexShader: /* glsl */ `
      uniform float uTime, uDPR, uShow; attribute float aRnd; varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y - uTime * (0.3 + aRnd * 0.9) + 5.0, 10.0) - 5.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.0 + aRnd * 2.0) * uDPR * (6.0 / -mv.z);
        vA = (0.15 + aRnd * 0.5) * uShow;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.08, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)); gl_FragColor = vec4(vec3(0.75, 0.85, 1.0) * a * vA, 1.0); }`,
  }))));

  // sample a portrait into particle targets
  const faceImgs = [];
  async function sampleFace(idx, slot) {
    const img = faceImgs[idx] || (faceImgs[idx] = await loadImage(faces[idx]));
    if (!img) return;
    const c = document.createElement('canvas');
    c.width = c.height = GRID;
    const ctx = c.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(img, 0, 0, GRID, GRID);
    const d = ctx.getImageData(0, 0, GRID, GRID).data;
    const pos = facePos[slot], lum = faceLum[slot];
    const W = 5.2;
    for (let y = 0, i = 0; y < GRID; y++) {
      for (let x = 0; x < GRID; x++, i++) {
        const L = d[i * 4] / 255;
        const jx = (Math.random() - 0.5) / GRID, jy = (Math.random() - 0.5) / GRID;
        pos[i * 3] = (x / GRID - 0.5 + jx) * W;
        pos[i * 3 + 1] = -(y / GRID - 0.5 + jy) * W;
        pos[i * 3 + 2] = L * 0.9;              // brighter = closer
        lum[i] = L < 0.12 ? 0 : Math.pow(L, 1.3);
      }
    }
    faceGeo.attributes[slot === 0 ? 'position' : 'aTo'].needsUpdate = true;
    faceGeo.attributes[slot === 0 ? 'aL0' : 'aL1'].needsUpdate = true;
  }
  let faceIdx = 0;
  let faceReady = faces.length ? sampleFace(0, 0) : Promise.resolve();

  // ───────────────────────── loop ─────────────────────────
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = teamCam.aspect = w / h;
    camera.fov = w < h ? 62 : 45;
    camera.updateProjectionMatrix();
    teamCam.updateProjectionMatrix();
    bgU.uView.value = w / h;
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => S.mouse.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1));

  if (valley) {
    new THREE.TextureLoader().load(valley, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      bgU.uTex.value = tex;
      bgU.uTexAspect.value = tex.image.width / tex.image.height;
      bgU.uHas.value = 1;
    });
  }

  let running = true;
  const clock = new THREE.Clock();
  function frame() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    U.uTime.value += dt;
    S.smouse.lerp(S.mouse, Math.min(1, dt * 2.5));
    U.uIntro.value = S.intro;
    U.uVoice.value += (S.voice - U.uVoice.value) * Math.min(1, dt * 6);

    const p = S.who;
    // choreography (fractions of the WHO section)
    const pan = smooth(0.03, 0.3, p);
    const beamP = smooth(0.26, 0.5, p);
    const cond = smooth(0.34, 0.6, p);
    const rise = smooth(0.36, 0.66, p);
    U.uPan.value = pan;
    U.uZoom.value = 1.28 - 0.1 * S.intro - smooth(0.3, 0.62, p) * 0.16;
    U.uBeam.value = beamP;
    U.uCondense.value = cond;
    U.uDark.value = smooth(0.6, 0.74, p) * 0.75;
    U.uTopo.value = smooth(0.62, 0.74, p) * (1 - smooth(0.93, 1.0, p) * 0.5);
    bgU.uOff.value.set(S.smouse.x * 0.01, -S.smouse.y * 0.006);

    // cloud lives in the sky: it starts centred high, drifts up as the camera tilts down
    cloud.position.set(0, 0.8 + pan * 1.6 + rise * 0.8, 0);
    cloud.rotation.y += dt * 0.03;
    drop.position.set(0, -1.0 + rise * 5.4, 0.4);
    drop.scale.setScalar(0.35 + (1 - rise) * 0.4);
    beam.position.y = 1.0 + pan * 1.5;
    camera.position.set(S.smouse.x * 0.3, -S.smouse.y * 0.18, 8 + smooth(0.3, 0.62, p) * 2.5);
    camera.lookAt(0, 0.8 + pan * 1.2, 0);
    key.position.y = 1 + pan * 2;
    for (let i = 0; i < SH; i++) {
      const d = rockData[i];
      const y = ((d.y + U.uTime.value * 0.05 * d.lift + p * 9 * d.lift + 5) % 10 + 10) % 10 - 5;
      dummy.position.set(d.x, y, d.z);
      dummy.rotation.set(d.r + U.uTime.value * d.v, d.r * 0.7 + U.uTime.value * d.v * 0.6, 0);
      dummy.scale.setScalar(d.s * S.intro * (1 - U.uDark.value));
      dummy.updateMatrix();
      rocks.setMatrixAt(i, dummy.matrix);
    }
    rocks.instanceMatrix.needsUpdate = true;

    // team
    const tm = S.team;
    T.uShow.value += ((tm > 0.5 ? 1 : 0) - T.uShow.value) * Math.min(1, dt * 2.2);
    face.rotation.y = S.smouse.x * 0.25;
    face.rotation.x = S.smouse.y * 0.12;
    face.position.x = window.innerWidth < 800 ? 0 : -0.4;

    renderer.clear();
    if (tm < 1) {
      renderer.render(bgScene, orthoCam);
      renderer.render(scene, camera);
      renderer.render(topoScene, orthoCam);
    }
    if (tm > 0) {
      // navy curtain over the valley, then the team scene
      renderer.setClearColor(new THREE.Color(0x05070f), 1);
      if (tm >= 1) renderer.clear();
      else {
        renderer.setScissorTest(false);
        curtain.material.opacity = tm;
        renderer.render(curtainScene, orthoCam);
      }
      renderer.render(teamScene, teamCam);
      renderer.setClearColor(0x000000, 1);
    }
    requestAnimationFrame(frame);
  }
  const curtainScene = new THREE.Scene();
  const curtain = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ color: 0x05070f, transparent: true, depthTest: false }));
  curtainScene.add(curtain);
  requestAnimationFrame(frame);

  return {
    set intro(v) { S.intro = v; },
    get intro() { return S.intro; },
    setWho(v) { S.who = v; },
    setTeam(v) { S.team = v; },
    setVoice(v) { S.voice = v; },
    async showFace(i) {
      if (!faces.length) return;
      await faceReady;
      const next = ((i % faces.length) + faces.length) % faces.length;
      if (next === faceIdx) return;
      await sampleFace(next, 1);
      const o = { m: 0 };
      T.uMix.value = 0;
      faceReady = new Promise((resolve) => {
        const start = performance.now();
        const step = (now) => {
          const k = Math.min(1, (now - start) / 1400);
          T.uMix.value = k;
          T.uScatter.value = Math.sin(k * Math.PI) * 0.9;
          if (k < 1) requestAnimationFrame(step);
          else {
            // commit: target becomes the base
            facePos[0].set(facePos[1]); faceLum[0].set(faceLum[1]);
            faceGeo.attributes.position.needsUpdate = true;
            faceGeo.attributes.aL0.needsUpdate = true;
            T.uMix.value = 0; T.uScatter.value = 0;
            resolve();
          }
        };
        requestAnimationFrame(step);
      });
      faceIdx = next;
      return faceReady;
    },
    pause() { running = false; },
    resume() { if (!running) { running = true; clock.getDelta(); requestAnimationFrame(frame); } },
  };
}
