import * as THREE from 'three';

export interface ProceduralTextureSet {
  organicBump: THREE.CanvasTexture;
  muscleAlbedo: THREE.CanvasTexture;
  muscleBump: THREE.CanvasTexture;
  muscleRoughness: THREE.CanvasTexture;
  boneAlbedo: THREE.CanvasTexture;
  boneBump: THREE.CanvasTexture;
  tendonAlbedo: THREE.CanvasTexture;
  tendonBump: THREE.CanvasTexture;
  vesselAlbedo: THREE.CanvasTexture;
  vesselBump: THREE.CanvasTexture;
  irisAlbedo: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  stageReticle: THREE.CanvasTexture;
  dispose: () => void;
}

function makeTex(
  canvas: HTMLCanvasElement,
  isColor: boolean,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  if (isColor) {
    tex.colorSpace = THREE.SRGBColorSpace;
  }
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = anisotropy;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextureSet {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Organic visceral parenchymal micro-bump (linear space)
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = 512;
  bumpCanvas.height = 512;
  const bCtx = bumpCanvas.getContext('2d');
  if (bCtx) {
    bCtx.fillStyle = '#808080';
    bCtx.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 1200; i++) {
      const x = (i * 137) % 512;
      const y = (i * 251) % 512;
      const r = 3 + (i % 12);
      const shade = 114 + ((i * 29) % 34);
      const grad = bCtx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, `rgb(${shade},${shade},${shade})`);
      grad.addColorStop(1, 'rgba(128,128,128,0)');
      bCtx.fillStyle = grad;
      bCtx.beginPath();
      bCtx.arc(x, y, r, 0, Math.PI * 2);
      bCtx.fill();
    }
    // Delicate sub-serosal capillary tracery
    bCtx.strokeStyle = 'rgba(155,155,155,0.22)';
    bCtx.lineWidth = 1.2;
    for (let v = 0; v < 48; v++) {
      let cx = (v * 97) % 512;
      let cy = (v * 173) % 512;
      bCtx.beginPath();
      bCtx.moveTo(cx, cy);
      for (let s = 0; s < 5; s++) {
        cx += Math.sin(v * 1.7 + s) * 26;
        cy += Math.cos(v * 1.1 + s) * 26;
        bCtx.lineTo(cx, cy);
      }
      bCtx.stroke();
    }
  }
  const organicBump = makeTex(bumpCanvas, false, aniso, 2.5, 2.5);

  // 2. Striated Skeletal Muscle Albedo + Bump + Roughness (longitudinal myofibril bundles & perimysium)
  const mColCanvas = document.createElement('canvas');
  mColCanvas.width = 512;
  mColCanvas.height = 512;
  const mBumpCanvas = document.createElement('canvas');
  mBumpCanvas.width = 512;
  mBumpCanvas.height = 512;
  const mRoughCanvas = document.createElement('canvas');
  mRoughCanvas.width = 512;
  mRoughCanvas.height = 512;

  const mc = mColCanvas.getContext('2d');
  const mb = mBumpCanvas.getContext('2d');
  const mr = mRoughCanvas.getContext('2d');
  if (mc && mb && mr) {
    mc.fillStyle = '#8b2b30';
    mc.fillRect(0, 0, 512, 512);
    mb.fillStyle = '#7e7e7e';
    mb.fillRect(0, 0, 512, 512);
    mr.fillStyle = '#787878';
    mr.fillRect(0, 0, 512, 512);

    // Muscle fascicle bundles running along V (tube length axis)
    for (let i = 0; i < 260; i++) {
      const x = (i * 2.0 + ((i * 19) % 5)) % 512;
      const w = 1.5 + (i % 4) * 0.9;
      const isSeptum = i % 14 === 0;

      if (isSeptum) {
        // Pale glistening perimysium fascia streak
        mc.fillStyle = 'rgba(222, 184, 178, 0.34)';
        mb.fillStyle = 'rgba(105, 105, 105, 0.65)';
        mr.fillStyle = 'rgba(72, 72, 72, 0.7)';
      } else {
        const tone = i % 3 === 0 ? 'rgba(106, 24, 29, 0.42)' : i % 3 === 1 ? 'rgba(156, 54, 58, 0.36)' : 'rgba(128, 36, 40, 0.35)';
        mc.fillStyle = tone;
        const bVal = 128 + (i % 7) * 8;
        mb.fillStyle = `rgba(${bVal},${bVal},${bVal},0.45)`;
        const rVal = 112 + (i % 5) * 10;
        mr.fillStyle = `rgba(${rVal},${rVal},${rVal},0.4)`;
      }
      mc.fillRect(x, 0, w, 512);
      mb.fillRect(x, 0, w, 512);
      mr.fillRect(x, 0, w, 512);
    }

    // Subtle sarcomere micro-cross striations
    mc.fillStyle = 'rgba(65, 16, 18, 0.08)';
    mb.fillStyle = 'rgba(108, 108, 108, 0.14)';
    for (let y = 0; y < 512; y += 6) {
      mc.fillRect(0, y, 512, 1.5);
      mb.fillRect(0, y, 512, 1.5);
    }
  }
  const muscleAlbedo = makeTex(mColCanvas, true, aniso, 2, 2);
  const muscleBump = makeTex(mBumpCanvas, false, aniso, 2, 2);
  const muscleRoughness = makeTex(mRoughCanvas, false, aniso, 2, 2);

  // 3. Cortical Bone Albedo + Periosteum Bump (natural ivory hydroxyapatite grain)
  const boneColCanvas = document.createElement('canvas');
  boneColCanvas.width = 512;
  boneColCanvas.height = 512;
  const boneBumpCanvas = document.createElement('canvas');
  boneBumpCanvas.width = 512;
  boneBumpCanvas.height = 512;
  const bc = boneColCanvas.getContext('2d');
  const bb = boneBumpCanvas.getContext('2d');
  if (bc && bb) {
    bc.fillStyle = '#e5dccb';
    bc.fillRect(0, 0, 512, 512);
    bb.fillStyle = '#808080';
    bb.fillRect(0, 0, 512, 512);

    // Subtle mottled mineral density patches
    for (let i = 0; i < 380; i++) {
      const x = (i * 89) % 512;
      const y = (i * 157) % 512;
      const rad = 14 + (i % 28);
      const grad = bc.createRadialGradient(x, y, 2, x, y, rad);
      grad.addColorStop(0, i % 2 === 0 ? 'rgba(212, 198, 175, 0.22)' : 'rgba(244, 238, 224, 0.2)');
      grad.addColorStop(1, 'rgba(229, 220, 203, 0)');
      bc.fillStyle = grad;
      bc.beginPath();
      bc.arc(x, y, rad, 0, Math.PI * 2);
      bc.fill();
    }

    // Longitudinal Haversian canal striations & nutrient pores
    for (let i = 0; i < 420; i++) {
      const x = (i * 43) % 512;
      const y = (i * 113) % 512;
      const len = 18 + (i % 44);
      bc.strokeStyle = i % 3 === 0 ? 'rgba(182, 166, 142, 0.22)' : 'rgba(248, 244, 236, 0.25)';
      bc.lineWidth = 1;
      bc.beginPath();
      bc.moveTo(x, y);
      bc.lineTo(x + (i % 3) - 1, y + len);
      bc.stroke();

      bb.strokeStyle = i % 2 === 0 ? 'rgba(112,112,112,0.35)' : 'rgba(146,146,146,0.35)';
      bb.lineWidth = 1;
      bb.beginPath();
      bb.moveTo(x, y);
      bb.lineTo(x + (i % 3) - 1, y + len);
      bb.stroke();
    }
  }
  const boneAlbedo = makeTex(boneColCanvas, true, aniso, 2, 2);
  const boneBump = makeTex(boneBumpCanvas, false, aniso, 2, 2);

  // 4. Fibrous Collagen Tendon & Ligament Albedo + Bump (pearlescent aligned collagen fibers)
  const tenColCanvas = document.createElement('canvas');
  tenColCanvas.width = 256;
  tenColCanvas.height = 256;
  const tenBumpCanvas = document.createElement('canvas');
  tenBumpCanvas.width = 256;
  tenBumpCanvas.height = 256;
  const tc = tenColCanvas.getContext('2d');
  const tb = tenBumpCanvas.getContext('2d');
  if (tc && tb) {
    tc.fillStyle = '#e4dfd4';
    tc.fillRect(0, 0, 256, 256);
    tb.fillStyle = '#808080';
    tb.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 220; i++) {
      const x = (i * 7) % 256;
      tc.fillStyle = i % 2 === 0 ? 'rgba(255,252,246,0.42)' : 'rgba(202,194,178,0.34)';
      tc.fillRect(x, 0, 1.5, 256);
      const b = i % 2 === 0 ? 152 : 108;
      tb.fillStyle = `rgba(${b},${b},${b},0.48)`;
      tb.fillRect(x, 0, 1.5, 256);
    }
  }
  const tendonAlbedo = makeTex(tenColCanvas, true, aniso, 2, 2);
  const tendonBump = makeTex(tenBumpCanvas, false, aniso, 2, 2);

  // 4b. Vascular Tunica Adventitia & Vasa Vasorum Albedo + Bump
  // Neutral pale-white base so multiplying by material color preserves exact venous plum-blue & arterial crimson hues
  const vColCanvas = document.createElement('canvas');
  vColCanvas.width = 256;
  vColCanvas.height = 256;
  const vBumpCanvas = document.createElement('canvas');
  vBumpCanvas.width = 256;
  vBumpCanvas.height = 256;
  const vc = vColCanvas.getContext('2d');
  const vb = vBumpCanvas.getContext('2d');
  if (vc && vb) {
    vc.fillStyle = '#edf1f5';
    vc.fillRect(0, 0, 256, 256);
    vb.fillStyle = '#808080';
    vb.fillRect(0, 0, 256, 256);

    // Subtle circumferential smooth-muscle tunica media bands
    for (let y = 0; y < 256; y += 5) {
      const shade = y % 10 === 0 ? 'rgba(205,212,224,0.22)' : 'rgba(255,255,255,0.16)';
      vc.fillStyle = shade;
      vc.fillRect(0, y, 256, 2.2);
      const bVal = y % 10 === 0 ? 116 : 140;
      vb.fillStyle = `rgba(${bVal},${bVal},${bVal},0.28)`;
      vb.fillRect(0, y, 256, 2.2);
    }

    // Longitudinal adventitial collagen streaks along vessel length (V axis)
    for (let i = 0; i < 110; i++) {
      const x = (i * 17) % 256;
      vc.fillStyle = i % 2 === 0 ? 'rgba(182,190,206,0.2)' : 'rgba(255,255,255,0.18)';
      vc.fillRect(x, 0, 1.4, 256);
      const b = i % 2 === 0 ? 112 : 144;
      vb.fillStyle = `rgba(${b},${b},${b},0.3)`;
      vb.fillRect(x, 0, 1.2, 256);
    }

    // Fine branching vasa vasorum capillary tracery on vessel wall
    for (let v = 0; v < 34; v++) {
      let vx = (v * 53) % 256;
      let vy = (v * 89) % 256;
      vc.strokeStyle = v % 3 === 0 ? 'rgba(142,154,178,0.34)' : 'rgba(165,172,192,0.26)';
      vc.lineWidth = 0.8 + (v % 2) * 0.4;
      vb.strokeStyle = 'rgba(156,156,156,0.38)';
      vb.lineWidth = 0.9;
      vc.beginPath();
      vb.beginPath();
      vc.moveTo(vx, vy);
      vb.moveTo(vx, vy);
      for (let s = 0; s < 5; s++) {
        vx += Math.sin(v * 2.1 + s * 1.4) * 14;
        vy += 12 + Math.cos(v * 1.3 + s) * 6;
        vc.lineTo(vx, vy);
        vb.lineTo(vx, vy);
      }
      vc.stroke();
      vb.stroke();
    }
  }
  const vesselAlbedo = makeTex(vColCanvas, true, aniso, 1.5, 2.5);
  const vesselBump = makeTex(vBumpCanvas, false, aniso, 1.5, 2.5);

  // 5. Realistic Radial Iris Stroma Map (for human & animal eyes)
  const irisCanvas = document.createElement('canvas');
  irisCanvas.width = 256;
  irisCanvas.height = 256;
  const ic = irisCanvas.getContext('2d');
  if (ic) {
    const cx = 128;
    const cy = 128;
    const baseGrad = ic.createRadialGradient(cx, cy, 18, cx, cy, 126);
    baseGrad.addColorStop(0, '#5a4326');
    baseGrad.addColorStop(0.32, '#8fa6a8');
    baseGrad.addColorStop(0.84, '#4c6d78');
    baseGrad.addColorStop(1, '#1d2b32');
    ic.fillStyle = baseGrad;
    ic.fillRect(0, 0, 256, 256);

    for (let i = 0; i < 240; i++) {
      const ang = (i / 240) * Math.PI * 2;
      const rIn = 22 + (i % 7) * 2;
      const rOut = 114 + (i % 5) * 2;
      ic.strokeStyle =
        i % 3 === 0
          ? 'rgba(235, 240, 232, 0.28)'
          : i % 3 === 1
            ? 'rgba(34, 52, 62, 0.34)'
            : 'rgba(182, 152, 102, 0.24)';
      ic.lineWidth = 1.2;
      ic.beginPath();
      ic.moveTo(cx + Math.cos(ang) * rIn, cy + Math.sin(ang) * rIn);
      ic.lineTo(
        cx + Math.cos(ang + Math.sin(i) * 0.04) * rOut,
        cy + Math.sin(ang + Math.sin(i) * 0.04) * rOut
      );
      ic.stroke();
    }
  }
  const irisAlbedo = makeTex(irisCanvas, true, aniso, 1, 1);

  // 6. Soft radial contact shadow (calibrated for studio cyclorama floor)
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const sCtx = shadowCanvas.getContext('2d');
  if (sCtx) {
    const grad = sCtx.createRadialGradient(128, 128, 12, 128, 128, 124);
    grad.addColorStop(0, 'rgba(15, 20, 28, 0.34)');
    grad.addColorStop(0.5, 'rgba(15, 20, 28, 0.13)');
    grad.addColorStop(1, 'rgba(15, 20, 28, 0)');
    sCtx.fillStyle = grad;
    sCtx.fillRect(0, 0, 256, 256);
  }
  const contactShadow = new THREE.CanvasTexture(shadowCanvas);
  contactShadow.colorSpace = THREE.SRGBColorSpace;

  // 7. Calibration stage reticle disc (refined medical museum floor plate)
  const reticleCanvas = document.createElement('canvas');
  reticleCanvas.width = 512;
  reticleCanvas.height = 512;
  const rCtx = reticleCanvas.getContext('2d');
  if (rCtx) {
    rCtx.clearRect(0, 0, 512, 512);
    const cx = 256;
    const cy = 256;

    const bgGrad = rCtx.createRadialGradient(cx, cy, 10, cx, cy, 245);
    bgGrad.addColorStop(0, 'rgba(185, 28, 28, 0.035)');
    bgGrad.addColorStop(0.65, 'rgba(15, 23, 42, 0.025)');
    bgGrad.addColorStop(1, 'rgba(236, 239, 243, 0)');
    rCtx.fillStyle = bgGrad;
    rCtx.beginPath();
    rCtx.arc(cx, cy, 245, 0, Math.PI * 2);
    rCtx.fill();

    [76, 152, 224, 244].forEach((radius, idx) => {
      rCtx.strokeStyle =
        idx === 3 ? 'rgba(185, 28, 28, 0.22)' : 'rgba(15, 23, 42, 0.1)';
      rCtx.lineWidth = idx === 3 ? 1.5 : 1;
      rCtx.beginPath();
      rCtx.arc(cx, cy, radius, 0, Math.PI * 2);
      rCtx.stroke();
    });

    rCtx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
    rCtx.lineWidth = 1;
    rCtx.beginPath();
    rCtx.moveTo(cx - 244, cy);
    rCtx.lineTo(cx + 244, cy);
    rCtx.moveTo(cx, cy - 244);
    rCtx.lineTo(cx, cy + 244);
    rCtx.stroke();

    for (let deg = 0; deg < 360; deg += 15) {
      const rad = (deg * Math.PI) / 180;
      const inner = deg % 45 === 0 ? 228 : 236;
      const outer = 244;
      rCtx.strokeStyle =
        deg % 45 === 0 ? 'rgba(185, 28, 28, 0.28)' : 'rgba(15, 23, 42, 0.12)';
      rCtx.beginPath();
      rCtx.moveTo(cx + Math.cos(rad) * inner, cy + Math.sin(rad) * inner);
      rCtx.lineTo(cx + Math.cos(rad) * outer, cy + Math.sin(rad) * outer);
      rCtx.stroke();
    }
  }
  const stageReticle = new THREE.CanvasTexture(reticleCanvas);
  stageReticle.colorSpace = THREE.SRGBColorSpace;
  stageReticle.anisotropy = aniso;

  return {
    organicBump,
    muscleAlbedo,
    muscleBump,
    muscleRoughness,
    boneAlbedo,
    boneBump,
    tendonAlbedo,
    tendonBump,
    vesselAlbedo,
    vesselBump,
    irisAlbedo,
    contactShadow,
    stageReticle,
    dispose: () => {
      organicBump.dispose();
      muscleAlbedo.dispose();
      muscleBump.dispose();
      muscleRoughness.dispose();
      boneAlbedo.dispose();
      boneBump.dispose();
      tendonAlbedo.dispose();
      tendonBump.dispose();
      vesselAlbedo.dispose();
      vesselBump.dispose();
      irisAlbedo.dispose();
      contactShadow.dispose();
      stageReticle.dispose();
    },
  };
}
