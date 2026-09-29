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

export function createHero(canvas, { backdrop } = {}) {
  // Opaque canvas: the backdrop photo is drawn inside WebGL, so additive
  // particles always have real pixels to add onto (a transparent canvas with
  // colour in alpha-0 pixels is dropped by some macOS compositors).
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0b0c0e, 1);
  renderer.autoClear = false;

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

  // ───────── Backdrop photo (cover-fit, scroll zoom, mouse parallax) ─────────
  const bgUniforms = {
    uTex: { value: null },
    uHasTex: { value: 0 },
    uTexAspect: { value: 1.5 },
    uViewAspect: { value: 1 },
    uZoom: { value: 1.25 },
    uOffset: { value: new THREE.Vector2() },
    uIntro: uniforms.uIntro,
    uProgress: uniforms.uProgress,
  };
  const bgScene = new THREE.Scene();
  const bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  bgScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.ShaderMaterial({
    uniforms: bgUniforms,
    depthTest: false,
    depthWrite: false,
    vertexShader: /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uTex;
      uniform float uHasTex, uTexAspect, uViewAspect, uZoom, uIntro, uProgress;
      uniform vec2 uOffset;
      varying vec2 vUv;
      void main(){
        vec2 uv = vUv - 0.5;
        // cover-fit the photo to the viewport
        if (uViewAspect > uTexAspect) uv.y *= uTexAspect / uViewAspect; else uv.x *= uViewAspect / uTexAspect;
        uv = uv / uZoom + 0.5 + uOffset;
        vec3 col = uHasTex > 0.5 ? texture2D(uTex, uv).rgb : vec3(0.05);
        // grade: slightly cool, darker as the story progresses
        col *= mix(0.95, 0.72, uProgress);
        float vig = smoothstep(1.15, 0.35, length((vUv - 0.5) * vec2(uViewAspect, 1.0) * 0.9));
        col *= mix(0.45, 1.0, vig);
        gl_FragColor = vec4(col * uIntro, 1.0);
      }`,
  })));
  if (backdrop) {
    new THREE.TextureLoader().load(backdrop, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.generateMipmaps = false;
      bgUniforms.uTex.value = tex;
      bgUniforms.uTexAspect.value = tex.image.width / tex.image.height;
      bgUniforms.uHasTex.value = 1;
    });
  }

  // ───────── Particle system with three morph targets ─────────
  // position = sphere, aNebula = scattered cloud (intro), aWord = brand wordmark.
  const COUNT = window.innerWidth < 800 ? 10000 : 20000;
  const pos = new Float32Array(COUNT * 3);
  const nebula = new Float32Array(COUNT * 3);
  const word = new Float32Array(COUNT * 3);
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
    // wide flattened nebula
    const a = Math.random() * Math.PI * 2;
    const d = Math.pow(Math.random(), 0.6) * 7;
    nebula[i * 3] = Math.cos(a) * d;
    nebula[i * 3 + 1] = (Math.random() - 0.5) * 3 + 1.5;
    nebula[i * 3 + 2] = Math.sin(a) * d * 0.6 - 2;
    for (let j = 0; j < 4; j++) rnd[i * 4 + j] = Math.random();
  }

  // Sample the wordmark from a 2D canvas into particle targets.
  function sampleWord(text) {
    const c = document.createElement('canvas');
    c.width = 1400;
    c.height = 260;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "500 210px 'Inter Tight', 'Helvetica Neue', Arial, sans-serif";
    ctx.fillText(text, c.width / 2, c.height / 2);
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    const pts = [];
    for (let y = 0; y < c.height; y += 2) {
      for (let x = 0; x < c.width; x += 2) {
        if (data[(y * c.width + x) * 4 + 3] > 128) pts.push(x, y);
      }
    }
    const n = pts.length / 2;
    const scale = 5.6 / c.width;
    for (let i = 0; i < COUNT; i++) {
      const j = Math.floor(Math.random() * n) * 2;
      word[i * 3] = (pts[j] - c.width / 2) * scale + (Math.random() - 0.5) * 0.012;
      word[i * 3 + 1] = -(pts[j + 1] - c.height / 2) * scale + (Math.random() - 0.5) * 0.012;
      word[i * 3 + 2] = (Math.random() - 0.5) * 0.12;
    }
  }
  sampleWord('HOBBYTAN');

  const orbGeo = new THREE.BufferGeometry();
  orbGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  orbGeo.setAttribute('aNebula', new THREE.BufferAttribute(nebula, 3));
  const wordAttr = new THREE.BufferAttribute(word, 3);
  orbGeo.setAttribute('aWord', wordAttr);
  orbGeo.setAttribute('aRnd', new THREE.BufferAttribute(rnd, 4));
  // Re-sample once the web font is ready so the wordmark uses the real face.
  document.fonts?.ready.then(() => { sampleWord('HOBBYTAN'); wordAttr.needsUpdate = true; });

  const orbMat = additive(new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    vertexShader: /* glsl */ `
      ${NOISE}
      uniform float uTime, uProgress, uVoice, uPixelRatio, uIntro;
      attribute vec3 aNebula;
      attribute vec3 aWord;
      attribute vec4 aRnd;
      varying float vAlpha;
      varying float vCyan;
      float stagger(float m, float r){ return clamp(m * 1.5 - r * 0.5, 0.0, 1.0); }
      void main(){
        float t = uTime * 0.25;
        // sphere with organic surface + "speaking" rings
        vec3 dir = normalize(position);
        float n = snoise(position * 1.6 + vec3(t, t * 0.7, -t));
        float ring = sin(position.y * 9.0 - uTime * 3.2) * 0.5 + 0.5;
        vec3 sphere = dir * (1.0 + n * 0.2 + (0.04 + uVoice * 0.22) * ring);

        // wordmark, gently breathing
        vec3 wordP = aWord + vec3(0.0, 0.0, snoise(aWord * 2.0 + t) * 0.06);

        // morph weights along the scroll story
        float toWord = stagger(smoothstep(0.2, 0.42, uProgress), aRnd.x);
        float leaveWord = stagger(smoothstep(0.58, 0.74, uProgress), aRnd.y);
        float condense = smoothstep(0.72, 0.96, uProgress);
        float intro = stagger(uIntro, aRnd.z);

        vec3 p = mix(aNebula, sphere, intro);
        p = mix(p, wordP, toWord);
        // swirl while in transit (peaks halfway through each morph)
        float transit = 4.0 * toWord * (1.0 - toWord) + 4.0 * leaveWord * (1.0 - leaveWord);
        p += vec3(snoise(p + t), snoise(p.yzx - t), snoise(p.zxy + 3.0)) * transit * 0.9;
        vec3 core = normalize(position) * (0.16 + aRnd.y * 0.1);
        p = mix(p, core, max(leaveWord * 0.35, condense));

        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float wordShown = toWord * (1.0 - leaveWord);
        float size = (1.1 + aRnd.w * 2.6) * mix(1.0, 0.8, wordShown) * (1.0 + condense * 0.6);
        gl_PointSize = size * uPixelRatio * (8.0 / -mv.z);
        vAlpha = mix(0.35 + 0.65 * smoothstep(-0.4, 0.8, n), 0.9, wordShown) * (0.25 + 0.75 * intro);
        vCyan = mix(smoothstep(0.55, 0.85, n), step(0.9, aRnd.w), wordShown) + transit * 0.4 + condense * step(0.7, aRnd.y);
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying float vCyan;
      void main(){
        float d = length(gl_PointCoord - 0.5);
        float a = smoothstep(0.5, 0.0, d);
        vec3 col = mix(vec3(0.86, 0.9, 0.95), vec3(0.22, 0.94, 1.0), clamp(vCyan, 0.0, 1.0));
        gl_FragColor = vec4(col, a * vAlpha);
      }`,
  }));
  const orb = new THREE.Points(orbGeo, orbMat);
  scene.add(orb);

  // ───────── Floating rock shards lit by the beam ─────────
  const SHARDS = window.innerWidth < 800 ? 40 : 90;
  const shardGeo = new THREE.IcosahedronGeometry(1, 0);
  const shardMat = new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 0.85, metalness: 0.1, flatShading: true });
  const shards = new THREE.InstancedMesh(shardGeo, shardMat, SHARDS);
  const shardData = Array.from({ length: SHARDS }, () => {
    const a = Math.random() * Math.PI * 2;
    const r = 0.8 + Math.pow(Math.random(), 0.7) * 5.5;
    return {
      x: Math.cos(a) * r,
      y: (Math.random() - 0.5) * 6,
      z: Math.sin(a) * r * 0.7 - 1,
      s: 0.02 + Math.pow(Math.random(), 3) * 0.14,
      rx: Math.random() * 6, ry: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.6,
      lift: 0.5 + Math.random() * 1.5,
    };
  });
  const shardDummy = new THREE.Object3D();
  scene.add(shards);
  scene.add(new THREE.AmbientLight(0x8fa3b8, 0.35));
  const beamLight = new THREE.PointLight(0xdff6ff, 18, 12, 1.6);
  beamLight.position.set(0, 2.5, 1.5);
  scene.add(beamLight);
  const rimLight = new THREE.DirectionalLight(0x39f0ff, 0.5);
  rimLight.position.set(-3, 1, -2);
  scene.add(rimLight);

  function updateShards(time, p) {
    for (let i = 0; i < SHARDS; i++) {
      const d = shardData[i];
      const y = ((d.y + time * 0.04 * d.lift + p * 5 * d.lift + 3) % 6 + 6) % 6 - 3;
      shardDummy.position.set(d.x, y + 0.6, d.z);
      shardDummy.rotation.set(d.rx + time * d.vr, d.ry + time * d.vr * 0.7, 0);
      shardDummy.scale.setScalar(d.s * uniforms.uIntro.value);
      shardDummy.updateMatrix();
      shards.setMatrixAt(i, shardDummy.matrix);
    }
    shards.instanceMatrix.needsUpdate = true;
  }

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
  let spin = 0;
  let running = true;
  const clock = new THREE.Clock();

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    bgUniforms.uViewAspect.value = w / h;
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

    // the wordmark faces the camera; otherwise the cloud slowly turns
    const wordHold = THREE.MathUtils.smoothstep(p, 0.18, 0.34) * (1 - THREE.MathUtils.smoothstep(p, 0.6, 0.72));
    spin += dt * (0.1 + p * 0.3) * (1 - wordHold);
    const targetY = wordHold > 0 ? Math.round(spin / (Math.PI * 2)) * Math.PI * 2 : spin;
    orb.rotation.y = THREE.MathUtils.lerp(spin, targetY, wordHold);
    orb.rotation.x = Math.sin(uniforms.uTime.value * 0.2) * 0.15 * (1 - wordHold);
    orb.position.y = 0.55 + p * 1.8 - wordHold * 0.25;
    orb.scale.setScalar(window.innerWidth < 800 ? 0.62 : 1);
    updateShards(uniforms.uTime.value, p);
    beamLight.intensity = (12 + p * 20) * uniforms.uIntro.value;
    glow.position.copy(orb.position);
    glow.lookAt(camera.position);
    beam.lookAt(camera.position.x, beam.position.y, camera.position.z);

    // backdrop slowly settles from a close-up to the wide view, with parallax
    bgUniforms.uZoom.value = 1.22 - 0.1 * uniforms.uIntro.value - p * 0.08;
    bgUniforms.uOffset.value.set(mouse.sx * 0.012, -mouse.sy * 0.008 + p * 0.04);

    renderer.clear();
    renderer.render(bgScene, bgCamera);
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
