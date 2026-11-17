import * as THREE from 'three';
import {
  addFlowStream,
  addMesh,
  addMuscleBelly,
  AnimationTargets,
  buildEyePair,
  createFusiformGeometry,
  createVesselBranchGeo,
  makeMaterial,
  makeTube,
  mergeVesselGeometries,
  spawnFineVesselTree,
} from '../modelUtils';
import { ProceduralTextureSet } from '../proceduralTextures';

interface HumanProport {
  isFemale: boolean;
  shoulderX: number;
  elbowX: number;
  wristX: number;
  wristY: number;
  hipX: number;
  kneeX: number;
  ankleX: number;
  ankleY: number;
  skullY: number;
  skullScale: number;
  ribWidth: number;
  ribScaleZ: number;
  pelvisFlare: number;
  boneScale: number;
  muscleBulk: number;
}

function getHumanProport(isFemale: boolean): HumanProport {
  return isFemale
    ? {
        isFemale: true,
        shoulderX: 0.46,
        elbowX: 0.67,
        wristX: 0.79,
        wristY: -0.31,
        hipX: 0.25,
        kneeX: 0.27,
        ankleX: 0.28,
        ankleY: -2.2,
        skullY: 1.72,
        skullScale: 0.97,
        ribWidth: 0.25,
        ribScaleZ: 0.88,
        pelvisFlare: 1.15,
        boneScale: 0.95,
        muscleBulk: 0.88,
      }
    : {
        isFemale: false,
        shoulderX: 0.54,
        elbowX: 0.76,
        wristX: 0.88,
        wristY: -0.32,
        hipX: 0.22,
        kneeX: 0.29,
        ankleX: 0.3,
        ankleY: -2.22,
        skullY: 1.76,
        skullScale: 1.0,
        ribWidth: 0.29,
        ribScaleZ: 0.96,
        pelvisFlare: 0.96,
        boneScale: 1.02,
        muscleBulk: 1.04,
      };
}

function addBoneShaft(
  group: THREE.Group,
  points: THREE.Vector3[],
  shaftR: number,
  proxR: number,
  distR: number,
  mat: THREE.Material,
  partId: string,
  collector: THREE.Mesh[],
  tubularSegs = 20,
  radialSegs = 14,
  squash: [number, number] = [1, 1]
) {
  const geo = createFusiformGeometry(
    points,
    (t) => {
      if (t < 0.16) {
        const u = t / 0.16;
        return THREE.MathUtils.lerp(proxR, shaftR, Math.sin(u * Math.PI * 0.5));
      }
      if (t > 0.84) {
        const u = (1 - t) / 0.16;
        return THREE.MathUtils.lerp(distR, shaftR, Math.sin(u * Math.PI * 0.5));
      }
      const midFlare = 1 + 0.04 * Math.sin(((t - 0.16) / 0.68) * Math.PI);
      return shaftR * midFlare;
    },
    tubularSegs,
    radialSegs,
    squash
  );
  return addMesh(group, geo.geometry, mat, partId, 'skeleton', collector, 2);
}

function addLigamentBand(
  group: THREE.Group,
  points: THREE.Vector3[],
  radius: number,
  mat: THREE.Material,
  partId: string,
  layer: 'skeleton' | 'muscles',
  collector: THREE.Mesh[],
  squash: [number, number] = [1.4, 0.55]
) {
  const geo = createFusiformGeometry(
    points,
    (t) => radius * (0.85 + 0.25 * Math.sin(t * Math.PI)),
    10,
    8,
    squash
  );
  return addMesh(group, geo.geometry, mat, partId, layer, collector, layer === 'skeleton' ? 3 : 6);
}

// ======================================================
// DETAILED HUMAN OUTER SKIN SHELL (WITH INDIVIDUAL FINGERS & TOES)
// ======================================================
function buildHumanSkin(
  p: HumanProport,
  group: THREE.Group,
  partId: string,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[]
) {
  const shellMat = makeMaterial(
    {
      color: p.isFemale ? 0xebd2c4 : 0xe6cbbd,
      layer: 'outer',
      tissue: 'skin',
      opacity: 0.13,
      focusOpacity: 0.42,
      roughness: 0.3,
      clearcoat: 0.38,
    },
    textures,
    scientific
  );

  const torsoProfile = p.isFemale
    ? [
        new THREE.Vector2(0.0, -0.96),
        new THREE.Vector2(0.47, -0.84),
        new THREE.Vector2(0.51, -0.54),
        new THREE.Vector2(0.34, -0.08),
        new THREE.Vector2(0.42, 0.36),
        new THREE.Vector2(0.47, 0.74),
        new THREE.Vector2(0.38, 0.94),
        new THREE.Vector2(0.145, 1.06),
        new THREE.Vector2(0.135, 1.23),
        new THREE.Vector2(0.0, 1.25),
      ]
    : [
        new THREE.Vector2(0.0, -0.96),
        new THREE.Vector2(0.43, -0.9),
        new THREE.Vector2(0.49, -0.58),
        new THREE.Vector2(0.39, -0.15),
        new THREE.Vector2(0.47, 0.35),
        new THREE.Vector2(0.57, 0.78),
        new THREE.Vector2(0.44, 0.96),
        new THREE.Vector2(0.17, 1.07),
        new THREE.Vector2(0.15, 1.25),
        new THREE.Vector2(0.0, 1.27),
      ];
  const torsoGeo = new THREE.LatheGeometry(torsoProfile, 36);
  torsoGeo.scale(p.isFemale ? 1.04 : 1.08, 1.0, 0.62);
  addMesh(group, torsoGeo, shellMat, partId, 'outer', collector, 8);

  if (p.isFemale) {
    for (const side of [-1, 1]) {
      const contour = addMesh(group, new THREE.SphereGeometry(0.175, 20, 16), shellMat, partId, 'outer', collector, 8);
      contour.scale.set(0.95, 0.88, 0.85);
      contour.position.set(side * 0.185, 0.57, 0.25);
    }
  }

  // Sculpted head & jaw contour
  const headGeo = new THREE.SphereGeometry(0.355 * p.skullScale, 28, 22);
  headGeo.scale(0.89, 1.13, 0.99);
  const head = addMesh(group, headGeo, shellMat, partId, 'outer', collector, 8);
  head.position.set(0, p.skullY - 0.1, 0.02);

  for (const side of [-1, 1]) {
    // Tapered arm
    const arm = createFusiformGeometry(
      [
        new THREE.Vector3(side * (p.shoulderX + 0.02), 0.82, 0),
        new THREE.Vector3(side * p.elbowX, 0.24, -0.02),
        new THREE.Vector3(side * p.wristX, p.wristY, 0.08),
      ],
      (t) => (p.isFemale ? 0.112 : 0.128) * (1 - 0.34 * t),
      20,
      16
    );
    addMesh(group, arm.geometry, shellMat, partId, 'outer', collector, 8);

    // Palm & 5 individual fingers in skin silhouette
    const palm = addMesh(group, new THREE.SphereGeometry(0.072 * p.boneScale, 12, 10), shellMat, partId, 'outer', collector, 8);
    palm.scale.set(0.68, 1.25, 0.95);
    palm.position.set(side * (p.wristX + 0.01), p.wristY - 0.08, 0.085);

    const fingerOffsets = [
      { dz: 0.052, dx: -side * 0.022, len: 0.078, angZ: side * -0.34 }, // thumb
      { dz: 0.032, dx: 0, len: 0.105, angZ: side * 0.04 },
      { dz: 0.008, dx: 0, len: 0.118, angZ: 0 },
      { dz: -0.016, dx: 0, len: 0.108, angZ: side * -0.03 },
      { dz: -0.038, dx: 0, len: 0.086, angZ: side * -0.07 },
    ];
    fingerOffsets.forEach((f, idx) => {
      const fStart = new THREE.Vector3(side * (p.wristX + 0.01) + f.dx, p.wristY - (idx === 0 ? 0.08 : 0.13), 0.085 + f.dz);
      const fEnd = new THREE.Vector3(fStart.x + Math.sin(f.angZ) * f.len, fStart.y - Math.cos(f.angZ) * f.len, fStart.z + (idx === 0 ? 0.025 : 0));
      const fGeo = createFusiformGeometry([fStart, fStart.clone().lerp(fEnd, 0.5), fEnd], (t) => (idx === 0 ? 0.02 : 0.017) * (1 - 0.28 * t), 8, 8);
      addMesh(group, fGeo.geometry, shellMat, partId, 'outer', collector, 8);
    });

    // Tapered leg
    const leg = createFusiformGeometry(
      [
        new THREE.Vector3(side * (p.hipX + 0.04), -0.8, 0),
        new THREE.Vector3(side * p.kneeX, -1.5, 0.04),
        new THREE.Vector3(side * p.ankleX, p.ankleY, -0.02),
      ],
      (t) => (p.isFemale ? 0.172 : 0.18) * (1 - 0.42 * t),
      20,
      16
    );
    addMesh(group, leg.geometry, shellMat, partId, 'outer', collector, 8);

    // Sculpted foot & 5 individual toes
    const footBody = createFusiformGeometry(
      [
        new THREE.Vector3(side * p.ankleX, p.ankleY - 0.07, -0.05),
        new THREE.Vector3(side * p.ankleX, p.ankleY - 0.09, 0.07),
        new THREE.Vector3(side * p.ankleX, p.ankleY - 0.1, 0.16),
      ],
      (t) => 0.08 * (0.9 + 0.2 * Math.sin(t * Math.PI)),
      10,
      12,
      [1.05, 0.65]
    );
    addMesh(group, footBody.geometry, shellMat, partId, 'outer', collector, 8);

    for (let toe = 0; toe < 5; toe++) {
      const toeX = side * (p.ankleX + (toe - 2) * -0.024);
      const toeLen = toe === 0 ? 0.072 : 0.065 - toe * 0.008;
      const toeR = toe === 0 ? 0.023 : 0.016;
      const tStart = new THREE.Vector3(toeX, p.ankleY - 0.11, 0.155);
      const tEnd = new THREE.Vector3(toeX, p.ankleY - 0.115, 0.155 + toeLen);
      const tGeo = createFusiformGeometry([tStart, tEnd], (t) => toeR * (1 - 0.25 * t), 6, 8);
      addMesh(group, tGeo.geometry, shellMat, partId, 'outer', collector, 8);
    }
  }
}

// ======================================================
// HIGH-DETAIL HUMAN SKELETON: CRANIUM, SPINE, RIBS, JOINTS, LIGAMENTS, 5 FINGERS & 5 TOES
// ======================================================
function buildHumanSkeleton(
  p: HumanProport,
  group: THREE.Group,
  partId: string,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[],
  anim: AnimationTargets
) {
  const boneMat = makeMaterial(
    { color: 0xe6dcc8, layer: 'skeleton', tissue: 'bone', opacity: 0.98, roughness: 0.5, clearcoat: 0.14 },
    textures,
    scientific
  );
  const cartMat = makeMaterial(
    { color: 0xc5d6e2, layer: 'skeleton', tissue: 'cartilage', opacity: 0.9, roughness: 0.22, clearcoat: 0.65 },
    textures,
    scientific
  );
  const ligMat = makeMaterial(
    { color: 0xe0dad0, layer: 'skeleton', tissue: 'ligament', opacity: 0.95, roughness: 0.34, clearcoat: 0.42 },
    textures,
    scientific
  );
  const toothMat = makeMaterial(
    { color: 0xf4f0e6, layer: 'skeleton', tissue: 'cartilage', opacity: 1.0, roughness: 0.15, clearcoat: 0.85 },
    textures,
    scientific
  );

  // 1. SCULPTED CRANIUM, ZYGOMATIC ARCHES, MAXILLA, TEETH & ARTICULATED MANDIBLE + TMJ LIGAMENT
  const sy = p.skullY;
  const sc = p.skullScale;

  // Parietal-frontal cranial vault
  const cranium = addMesh(group, new THREE.SphereGeometry(0.285 * sc, 28, 24), boneMat, partId, 'skeleton', collector, 2);
  cranium.scale.set(0.87, 0.96, 1.05);
  cranium.position.set(0, sy + 0.02, -0.02);

  // Occipital bun
  const occip = addMesh(group, new THREE.SphereGeometry(0.175 * sc, 18, 14), boneMat, partId, 'skeleton', collector, 2);
  occip.scale.set(0.95, 0.85, 0.85);
  occip.position.set(0, sy - 0.04, -0.15 * sc);

  // Brow ridge & nasal bridge
  const brow = addMesh(
    group,
    makeTube(
      [
        new THREE.Vector3(-0.15 * sc, sy - 0.04, 0.18 * sc),
        new THREE.Vector3(0, sy - 0.03, 0.22 * sc),
        new THREE.Vector3(0.15 * sc, sy - 0.04, 0.18 * sc),
      ],
      p.isFemale ? 0.028 : 0.036,
      8,
      12
    ).geometry,
    boneMat,
    partId,
    'skeleton',
    collector,
    2
  );
  brow.name = 'supraorbitalRidge';

  const nasalBridge = addMesh(group, new THREE.ConeGeometry(0.042 * sc, 0.105 * sc, 8), boneMat, partId, 'skeleton', collector, 2);
  nasalBridge.rotation.x = 0.45;
  nasalBridge.position.set(0, sy - 0.1, 0.22 * sc);

  // Orbital rims, zygomatic arches & maxilla
  for (const side of [-1, 1]) {
    const orbit = addMesh(group, new THREE.TorusGeometry(0.052 * sc, 0.018 * sc, 8, 16), boneMat, partId, 'skeleton', collector, 2);
    orbit.position.set(side * 0.076 * sc, sy - 0.07, 0.2 * sc);
    orbit.rotation.y = side * 0.18;

    // Zygomatic arch cheekbone
    addBoneShaft(
      group,
      [
        new THREE.Vector3(side * 0.115 * sc, sy - 0.11, 0.18 * sc),
        new THREE.Vector3(side * 0.182 * sc, sy - 0.11, 0.095 * sc),
        new THREE.Vector3(side * 0.172 * sc, sy - 0.1, -0.02 * sc),
      ],
      0.023 * sc,
      0.032 * sc,
      0.024 * sc,
      boneMat,
      partId,
      collector,
      10,
      8
    );

    // Temporomandibular Joint (TMJ) capsule + lateral ligament
    const tmj = addMesh(group, new THREE.SphereGeometry(0.032 * sc, 10, 8), cartMat, partId, 'skeleton', collector, 2);
    tmj.position.set(side * 0.152 * sc, sy - 0.14, 0.01);
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * 0.162 * sc, sy - 0.11, 0.02),
        new THREE.Vector3(side * 0.154 * sc, sy - 0.165, 0.005),
      ],
      0.015 * sc,
      ligMat,
      partId,
      'skeleton',
      collector
    );
  }

  // Maxilla horseshoe & upper teeth
  addBoneShaft(
    group,
    [
      new THREE.Vector3(-0.09 * sc, sy - 0.18, 0.115 * sc),
      new THREE.Vector3(-0.064 * sc, sy - 0.19, 0.195 * sc),
      new THREE.Vector3(0, sy - 0.19, 0.22 * sc),
      new THREE.Vector3(0.064 * sc, sy - 0.19, 0.195 * sc),
      new THREE.Vector3(0.09 * sc, sy - 0.18, 0.115 * sc),
    ],
    0.036 * sc,
    0.032 * sc,
    0.032 * sc,
    boneMat,
    partId,
    collector,
    14,
    8
  );

  // Mandible (ramus, gonial angle, body, mental protuberance)
  addBoneShaft(
    group,
    [
      new THREE.Vector3(-0.152 * sc, sy - 0.15, 0.01),
      new THREE.Vector3(-0.14 * sc, sy - 0.27, 0.03 * sc),
      new THREE.Vector3(-0.09 * sc, sy - 0.31, 0.145 * sc),
      new THREE.Vector3(0, sy - 0.335, 0.215 * sc),
      new THREE.Vector3(0.09 * sc, sy - 0.31, 0.145 * sc),
      new THREE.Vector3(0.14 * sc, sy - 0.27, 0.03 * sc),
      new THREE.Vector3(0.152 * sc, sy - 0.15, 0.01),
    ],
    p.isFemale ? 0.036 : 0.044,
    0.03 * sc,
    0.03 * sc,
    boneMat,
    partId,
    collector,
    22,
    10,
    [0.78, 1.15]
  );

  // Upper & Lower dental crowns
  for (let t = -4; t <= 4; t++) {
    const ang = t * 0.22;
    const tx = Math.sin(ang) * 0.076 * sc;
    const tz = 0.13 * sc + Math.cos(ang) * 0.084 * sc;
    const uTooth = addMesh(group, new THREE.CylinderGeometry(0.0115 * sc, 0.0125 * sc, 0.028 * sc, 8), toothMat, partId, 'skeleton', collector, 2);
    uTooth.position.set(tx, sy - 0.225, tz);
    const lTooth = addMesh(group, new THREE.CylinderGeometry(0.0115 * sc, 0.0115 * sc, 0.026 * sc, 8), toothMat, partId, 'skeleton', collector, 2);
    lTooth.position.set(tx * 0.96, sy - 0.265, tz * 0.97);
  }

  // 2. ARTICULATED VERTEBRAL COLUMN (CERVICAL-THORACIC-LUMBAR) + INTERVERTEBRAL DISCS & LIGAMENTS
  const spinePoints: THREE.Vector3[] = [];
  for (let v = 0; v < 20; v++) {
    const t = v / 19;
    const y = sy - 0.34 - t * (sy - 0.34 + 0.56);
    // Natural anatomical S-curve: cervical lordosis (+z), thoracic kyphosis (-z), lumbar lordosis (+z)
    const sCurveZ =
      -0.105 -
      0.045 * Math.sin(t * Math.PI * 1.15) +
      0.035 * Math.sin(t * Math.PI * 2.5);
    const pt = new THREE.Vector3(0, y, sCurveZ);
    spinePoints.push(pt);

    const r = (0.048 + t * 0.036) * p.boneScale;
    const vert = addMesh(group, new THREE.CylinderGeometry(r, r * 1.06, 0.058, 14), boneMat, partId, 'skeleton', collector, 2);
    vert.scale.set(1.18, 1, 0.95);
    vert.position.copy(pt);

    // Fibrocartilage intervertebral disc between vertebrae
    if (v < 19) {
      const disc = addMesh(group, new THREE.CylinderGeometry(r * 1.04, r * 1.04, 0.025, 14), cartMat, partId, 'skeleton', collector, 2);
      disc.scale.set(1.18, 1, 0.95);
      disc.position.set(0, y - 0.046, sCurveZ);
    }

    // Spinous process & bilateral transverse processes
    const spinous = addMesh(group, new THREE.BoxGeometry(0.028 * p.boneScale, 0.038, 0.08 * p.boneScale), boneMat, partId, 'skeleton', collector, 2);
    spinous.position.set(0, y - 0.012, sCurveZ - r - 0.016);
    spinous.rotation.x = 0.42;

    for (const side of [-1, 1]) {
      const trans = addMesh(group, new THREE.CylinderGeometry(0.017, 0.022, 0.075 * p.boneScale, 8), boneMat, partId, 'skeleton', collector, 2);
      trans.rotation.z = Math.PI / 2;
      trans.position.set(side * (r + 0.028), y, sCurveZ - 0.016);
    }
  }

  // Anterior longitudinal ligament & supraspinous ligament along spine
  const antLigPts = spinePoints.map((pt, i) => new THREE.Vector3(pt.x, pt.y, pt.z + (0.048 + (i / 19) * 0.034) * p.boneScale));
  addLigamentBand(group, antLigPts, 0.022 * p.boneScale, ligMat, partId, 'skeleton', collector, [1.6, 0.35]);
  const supLigPts = spinePoints.map((pt, i) => new THREE.Vector3(pt.x, pt.y - 0.01, pt.z - (0.088 + (i / 19) * 0.032) * p.boneScale));
  addLigamentBand(group, supLigPts, 0.014 * p.boneScale, ligMat, partId, 'skeleton', collector, [0.8, 1.0]);

  // 3. THORACIC RIBCAGE, STERNUM (MANUBRIUM/BODY/XIPHOID) & HYALINE COSTAL CARTILAGES
  const ribGroup = new THREE.Group();
  const sternZ = p.isFemale ? 0.2 : 0.22;

  const manubrium = addMesh(ribGroup, new THREE.CylinderGeometry(0.095 * p.boneScale, 0.064 * p.boneScale, 0.13, 10), boneMat, partId, 'skeleton', collector, 2);
  manubrium.scale.set(1.18, 1, 0.42);
  manubrium.position.set(0, 0.9, sternZ);

  const sternalBody = addMesh(ribGroup, new THREE.CylinderGeometry(0.058 * p.boneScale, 0.046 * p.boneScale, 0.38, 10), boneMat, partId, 'skeleton', collector, 2);
  sternalBody.scale.set(1.1, 1, 0.42);
  sternalBody.position.set(0, 0.65, sternZ + 0.01);

  const xiphoid = addMesh(ribGroup, new THREE.ConeGeometry(0.034 * p.boneScale, 0.085, 8), cartMat, partId, 'skeleton', collector, 2);
  xiphoid.rotation.x = Math.PI;
  xiphoid.scale.set(1, 1, 0.42);
  xiphoid.position.set(0, 0.42, sternZ);

  for (let i = 0; i < 11; i++) {
    const y = 0.91 - i * 0.064;
    const archFactor = Math.sin(((i + 1) / 11.5) * Math.PI);
    const rad = (p.ribWidth + archFactor * (p.isFemale ? 0.125 : 0.155)) * 1.04;
    const isFloating = i >= 9;
    const isFalse = i >= 6 && i < 9;

    for (const side of [-1, 1]) {
      if (isFloating) {
        const ribGeo = createFusiformGeometry(
          [
            new THREE.Vector3(side * 0.055, y + 0.02, -0.155),
            new THREE.Vector3(side * (rad * 0.85), y - 0.02, -0.02),
            new THREE.Vector3(side * (rad * 0.65), y - 0.06, 0.09),
          ],
          () => 0.021 * p.boneScale,
          14,
          8,
          [0.6, 1.65]
        );
        addMesh(ribGroup, ribGeo.geometry, boneMat, partId, 'skeleton', collector, 2);
      } else {
        // Bony rib shaft around back & flank
        const boneEnd = new THREE.Vector3(side * (rad * 0.56), y - 0.04, 0.16 * p.ribScaleZ);
        const ribGeo = createFusiformGeometry(
          [
            new THREE.Vector3(side * 0.055, y + 0.03, -0.155),
            new THREE.Vector3(side * rad, y - 0.01, -0.01),
            boneEnd,
          ],
          () => 0.023 * p.boneScale,
          16,
          8,
          [0.58, 1.65]
        );
        addMesh(ribGroup, ribGeo.geometry, boneMat, partId, 'skeleton', collector, 2);

        // Hyaline costal cartilage bridge connecting bony rib to sternum / costal margin
        const sternJoinY = isFalse ? 0.52 : Math.max(0.47, y - 0.02);
        const cartGeo = createFusiformGeometry(
          [
            boneEnd,
            new THREE.Vector3(side * (rad * 0.3), (y - 0.03 + sternJoinY) * 0.5, sternZ * 0.96),
            new THREE.Vector3(side * 0.044, sternJoinY, sternZ),
          ],
          () => 0.021 * p.boneScale,
          10,
          8,
          [0.65, 1.5]
        );
        addMesh(ribGroup, cartGeo.geometry, cartMat, partId, 'skeleton', collector, 2);
      }
    }
  }
  group.add(ribGroup);
  anim.breathGroups.push({ group: ribGroup, rate: 1.55, amp: 0.022, axisMask: [1, 0.25, 1] });

  // 4. PELVIC GIRDLE (SACRUM, COCCYX, EXTRUDED ILIAC WINGS, PUBIC SYMPHYSIS & LIGAMENTS)
  const pelvisGroup = new THREE.Group();
  const sacrum = addMesh(pelvisGroup, new THREE.ConeGeometry(0.15 * p.pelvisFlare, 0.25, 10), boneMat, partId, 'skeleton', collector, 2);
  sacrum.rotation.x = Math.PI - 0.18;
  sacrum.scale.set(1.28, 1, 0.58);
  sacrum.position.set(0, -0.6, -0.13);

  const coccyx = addMesh(pelvisGroup, new THREE.ConeGeometry(0.042, 0.09, 8), boneMat, partId, 'skeleton', collector, 2);
  coccyx.rotation.x = Math.PI + 0.3;
  coccyx.position.set(0, -0.74, -0.13);

  // Iliac wing contoured shape
  const iliumShape = new THREE.Shape();
  iliumShape.moveTo(0, 0);
  iliumShape.quadraticCurveTo(-0.08, 0.14, 0.03, 0.24);
  iliumShape.quadraticCurveTo(0.16, 0.28, 0.23, 0.14);
  iliumShape.quadraticCurveTo(0.24, 0.02, 0.14, -0.06);
  iliumShape.quadraticCurveTo(0.06, -0.08, 0, 0);
  const iliumGeo = new THREE.ExtrudeGeometry(iliumShape, {
    depth: 0.054,
    bevelEnabled: true,
    bevelSize: 0.022,
    bevelThickness: 0.02,
    bevelSegments: 3,
  });
  iliumGeo.center();

  for (const side of [-1, 1]) {
    const ilium = addMesh(pelvisGroup, iliumGeo, boneMat, partId, 'skeleton', collector, 2);
    ilium.position.set(side * (p.isFemale ? 0.255 : 0.215), -0.55, -0.02);
    ilium.scale.set(side * p.pelvisFlare * 1.15, 1.15, 1.15);
    ilium.rotation.y = side * 0.72;
    ilium.rotation.z = side * -0.28;

    // Superior & inferior pubic rami + ischial arch (dimorphic subpubic angle)
    const archDrop = p.isFemale ? -0.72 : -0.77;
    addBoneShaft(
      pelvisGroup,
      [
        new THREE.Vector3(side * p.hipX, -0.69, 0.02),
        new THREE.Vector3(side * (p.hipX * 0.56), -0.74, 0.13),
        new THREE.Vector3(side * 0.022, archDrop, 0.155),
      ],
      0.04 * p.boneScale,
      0.052 * p.boneScale,
      0.042 * p.boneScale,
      boneMat,
      partId,
      collector,
      12,
      8
    );

    // Ischial tuberosity loop
    addBoneShaft(
      pelvisGroup,
      [
        new THREE.Vector3(side * p.hipX, -0.69, 0.01),
        new THREE.Vector3(side * (p.hipX * 0.78), -0.82, -0.03),
        new THREE.Vector3(side * 0.028, archDrop - 0.02, 0.14),
      ],
      0.036 * p.boneScale,
      0.046 * p.boneScale,
      0.038 * p.boneScale,
      boneMat,
      partId,
      collector,
      12,
      8
    );

    // Sacroiliac & Sacrotuberous Ligaments
    addLigamentBand(
      pelvisGroup,
      [
        new THREE.Vector3(side * 0.07, -0.53, -0.13),
        new THREE.Vector3(side * (p.isFemale ? 0.21 : 0.18), -0.54, -0.1),
      ],
      0.022,
      ligMat,
      partId,
      'skeleton',
      collector
    );
    addLigamentBand(
      pelvisGroup,
      [
        new THREE.Vector3(side * 0.06, -0.66, -0.13),
        new THREE.Vector3(side * (p.hipX * 0.78), -0.81, -0.03),
      ],
      0.015,
      ligMat,
      partId,
      'skeleton',
      collector
    );
  }

  // Pubic symphysis fibrocartilage disc
  const symphysis = addMesh(pelvisGroup, new THREE.BoxGeometry(0.046, 0.084, 0.062), cartMat, partId, 'skeleton', collector, 2);
  symphysis.position.set(0, p.isFemale ? -0.725 : -0.77, 0.152);
  group.add(pelvisGroup);

  // 5. SHOULDER GIRDLE, UPPER LIMB, WRIST CARPALS & 5 INDIVIDUAL FINGERS
  const scapulaShape = new THREE.Shape();
  scapulaShape.moveTo(0, 0.14);
  scapulaShape.lineTo(0.14, 0.12);
  scapulaShape.lineTo(0.03, -0.15);
  scapulaShape.closePath();
  const scapulaGeo = new THREE.ExtrudeGeometry(scapulaShape, {
    depth: 0.034,
    bevelEnabled: true,
    bevelSize: 0.012,
    bevelThickness: 0.012,
    bevelSegments: 2,
  });
  scapulaGeo.center();

  for (const side of [-1, 1]) {
    // S-curved Clavicle + Sternoclavicular & Acromioclavicular ligaments
    const clavPts = [
      new THREE.Vector3(side * 0.055, 0.95, sternZ - 0.01),
      new THREE.Vector3(side * (p.shoulderX * 0.48), 0.99, 0.13),
      new THREE.Vector3(side * (p.shoulderX - 0.02), 0.92, -0.03),
    ];
    addBoneShaft(group, clavPts, 0.03 * p.boneScale, 0.042 * p.boneScale, 0.04 * p.boneScale, boneMat, partId, collector, 14, 8);
    addLigamentBand(group, [new THREE.Vector3(side * 0.03, 0.94, sternZ), new THREE.Vector3(side * 0.07, 0.95, sternZ - 0.01)], 0.02, ligMat, partId, 'skeleton', collector);
    addLigamentBand(group, [new THREE.Vector3(side * (p.shoulderX - 0.03), 0.92, -0.03), new THREE.Vector3(side * (p.shoulderX - 0.01), 0.89, -0.05)], 0.019, ligMat, partId, 'skeleton', collector);

    // Triangular Scapula + Scapular spine
    const scapula = addMesh(group, scapulaGeo, boneMat, partId, 'skeleton', collector, 2);
    scapula.position.set(side * (p.shoulderX * 0.48), 0.72, -0.19);
    scapula.scale.set(side * p.boneScale * 1.18, p.boneScale * 1.18, 1.15);
    scapula.rotation.y = side * 0.24;
    scapula.rotation.z = side * -0.14;

    addBoneShaft(
      group,
      [
        new THREE.Vector3(side * (p.shoulderX * 0.34), 0.78, -0.22),
        new THREE.Vector3(side * (p.shoulderX - 0.02), 0.89, -0.08),
      ],
      0.024 * p.boneScale,
      0.026 * p.boneScale,
      0.036 * p.boneScale,
      boneMat,
      partId,
      collector,
      8,
      8
    );

    // Glenohumeral (Shoulder) joint cartilage & capsular ligaments
    const shoulderPos = new THREE.Vector3(side * p.shoulderX, 0.85, 0.0);
    const hHead = addMesh(group, new THREE.SphereGeometry(0.078 * p.boneScale, 16, 14), cartMat, partId, 'skeleton', collector, 2);
    hHead.position.copy(shoulderPos);

    for (const dz of [-0.032, 0.032]) {
      addLigamentBand(
        group,
        [
          new THREE.Vector3(side * (p.shoulderX - 0.05), 0.88, dz - 0.04),
          new THREE.Vector3(side * (p.shoulderX + 0.02), 0.84, dz),
        ],
        0.018 * p.boneScale,
        ligMat,
        partId,
        'skeleton',
        collector
      );
    }

    // Humerus shaft with condyles
    const elbowPos = new THREE.Vector3(side * p.elbowX, 0.24, -0.02);
    addBoneShaft(
      group,
      [shoulderPos, shoulderPos.clone().lerp(elbowPos, 0.5), elbowPos],
      0.052 * p.boneScale,
      0.076 * p.boneScale,
      0.072 * p.boneScale,
      boneMat,
      partId,
      collector,
      18,
      12
    );

    // Elbow hyaline joint + collateral & annular ligaments
    const elbowJoint = addMesh(group, new THREE.CylinderGeometry(0.058 * p.boneScale, 0.058 * p.boneScale, 0.105 * p.boneScale, 12), cartMat, partId, 'skeleton', collector, 2);
    elbowJoint.rotation.z = Math.PI / 2;
    elbowJoint.position.copy(elbowPos);

    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * (p.elbowX + 0.048), 0.28, 0),
        new THREE.Vector3(side * (p.elbowX + 0.05), 0.19, 0.01),
      ],
      0.014 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * (p.elbowX - 0.048), 0.28, 0),
        new THREE.Vector3(side * (p.elbowX - 0.05), 0.19, -0.01),
      ],
      0.014 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );

    // Radius (lateral) & Ulna (medial) + Interosseous Membrane
    const wristRadiusPos = new THREE.Vector3(side * (p.wristX + 0.02), p.wristY, 0.095);
    const wristUlnaPos = new THREE.Vector3(side * (p.wristX - 0.02), p.wristY, 0.065);
    const elbowRadiusPos = new THREE.Vector3(side * (p.elbowX + 0.028), 0.22, 0.012);
    const elbowUlnaPos = new THREE.Vector3(side * (p.elbowX - 0.026), 0.25, -0.036);

    addBoneShaft(group, [elbowRadiusPos, wristRadiusPos], 0.03 * p.boneScale, 0.044 * p.boneScale, 0.048 * p.boneScale, boneMat, partId, collector, 14, 10);
    addBoneShaft(group, [elbowUlnaPos, wristUlnaPos], 0.028 * p.boneScale, 0.046 * p.boneScale, 0.036 * p.boneScale, boneMat, partId, collector, 14, 10);

    // Interosseous membrane ligament connecting radius & ulna
    for (let m = 1; m <= 5; m++) {
      const t = m / 6;
      addLigamentBand(
        group,
        [elbowRadiusPos.clone().lerp(wristRadiusPos, t), elbowUlnaPos.clone().lerp(wristUlnaPos, t)],
        0.009 * p.boneScale,
        ligMat,
        partId,
        'skeleton',
        collector
      );
    }

    // WRIST CARPAL BONES (2 rows of 4) + TRANSVERSE CARPAL LIGAMENT
    const wristMid = wristRadiusPos.clone().lerp(wristUlnaPos, 0.5);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 4; col++) {
        const carpal = addMesh(group, new THREE.SphereGeometry(0.018 * p.boneScale, 8, 8), boneMat, partId, 'skeleton', collector, 2);
        carpal.scale.set(0.88, 1.0, 1.1);
        carpal.position.set(
          wristMid.x + side * (0.004 - row * 0.002),
          wristMid.y - 0.022 - row * 0.022,
          wristMid.z + (1.5 - col) * 0.017 * p.boneScale
        );
      }
    }
    addLigamentBand(
      group,
      [
        new THREE.Vector3(wristMid.x, wristMid.y - 0.025, wristMid.z - 0.038),
        new THREE.Vector3(wristMid.x + side * 0.012, wristMid.y - 0.025, wristMid.z + 0.038),
      ],
      0.012 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );

    // 5 METACARPALS & 14 INDIVIDUAL FINGER PHALANGES WITH KNUCKLE JOINTS
    const fingerSpecs = [
      { zOff: 0.044, xSpread: -side * 0.018, splayZ: 0.022, mcLen: 0.044, phalanges: [0.032, 0.024], r: 0.015 }, // Thumb (2 phalanges)
      { zOff: 0.026, xSpread: 0, splayZ: 0.008, mcLen: 0.068, phalanges: [0.038, 0.024, 0.018], r: 0.0125 }, // Index
      { zOff: 0.008, xSpread: 0, splayZ: 0.0, mcLen: 0.072, phalanges: [0.042, 0.028, 0.02], r: 0.0132 }, // Middle
      { zOff: -0.01, xSpread: 0, splayZ: -0.007, mcLen: 0.066, phalanges: [0.038, 0.025, 0.018], r: 0.0122 }, // Ring
      { zOff: -0.027, xSpread: 0, splayZ: -0.015, mcLen: 0.058, phalanges: [0.03, 0.02, 0.015], r: 0.0108 }, // Little
    ];

    fingerSpecs.forEach((f, idx) => {
      const base = new THREE.Vector3(
        wristMid.x + f.xSpread * 0.3,
        wristMid.y - 0.048,
        wristMid.z + f.zOff * p.boneScale
      );
      const mcp = new THREE.Vector3(
        base.x + f.xSpread * 0.8,
        base.y - f.mcLen * p.boneScale,
        base.z + f.splayZ * 0.6
      );
      addBoneShaft(group, [base, mcp], f.r * 0.74 * p.boneScale, f.r * p.boneScale, f.r * 1.15 * p.boneScale, boneMat, partId, collector, 8, 8);

      let curr = mcp.clone();
      f.phalanges.forEach((plen, pIdx) => {
        // Joint cartilage knuckle
        const jCap = addMesh(group, new THREE.SphereGeometry(f.r * 1.08 * p.boneScale, 8, 8), cartMat, partId, 'skeleton', collector, 2);
        jCap.position.copy(curr);

        const next = new THREE.Vector3(
          curr.x + (idx === 0 ? -side * 0.008 : -side * 0.004 * (pIdx + 1)),
          curr.y - plen * p.boneScale,
          curr.z + f.splayZ * (0.35 - pIdx * 0.05)
        );
        const rad = f.r * (0.9 - pIdx * 0.14) * p.boneScale;
        addBoneShaft(group, [curr, next], rad * 0.74, rad, rad * 0.88, boneMat, partId, collector, 6, 8);
        curr = next;
      });
    });

    // 6. LOWER LIMB: FEMUR, KNEE JOINT (MENISCI + ACL/PCL + MCL/LCL + PATELLA), TIBIA/FIBULA & 5 TOES
    const hipJointPos = new THREE.Vector3(side * p.hipX, -0.73, 0.02);
    const trochanterPos = new THREE.Vector3(side * (p.hipX + 0.08), -0.8, 0.01);
    const kneePos = new THREE.Vector3(side * p.kneeX, -1.48, 0.04);

    // Femoral head cartilage & Iliofemoral Y-ligament
    const femHead = addMesh(group, new THREE.SphereGeometry(0.088 * p.boneScale, 16, 14), cartMat, partId, 'skeleton', collector, 2);
    femHead.position.copy(hipJointPos);
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * (p.hipX + 0.02), -0.64, 0.07),
        new THREE.Vector3(side * (p.hipX + 0.06), -0.78, 0.075),
      ],
      0.022 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * (p.hipX + 0.01), -0.65, 0.07),
        new THREE.Vector3(side * (p.hipX + 0.03), -0.81, 0.065),
      ],
      0.018 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );

    // Femoral neck + Greater trochanter + Femoral shaft + Condyles
    addBoneShaft(
      group,
      [hipJointPos, trochanterPos, trochanterPos.clone().lerp(kneePos, 0.5), kneePos],
      0.072 * p.boneScale,
      0.088 * p.boneScale,
      0.098 * p.boneScale,
      boneMat,
      partId,
      collector,
      20,
      14
    );

    // Medial & lateral femoral condyles + articular hyaline cartilage
    for (const cSide of [-1, 1]) {
      const condyle = addMesh(group, new THREE.SphereGeometry(0.056 * p.boneScale, 12, 10), cartMat, partId, 'skeleton', collector, 2);
      condyle.scale.set(0.88, 1.0, 1.25);
      condyle.position.set(kneePos.x + cSide * 0.038 * p.boneScale, kneePos.y - 0.018, kneePos.z);

      // Meniscus (C-shaped shock-absorbing fibrocartilage pad)
      const meniscus = addMesh(group, new THREE.TorusGeometry(0.04 * p.boneScale, 0.014 * p.boneScale, 8, 14, Math.PI * 1.45), cartMat, partId, 'skeleton', collector, 2);
      meniscus.rotation.x = Math.PI / 2;
      meniscus.rotation.z = cSide === -1 ? -Math.PI * 0.72 : Math.PI * 0.28;
      meniscus.position.set(kneePos.x + cSide * 0.038 * p.boneScale, kneePos.y - 0.044, kneePos.z);
    }

    // Cruciate ligaments (ACL & PCL crossing inside knee intercondylar notch)
    addLigamentBand(
      group,
      [
        new THREE.Vector3(kneePos.x - 0.014, kneePos.y - 0.055, kneePos.z + 0.022),
        new THREE.Vector3(kneePos.x + 0.016, kneePos.y - 0.005, kneePos.z - 0.022),
      ],
      0.012 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );
    addLigamentBand(
      group,
      [
        new THREE.Vector3(kneePos.x + 0.014, kneePos.y - 0.055, kneePos.z - 0.022),
        new THREE.Vector3(kneePos.x - 0.016, kneePos.y - 0.005, kneePos.z + 0.022),
      ],
      0.012 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );

    // Medial & Lateral Collateral Ligaments (MCL & LCL)
    addLigamentBand(
      group,
      [
        new THREE.Vector3(kneePos.x - side * 0.08 * p.boneScale, kneePos.y + 0.02, kneePos.z),
        new THREE.Vector3(kneePos.x - side * 0.072 * p.boneScale, kneePos.y - 0.09, kneePos.z),
      ],
      0.014 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );
    addLigamentBand(
      group,
      [
        new THREE.Vector3(kneePos.x + side * 0.08 * p.boneScale, kneePos.y + 0.02, kneePos.z - 0.005),
        new THREE.Vector3(kneePos.x + side * 0.086 * p.boneScale, kneePos.y - 0.085, kneePos.z - 0.02),
      ],
      0.013 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );

    // Patella + Patellar Ligament inserting onto tibial tuberosity
    const patella = addMesh(group, new THREE.SphereGeometry(0.056 * p.boneScale, 12, 10), boneMat, partId, 'skeleton', collector, 2);
    patella.scale.set(0.95, 1.08, 0.56);
    patella.position.set(kneePos.x, kneePos.y - 0.01, kneePos.z + 0.075);
    addLigamentBand(
      group,
      [
        new THREE.Vector3(kneePos.x, kneePos.y - 0.04, kneePos.z + 0.07),
        new THREE.Vector3(kneePos.x, kneePos.y - 0.135, kneePos.z + 0.052),
      ],
      0.02 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector,
      [1.4, 0.45]
    );

    // Tibia & Fibula + Crural Interosseous Membrane
    const tibiaTop = new THREE.Vector3(kneePos.x - side * 0.008, kneePos.y - 0.06, kneePos.z);
    const tibiaBot = new THREE.Vector3(side * p.ankleX, p.ankleY, -0.01);
    const fibulaTop = new THREE.Vector3(kneePos.x + side * 0.076 * p.boneScale, kneePos.y - 0.085, kneePos.z - 0.028);
    const fibulaBot = new THREE.Vector3(side * (p.ankleX + 0.062 * p.boneScale), p.ankleY - 0.012, -0.032);

    addBoneShaft(group, [tibiaTop, tibiaBot], 0.06 * p.boneScale, 0.088 * p.boneScale, 0.068 * p.boneScale, boneMat, partId, collector, 16, 12);
    addBoneShaft(group, [fibulaTop, fibulaBot], 0.026 * p.boneScale, 0.04 * p.boneScale, 0.036 * p.boneScale, boneMat, partId, collector, 16, 8);

    for (let m = 1; m <= 6; m++) {
      const t = m / 7;
      addLigamentBand(group, [tibiaTop.clone().lerp(tibiaBot, t), fibulaTop.clone().lerp(fibulaBot, t)], 0.009 * p.boneScale, ligMat, partId, 'skeleton', collector);
    }

    // ANKLE JOINT, CALCANEUS, TALUS, TARSALS, 5 METATARSALS & 14 INDIVIDUAL TOE PHALANGES
    const talusPos = new THREE.Vector3(side * p.ankleX, p.ankleY - 0.035, 0.005);
    const talus = addMesh(group, new THREE.SphereGeometry(0.054 * p.boneScale, 12, 10), cartMat, partId, 'skeleton', collector, 2);
    talus.scale.set(0.95, 0.85, 1.18);
    talus.position.copy(talusPos);

    const calcaneus = addBoneShaft(
      group,
      [
        new THREE.Vector3(side * p.ankleX, p.ankleY - 0.09, -0.08),
        new THREE.Vector3(side * p.ankleX, p.ankleY - 0.085, 0.028),
      ],
      0.05 * p.boneScale,
      0.056 * p.boneScale,
      0.046 * p.boneScale,
      boneMat,
      partId,
      collector,
      8,
      10,
      [0.85, 1.1]
    );
    calcaneus.name = 'calcaneus';

    // Ankle Deltoid & Anterior Talofibular Ligaments
    addLigamentBand(
      group,
      [
        new THREE.Vector3(tibiaBot.x - side * 0.035, tibiaBot.y, 0),
        new THREE.Vector3(talusPos.x - side * 0.03, talusPos.y - 0.04, 0.01),
      ],
      0.016 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );
    addLigamentBand(
      group,
      [
        fibulaBot,
        new THREE.Vector3(talusPos.x + side * 0.028, talusPos.y - 0.01, 0.04),
      ],
      0.014 * p.boneScale,
      ligMat,
      partId,
      'skeleton',
      collector
    );

    // Tarsal arch & 5 individual Metatarsals + 14 individual Toe Phalanges
    const toeSpecs = [
      { xOff: -side * 0.038, lenM: 0.085, phalanges: [0.036, 0.026], r: 0.021 }, // Hallux (big toe, 2 phalanges)
      { xOff: -side * 0.018, lenM: 0.092, phalanges: [0.028, 0.018, 0.014], r: 0.014 },
      { xOff: 0, lenM: 0.088, phalanges: [0.025, 0.016, 0.013], r: 0.0132 },
      { xOff: side * 0.018, lenM: 0.084, phalanges: [0.022, 0.015, 0.012], r: 0.0124 },
      { xOff: side * 0.035, lenM: 0.078, phalanges: [0.019, 0.013, 0.011], r: 0.0116 },
    ];

    toeSpecs.forEach((toe) => {
      const tarsalBase = new THREE.Vector3(
        side * p.ankleX + toe.xOff * 0.72,
        p.ankleY - 0.068,
        0.045
      );
      const tarsalNode = addMesh(group, new THREE.SphereGeometry(toe.r * 1.55 * p.boneScale, 8, 8), boneMat, partId, 'skeleton', collector, 2);
      tarsalNode.position.copy(tarsalBase);

      const mtpHead = new THREE.Vector3(
        side * p.ankleX + toe.xOff,
        p.ankleY - 0.105,
        0.045 + toe.lenM * p.boneScale
      );
      addBoneShaft(group, [tarsalBase, mtpHead], toe.r * 0.8 * p.boneScale, toe.r * 1.15 * p.boneScale, toe.r * 1.2 * p.boneScale, boneMat, partId, collector, 8, 8);

      // Plantar fascia slip from calcaneus to MTP head
      addLigamentBand(
        group,
        [new THREE.Vector3(side * p.ankleX, p.ankleY - 0.12, -0.04), mtpHead.clone().setY(p.ankleY - 0.122)],
        0.0065 * p.boneScale,
        ligMat,
        partId,
        'skeleton',
        collector
      );

      let curr = mtpHead.clone();
      toe.phalanges.forEach((plen, pIdx) => {
        const jCap = addMesh(group, new THREE.SphereGeometry(toe.r * 1.08 * p.boneScale, 8, 8), cartMat, partId, 'skeleton', collector, 2);
        jCap.position.copy(curr);

        const next = new THREE.Vector3(curr.x, curr.y - 0.004, curr.z + plen * p.boneScale);
        const rad = toe.r * (0.9 - pIdx * 0.15) * p.boneScale;
        addBoneShaft(group, [curr, next], rad * 0.74, rad, rad * 0.9, boneMat, partId, collector, 6, 8);
        curr = next;
      });
    });
  }
}

// ======================================================
// HIGH-DETAIL HUMAN MUSCLES, APONEUROSES & TENDONS (INCLUDING FINGER & TOE TENDONS)
// ======================================================
function buildHumanMuscles(
  p: HumanProport,
  group: THREE.Group,
  partId: string,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[]
) {
  const muscMat = makeMaterial(
    { color: 0xa63a3e, layer: 'muscles', tissue: 'muscle', opacity: 0.58, focusOpacity: 0.96 },
    textures,
    scientific
  );
  const deepMuscMat = makeMaterial(
    { color: 0x852b30, layer: 'muscles', tissue: 'muscle', opacity: 0.62, focusOpacity: 0.96 },
    textures,
    scientific
  );
  const tendonMat = makeMaterial(
    { color: 0xe6e0d4, layer: 'muscles', tissue: 'tendon', opacity: 0.94, focusOpacity: 1.0 },
    textures,
    scientific
  );

  const mb = p.muscleBulk;
  const sternZ = p.isFemale ? 0.21 : 0.23;

  // Linea alba central abdominal collagen band
  addLigamentBand(
    group,
    [new THREE.Vector3(0, 0.48, sternZ), new THREE.Vector3(0, -0.58, 0.185)],
    0.016,
    tendonMat,
    partId,
    'muscles',
    collector,
    [1.6, 0.3]
  );

  for (const side of [-1, 1]) {
    // 1. HEAD & NECK: Masseter, Temporalis, Sternocleidomastoid (2 heads), Trapezius
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * 0.13 * p.skullScale, p.skullY - 0.11, 0.08),
        new THREE.Vector3(side * 0.135 * p.skullScale, p.skullY - 0.24, 0.05),
      ],
      0.032 * mb,
      muscMat,
      tendonMat,
      partId,
      collector,
      [0.65, 1.2]
    );
    const temporalis = addMesh(group, new THREE.SphereGeometry(0.08 * p.skullScale, 12, 10), deepMuscMat, partId, 'muscles', collector, 5);
    temporalis.scale.set(0.32, 0.85, 1.15);
    temporalis.position.set(side * 0.165 * p.skullScale, p.skullY - 0.03, 0.01);

    // Sternocleidomastoid (sternal & clavicular heads)
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * 0.125 * p.skullScale, p.skullY - 0.18, -0.03),
        new THREE.Vector3(side * 0.085, 1.2, 0.09),
        new THREE.Vector3(side * 0.04, 0.96, sternZ - 0.01),
      ],
      0.028 * mb,
      muscMat,
      tendonMat,
      partId,
      collector
    );

    // Upper & Middle Trapezius + Nuchal/Thoracic Aponeurosis
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * 0.04, p.skullY - 0.24, -0.14),
        new THREE.Vector3(side * (p.shoulderX * 0.55), 1.05, -0.12),
        new THREE.Vector3(side * (p.shoulderX - 0.03), 0.93, -0.05),
      ],
      0.045 * mb,
      muscMat,
      tendonMat,
      partId,
      collector,
      [1.3, 0.65]
    );
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * 0.03, 0.95, -0.2),
        new THREE.Vector3(side * (p.shoulderX * 0.55), 0.82, -0.21),
        new THREE.Vector3(side * 0.03, 0.5, -0.2),
      ],
      0.055 * mb,
      deepMuscMat,
      tendonMat,
      partId,
      collector,
      [0.7, 1.4]
    );

    // 2. CHEST & TORSO: Pectoralis Major (clavicular + sternocostal heads converging to humeral tendon)
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * 0.08, 0.92, sternZ),
        new THREE.Vector3(side * (p.shoulderX * 0.45), 0.84, 0.2),
        new THREE.Vector3(side * p.shoulderX, 0.78, 0.04),
      ],
      0.058 * mb,
      muscMat,
      tendonMat,
      partId,
      collector,
      [0.65, 1.35]
    );
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * 0.05, 0.65, sternZ + 0.01),
        new THREE.Vector3(side * (p.shoulderX * 0.48), 0.71, 0.21),
        new THREE.Vector3(side * p.shoulderX, 0.77, 0.04),
      ],
      0.072 * mb,
      muscMat,
      tendonMat,
      partId,
      collector,
      [0.58, 1.45]
    );

    // Serratus anterior finger-like slips over lateral ribs
    for (let s = 0; s < 4; s++) {
      const syRib = 0.64 - s * 0.075;
      addMuscleBelly(
        group,
        [
          new THREE.Vector3(side * (p.ribWidth + 0.08), syRib + 0.04, -0.06),
          new THREE.Vector3(side * (p.ribWidth + 0.06), syRib, 0.08),
        ],
        0.022 * mb,
        deepMuscMat,
        tendonMat,
        partId,
        collector,
        [0.65, 1.2]
      );
    }

    // Rectus Abdominis + Tendinous Intersections
    for (let row = 0; row < 4; row++) {
      const abY = 0.4 - row * 0.155;
      const ab = addMesh(group, new THREE.SphereGeometry(0.074 * mb, 14, 12), muscMat, partId, 'muscles', collector, 5);
      ab.scale.set(1.04, 0.74, 0.38);
      ab.position.set(side * (p.isFemale ? 0.08 : 0.092), abY, sternZ + 0.01 - row * 0.008);

      if (row < 3) {
        addLigamentBand(
          group,
          [
            new THREE.Vector3(side * 0.015, abY - 0.076, sternZ + 0.01 - row * 0.008),
            new THREE.Vector3(side * 0.16, abY - 0.076, sternZ - 0.02 - row * 0.008),
          ],
          0.009,
          tendonMat,
          partId,
          'muscles',
          collector
        );
      }
    }

    // External Obliques + Inguinal Tendon
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.ribWidth + 0.08), 0.42, 0.04),
        new THREE.Vector3(side * (p.isFemale ? 0.28 : 0.34), 0.08, 0.12),
        new THREE.Vector3(side * (p.hipX + 0.04), -0.44, 0.12),
      ],
      0.062 * mb,
      muscMat,
      tendonMat,
      partId,
      collector,
      [0.52, 1.5]
    );
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * (p.hipX + 0.04), -0.5, 0.07),
        new THREE.Vector3(side * 0.02, -0.71, 0.16),
      ],
      0.012,
      tendonMat,
      partId,
      'muscles',
      collector
    );

    // Latissimus Dorsi + Thoracolumbar Fascia Aponeurosis
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * 0.05, 0.25, -0.2),
        new THREE.Vector3(side * (p.shoulderX * 0.56), 0.46, -0.2),
        new THREE.Vector3(side * p.shoulderX, 0.78, -0.02),
      ],
      0.082 * mb,
      deepMuscMat,
      tendonMat,
      partId,
      collector,
      [0.48, 1.65]
    );
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * 0.03, 0.18, -0.2),
        new THREE.Vector3(side * 0.14, -0.48, -0.15),
      ],
      0.038,
      tendonMat,
      partId,
      'muscles',
      collector,
      [1.4, 0.22]
    );

    // 3. SHOULDER & ARM: 3-Head Deltoid, Biceps, Triceps, Forearm Flexors/Extensors & 5 Finger Tendons
    for (const dOff of [0.04, 0, -0.04]) {
      addMuscleBelly(
        group,
        [
          new THREE.Vector3(side * (p.shoulderX - 0.02), 0.91, dOff),
          new THREE.Vector3(side * (p.shoulderX + 0.055), 0.82, dOff * 0.7),
          new THREE.Vector3(side * (p.shoulderX + 0.07), 0.67, 0),
        ],
        0.044 * mb,
        muscMat,
        tendonMat,
        partId,
        collector
      );
    }

    // Biceps Brachii (anterior) + Triceps Brachii (posterior)
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * p.shoulderX, 0.82, 0.03),
        new THREE.Vector3(side * ((p.shoulderX + p.elbowX) * 0.5), 0.54, 0.045),
        new THREE.Vector3(side * (p.elbowX + 0.01), 0.21, 0.02),
      ],
      0.054 * mb,
      muscMat,
      tendonMat,
      partId,
      collector
    );
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * p.shoulderX, 0.8, -0.03),
        new THREE.Vector3(side * ((p.shoulderX + p.elbowX) * 0.5 - side * 0.01), 0.53, -0.055),
        new THREE.Vector3(side * (p.elbowX - 0.02), 0.25, -0.04),
      ],
      0.056 * mb,
      deepMuscMat,
      tendonMat,
      partId,
      collector
    );

    // Forearm Flexor & Extensor bellies tapering to Wrist Retinaculum
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.elbowX - 0.01), 0.23, 0.01),
        new THREE.Vector3(side * ((p.elbowX + p.wristX) * 0.5 - side * 0.01), -0.02, 0.055),
        new THREE.Vector3(side * (p.wristX - 0.008), p.wristY, 0.075),
      ],
      0.046 * mb,
      muscMat,
      tendonMat,
      partId,
      collector
    );
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.elbowX + 0.02), 0.25, -0.02),
        new THREE.Vector3(side * ((p.elbowX + p.wristX) * 0.5 + side * 0.015), -0.01, 0.025),
        new THREE.Vector3(side * (p.wristX + 0.014), p.wristY, 0.088),
      ],
      0.042 * mb,
      deepMuscMat,
      tendonMat,
      partId,
      collector
    );

    // Wrist Extensor/Flexor Retinaculum + 5 Long Digital Tendons to all 5 fingertips
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * p.wristX, p.wristY - 0.01, 0.045),
        new THREE.Vector3(side * (p.wristX + 0.012), p.wristY - 0.01, 0.115),
      ],
      0.011,
      tendonMat,
      partId,
      'muscles',
      collector
    );

    const fTendonZ = [0.044, 0.026, 0.008, -0.01, -0.027];
    const fTendonLen = [0.11, 0.155, 0.168, 0.154, 0.128];
    fTendonZ.forEach((fz, idx) => {
      const start = new THREE.Vector3(side * (p.wristX + 0.012), p.wristY - 0.015, 0.08 + fz * 0.55);
      const mid = new THREE.Vector3(side * (p.wristX + 0.014), p.wristY - 0.07, 0.08 + fz * p.boneScale);
      const end = new THREE.Vector3(
        side * (p.wristX + (idx === 0 ? -0.025 : 0.004)),
        p.wristY - 0.048 - fTendonLen[idx] * p.boneScale,
        0.08 + fz * p.boneScale + (idx === 0 ? 0.022 : 0)
      );
      addLigamentBand(group, [start, mid, end], 0.0042 * p.boneScale, tendonMat, partId, 'muscles', collector, [1, 1]);
    });

    // 4. HIP, THIGH & CALF: Gluteus Medius/Maximus, IT Band, Quadriceps, Hamstrings, Sartorius, Achilles & 5 Toe Tendons
    const gluteMax = addMesh(group, new THREE.SphereGeometry(0.175 * mb, 18, 14), muscMat, partId, 'muscles', collector, 5);
    gluteMax.scale.set(0.95, 1.05, 0.65);
    gluteMax.position.set(side * (p.hipX - 0.01), -0.78, -0.14);

    const gluteMed = addMesh(group, new THREE.SphereGeometry(0.12 * mb, 14, 12), deepMuscMat, partId, 'muscles', collector, 5);
    gluteMed.scale.set(0.9, 0.85, 0.65);
    gluteMed.position.set(side * (p.hipX + 0.06), -0.62, -0.06);

    // Iliotibial (IT) Band Tract running from iliac crest down lateral thigh to knee
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * (p.hipX + 0.1), -0.6, 0.0),
        new THREE.Vector3(side * (p.kneeX + 0.075), -1.06, 0.03),
        new THREE.Vector3(side * (p.kneeX + 0.056), -1.53, 0.03),
      ],
      0.018,
      tendonMat,
      partId,
      'muscles',
      collector,
      [0.45, 1.9]
    );

    // Quadriceps (Rectus Femoris, Vastus Lateralis, Vastus Medialis) -> Quadriceps & Patellar Tendon
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.hipX + 0.03), -0.72, 0.09),
        new THREE.Vector3(side * ((p.hipX + p.kneeX) * 0.5 + side * 0.02), -1.12, 0.125),
        new THREE.Vector3(side * p.kneeX, -1.46, 0.095),
      ],
      0.074 * mb,
      muscMat,
      tendonMat,
      partId,
      collector
    );
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.hipX + 0.08), -0.82, 0.03),
        new THREE.Vector3(side * (p.kneeX + 0.06), -1.16, 0.06),
        new THREE.Vector3(side * (p.kneeX + 0.03), -1.46, 0.08),
      ],
      0.066 * mb,
      deepMuscMat,
      tendonMat,
      partId,
      collector
    );
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.hipX - 0.02), -0.92, 0.04),
        new THREE.Vector3(side * (p.kneeX - 0.045), -1.24, 0.075),
        new THREE.Vector3(side * (p.kneeX - 0.02), -1.46, 0.085),
      ],
      0.06 * mb,
      muscMat,
      tendonMat,
      partId,
      collector
    );

    // Quadriceps + Patellar Tendon over knee
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * p.kneeX, -1.4, 0.095),
        new THREE.Vector3(side * p.kneeX, -1.49, 0.096),
        new THREE.Vector3(side * p.kneeX, -1.61, 0.078),
      ],
      0.017,
      tendonMat,
      partId,
      'muscles',
      collector,
      [1.45, 0.45]
    );

    // Sartorius oblique strap + Hamstrings (posterior)
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.hipX + 0.08), -0.66, 0.08),
        new THREE.Vector3(side * (p.kneeX - 0.03), -1.14, 0.08),
        new THREE.Vector3(side * (p.kneeX - 0.05), -1.55, 0.02),
      ],
      0.026 * mb,
      muscMat,
      tendonMat,
      partId,
      collector
    );
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.hipX + 0.01), -0.82, -0.07),
        new THREE.Vector3(side * p.kneeX, -1.16, -0.08),
        new THREE.Vector3(side * (p.kneeX + 0.04), -1.54, -0.02),
      ],
      0.072 * mb,
      deepMuscMat,
      tendonMat,
      partId,
      collector
    );

    // Tibialis Anterior + Medial & Lateral Gastrocnemius Heads + ACHILLES TENDON
    addMuscleBelly(
      group,
      [
        new THREE.Vector3(side * (p.kneeX + 0.02), -1.58, 0.045),
        new THREE.Vector3(side * (p.ankleX + 0.02), -1.84, 0.048),
        new THREE.Vector3(side * (p.ankleX - 0.01), p.ankleY, 0.04),
      ],
      0.036 * mb,
      muscMat,
      tendonMat,
      partId,
      collector
    );
    for (const headSide of [-1, 1]) {
      addMuscleBelly(
        group,
        [
          new THREE.Vector3(side * p.kneeX + headSide * 0.032, -1.52, -0.03),
          new THREE.Vector3(side * p.ankleX + headSide * 0.028, -1.76, -0.085),
          new THREE.Vector3(side * p.ankleX, -1.96, -0.065),
        ],
        0.048 * mb,
        muscMat,
        tendonMat,
        partId,
        collector
      );
    }
    // Thick, sculpted Achilles (Calcaneal) Tendon inserting into posterior calcaneus
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * p.ankleX, -1.9, -0.072),
        new THREE.Vector3(side * p.ankleX, -2.1, -0.065),
        new THREE.Vector3(side * p.ankleX, p.ankleY - 0.09, -0.075),
      ],
      0.018 * p.boneScale,
      tendonMat,
      partId,
      'muscles',
      collector,
      [1.0, 0.75]
    );

    // Extensor Retinaculum of Ankle + 5 Individual Long Toe Extensor Tendons
    addLigamentBand(
      group,
      [
        new THREE.Vector3(side * (p.ankleX - 0.04), p.ankleY - 0.02, 0.04),
        new THREE.Vector3(side * (p.ankleX + 0.04), p.ankleY - 0.02, 0.04),
      ],
      0.01,
      tendonMat,
      partId,
      'muscles',
      collector
    );

    const toeXOffs = [-side * 0.038, -side * 0.018, 0, side * 0.018, side * 0.035];
    const toeLens = [0.06, 0.06, 0.052, 0.048, 0.042];
    toeXOffs.forEach((tx, idx) => {
      const ankleStart = new THREE.Vector3(side * p.ankleX, p.ankleY - 0.02, 0.04);
      const dorsumMid = new THREE.Vector3(side * p.ankleX + tx * 0.8, p.ankleY - 0.075, 0.11);
      const toeTip = new THREE.Vector3(
        side * p.ankleX + tx,
        p.ankleY - 0.105,
        0.13 + toeLens[idx] * p.boneScale
      );
      addLigamentBand(group, [ankleStart, dorsumMid, toeTip], 0.004 * p.boneScale, tendonMat, partId, 'muscles', collector, [1, 1]);
    });
  }
}

// ======================================================
// HIGH-DETAIL HUMAN VASCULAR SYSTEM: VEINS, VENOUS VALVES, PLEXUSES & FINE ARTERIOLES
// ======================================================
function buildHumanVessels(
  p: HumanProport,
  group: THREE.Group,
  partId: string,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[],
  anim: AnimationTargets
) {
  const majorArteryMat = makeMaterial(
    { color: 0xa61c24, layer: 'internal', tissue: 'vessel_artery', roughness: 0.28, clearcoat: 0.6 },
    textures,
    scientific
  );
  const fineArteryMat = makeMaterial(
    { color: 0xb82b35, layer: 'internal', tissue: 'vessel_artery', roughness: 0.3, clearcoat: 0.52 },
    textures,
    scientific
  );
  const deepVeinMat = makeMaterial(
    {
      color: 0x1b4e96,
      layer: 'internal',
      tissue: 'vessel_vein',
      roughness: 0.26,
      clearcoat: 0.58,
      emissive: 0x071a38,
      emissiveIntensity: 0.08,
    },
    textures,
    scientific
  );
  const superficialVeinMat = makeMaterial(
    {
      color: 0x1f5eb5,
      layer: 'internal',
      tissue: 'vessel_vein',
      roughness: 0.24,
      clearcoat: 0.6,
      emissive: 0x09224d,
      emissiveIntensity: 0.1,
    },
    textures,
    scientific
  );
  const fineVeinMat = makeMaterial(
    {
      color: 0x2b74d6,
      layer: 'internal',
      tissue: 'vessel_vein',
      roughness: 0.26,
      clearcoat: 0.54,
      opacity: 0.98,
      focusOpacity: 1.0,
      emissive: 0x0b295c,
      emissiveIntensity: 0.1,
    },
    textures,
    scientific
  );

  const majorArtGeos: THREE.BufferGeometry[] = [];
  const fineArtGeos: THREE.BufferGeometry[] = [];
  const deepVeinGeos: THREE.BufferGeometry[] = [];
  const superficialVeinGeos: THREE.BufferGeometry[] = [];
  const fineVeinGeos: THREE.BufferGeometry[] = [];

  const arterialCurves: THREE.CatmullRomCurve3[] = [];
  const venousCurves: THREE.CatmullRomCurve3[] = [];

  const pushArt = (
    pts: THREE.Vector3[],
    r0: number,
    r1: number,
    isFine = false,
    opts?: Parameters<typeof createVesselBranchGeo>[3]
  ) => {
    const res = createVesselBranchGeo(pts, r0, r1, opts);
    (isFine ? fineArtGeos : majorArtGeos).push(res.geometry);
    return res.curve;
  };

  const pushVein = (
    pts: THREE.Vector3[],
    r0: number,
    r1: number,
    tier: 'deep' | 'superficial' | 'fine' = 'superficial',
    opts?: Parameters<typeof createVesselBranchGeo>[3]
  ) => {
    const res = createVesselBranchGeo(pts, r0, r1, opts);
    if (tier === 'deep') {
      deepVeinGeos.push(res.geometry);
    } else if (tier === 'superficial') {
      superficialVeinGeos.push(res.geometry);
    } else {
      fineVeinGeos.push(res.geometry);
    }
    return res.curve;
  };

  // 1. CENTRAL TRUNKS: AORTIC ARCH -> ABDOMINAL AORTA; SVC -> IVC; AZYGOS & HEMIAZYGOS
  const aortaCurve = pushArt(
    [
      new THREE.Vector3(0.042, 0.78, 0.08),
      new THREE.Vector3(0.068, 0.94, 0.02),
      new THREE.Vector3(0.032, 0.82, -0.065),
      new THREE.Vector3(0.024, 0.45, -0.072),
      new THREE.Vector3(0.018, -0.05, -0.062),
      new THREE.Vector3(0.014, -0.46, -0.038),
    ],
    0.038,
    0.028,
    false,
    { tubularSegs: 28, radialSegs: 12, tortuosity: 0.004, seed: 101 }
  );
  arterialCurves.push(aortaCurve);

  const ivcCurve = pushVein(
    [
      new THREE.Vector3(-0.045, -0.46, -0.028),
      new THREE.Vector3(-0.055, -0.1, -0.045),
      new THREE.Vector3(-0.062, 0.35, -0.025),
      new THREE.Vector3(-0.058, 0.66, 0.02),
      new THREE.Vector3(-0.056, 0.88, 0.038),
    ],
    0.04,
    0.046,
    'deep',
    { tubularSegs: 26, radialSegs: 12, tortuosity: 0.004, seed: 102 }
  );
  venousCurves.push(ivcCurve);

  // Azygos (right) & Hemiazygos (left) posterior paravertebral venous trunks
  const azygosCurve = pushVein(
    [
      new THREE.Vector3(-0.048, 0.12, -0.115),
      new THREE.Vector3(-0.044, 0.48, -0.125),
      new THREE.Vector3(-0.046, 0.78, -0.075),
      new THREE.Vector3(-0.056, 0.83, 0.03),
    ],
    0.015,
    0.018,
    'deep',
    { tubularSegs: 16, radialSegs: 8, tortuosity: 0.005, seed: 103 }
  );
  const hemiazygosCurve = pushVein(
    [
      new THREE.Vector3(0.052, 0.14, -0.115),
      new THREE.Vector3(0.048, 0.44, -0.125),
      new THREE.Vector3(0.038, 0.62, -0.12),
      new THREE.Vector3(-0.042, 0.65, -0.118),
    ],
    0.013,
    0.014,
    'deep',
    { tubularSegs: 14, radialSegs: 7, tortuosity: 0.005, seed: 104 }
  );
  spawnFineVesselTree(fineVeinGeos, azygosCurve, { branchCount: 6, baseRadius: 0.0055, branchLength: 0.095, subBranches: 2, seed: 105, depth: 2 });
  spawnFineVesselTree(fineVeinGeos, hemiazygosCurve, { branchCount: 5, baseRadius: 0.005, branchLength: 0.085, subBranches: 2, seed: 106, depth: 2 });

  // 2. INTERCOSTAL RIB-HUGGING VEINS & ARTERIES
  for (let i = 0; i < 9; i++) {
    const ry = 0.85 - i * 0.064;
    const archFactor = Math.sin(((i + 1) / 11.5) * Math.PI);
    const rad = p.ribWidth + archFactor * (p.isFemale ? 0.122 : 0.15);
    const zAnt = p.isFemale ? 0.195 : 0.21;

    for (const side of [-1, 1]) {
      const icVein = pushVein(
        [
          new THREE.Vector3(side * 0.048, ry + 0.015, -0.14),
          new THREE.Vector3(side * (rad * 0.98), ry - 0.012, -0.01),
          new THREE.Vector3(side * (rad * 0.68), ry - 0.036, zAnt * 0.88),
          new THREE.Vector3(side * 0.075, ry - 0.025, zAnt),
        ],
        0.0085,
        0.0062,
        'superficial',
        { tubularSegs: 14, radialSegs: 6, tortuosity: 0.005, seed: 200 + i * 7 + side }
      );
      pushArt(
        [
          new THREE.Vector3(side * 0.028, ry + 0.008, -0.115),
          new THREE.Vector3(side * (rad * 0.92), ry - 0.02, -0.01),
          new THREE.Vector3(side * (rad * 0.62), ry - 0.044, zAnt * 0.84),
          new THREE.Vector3(side * 0.072, ry - 0.032, zAnt),
        ],
        0.0058,
        0.004,
        true,
        { tubularSegs: 12, radialSegs: 6, tortuosity: 0.004, seed: 250 + i * 7 + side }
      );
      if (i % 2 === 0) {
        spawnFineVesselTree(fineVeinGeos, icVein, {
          branchCount: 4,
          baseRadius: 0.0044,
          branchLength: 0.095,
          subBranches: 2,
          outwardBias: new THREE.Vector3(side * 0.5, -0.2, 0.35),
          tortuosity: 0.007,
          seed: 300 + i * 11 + side,
          depth: 2,
        });
      }
    }
  }

  // 3. HEPATIC PORTAL SYSTEM, SPLENIC & MESENTERIC VENOUS ARCADES
  const portalVein = pushVein(
    [
      new THREE.Vector3(-0.02, -0.14, 0.01),
      new THREE.Vector3(-0.07, -0.02, 0.03),
      new THREE.Vector3(-0.15, 0.08, 0.05),
      new THREE.Vector3(-0.26, 0.14, 0.06),
    ],
    0.021,
    0.01,
    'deep',
    { tubularSegs: 14, radialSegs: 8, tortuosity: 0.005, seed: 401 }
  );
  spawnFineVesselTree(fineVeinGeos, portalVein, {
    branchCount: 7,
    baseRadius: 0.006,
    branchLength: 0.11,
    subBranches: 2,
    outwardBias: new THREE.Vector3(-0.4, 0.25, 0.2),
    seed: 402,
    depth: 3,
  });

  const splenicVein = pushVein(
    [
      new THREE.Vector3(0.32, 0.05, -0.06),
      new THREE.Vector3(0.18, -0.04, -0.01),
      new THREE.Vector3(-0.02, -0.13, 0.01),
    ],
    0.012,
    0.015,
    'deep',
    { tubularSegs: 14, radialSegs: 7, tortuosity: 0.009, seed: 403 }
  );
  spawnFineVesselTree(fineVeinGeos, splenicVein, {
    branchCount: 5,
    baseRadius: 0.0048,
    branchLength: 0.09,
    subBranches: 2,
    seed: 404,
    depth: 2,
  });

  const smvCurve = pushVein(
    [
      new THREE.Vector3(-0.02, -0.14, 0.01),
      new THREE.Vector3(-0.04, -0.34, 0.045),
      new THREE.Vector3(-0.08, -0.52, 0.065),
    ],
    0.016,
    0.009,
    'deep',
    { tubularSegs: 14, radialSegs: 8, tortuosity: 0.006, seed: 405 }
  );
  const smaCurve = pushArt(
    [
      new THREE.Vector3(0.018, -0.12, -0.045),
      new THREE.Vector3(0.01, -0.32, 0.03),
      new THREE.Vector3(0.03, -0.52, 0.06),
    ],
    0.014,
    0.007,
    false,
    { tubularSegs: 14, radialSegs: 8, tortuosity: 0.006, seed: 406 }
  );
  spawnFineVesselTree(fineVeinGeos, smvCurve, {
    branchCount: 9,
    baseRadius: 0.0052,
    branchLength: 0.16,
    subBranches: 3,
    outwardBias: new THREE.Vector3(0, -0.25, 0.55),
    spreadAxis: [1.4, 0.7, 0.5],
    tortuosity: 0.01,
    seed: 407,
    depth: 3,
  });
  spawnFineVesselTree(fineArtGeos, smaCurve, {
    branchCount: 8,
    baseRadius: 0.0042,
    branchLength: 0.14,
    subBranches: 2,
    outwardBias: new THREE.Vector3(0, -0.2, 0.5),
    spreadAxis: [1.3, 0.7, 0.5],
    tortuosity: 0.009,
    seed: 408,
    depth: 3,
  });

  // 4. PULMONARY VESSELS
  for (const side of [-1, 1]) {
    const pulmArt = pushArt(
      [
        new THREE.Vector3(0.01, 0.78, 0.07),
        new THREE.Vector3(side * 0.14, 0.76, 0.02),
        new THREE.Vector3(side * 0.28, 0.74, -0.04),
      ],
      0.018,
      0.008,
      false,
      { tubularSegs: 12, radialSegs: 8, tortuosity: 0.005, seed: 420 + side }
    );
    const pulmVein = pushVein(
      [
        new THREE.Vector3(side * 0.28, 0.67, -0.02),
        new THREE.Vector3(side * 0.15, 0.68, 0.03),
        new THREE.Vector3(0.01, 0.71, 0.06),
      ],
      0.008,
      0.018,
      'deep',
      { tubularSegs: 12, radialSegs: 8, tortuosity: 0.005, seed: 430 + side }
    );
    spawnFineVesselTree(fineVeinGeos, pulmVein, {
      branchCount: 6,
      baseRadius: 0.0052,
      branchLength: 0.125,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.5, 0.1, -0.15),
      seed: 440 + side,
      depth: 3,
    });
    spawnFineVesselTree(fineArtGeos, pulmArt, {
      branchCount: 5,
      baseRadius: 0.0044,
      branchLength: 0.11,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.5, 0.1, -0.15),
      seed: 450 + side,
      depth: 2,
    });
  }

  // 5. SUPERFICIAL CRANIAL CROWN / SUPERIOR SAGITTAL SINUS ARCHING OVER HEAD
  const sc = p.skullScale;
  const sagittalSinus = pushVein(
    [
      new THREE.Vector3(0, p.skullY + 0.02, 0.295 * sc),
      new THREE.Vector3(0, p.skullY + 0.295 * sc, 0.15 * sc),
      new THREE.Vector3(0, p.skullY + 0.305 * sc, -0.05 * sc),
      new THREE.Vector3(0, p.skullY + 0.1 * sc, -0.3 * sc),
    ],
    0.007,
    0.014,
    'superficial',
    { tubularSegs: 20, radialSegs: 8, tortuosity: 0.005, seed: 501 }
  );
  spawnFineVesselTree(fineVeinGeos, sagittalSinus, {
    branchCount: 12,
    baseRadius: 0.005,
    branchLength: 0.13,
    subBranches: 2,
    outwardBias: new THREE.Vector3(0, -0.18, 0),
    spreadAxis: [1.5, 0.85, 0.85],
    tortuosity: 0.012,
    seed: 502,
    depth: 3,
  });

  // 6. BILATERAL SYSTEMS EXTENDING CONTINUOUSLY FROM HEAD TO FINGERS & TOES
  for (const side of [-1, 1]) {
    // --- A. CRANIAL SCALP, TEMPORAL, FRONTAL, OCCIPITAL, FACIAL & JUGULAR VEINS ---
    const brachioVein = pushVein(
      [
        new THREE.Vector3(side * 0.11, 0.94, 0.03),
        new THREE.Vector3(-0.04, 0.89, 0.04),
        new THREE.Vector3(-0.056, 0.86, 0.038),
      ],
      0.023,
      0.028,
      'deep',
      { tubularSegs: 10, radialSegs: 8, tortuosity: 0.003, seed: 510 + side }
    );
    venousCurves.push(brachioVein);

    const carotid = pushArt(
      [
        new THREE.Vector3(side * 0.038, 0.9, 0.035),
        new THREE.Vector3(side * 0.072, 1.18, 0.03),
        new THREE.Vector3(side * 0.088, 1.44, 0.02),
        new THREE.Vector3(side * 0.098, p.skullY - 0.06, 0.015),
      ],
      0.018,
      0.011,
      false,
      { tubularSegs: 20, radialSegs: 8, tortuosity: 0.005, seed: 520 + side }
    );
    arterialCurves.push(carotid);

    // Internal Jugular Vein (thick deep neck trunk)
    const intJugular = pushVein(
      [
        new THREE.Vector3(side * 0.112, p.skullY - 0.08, -0.01),
        new THREE.Vector3(side * 0.105, 1.38, 0.018),
        new THREE.Vector3(side * 0.095, 1.14, 0.032),
        new THREE.Vector3(side * 0.108, 0.94, 0.035),
      ],
      0.015,
      0.023,
      'superficial',
      { tubularSegs: 20, radialSegs: 8, tortuosity: 0.006, valveCount: 2, seed: 530 + side }
    );
    venousCurves.push(intJugular);

    // External Jugular Vein (prominent lateral neck vein draining scalp & face down to subclavian)
    const extJugular = pushVein(
      [
        new THREE.Vector3(side * 0.185 * sc, p.skullY - 0.18, 0.03),
        new THREE.Vector3(side * 0.145, 1.26, 0.065),
        new THREE.Vector3(side * 0.15, 1.05, 0.072),
        new THREE.Vector3(side * 0.185, 0.93, 0.048),
      ],
      0.0105,
      0.0145,
      'superficial',
      { tubularSegs: 16, radialSegs: 8, tortuosity: 0.008, valveCount: 2, seed: 540 + side }
    );
    venousCurves.push(extJugular);
    spawnFineVesselTree(fineVeinGeos, extJugular, {
      branchCount: 6,
      baseRadius: 0.0046,
      branchLength: 0.08,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.4, 0.1, 0.45),
      seed: 545 + side,
      depth: 2,
    });

    // Anterior Jugular Vein (front of neck down to suprasternal arch)
    pushVein(
      [
        new THREE.Vector3(side * 0.04 * sc, p.skullY - 0.3, 0.15 * sc),
        new THREE.Vector3(side * 0.045, 1.22, 0.1),
        new THREE.Vector3(side * 0.06, 0.98, 0.11),
        new THREE.Vector3(side * 0.15, 0.93, 0.065),
      ],
      0.0055,
      0.0085,
      'superficial',
      { tubularSegs: 14, radialSegs: 6, tortuosity: 0.006, seed: 548 + side }
    );

    // Superficial Temporal + Parietal Scalp Vein (crown of skull -> temple -> external jugular)
    const supTempVein = pushVein(
      [
        new THREE.Vector3(side * 0.045 * sc, p.skullY + 0.285 * sc, 0.02 * sc),
        new THREE.Vector3(side * 0.22 * sc, p.skullY + 0.18 * sc, 0.04 * sc),
        new THREE.Vector3(side * 0.262 * sc, p.skullY - 0.02, 0.04 * sc),
        new THREE.Vector3(side * 0.185 * sc, p.skullY - 0.18, 0.03),
      ],
      0.0048,
      0.011,
      'superficial',
      { tubularSegs: 18, radialSegs: 7, tortuosity: 0.012, seed: 560 + side }
    );
    const supTempArt = pushArt(
      [
        new THREE.Vector3(side * 0.125 * sc, p.skullY - 0.18, 0.025),
        new THREE.Vector3(side * 0.225 * sc, p.skullY - 0.02, 0.045),
        new THREE.Vector3(side * 0.18 * sc, p.skullY + 0.17, 0.02),
      ],
      0.0068,
      0.0032,
      true,
      { tubularSegs: 14, radialSegs: 6, tortuosity: 0.01, seed: 565 + side }
    );
    spawnFineVesselTree(fineVeinGeos, supTempVein, {
      branchCount: 10,
      baseRadius: 0.0046,
      branchLength: 0.1,
      subBranches: 3,
      outwardBias: new THREE.Vector3(side * 0.45, 0.35, 0.25),
      tortuosity: 0.012,
      seed: 570 + side,
      depth: 3,
    });
    spawnFineVesselTree(fineArtGeos, supTempArt, {
      branchCount: 6,
      baseRadius: 0.0032,
      branchLength: 0.08,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.4, 0.3, 0.2),
      tortuosity: 0.01,
      seed: 575 + side,
      depth: 2,
    });

    // Frontal, Supraorbital, Angular & Facial Veins (forehead & face -> neck)
    const facialVein = pushVein(
      [
        new THREE.Vector3(side * 0.038 * sc, p.skullY + 0.24 * sc, 0.165 * sc),
        new THREE.Vector3(side * 0.056 * sc, p.skullY + 0.03, 0.278 * sc),
        new THREE.Vector3(side * 0.092 * sc, p.skullY - 0.1, 0.235 * sc),
        new THREE.Vector3(side * 0.145 * sc, p.skullY - 0.22, 0.145 * sc),
        new THREE.Vector3(side * 0.115, 1.38, 0.03),
      ],
      0.0044,
      0.0105,
      'superficial',
      { tubularSegs: 18, radialSegs: 7, tortuosity: 0.01, seed: 580 + side }
    );
    spawnFineVesselTree(fineVeinGeos, facialVein, {
      branchCount: 8,
      baseRadius: 0.0042,
      branchLength: 0.072,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.3, 0.1, 0.6),
      tortuosity: 0.009,
      seed: 585 + side,
      depth: 3,
    });

    // Occipital & Posterior Auricular Scalp Veins (back of skull -> neck)
    const occipVein = pushVein(
      [
        new THREE.Vector3(side * 0.065 * sc, p.skullY + 0.23 * sc, -0.2 * sc),
        new THREE.Vector3(side * 0.14 * sc, p.skullY + 0.04, -0.275 * sc),
        new THREE.Vector3(side * 0.155 * sc, p.skullY - 0.18, -0.145 * sc),
        new THREE.Vector3(side * 0.145, 1.26, 0.05),
      ],
      0.0044,
      0.0092,
      'superficial',
      { tubularSegs: 16, radialSegs: 6, tortuosity: 0.01, seed: 590 + side }
    );
    spawnFineVesselTree(fineVeinGeos, occipVein, {
      branchCount: 7,
      baseRadius: 0.0042,
      branchLength: 0.085,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.35, 0.1, -0.55),
      seed: 595 + side,
      depth: 2,
    });

    // --- B. CONTINUOUS SUPERFICIAL TORSO VEINS (THORACOEPIGASTRIC, INTERNAL THORACIC & SUPERFICIAL EPIGASTRIC) ---
    // Links axillary vein down the lateral ribcage & abdomen directly into the femoral/saphenous junction!
    const thoracoEpigastricVein = pushVein(
      [
        new THREE.Vector3(side * p.shoulderX * 0.72, 0.82, 0.06),
        new THREE.Vector3(side * (p.ribWidth + 0.12), 0.52, 0.145),
        new THREE.Vector3(side * (p.ribWidth + 0.08), 0.18, 0.175),
        new THREE.Vector3(side * (p.isFemale ? 0.26 : 0.3), -0.22, 0.175),
        new THREE.Vector3(side * (p.hipX + 0.015), -0.68, 0.095),
      ],
      0.0105,
      0.0095,
      'superficial',
      { tubularSegs: 24, radialSegs: 8, tortuosity: 0.012, valveCount: 5, seed: 600 + side }
    );
    venousCurves.push(thoracoEpigastricVein);
    spawnFineVesselTree(fineVeinGeos, thoracoEpigastricVein, {
      branchCount: 12,
      baseRadius: 0.0048,
      branchLength: 0.125,
      subBranches: 3,
      outwardBias: new THREE.Vector3(side * 0.4, -0.1, 0.55),
      spreadAxis: [1.1, 0.85, 0.7],
      tortuosity: 0.01,
      seed: 602 + side,
      depth: 3,
    });

    // Anterior Pectoral -> Superficial Epigastric Vein (front of chest & abdomen -> groin)
    const antTorsoVein = pushVein(
      [
        new THREE.Vector3(side * 0.1, 0.92, 0.08),
        new THREE.Vector3(side * 0.115, 0.68, p.isFemale ? 0.24 : 0.245),
        new THREE.Vector3(side * 0.095, 0.26, 0.225),
        new THREE.Vector3(side * 0.115, -0.22, 0.215),
        new THREE.Vector3(side * (p.hipX - 0.01), -0.72, 0.085),
      ],
      0.0088,
      0.0095,
      'superficial',
      { tubularSegs: 22, radialSegs: 7, tortuosity: 0.011, valveCount: 4, seed: 606 + side }
    );
    spawnFineVesselTree(fineVeinGeos, antTorsoVein, {
      branchCount: 10,
      baseRadius: 0.0045,
      branchLength: 0.115,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.35, -0.15, 0.6),
      tortuosity: 0.01,
      seed: 608 + side,
      depth: 3,
    });

    if (p.isFemale) {
      const mammaryArt = pushArt(
        [
          new THREE.Vector3(side * 0.06, 0.88, 0.05),
          new THREE.Vector3(side * 0.16, 0.72, 0.15),
          new THREE.Vector3(side * 0.185, 0.57, 0.23),
        ],
        0.011,
        0.005,
        true,
        { tubularSegs: 12, radialSegs: 7, tortuosity: 0.006, seed: 610 + side }
      );
      arterialCurves.push(mammaryArt);
      spawnFineVesselTree(fineArtGeos, mammaryArt, {
        branchCount: 5,
        baseRadius: 0.0036,
        branchLength: 0.075,
        subBranches: 2,
        outwardBias: new THREE.Vector3(side * 0.25, -0.2, 0.6),
        seed: 612 + side,
        depth: 2,
      });

      const uterineArt = pushArt(
        [
          new THREE.Vector3(side * 0.09, -0.58, -0.02),
          new THREE.Vector3(side * 0.18, -0.66, 0.01),
          new THREE.Vector3(side * 0.1, -0.62, 0.06),
        ],
        0.01,
        0.005,
        true,
        { tubularSegs: 12, radialSegs: 7, tortuosity: 0.009, seed: 620 + side }
      );
      const uterineVein = pushVein(
        [
          new THREE.Vector3(side * 0.1, -0.64, 0.06),
          new THREE.Vector3(side * 0.19, -0.65, 0.0),
          new THREE.Vector3(side * 0.12, -0.55, -0.02),
        ],
        0.007,
        0.012,
        'deep',
        { tubularSegs: 12, radialSegs: 7, tortuosity: 0.01, seed: 625 + side }
      );
      arterialCurves.push(uterineArt);
      spawnFineVesselTree(fineVeinGeos, uterineVein, {
        branchCount: 5,
        baseRadius: 0.0038,
        branchLength: 0.07,
        subBranches: 2,
        seed: 628 + side,
        depth: 2,
      });
    }

    // --- C. RENAL VESSELS ---
    const renalArt = pushArt(
      [
        new THREE.Vector3(0.018, -0.34, -0.06),
        new THREE.Vector3(side * 0.13, -0.35, -0.11),
        new THREE.Vector3(side * 0.22, -0.36, -0.14),
      ],
      0.014,
      0.008,
      false,
      { tubularSegs: 10, radialSegs: 7, tortuosity: 0.004, seed: 630 + side }
    );
    const renalVein = pushVein(
      [
        new THREE.Vector3(side * 0.22, -0.38, -0.12),
        new THREE.Vector3(side * 0.11, -0.37, -0.08),
        new THREE.Vector3(-0.055, -0.36, -0.04),
      ],
      0.009,
      0.016,
      'deep',
      { tubularSegs: 10, radialSegs: 7, tortuosity: 0.004, seed: 635 + side }
    );
    spawnFineVesselTree(fineVeinGeos, renalVein, {
      branchCount: 4,
      baseRadius: 0.0044,
      branchLength: 0.075,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.6, 0.1, -0.2),
      tRange: [0.05, 0.45],
      seed: 638 + side,
      depth: 2,
    });
    spawnFineVesselTree(fineArtGeos, renalArt, {
      branchCount: 4,
      baseRadius: 0.0036,
      branchLength: 0.06,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.6, 0.1, -0.2),
      tRange: [0.55, 0.95],
      seed: 640 + side,
      depth: 2,
    });

    // --- D. UPPER LIMB: SUBCLAVIAN/AXILLARY/BRACHIAL, CEPHALIC, BASILIC, MEDIAN CUBITAL, HAND & 5 FINGERS ---
    const wristMid = new THREE.Vector3(side * p.wristX, p.wristY, 0.08);
    const armArt = pushArt(
      [
        new THREE.Vector3(side * 0.045, 0.9, 0.03),
        new THREE.Vector3(side * p.shoulderX * 0.78, 0.87, 0.0),
        new THREE.Vector3(side * (p.shoulderX + 0.01), 0.72, 0.01),
        new THREE.Vector3(side * (p.elbowX - 0.01), 0.24, 0.005),
        new THREE.Vector3(side * (p.wristX - 0.015), p.wristY - 0.01, 0.065),
      ],
      0.017,
      0.0085,
      false,
      { tubularSegs: 24, radialSegs: 8, tortuosity: 0.006, seed: 700 + side }
    );
    arterialCurves.push(armArt);

    pushArt(
      [
        new THREE.Vector3(side * (p.elbowX - 0.005), 0.2, 0.01),
        new THREE.Vector3(side * ((p.elbowX + p.wristX) * 0.5 + side * 0.018), -0.02, 0.055),
        new THREE.Vector3(side * (p.wristX + 0.018), p.wristY - 0.01, 0.098),
      ],
      0.0082,
      0.0055,
      true,
      { tubularSegs: 14, radialSegs: 6, tortuosity: 0.005, seed: 704 + side }
    );

    // Deep Subclavian -> Axillary -> Brachial Vein
    const deepArmVein = pushVein(
      [
        new THREE.Vector3(side * (p.wristX - 0.015), p.wristY - 0.01, 0.072),
        new THREE.Vector3(side * (p.elbowX - 0.012), 0.24, -0.005),
        new THREE.Vector3(side * p.shoulderX * 0.94, 0.74, 0.015),
        new THREE.Vector3(side * p.shoulderX * 0.72, 0.86, 0.018),
        new THREE.Vector3(side * 0.11, 0.94, 0.03),
      ],
      0.009,
      0.021,
      'deep',
      { tubularSegs: 24, radialSegs: 8, tortuosity: 0.006, valveCount: 4, seed: 710 + side }
    );
    venousCurves.push(deepArmVein);

    // Superficial CEPHALIC Vein (prominent lateral shoulder/arm/forearm -> dorsal thumb side, with valves!)
    const cephalicVein = pushVein(
      [
        new THREE.Vector3(side * (p.wristX + 0.036), p.wristY - 0.06, 0.128),
        new THREE.Vector3(side * (p.wristX + 0.044), p.wristY + 0.02, 0.115),
        new THREE.Vector3(side * (p.elbowX + 0.074), 0.23, 0.062),
        new THREE.Vector3(side * (p.shoulderX + 0.082), 0.62, 0.062),
        new THREE.Vector3(side * (p.shoulderX - 0.02), 0.87, 0.075),
        new THREE.Vector3(side * (p.shoulderX * 0.65), 0.89, 0.04),
      ],
      0.0085,
      0.0155,
      'superficial',
      { tubularSegs: 26, radialSegs: 8, tortuosity: 0.01, valveCount: 5, seed: 720 + side }
    );
    venousCurves.push(cephalicVein);
    spawnFineVesselTree(fineVeinGeos, cephalicVein, {
      branchCount: 12,
      baseRadius: 0.005,
      branchLength: 0.1,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.45, -0.2, 0.45),
      tortuosity: 0.01,
      seed: 725 + side,
      depth: 3,
    });

    // Superficial BASILIC Vein (medial forearm/arm with valves)
    const basilicVein = pushVein(
      [
        new THREE.Vector3(side * (p.wristX - 0.032), p.wristY - 0.06, 0.072),
        new THREE.Vector3(side * (p.wristX - 0.04), p.wristY + 0.03, 0.062),
        new THREE.Vector3(side * (p.elbowX - 0.064), 0.22, 0.038),
        new THREE.Vector3(side * (p.shoulderX - 0.028), 0.56, 0.042),
        new THREE.Vector3(side * (p.shoulderX * 0.88), 0.74, 0.035),
      ],
      0.0078,
      0.014,
      'superficial',
      { tubularSegs: 22, radialSegs: 7, tortuosity: 0.009, valveCount: 4, seed: 730 + side }
    );
    spawnFineVesselTree(fineVeinGeos, basilicVein, {
      branchCount: 10,
      baseRadius: 0.0046,
      branchLength: 0.088,
      subBranches: 2,
      outwardBias: new THREE.Vector3(-side * 0.3, -0.2, 0.45),
      tortuosity: 0.009,
      seed: 735 + side,
      depth: 2,
    });

    // Median Cubital & Median Antebrachial Veins (anterior forearm & elbow Y-bridge)
    const medianCubital = pushVein(
      [
        new THREE.Vector3(side * (p.elbowX + 0.068), 0.19, 0.064),
        new THREE.Vector3(side * p.elbowX, 0.24, 0.066),
        new THREE.Vector3(side * (p.elbowX - 0.06), 0.27, 0.045),
      ],
      0.0092,
      0.0098,
      'superficial',
      { tubularSegs: 10, radialSegs: 7, tortuosity: 0.005, seed: 740 + side }
    );
    const medianAntebrach = pushVein(
      [
        new THREE.Vector3(side * p.wristX, p.wristY - 0.02, 0.125),
        new THREE.Vector3(side * ((p.elbowX + p.wristX) * 0.5), -0.04, 0.098),
        new THREE.Vector3(side * p.elbowX, 0.23, 0.065),
      ],
      0.0068,
      0.0085,
      'superficial',
      { tubularSegs: 14, radialSegs: 7, tortuosity: 0.008, seed: 745 + side }
    );
    spawnFineVesselTree(fineVeinGeos, medianAntebrach, {
      branchCount: 7,
      baseRadius: 0.0042,
      branchLength: 0.068,
      subBranches: 2,
      outwardBias: new THREE.Vector3(0, -0.1, 0.55),
      seed: 748 + side,
      depth: 2,
    });
    spawnFineVesselTree(fineVeinGeos, medianCubital, {
      branchCount: 4,
      baseRadius: 0.0038,
      branchLength: 0.055,
      subBranches: 1,
      seed: 749 + side,
      depth: 2,
    });

    // Dorsal Venous Network of the Hand + Palmar Arterial Arch + 5 Individual Finger Vessels
    pushArt(
      [
        new THREE.Vector3(side * (p.wristX - 0.012), p.wristY - 0.04, 0.065),
        new THREE.Vector3(side * p.wristX, p.wristY - 0.09, 0.088),
        new THREE.Vector3(side * (p.wristX + 0.015), p.wristY - 0.04, 0.108),
      ],
      0.006,
      0.0055,
      true,
      { tubularSegs: 10, radialSegs: 6, tortuosity: 0.003, seed: 750 + side }
    );
    const dorsalHandArch = pushVein(
      [
        new THREE.Vector3(side * (p.wristX + 0.028), p.wristY - 0.055, 0.12),
        new THREE.Vector3(side * (p.wristX + 0.022), p.wristY - 0.105, 0.095),
        new THREE.Vector3(side * (p.wristX + 0.006), p.wristY - 0.102, 0.066),
        new THREE.Vector3(side * (p.wristX - 0.02), p.wristY - 0.055, 0.062),
      ],
      0.0072,
      0.0068,
      'superficial',
      { tubularSegs: 14, radialSegs: 7, tortuosity: 0.004, seed: 752 + side }
    );
    spawnFineVesselTree(fineVeinGeos, dorsalHandArch, {
      branchCount: 6,
      baseRadius: 0.0034,
      branchLength: 0.045,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.5, -0.3, 0.25),
      seed: 754 + side,
      depth: 2,
    });

    const fingerVesselSpecs = [
      { zOff: 0.044, xSpread: -side * 0.018, splayZ: 0.022, len: 0.095 },
      { zOff: 0.026, xSpread: 0, splayZ: 0.008, len: 0.135 },
      { zOff: 0.008, xSpread: 0, splayZ: 0.0, len: 0.148 },
      { zOff: -0.01, xSpread: 0, splayZ: -0.007, len: 0.136 },
      { zOff: -0.027, xSpread: 0, splayZ: -0.015, len: 0.114 },
    ];
    fingerVesselSpecs.forEach((f, idx) => {
      const fBase = new THREE.Vector3(
        wristMid.x + side * 0.016 + f.xSpread * 0.4,
        wristMid.y - 0.088,
        wristMid.z + f.zOff * p.boneScale
      );
      const fMid = new THREE.Vector3(
        fBase.x + f.xSpread * 0.5,
        fBase.y - f.len * 0.48 * p.boneScale,
        fBase.z + f.splayZ * 0.65
      );
      const fTip = new THREE.Vector3(
        fBase.x + (idx === 0 ? -side * 0.022 : -side * 0.012),
        fBase.y - f.len * p.boneScale,
        fBase.z + f.splayZ * 1.15
      );
      pushVein(
        [
          new THREE.Vector3(wristMid.x + side * 0.02, wristMid.y - 0.055, wristMid.z + f.zOff * 0.72),
          fBase,
          fMid,
          fTip,
        ],
        0.0046,
        0.0022,
        'fine',
        { tubularSegs: 10, radialSegs: 5, tortuosity: 0.003, seed: 760 + idx * 5 + side }
      );
      pushArt(
        [
          new THREE.Vector3(wristMid.x - side * 0.004, wristMid.y - 0.082, wristMid.z + f.zOff * 0.72),
          fBase.clone().add(new THREE.Vector3(-side * 0.01, 0, -0.003)),
          fTip.clone().add(new THREE.Vector3(-side * 0.006, 0.004, -0.002)),
        ],
        0.0028,
        0.0014,
        true,
        { tubularSegs: 8, radialSegs: 5, tortuosity: 0.0025, seed: 780 + idx * 5 + side }
      );
    });

    // --- E. LOWER LIMB: ILIAC, FEMORAL, GREAT & SMALL SAPHENOUS, ANTERIOR THIGH/SHIN, DORSAL PEDAL ARCH & 5 TOES ---
    const legArt = pushArt(
      [
        new THREE.Vector3(0.014, -0.46, -0.038),
        new THREE.Vector3(side * (p.hipX * 0.78), -0.66, 0.025),
        new THREE.Vector3(side * p.hipX, -0.82, 0.032),
        new THREE.Vector3(side * (p.kneeX - 0.018), -1.48, -0.012),
        new THREE.Vector3(side * (p.ankleX - 0.008), p.ankleY, 0.015),
        new THREE.Vector3(side * p.ankleX, p.ankleY - 0.08, 0.13),
      ],
      0.024,
      0.008,
      false,
      { tubularSegs: 30, radialSegs: 9, tortuosity: 0.006, seed: 800 + side }
    );
    arterialCurves.push(legArt);

    const profundaArt = pushArt(
      [
        new THREE.Vector3(side * (p.hipX + 0.01), -0.82, 0.028),
        new THREE.Vector3(side * (p.hipX + 0.045), -1.04, 0.01),
        new THREE.Vector3(side * (p.kneeX + 0.025), -1.28, -0.01),
      ],
      0.012,
      0.0045,
      true,
      { tubularSegs: 12, radialSegs: 6, tortuosity: 0.005, seed: 804 + side }
    );
    spawnFineVesselTree(fineArtGeos, profundaArt, {
      branchCount: 6,
      baseRadius: 0.004,
      branchLength: 0.095,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.4, -0.2, 0.3),
      seed: 806 + side,
      depth: 2,
    });

    // Deep Iliac -> Femoral -> Popliteal -> Tibial Vein
    const deepLegVein = pushVein(
      [
        new THREE.Vector3(side * (p.ankleX - 0.018), p.ankleY - 0.05, 0.045),
        new THREE.Vector3(side * (p.ankleX - 0.01), p.ankleY, 0.02),
        new THREE.Vector3(side * (p.kneeX - 0.012), -1.48, -0.025),
        new THREE.Vector3(side * (p.hipX - 0.022), -0.82, 0.068),
        new THREE.Vector3(side * (p.hipX * 0.72), -0.66, 0.035),
        new THREE.Vector3(-0.045, -0.46, -0.028),
      ],
      0.01,
      0.026,
      'deep',
      { tubularSegs: 30, radialSegs: 9, tortuosity: 0.006, valveCount: 5, seed: 810 + side }
    );
    venousCurves.push(deepLegVein);

    // GREAT SAPHENOUS VEIN (bold medial superficial trunk from medial foot up shin, knee, and thigh with valves!)
    const greatSaphenous = pushVein(
      [
        new THREE.Vector3(side * (p.ankleX - 0.065 * p.boneScale), p.ankleY - 0.08, 0.105),
        new THREE.Vector3(side * (p.ankleX - 0.068 * p.boneScale), p.ankleY - 0.01, 0.065),
        new THREE.Vector3(side * (p.kneeX - 0.092), -1.48, 0.065),
        new THREE.Vector3(side * (p.hipX - 0.062), -1.12, 0.115),
        new THREE.Vector3(side * (p.hipX - 0.022), -0.8, 0.105),
        new THREE.Vector3(side * (p.hipX + 0.012), -0.72, 0.082),
      ],
      0.0095,
      0.0175,
      'superficial',
      { tubularSegs: 32, radialSegs: 8, tortuosity: 0.011, valveCount: 7, seed: 820 + side }
    );
    venousCurves.push(greatSaphenous);
    spawnFineVesselTree(fineVeinGeos, greatSaphenous, {
      branchCount: 16,
      baseRadius: 0.0056,
      branchLength: 0.14,
      subBranches: 3,
      outwardBias: new THREE.Vector3(side * 0.3, -0.15, 0.65),
      spreadAxis: [1.15, 0.85, 0.75],
      tortuosity: 0.012,
      seed: 825 + side,
      depth: 3,
    });

    // SMALL SAPHENOUS VEIN (posterior calf curving visibly over gastrocnemius & Achilles)
    const smallSaphenous = pushVein(
      [
        new THREE.Vector3(side * (p.ankleX + 0.055 * p.boneScale), p.ankleY - 0.08, 0.075),
        new THREE.Vector3(side * (p.ankleX + 0.052 * p.boneScale), p.ankleY - 0.03, -0.062),
        new THREE.Vector3(side * p.ankleX, -1.96, -0.115),
        new THREE.Vector3(side * p.kneeX, -1.68, -0.12),
        new THREE.Vector3(side * (p.kneeX + 0.005), -1.48, -0.035),
      ],
      0.0075,
      0.0125,
      'superficial',
      { tubularSegs: 20, radialSegs: 8, tortuosity: 0.009, valveCount: 4, seed: 830 + side }
    );
    spawnFineVesselTree(fineVeinGeos, smallSaphenous, {
      branchCount: 9,
      baseRadius: 0.0046,
      branchLength: 0.11,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.25, -0.15, -0.6),
      tortuosity: 0.01,
      seed: 835 + side,
      depth: 2,
    });

    // Anterior Accessory Saphenous & Lateral Thigh Cutaneous Vein (sweeps visibly across front/outer quadriceps)
    const latThighVein = pushVein(
      [
        new THREE.Vector3(side * (p.kneeX + 0.092), -1.46, 0.092),
        new THREE.Vector3(side * (p.kneeX + 0.095), -1.14, 0.125),
        new THREE.Vector3(side * (p.hipX + 0.098), -0.88, 0.115),
        new THREE.Vector3(side * (p.hipX + 0.018), -0.74, 0.088),
      ],
      0.0068,
      0.0115,
      'superficial',
      { tubularSegs: 16, radialSegs: 7, tortuosity: 0.011, valveCount: 4, seed: 840 + side }
    );
    spawnFineVesselTree(fineVeinGeos, latThighVein, {
      branchCount: 10,
      baseRadius: 0.0046,
      branchLength: 0.115,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.45, -0.2, 0.55),
      tortuosity: 0.01,
      seed: 845 + side,
      depth: 3,
    });

    // Anterior Tibial / Shin Superficial Vein (sweeping front of shin & lateral calf down to foot!)
    const antTibVein = pushVein(
      [
        new THREE.Vector3(side * p.ankleX, p.ankleY - 0.04, 0.082),
        new THREE.Vector3(side * (p.ankleX + 0.038), -1.86, 0.095),
        new THREE.Vector3(side * (p.kneeX + 0.036), -1.55, 0.098),
        new THREE.Vector3(side * (p.kneeX + 0.014), -1.46, 0.068),
      ],
      0.0066,
      0.01,
      'superficial',
      { tubularSegs: 16, radialSegs: 7, tortuosity: 0.009, valveCount: 3, seed: 850 + side }
    );
    spawnFineVesselTree(fineVeinGeos, antTibVein, {
      branchCount: 8,
      baseRadius: 0.0042,
      branchLength: 0.09,
      subBranches: 2,
      outwardBias: new THREE.Vector3(side * 0.35, -0.15, 0.58),
      seed: 855 + side,
      depth: 2,
    });

    // DORSAL VENOUS ARCH OF THE FOOT + 5 METATARSAL & TOE DIGITAL VEINS
    const dorsalFootArch = pushVein(
      [
        new THREE.Vector3(side * (p.ankleX - 0.04 * p.boneScale), p.ankleY - 0.08, 0.1),
        new THREE.Vector3(side * (p.ankleX - 0.022 * p.boneScale), p.ankleY - 0.092, 0.142),
        new THREE.Vector3(side * (p.ankleX + 0.018 * p.boneScale), p.ankleY - 0.092, 0.136),
        new THREE.Vector3(side * (p.ankleX + 0.04 * p.boneScale), p.ankleY - 0.08, 0.08),
      ],
      0.0078,
      0.0072,
      'superficial',
      { tubularSegs: 14, radialSegs: 7, tortuosity: 0.004, seed: 860 + side }
    );
    spawnFineVesselTree(fineVeinGeos, dorsalFootArch, {
      branchCount: 5,
      baseRadius: 0.0034,
      branchLength: 0.042,
      subBranches: 2,
      outwardBias: new THREE.Vector3(0, 0.25, 0.65),
      seed: 862 + side,
      depth: 2,
    });

    const toeXOffs = [-side * 0.038, -side * 0.018, 0, side * 0.018, side * 0.035];
    const toeLens = [0.064, 0.062, 0.056, 0.05, 0.044];
    toeXOffs.forEach((tx, idx) => {
      const mBase = new THREE.Vector3(side * p.ankleX + tx * 0.72, p.ankleY - 0.086, 0.105);
      const mArch = new THREE.Vector3(side * p.ankleX + tx, p.ankleY - 0.098, 0.138);
      const tEnd = new THREE.Vector3(
        side * p.ankleX + tx,
        p.ankleY - 0.104,
        0.138 + toeLens[idx] * p.boneScale
      );
      pushVein(
        [mBase, mArch, tEnd],
        0.0044,
        0.002,
        'fine',
        { tubularSegs: 8, radialSegs: 5, tortuosity: 0.0025, seed: 870 + idx * 5 + side }
      );
      pushArt(
        [mBase.clone().add(new THREE.Vector3(0, -0.006, 0)), mArch.clone().add(new THREE.Vector3(0, -0.005, 0)), tEnd.clone().add(new THREE.Vector3(0, -0.004, 0))],
        0.0026,
        0.0014,
        true,
        { tubularSegs: 7, radialSegs: 5, tortuosity: 0.002, seed: 890 + idx * 5 + side }
      );
    });
  }

  // Merge each vascular tier into crisp low-draw-call meshes;
  // superficial & fine cutaneous veins render at order 6 (above semi-transparent muscles at order 5, below skin at order 8)
  const mergedMajorArt = mergeVesselGeometries(majorArtGeos);
  if (mergedMajorArt) addMesh(group, mergedMajorArt, majorArteryMat, partId, 'internal', collector, 1);

  const mergedFineArt = mergeVesselGeometries(fineArtGeos);
  if (mergedFineArt) addMesh(group, mergedFineArt, fineArteryMat, partId, 'internal', collector, 1);

  const mergedDeepVein = mergeVesselGeometries(deepVeinGeos);
  if (mergedDeepVein) addMesh(group, mergedDeepVein, deepVeinMat, partId, 'internal', collector, 2);

  const mergedSuperficialVein = mergeVesselGeometries(superficialVeinGeos);
  if (mergedSuperficialVein) addMesh(group, mergedSuperficialVein, superficialVeinMat, partId, 'internal', collector, 6);

  const mergedFineVein = mergeVesselGeometries(fineVeinGeos);
  if (mergedFineVein) addMesh(group, mergedFineVein, fineVeinMat, partId, 'internal', collector, 6);

  addFlowStream(group, arterialCurves, 108, 0xd42c36, 0.25, 0.017, partId, 'internal', collector, anim);
  addFlowStream(group, venousCurves, 128, 0x3f84e5, 0.2, 0.018, partId, 'internal', collector, anim);
}

// ======================================================
// MASTER HUMAN PART DISPATCHER (MALE & FEMALE)
// ======================================================
export function buildRealisticHumanPart(
  isFemale: boolean,
  partId: string,
  group: THREE.Group,
  color: number,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[],
  anim: AnimationTargets
) {
  const p = getHumanProport(isFemale);

  if (partId === 'skin') {
    buildHumanSkin(p, group, partId, textures, scientific, collector);
    return;
  }

  if (partId === 'muscles') {
    buildHumanMuscles(p, group, partId, textures, scientific, collector);
    return;
  }

  if (partId === 'skeleton') {
    buildHumanSkeleton(p, group, partId, textures, scientific, collector, anim);
    return;
  }

  if (partId === 'mammary' && isFemale) {
    const stromaMat = makeMaterial({ color: 0xeed4cc, layer: 'internal', tissue: 'skin', opacity: 0.28, focusOpacity: 0.36, roughness: 0.36 }, textures, scientific);
    const lobuleMat = makeMaterial({ color: 0xd1798e, layer: 'internal', tissue: 'organ', roughness: 0.44 }, textures, scientific);
    const ductMat = makeMaterial({ color: 0xe6d49c, layer: 'internal', tissue: 'tendon', roughness: 0.32 }, textures, scientific);
    const vesselMat = makeMaterial({ color: 0xa61c24, layer: 'internal', tissue: 'vessel_artery', roughness: 0.32 }, textures, scientific);
    const lymphMat = makeMaterial({ color: 0x4b8f64, layer: 'internal', tissue: 'organ', roughness: 0.4 }, textures, scientific);

    for (const side of [-1, 1]) {
      const cx = side * 0.185;
      const cy = 0.0;
      const cz = 0.07;

      const stroma = addMesh(group, new THREE.SphereGeometry(0.162, 22, 18), stromaMat, partId, 'internal', collector, 6);
      stroma.scale.set(0.96, 0.9, 0.78);
      stroma.position.set(cx, cy, cz);

      const areola = addMesh(group, new THREE.CylinderGeometry(0.04, 0.044, 0.016, 18), lobuleMat, partId, 'internal', collector);
      areola.rotation.x = Math.PI / 2;
      areola.position.set(cx, cy - 0.01, cz + 0.123);

      for (let i = 0; i < 14; i++) {
        const ang = (i / 14) * Math.PI * 2;
        const lx = cx + Math.cos(ang) * 0.082;
        const ly = cy + Math.sin(ang) * 0.076;
        const lz = cz + 0.02;

        const lobule = addMesh(group, new THREE.SphereGeometry(0.025, 10, 8), lobuleMat, partId, 'internal', collector);
        lobule.scale.set(1.15, 0.9, 0.8);
        lobule.position.set(lx, ly, lz);

        addMesh(
          group,
          makeTube(
            [
              new THREE.Vector3(lx, ly, lz + 0.015),
              new THREE.Vector3(cx + Math.cos(ang) * 0.032, cy - 0.01 + Math.sin(ang) * 0.03, cz + 0.09),
              new THREE.Vector3(cx, cy - 0.01, cz + 0.123),
            ],
            0.005,
            6,
            8
          ).geometry,
          ductMat,
          partId,
          'internal',
          collector
        );
      }

      addMesh(
        group,
        makeTube([new THREE.Vector3(side * 0.08, 0.14, -0.02), new THREE.Vector3(cx, 0.07, cz + 0.03), new THREE.Vector3(cx + side * 0.05, -0.04, cz + 0.05)], 0.008, 6, 10).geometry,
        vesselMat,
        partId,
        'internal',
        collector
      );

      addMesh(
        group,
        makeTube([new THREE.Vector3(cx + side * 0.06, 0.05, cz), new THREE.Vector3(side * 0.36, 0.14, -0.04), new THREE.Vector3(side * 0.44, 0.2, -0.09)], 0.006, 6, 8).geometry,
        lymphMat,
        partId,
        'internal',
        collector
      );
      for (let n = 0; n < 4; n++) {
        const node = addMesh(group, new THREE.SphereGeometry(0.016, 8, 8), lymphMat, partId, 'internal', collector);
        node.position.set(side * (0.34 + n * 0.035), 0.12 + n * 0.025, -0.03 - n * 0.02);
      }
    }
    return;
  }

  if (partId === 'reproductive' && isFemale) {
    const myoMat = makeMaterial({ color: 0x9e3240, layer: 'internal', tissue: 'organ', opacity: 0.84, focusOpacity: 0.9, roughness: 0.38 }, textures, scientific);
    const endoMat = makeMaterial({ color: 0xc96b76, layer: 'internal', tissue: 'organ', roughness: 0.45 }, textures, scientific);
    const tubeMat = makeMaterial({ color: 0xb54b58, layer: 'internal', tissue: 'organ', roughness: 0.4 }, textures, scientific);
    const ovaryMat = makeMaterial({ color: 0xdfd3b4, layer: 'internal', tissue: 'organ', roughness: 0.46 }, textures, scientific);
    const follicleMat = makeMaterial({ color: 0xd9b36c, layer: 'internal', tissue: 'cartilage', roughness: 0.24 }, textures, scientific);
    const ligMat = makeMaterial({ color: 0xe2dbd0, layer: 'internal', tissue: 'ligament', opacity: 0.86, roughness: 0.42 }, textures, scientific);
    const vesselMat = makeMaterial({ color: 0xa61c24, layer: 'internal', tissue: 'vessel_artery', roughness: 0.34 }, textures, scientific);

    const uterusGroup = new THREE.Group();
    uterusGroup.rotation.x = 0.28;
    const body = addMesh(uterusGroup, new THREE.SphereGeometry(0.115, 22, 18), myoMat, partId, 'internal', collector, 4);
    body.scale.set(0.95, 1.32, 0.74);
    body.position.set(0, 0.09, 0.02);

    const endo = addMesh(uterusGroup, new THREE.ConeGeometry(0.068, 0.15, 14), endoMat, partId, 'internal', collector);
    endo.rotation.x = Math.PI;
    endo.scale.set(1.0, 1.0, 0.45);
    endo.position.set(0, 0.09, 0.02);

    const cervix = addMesh(uterusGroup, new THREE.CylinderGeometry(0.044, 0.04, 0.09, 14), myoMat, partId, 'internal', collector);
    cervix.position.set(0, -0.05, 0.01);

    const vagina = addMesh(uterusGroup, new THREE.CylinderGeometry(0.042, 0.048, 0.18, 14), endoMat, partId, 'internal', collector);
    vagina.position.set(0, -0.17, -0.01);
    vagina.rotation.x = -0.25;
    group.add(uterusGroup);

    for (const side of [-1, 1]) {
      addMesh(
        group,
        makeTube(
          [
            new THREE.Vector3(side * 0.08, 0.16, 0.03),
            new THREE.Vector3(side * 0.19, 0.18, 0.02),
            new THREE.Vector3(side * 0.28, 0.12, -0.01),
            new THREE.Vector3(side * 0.29, 0.05, 0.01),
          ],
          0.017,
          8,
          16
        ).geometry,
        tubeMat,
        partId,
        'internal',
        collector
      );

      for (let f = 0; f < 5; f++) {
        const ang = (f - 2) * 0.28;
        addMesh(
          group,
          makeTube(
            [
              new THREE.Vector3(side * 0.29, 0.05, 0.01),
              new THREE.Vector3(side * (0.28 + Math.cos(ang) * 0.025), 0.025, 0.01 + Math.sin(ang) * 0.03),
            ],
            0.0055,
            5,
            6
          ).geometry,
          tubeMat,
          partId,
          'internal',
          collector
        );
      }

      const ovary = addMesh(group, new THREE.SphereGeometry(0.045, 16, 12), ovaryMat, partId, 'internal', collector);
      ovary.scale.set(0.8, 1.15, 0.7);
      ovary.position.set(side * 0.245, 0.03, -0.01);

      for (let fl = 0; fl < 3; fl++) {
        const fol = addMesh(group, new THREE.SphereGeometry(0.012, 8, 8), follicleMat, partId, 'internal', collector);
        fol.position.set(side * (0.23 + fl * 0.012), 0.015 + fl * 0.015, 0.018);
      }

      // Ovarian & Round ligaments
      addMesh(group, makeTube([new THREE.Vector3(side * 0.09, 0.12, 0.01), new THREE.Vector3(side * 0.22, 0.03, -0.01)], 0.008, 6, 8).geometry, ligMat, partId, 'internal', collector);
      addMesh(group, makeTube([new THREE.Vector3(side * 0.09, 0.14, 0.04), new THREE.Vector3(side * 0.24, -0.06, 0.14)], 0.007, 6, 10).geometry, ligMat, partId, 'internal', collector);

      addMesh(
        group,
        makeTube(
          [
            new THREE.Vector3(side * 0.18, -0.1, -0.04),
            new THREE.Vector3(side * 0.11, -0.01, 0.02),
            new THREE.Vector3(side * 0.12, 0.08, 0.03),
            new THREE.Vector3(side * 0.1, 0.15, 0.02),
          ],
          0.008,
          6,
          12
        ).geometry,
        vesselMat,
        partId,
        'internal',
        collector
      );
    }
    return;
  }

  if (partId === 'eyes') {
    buildEyePair(group, partId, textures, scientific, collector, {
      leftPos: [isFemale ? -0.1 : -0.11, 0, isFemale ? 0.075 : 0.08],
      rightPos: [isFemale ? 0.1 : 0.11, 0, isFemale ? 0.075 : 0.08],
      radius: isFemale ? 0.044 : 0.046,
      facing: 'forwardZ',
      irisColor: 0x7ba5b0,
      chiasmPos: [0, -0.02, isFemale ? -0.13 : -0.14],
    });

    const cochleaMat = makeMaterial({ color: 0xe3d2a8, layer: 'internal', tissue: 'bone', roughness: 0.4 }, textures, scientific);
    for (const side of [-1, 1]) {
      const coch = addMesh(group, new THREE.TorusGeometry(0.031, 0.01, 8, 16, Math.PI * 1.7), cochleaMat, partId, 'internal', collector);
      coch.position.set(side * (isFemale ? 0.21 : 0.23), -0.06, isFemale ? -0.17 : -0.18);
      coch.rotation.y = side * 1.2;

      const canal = addMesh(group, new THREE.TorusGeometry(0.025, 0.006, 6, 14), cochleaMat, partId, 'internal', collector);
      canal.position.set(side * (isFemale ? 0.22 : 0.24), -0.03, -0.19);
      canal.rotation.x = 0.9;
    }
    return;
  }

  if (partId === 'vessels') {
    buildHumanVessels(p, group, partId, textures, scientific, collector, anim);
    return;
  }

  if (partId === 'brain') {
    const cortexMat = makeMaterial({ color: 0xd8ada6, layer: 'internal', tissue: 'organ', roughness: 0.44, bumpScale: 0.028 }, textures, scientific);
    const foldMat = makeMaterial({ color: 0xc28e88, layer: 'internal', tissue: 'organ', roughness: 0.48 }, textures, scientific);
    const stemMat = makeMaterial({ color: 0xe6d4cc, layer: 'internal', tissue: 'organ', roughness: 0.52 }, textures, scientific);
    const vesselMat = makeMaterial({ color: 0x9b1820, layer: 'internal', tissue: 'vessel_artery', roughness: 0.3 }, textures, scientific);
    const veinMat = makeMaterial({ color: 0x2a4b7d, layer: 'internal', tissue: 'vessel_vein', roughness: 0.3 }, textures, scientific);

    const brainArtGeos: THREE.BufferGeometry[] = [];
    const brainVeinGeos: THREE.BufferGeometry[] = [];

    for (const side of [-1, 1]) {
      const hemi = addMesh(group, new THREE.SphereGeometry(0.205, 28, 22), cortexMat, partId, 'internal', collector);
      hemi.scale.set(0.68, 0.94, 1.22);
      hemi.position.set(side * 0.105, 0.03, 0);

      for (let g = 0; g < 4; g++) {
        addMesh(
          group,
          makeTube(
            [
              new THREE.Vector3(side * 0.045, 0.175 - g * 0.05, 0.18 - g * 0.05),
              new THREE.Vector3(side * 0.2, 0.11 - g * 0.045, 0.02),
              new THREE.Vector3(side * 0.13, 0.05 - g * 0.045, -0.18),
            ],
            0.02,
            8,
            16
          ).geometry,
          foldMat,
          partId,
          'internal',
          collector
        );
      }

      // Middle cerebral arterial & cortical pial venous arborizations
      const mcaRes = createVesselBranchGeo(
        [
          new THREE.Vector3(side * 0.04, -0.11, 0.04),
          new THREE.Vector3(side * 0.18, 0.0, 0.08),
          new THREE.Vector3(side * 0.21, 0.1, 0.01),
          new THREE.Vector3(side * 0.13, 0.18, -0.09),
        ],
        0.0075,
        0.0022,
        { tubularSegs: 16, radialSegs: 7, tortuosity: 0.009, seed: 910 + side }
      );
      brainArtGeos.push(mcaRes.geometry);
      spawnFineVesselTree(brainArtGeos, mcaRes.curve, {
        branchCount: 7,
        baseRadius: 0.0026,
        branchLength: 0.068,
        subBranches: 2,
        outwardBias: new THREE.Vector3(side * 0.4, 0.35, 0.15),
        tortuosity: 0.008,
        seed: 912 + side,
        depth: 2,
      });

      const supCerebVein = createVesselBranchGeo(
        [
          new THREE.Vector3(side * 0.21, -0.02, 0.05),
          new THREE.Vector3(side * 0.18, 0.11, 0.02),
          new THREE.Vector3(side * 0.07, 0.2, 0.0),
          new THREE.Vector3(side * 0.015, 0.22, -0.02),
        ],
        0.0032,
        0.0068,
        { tubularSegs: 14, radialSegs: 6, tortuosity: 0.008, seed: 915 + side }
      );
      brainVeinGeos.push(supCerebVein.geometry);
      spawnFineVesselTree(brainVeinGeos, supCerebVein.curve, {
        branchCount: 8,
        baseRadius: 0.0024,
        branchLength: 0.065,
        subBranches: 2,
        outwardBias: new THREE.Vector3(side * 0.35, 0.1, 0.25),
        tortuosity: 0.009,
        seed: 918 + side,
        depth: 3,
      });

      const cere = addMesh(group, new THREE.SphereGeometry(0.092, 16, 14), stemMat, partId, 'internal', collector);
      cere.scale.set(0.95, 0.78, 0.92);
      cere.position.set(side * 0.075, -0.11, -0.14);
    }

    const mergedBArt = mergeVesselGeometries(brainArtGeos);
    if (mergedBArt) addMesh(group, mergedBArt, vesselMat, partId, 'internal', collector);
    const mergedBVein = mergeVesselGeometries(brainVeinGeos);
    if (mergedBVein) addMesh(group, mergedBVein, veinMat, partId, 'internal', collector);

    const stem = addMesh(group, new THREE.CylinderGeometry(0.043, 0.03, 0.28, 14), stemMat, partId, 'internal', collector);
    stem.position.set(0, -0.24, -0.04);
    return;
  }

  if (partId === 'lungs') {
    const lungMat = makeMaterial({ color: 0xc98a8f, layer: 'internal', tissue: 'organ', opacity: 0.72, focusOpacity: 0.88, roughness: 0.52 }, textures, scientific);
    const airwayMat = makeMaterial({ color: 0xd8e0e6, layer: 'internal', tissue: 'cartilage', roughness: 0.35 }, textures, scientific);
    const diaphMat = makeMaterial({ color: 0x993a43, layer: 'internal', tissue: 'muscle', opacity: 0.88, roughness: 0.48 }, textures, scientific);

    const trachea = addMesh(group, new THREE.CylinderGeometry(0.042, 0.042, 0.45, 16), airwayMat, partId, 'internal', collector);
    trachea.position.set(0, 0.27, 0);
    for (let r = 0; r < 9; r++) {
      const ring = addMesh(group, new THREE.TorusGeometry(0.046, 0.0075, 8, 18), airwayMat, partId, 'internal', collector);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(0, 0.1 + r * 0.044, 0);
    }

    const breathShell = new THREE.Group();
    for (const side of [-1, 1]) {
      addMesh(
        group,
        makeTube([new THREE.Vector3(0, 0.07, 0), new THREE.Vector3(side * 0.2, -0.02, 0), new THREE.Vector3(side * 0.33, -0.18, -0.02)], 0.026, 10, 14).geometry,
        airwayMat,
        partId,
        'internal',
        collector
      );
      addMesh(
        group,
        makeTube([new THREE.Vector3(side * 0.15, 0.0, 0), new THREE.Vector3(side * 0.27, 0.14, 0.02)], 0.017, 8, 10).geometry,
        airwayMat,
        partId,
        'internal',
        collector
      );

      const upper = addMesh(breathShell, new THREE.SphereGeometry(0.21, 22, 18), lungMat, partId, 'internal', collector, 4);
      upper.scale.set(side === 1 ? 0.72 : 0.8, 1.35, 0.82);
      upper.position.set(side * 0.24, 0.04, 0);
      upper.rotation.z = side * -0.16;

      const lower = addMesh(breathShell, new THREE.SphereGeometry(0.23, 22, 18), lungMat, partId, 'internal', collector, 4);
      lower.scale.set(side === 1 ? 0.74 : 0.84, 1.05, 0.88);
      lower.position.set(side * 0.27, -0.16, -0.02);
    }

    const diaphragm = addMesh(breathShell, new THREE.SphereGeometry(0.44, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.45), diaphMat, partId, 'internal', collector);
    diaphragm.scale.set(1.05, 0.36, 0.65);
    diaphragm.position.set(0, -0.38, 0);

    group.add(breathShell);
    anim.breathGroups.push({ group: breathShell, rate: 1.55, amp: 0.048, axisMask: [1, 0.7, 1] });
    return;
  }

  if (partId === 'heart') {
    const myoMat = makeMaterial({ color: 0x9b2c35, layer: 'internal', tissue: 'organ', roughness: 0.34, clearcoat: 0.52 }, textures, scientific);
    const aortaMat = makeMaterial({ color: 0xb0232b, layer: 'internal', tissue: 'vessel_artery', roughness: 0.34 }, textures, scientific);
    const veinMat = makeMaterial({ color: 0x2c4f80, layer: 'internal', tissue: 'vessel_vein', roughness: 0.38 }, textures, scientific);

    const beatGroup = new THREE.Group();
    const ventGeo = new THREE.SphereGeometry(0.165, 24, 20);
    ventGeo.scale(0.86, 1.18, 0.78);
    const vent = addMesh(beatGroup, ventGeo, myoMat, partId, 'internal', collector);
    vent.rotation.z = 0.32;

    for (const side of [-1, 1]) {
      const atrium = addMesh(beatGroup, new THREE.SphereGeometry(0.084, 16, 14), myoMat, partId, 'internal', collector);
      atrium.position.set(side * 0.09, 0.12, -0.02);
    }

    // Anterior interventricular & circumflex coronary arteries + branching cardiac veins
    const heartArtGeos: THREE.BufferGeometry[] = [];
    const heartVeinGeos: THREE.BufferGeometry[] = [];

    const lad = createVesselBranchGeo(
      [new THREE.Vector3(0.01, 0.14, 0.11), new THREE.Vector3(0.042, 0.02, 0.138), new THREE.Vector3(0.062, -0.12, 0.102)],
      0.0085,
      0.0028,
      { tubularSegs: 14, radialSegs: 7, tortuosity: 0.005, seed: 930 }
    );
    heartArtGeos.push(lad.geometry);
    spawnFineVesselTree(heartArtGeos, lad.curve, {
      branchCount: 6,
      baseRadius: 0.0026,
      branchLength: 0.058,
      subBranches: 2,
      outwardBias: new THREE.Vector3(0.25, -0.2, 0.55),
      tortuosity: 0.005,
      seed: 931,
      depth: 2,
    });

    const lcx = createVesselBranchGeo(
      [new THREE.Vector3(-0.04, 0.12, 0.1), new THREE.Vector3(-0.115, 0.0, 0.092), new THREE.Vector3(-0.055, -0.11, 0.06)],
      0.0075,
      0.0024,
      { tubularSegs: 14, radialSegs: 7, tortuosity: 0.005, seed: 932 }
    );
    heartArtGeos.push(lcx.geometry);
    spawnFineVesselTree(heartArtGeos, lcx.curve, {
      branchCount: 5,
      baseRadius: 0.0022,
      branchLength: 0.05,
      subBranches: 2,
      outwardBias: new THREE.Vector3(-0.4, -0.2, 0.45),
      seed: 933,
      depth: 2,
    });

    const greatCardiacVein = createVesselBranchGeo(
      [new THREE.Vector3(0.05, -0.13, 0.105), new THREE.Vector3(0.025, 0.01, 0.135), new THREE.Vector3(-0.02, 0.1, 0.122), new THREE.Vector3(-0.11, 0.06, -0.05)],
      0.0028,
      0.0072,
      { tubularSegs: 16, radialSegs: 7, tortuosity: 0.005, seed: 934 }
    );
    heartVeinGeos.push(greatCardiacVein.geometry);
    spawnFineVesselTree(heartVeinGeos, greatCardiacVein.curve, {
      branchCount: 7,
      baseRadius: 0.0024,
      branchLength: 0.062,
      subBranches: 2,
      outwardBias: new THREE.Vector3(0.15, -0.2, 0.55),
      tortuosity: 0.006,
      seed: 935,
      depth: 3,
    });

    const mergedHArt = mergeVesselGeometries(heartArtGeos);
    if (mergedHArt) addMesh(beatGroup, mergedHArt, aortaMat, partId, 'internal', collector);
    const mergedHVein = mergeVesselGeometries(heartVeinGeos);
    if (mergedHVein) addMesh(beatGroup, mergedHVein, veinMat, partId, 'internal', collector);

    addMesh(
      beatGroup,
      makeTube([new THREE.Vector3(0, 0.12, 0), new THREE.Vector3(-0.02, 0.28, 0.02), new THREE.Vector3(0.09, 0.3, -0.04), new THREE.Vector3(0.11, 0.12, -0.08)], 0.038, 12, 18).geometry,
      aortaMat,
      partId,
      'internal',
      collector
    );

    for (let t = -1; t <= 1; t++) {
      const trunk = addMesh(beatGroup, new THREE.CylinderGeometry(0.013, 0.015, 0.1, 8), aortaMat, partId, 'internal', collector);
      trunk.position.set(0.02 + t * 0.036, 0.33, 0);
    }

    addMesh(
      beatGroup,
      makeTube([new THREE.Vector3(0.04, 0.11, 0.06), new THREE.Vector3(0.02, 0.22, 0.04), new THREE.Vector3(-0.14, 0.22, -0.02)], 0.025, 10, 12).geometry,
      veinMat,
      partId,
      'internal',
      collector
    );
    const cava = addMesh(beatGroup, new THREE.CylinderGeometry(0.032, 0.032, 0.25, 12), veinMat, partId, 'internal', collector);
    cava.position.set(-0.11, 0.2, -0.02);

    group.add(beatGroup);
    anim.heartGroups.push({ group: beatGroup, rate: 7.2, amp: 0.072 });
    return;
  }

  if (partId === 'endocrine') {
    const thyroidMat = makeMaterial({ color: 0xb85e7c, layer: 'internal', tissue: 'organ', roughness: 0.4 }, textures, scientific);
    const thymusMat = makeMaterial({ color: 0xc97b7e, layer: 'internal', tissue: 'organ', roughness: 0.44 }, textures, scientific);
    const pancMat = makeMaterial({ color: 0xd4ad5b, layer: 'internal', tissue: 'organ', roughness: 0.48 }, textures, scientific);
    const spleenMat = makeMaterial({ color: 0x6e1f2d, layer: 'internal', tissue: 'organ', roughness: 0.36 }, textures, scientific);

    for (const side of [-1, 1]) {
      const lobe = addMesh(group, new THREE.SphereGeometry(0.046, 14, 12), thyroidMat, partId, 'internal', collector);
      lobe.scale.set(0.75, 1.45, 0.65);
      lobe.position.set(-0.05 + side * 0.048, 0.94, 0.06);
    }
    const isthmus = addMesh(group, new THREE.BoxGeometry(0.07, 0.035, 0.028), thyroidMat, partId, 'internal', collector);
    isthmus.position.set(-0.05, 0.92, 0.06);

    for (const side of [-1, 1]) {
      const thLobe = addMesh(group, new THREE.SphereGeometry(0.042, 12, 10), thymusMat, partId, 'internal', collector);
      thLobe.scale.set(0.75, 1.3, 0.55);
      thLobe.position.set(-0.05 + side * 0.03, 0.64, 0.11);
    }

    addMesh(
      group,
      makeTube([new THREE.Vector3(-0.08, -0.26, 0.04), new THREE.Vector3(0.08, -0.22, 0.02), new THREE.Vector3(0.28, -0.15, -0.02)], 0.045, 12, 14).geometry,
      pancMat,
      partId,
      'internal',
      collector
    );

    const spleen = addMesh(group, new THREE.SphereGeometry(0.092, 16, 14), spleenMat, partId, 'internal', collector);
    spleen.scale.set(0.85, 1.25, 0.72);
    spleen.position.set(0.35, -0.1, -0.06);
    spleen.rotation.z = -0.3;
    return;
  }

  if (partId === 'liver') {
    const liverMat = makeMaterial({ color: 0x6f2d25, layer: 'internal', tissue: 'organ', roughness: 0.34, clearcoat: 0.52 }, textures, scientific);
    const gallMat = makeMaterial({ color: 0x4b6e22, layer: 'internal', tissue: 'organ', roughness: 0.28, clearcoat: 0.5 }, textures, scientific);
    const portalMat = makeMaterial({ color: 0x3b4e82, layer: 'internal', tissue: 'vessel_vein', roughness: 0.4 }, textures, scientific);

    const right = addMesh(group, new THREE.SphereGeometry(0.235, 22, 18), liverMat, partId, 'internal', collector);
    right.scale.set(1.25, 0.62, 0.85);
    right.position.set(-0.05, 0.02, 0);
    right.rotation.z = 0.22;

    const left = addMesh(group, new THREE.SphereGeometry(0.155, 18, 14), liverMat, partId, 'internal', collector);
    left.scale.set(1.45, 0.46, 0.68);
    left.position.set(0.18, 0.08, 0.02);
    left.rotation.z = -0.18;

    const gall = addMesh(group, new THREE.SphereGeometry(0.052, 14, 12), gallMat, partId, 'internal', collector);
    gall.scale.set(0.8, 1.38, 0.8);
    gall.position.set(-0.02, -0.09, 0.11);

    addMesh(group, makeTube([new THREE.Vector3(-0.01, -0.06, 0.08), new THREE.Vector3(0.08, -0.15, 0.05)], 0.011, 8, 8).geometry, gallMat, partId, 'internal', collector);
    const liverPortalGeos: THREE.BufferGeometry[] = [];
    const pvMain = createVesselBranchGeo(
      [new THREE.Vector3(0.08, -0.16, -0.02), new THREE.Vector3(0.02, -0.02, 0.01), new THREE.Vector3(-0.1, 0.04, 0.02)],
      0.02,
      0.008,
      { tubularSegs: 12, radialSegs: 8, tortuosity: 0.004, seed: 940 }
    );
    liverPortalGeos.push(pvMain.geometry);
    spawnFineVesselTree(liverPortalGeos, pvMain.curve, {
      branchCount: 6,
      baseRadius: 0.0045,
      branchLength: 0.1,
      subBranches: 2,
      outwardBias: new THREE.Vector3(-0.3, 0.2, 0.35),
      seed: 941,
      depth: 2,
    });
    const mergedLiverV = mergeVesselGeometries(liverPortalGeos);
    if (mergedLiverV) addMesh(group, mergedLiverV, portalMat, partId, 'internal', collector);
    return;
  }

  if (partId === 'stomach') {
    const stomMat = makeMaterial({ color: 0xc98b6c, layer: 'internal', tissue: 'organ', roughness: 0.42, bumpScale: 0.02 }, textures, scientific);
    const vesselMat = makeMaterial({ color: 0xa61c24, layer: 'internal', tissue: 'vessel_artery', roughness: 0.36 }, textures, scientific);

    const esoph = addMesh(group, new THREE.CylinderGeometry(0.036, 0.04, 0.32, 12), stomMat, partId, 'internal', collector);
    esoph.position.set(-0.09, 0.34, -0.02);

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.08, 0.22, 0),
      new THREE.Vector3(0.08, 0.1, 0.03),
      new THREE.Vector3(0.11, -0.08, 0.04),
      new THREE.Vector3(-0.04, -0.15, 0.02),
      new THREE.Vector3(-0.17, -0.1, -0.02),
    ]);
    addMesh(group, new THREE.TubeGeometry(curve, 26, 0.102, 18, false), stomMat, partId, 'internal', collector);

    const fundus = addMesh(group, new THREE.SphereGeometry(0.125, 18, 16), stomMat, partId, 'internal', collector);
    fundus.position.set(0.06, 0.08, 0.03);
    fundus.scale.set(1.1, 1.2, 0.9);

    addMesh(
      group,
      makeTube([new THREE.Vector3(0.14, 0.12, 0.09), new THREE.Vector3(0.19, -0.06, 0.09), new THREE.Vector3(0.02, -0.2, 0.08)], 0.009, 6, 12).geometry,
      vesselMat,
      partId,
      'internal',
      collector
    );
    return;
  }

  if (partId === 'kidneys') {
    const kidMat = makeMaterial({ color: 0x7c363e, layer: 'internal', tissue: 'organ', roughness: 0.36, clearcoat: 0.45 }, textures, scientific);
    const adrenalMat = makeMaterial({ color: 0xc99642, layer: 'internal', tissue: 'organ', roughness: 0.48 }, textures, scientific);
    const ureterMat = makeMaterial({ color: 0xd9c2a3, layer: 'internal', tissue: 'tendon', roughness: 0.46 }, textures, scientific);
    const arteryMat = makeMaterial({ color: 0xa61c24, layer: 'internal', tissue: 'vessel_artery', roughness: 0.34 }, textures, scientific);
    const veinMat = makeMaterial({ color: 0x2c4f80, layer: 'internal', tissue: 'vessel_vein', roughness: 0.36 }, textures, scientific);

    for (const side of [-1, 1]) {
      const k = addMesh(group, new THREE.SphereGeometry(isFemale ? 0.115 : 0.122, 20, 16), kidMat, partId, 'internal', collector);
      k.scale.set(0.74, 1.25, 0.65);
      k.position.set(side * (isFemale ? 0.22 : 0.24), side === 1 ? -0.03 : 0.03, 0);
      k.rotation.z = side * -0.18;

      const adr = addMesh(group, new THREE.ConeGeometry(0.05, 0.07, 10), adrenalMat, partId, 'internal', collector);
      adr.position.set(side * (isFemale ? 0.2 : 0.22), (side === 1 ? -0.03 : 0.03) + 0.14, 0);

      addMesh(group, makeTube([new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(side * 0.17, 0, 0)], 0.013, 8, 8).geometry, arteryMat, partId, 'internal', collector);
      addMesh(group, makeTube([new THREE.Vector3(0, -0.03, 0.04), new THREE.Vector3(side * 0.17, -0.03, 0.01)], 0.014, 8, 8).geometry, veinMat, partId, 'internal', collector);
      addMesh(
        group,
        makeTube(
          [
            new THREE.Vector3(side * 0.18, 0, 0),
            new THREE.Vector3(side * 0.14, -0.28, isFemale ? 0.08 : 0.04),
            new THREE.Vector3(side * 0.05, isFemale ? -0.49 : -0.5, isFemale ? 0.24 : 0.1),
          ],
          0.014,
          8,
          12
        ).geometry,
        ureterMat,
        partId,
        'internal',
        collector
      );
    }

    const bladder = addMesh(group, new THREE.SphereGeometry(isFemale ? 0.092 : 0.1, 18, 14), ureterMat, partId, 'internal', collector);
    bladder.scale.set(1.1, 0.88, 0.9);
    bladder.position.set(0, isFemale ? -0.5 : -0.54, isFemale ? 0.25 : 0.12);
    return;
  }

  if (partId === 'intestines') {
    const smallMat = makeMaterial({ color: 0xc98b6d, layer: 'internal', tissue: 'organ', roughness: 0.44 }, textures, scientific);
    const colonMat = makeMaterial({ color: 0xa66b51, layer: 'internal', tissue: 'organ', roughness: 0.48 }, textures, scientific);
    const vesselMat = makeMaterial({ color: 0xa61c24, layer: 'internal', tissue: 'vessel_artery', roughness: 0.36 }, textures, scientific);

    const smallPts: THREE.Vector3[] = [];
    for (let i = 0; i <= 36; i++) {
      const t = i / 36;
      smallPts.push(new THREE.Vector3(Math.sin(t * Math.PI * 8) * 0.175, 0.14 - t * 0.34, Math.cos(t * Math.PI * 6) * 0.07));
    }
    addMesh(group, makeTube(smallPts, 0.046, 14, 52).geometry, smallMat, partId, 'internal', collector);

    const colonCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.27, -0.24, -0.02),
      new THREE.Vector3(-0.29, 0.16, -0.01),
      new THREE.Vector3(0, 0.22, 0.03),
      new THREE.Vector3(0.29, 0.16, -0.01),
      new THREE.Vector3(0.27, -0.22, -0.02),
      new THREE.Vector3(0.02, -0.32, -0.04),
    ]);
    addMesh(group, new THREE.TubeGeometry(colonCurve, 34, 0.062, 14, false), colonMat, partId, 'internal', collector);

    for (let h = 0; h <= 18; h++) {
      const pt = colonCurve.getPointAt(h / 18);
      const haustrum = addMesh(group, new THREE.SphereGeometry(0.075, 10, 8), colonMat, partId, 'internal', collector);
      haustrum.position.copy(pt);
    }

    for (let m = -2; m <= 2; m++) {
      addMesh(group, makeTube([new THREE.Vector3(0, 0.12, -0.06), new THREE.Vector3(m * 0.11, -0.05, 0.04)], 0.008, 6, 8).geometry, vesselMat, partId, 'internal', collector);
    }
  }
}

export function buildHumanPart(
  partId: string,
  group: THREE.Group,
  color: number,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[],
  anim: AnimationTargets
) {
  buildRealisticHumanPart(false, partId, group, color, textures, scientific, collector, anim);
}

export function buildHumanFemalePart(
  partId: string,
  group: THREE.Group,
  color: number,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[],
  anim: AnimationTargets
) {
  buildRealisticHumanPart(true, partId, group, color, textures, scientific, collector, anim);
}
