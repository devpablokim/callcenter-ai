import * as THREE from 'three';

// Simplex-ish 3D noise (Ashima / Stefan Gustavson, MIT)
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

// Additive colour, but leave the canvas alpha untouched so it composites
// additively over the CSS background image instead of darkening it.
function additive(mat, useAlpha = true) {
  mat.blending = THREE.CustomBlending;
  mat.blendEquation = THREE.AddEquation;
  mat.blendSrc = useAlpha ? THREE.SrcAlphaFactor : THREE.OneFactor;
  mat.blendDst = THREE.OneFactor;
  mat.blendSrcAlpha = THREE.ZeroFactor;
  mat.blendDstAlpha = THREE.OneFactor;
  return mat;
}

export function createHero(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 7);

  const uniforms = {
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uVoice: { value: 0 },
    uPixelRatio: { value: renderer.getPixelRatio() },
    uIntro: { value: 0 },
  };

  // ───────── Voice orb: particles on a noisy sphere ─────────
  const COUNT = window.innerWidth < 800 ? 9000 : 18000;
  const pos = new Float32Array(COUNT * 3);
  const rnd = new Float32Array(COUNT * 4);
  for (let i = 0; i < COUNT; i++) {
    // fibonacci sphere with jitter
    const k = i + 0.5;
    const phi = Math.acos(1 - (2 * k) / COUNT);
    const theta = Math.PI * (1 + Math.sqrt(5)) * k;
    const r = 1 + (Math.random() - 0.5) * 0.08;
    pos[i * 3] = Math.cos(theta) * Math.sin(phi) * r;
    pos[i * 3 + 1] = Math.cos(phi) * r;
    pos[i * 3 + 2] = Math.sin(theta) * Math.sin(phi) * r;
    rnd[i * 4] = Math.random();
    rnd[i * 4 + 1] = Math.random();
    rnd[i * 4 + 2] = Math.random();
    rnd[i * 4 + 3] = Math.random();
  }
  const orbGeo = new THREE.BufferGeometry();
  orbGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  orbGeo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));

  const orbMat = additive(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uProgress, uVoice, uPixelRatio, uIntro;
      attribute vec4 aRnd;
      varying float vAlpha;
      varying float vCyan;
      void main(){
        vec3 p = position;
        float t = uTime * 0.25;
        // organic surface
        float n = snoise(p * 1.6 + vec3(t, t * 0.7, -t));
        // "speaking" rings travelling from the poles
        float ring = sin(p.y * 9.0 - uTime * 3.2) * 0.5 + 0.5;
        float speak = (0.05 + uVoice * 0.25) * ring;
        // scatter: particles drift away as the story starts
        float scatter = smoothstep(0.0, 0.45, uProgress) * (1.0 - smoothstep(0.55, 0.9, uProgress));
        vec3 dir = normalize(p);
        float burst = aRnd.x * aRnd.x * 2.4 * scatter;
        // condense into a bright core at the end
        float condense = smoothstep(0.6, 1.0, uProgress);
        float radius = 1.0 + n * 0.22 + speak + burst;
        radius = mix(radius, 0.18 + aRnd.y * 0.08, condense);
        // intro: gather from a wide cloud
        radius = mix(4.0 + aRnd.z * 6.0, radius, uIntro);
        p = dir * radius;
        p.y += (aRnd.w - 0.5) * burst * 0.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float size = (1.2 + aRnd.w * 2.8) * (1.0 + condense * 0.6);
        gl_PointSize = size * uPixelRatio * (8.0 / -mv.z);
        vAlpha = (0.35 + 0.65 * smoothstep(-0.4, 0.8, n)) * uIntro;
        vCyan = smoothstep(0.55, 0.85, n) * (1.0 - scatter) + condense * step(0.72, aRnd.y);
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vCyan;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(0.86, 0.9, 0.95), vec3(0.22, 0.94, 1.0), vCyan);
        gl_FragColor = vec4(col, a * vAlpha);
      }`,
  }));
  const orb = new THREE.Points(orbGeo, orbMat);
  scene.add(orb);

  // ───────── Light beam from above ─────────
  const beamMat = additive(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uProgress, uIntro;
      varying vec2 vUv;
      void main(){
        float x = abs(vUv.x - 0.5) * 2.0;
        float width = mix(0.55, 0.22, uProgress);
        float core = exp(-pow(x / width, 2.0) * 3.0);
        float flicker = 0.85 + 0.15 * snoise(vec3(vUv.y * 3.0 - uTime * 0.4, x * 2.0, uTime * 0.2));
        float fadeY = smoothstep(0.0, 0.35, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
        float strength = mix(0.18, 0.55, smoothstep(0.1, 0.8, uProgress)) * uIntro;
        gl_FragColor = vec4(vec3(0.85, 0.93, 1.0) * core * flicker * fadeY * strength, 1.0);
      }`,
  }), false);
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 12), beamMat);
  beam.position.set(0, 3, -0.5);
  scene.add(beam);

  // ───────── Core glow sprite ─────────
  const glowMat = additive(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      uniform float uProgress, uVoice, uIntro, uTime;
      varying vec2 vUv;
      void main(){
        float d = length(vUv - 0.5) * 2.0;
        float c = smoothstep(0.55, 1.0, uProgress);
        float g = exp(-d * d * 7.0) * (0.12 + c * 0.9 + uVoice * 0.25) * uIntro;
        g *= 0.92 + 0.08 * sin(uTime * 2.0);
        vec3 col = mix(vec3(0.8, 0.9, 1.0), vec3(0.22, 0.94, 1.0), 0.35 + c * 0.5);
        gl_FragColor = vec4(col * g, 1.0);
      }`,
  }), false);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), glowMat);
  scene.add(glow);

  // ───────── Floating dust / debris ─────────
  const DUST = 700;
  const dpos = new Float32Array(DUST * 3);
  const dseed = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    dpos[i * 3] = (Math.random() - 0.5) * 16;
    dpos[i * 3 + 1] = (Math.random() - 0.5) * 12;
    dpos[i * 3 + 2] = (Math.random() - 0.5) * 10 - 1;
    dseed[i] = Math.random();
  }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dpos, 3));
  dustGeo.setAttribute('aSeed', new THREE.BufferAttribute(dseed, 1));
  const dustMat = additive(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      uniform float uTime, uProgress, uPixelRatio, uIntro;
      attribute float aSeed;
      varying float vA;
      void main(){
        vec3 p = position;
        p.y = mod(p.y + uTime * (0.05 + aSeed * 0.12) + uProgress * 6.0 * (0.4 + aSeed) + 6.0, 12.0) - 6.0;
        p.x += sin(uTime * 0.3 + aSeed * 20.0) * 0.2;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.0 + aSeed * 3.5) * uPixelRatio * (6.0 / -mv.z);
        vA = (0.15 + aSeed * 0.5) * uIntro;
      }`,
    fragmentShader: /* glsl */ `
      varying float vA;
      void main(){ float d = length(gl_PointCoord - 0.5); gl_FragColor = vec4(vec3(0.9,0.95,1.0), smoothstep(0.5,0.0,d) * vA); }`,
  }));
  scene.add(new THREE.Points(dustGeo, dustMat));

  // ───────── State ─────────
  const mouse = { x: 0, y: 0, sx: 0, sy: 0 };
  let progress = 0;
  let smoothProgress = 0;
  let voice = 0;
  let running = true;
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // keep the orb a similar visual size on portrait screens
    camera.fov = w < h ? 58 : 40;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  });

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    uniforms.uTime.value += dt;

    smoothProgress += (progress - smoothProgress) * Math.min(1, dt * 6);
    uniforms.uProgress.value = smoothProgress;
    uniforms.uVoice.value += (voice - uniforms.uVoice.value) * Math.min(1, dt * 8);

    mouse.sx += (mouse.x - mouse.sx) * dt * 2.5;
    mouse.sy += (mouse.y - mouse.sy) * dt * 2.5;

    const p = smoothProgress;
    // camera pulls back and rises as you scroll
    camera.position.x = mouse.sx * 0.35;
    camera.position.y = -mouse.sy * 0.2 + p * 0.6;
    camera.position.z = 6.2 + p * 5.5;
    camera.lookAt(0, 0.4 + p * 0.9, 0);

    orb.position.y = 0.55 + p * 1.8;
    orb.rotation.y += dt * (0.08 + p * 0.3);
    orb.rotation.x = Math.sin(uniforms.uTime.value * 0.2) * 0.15;
    glow.position.copy(orb.position);
    glow.lookAt(camera.position);
    beam.lookAt(camera.position.x, beam.position.y, camera.position.z);

    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);

  return {
    uniforms,
    setProgress(v) { progress = v; },
    setVoice(v) { voice = v; },
    pause() { running = false; },
    resume() { if (!running) { running = true; clock.getDelta(); requestAnimationFrame(tick); } },
  };
}
