import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';
import { PartLayer } from '../types/anatomy';
import { ProceduralTextureSet } from './proceduralTextures';

export interface FlowStream {
  instancedMesh: THREE.InstancedMesh;
  curves: THREE.CatmullRomCurve3[];
  count: number;
  speed: number;
  phaseOffsets: Float32Array;
  curveIndexPerInstance: Uint8Array;
  baseScale: number;
}

export interface BuiltPartEntry {
  partId: string;
  layer: PartLayer;
  group: THREE.Group;
  meshes: THREE.Mesh[];
  basePosition: THREE.Vector3;
  explodeOffset: THREE.Vector3;
  labelAnchorLocal: THREE.Vector3;
  localBoundsCenter: THREE.Vector3;
  localBoundsSize: THREE.Vector3;
  focusScale: number;
  currentScale: number;
  currentFocusOffset: THREE.Vector3;
}

export interface BuiltSpeciesModel {
  root: THREE.Group;
  parts: BuiltPartEntry[];
  allInteractiveMeshes: THREE.Mesh[];
  update4D: (dt: number, elapsedSeconds: number) => void;
  dispose: () => void;
}

export interface AnimationTargets {
  heartGroups: { group: THREE.Object3D; rate: number; amp: number }[];
  breathGroups: { group: THREE.Object3D; rate: number; amp: number; axisMask: [number, number, number] }[];
  spinGroups: { group: THREE.Object3D; axis: 'x' | 'y' | 'z'; speed: number }[];
  pulseMeshes: { mesh: THREE.Object3D; index: number; rate: number; amp: number }[];
  flowStreams: FlowStream[];
}

export type PartBuilderFn = (
  partId: string,
  group: THREE.Group,
  color: number,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[],
  anim: AnimationTargets
) => void;

export type TissueKind =
  | 'skin'
  | 'muscle'
  | 'tendon'
  | 'ligament'
  | 'bone'
  | 'cartilage'
  | 'organ'
  | 'vessel_artery'
  | 'vessel_vein'
  | 'nerve'
  | 'sclera'
  | 'iris';

// Module-scope reusable math helpers for zero GC during 4D updates
const _dummy = new THREE.Object3D();
const _flowPos = new THREE.Vector3();
const _tan = new THREE.Vector3();
const _norm = new THREE.Vector3();
const _binorm = new THREE.Vector3();
const _refUp = new THREE.Vector3(0, 1, 0);
const _refAlt = new THREE.Vector3(1, 0, 0);

export interface MatOpts {
  color: number;
  layer: PartLayer;
  tissue?: TissueKind;
  roughness?: number;
  metalness?: number;
  clearcoat?: number;
  opacity?: number;
  bumpScale?: number;
  doubleSide?: boolean;
  emissive?: number;
  emissiveIntensity?: number;
  focusOpacity?: number;
  map?: THREE.Texture | null;
}

export function makeMaterial(
  opts: MatOpts,
  textures: ProceduralTextureSet,
  scientific: boolean
): THREE.MeshPhysicalMaterial {
  const isOuter = opts.layer === 'outer';
  const isMuscle = opts.layer === 'muscles';
  const tissue: TissueKind =
    opts.tissue ??
    (isOuter ? 'skin' : isMuscle ? 'muscle' : opts.layer === 'skeleton' ? 'bone' : 'organ');

  const defaultOpacity =
    tissue === 'skin'
      ? 0.14
      : tissue === 'muscle'
        ? 0.56
        : tissue === 'tendon' || tissue === 'ligament'
          ? 0.94
          : 1.0;

  const baseOpacity = opts.opacity ?? defaultOpacity;
  const effectiveOpacity = scientific
    ? isOuter
      ? 0.42
      : isMuscle
        ? 0.68
        : 0.95
    : baseOpacity;

  const focusOpacity =
    opts.focusOpacity ??
    (tissue === 'skin' ? 0.45 : tissue === 'muscle' ? 0.96 : Math.max(0.88, baseOpacity));

  let albedoMap: THREE.Texture | null = opts.map ?? null;
  let bumpMap: THREE.Texture | null = null;
  let roughnessMap: THREE.Texture | null = null;
  let bumpScale = opts.bumpScale ?? 0.012;
  let roughness = opts.roughness ?? 0.48;
  let clearcoat = opts.clearcoat ?? 0.25;
  let sheen = 0.0;
  let sheenRoughness = 0.5;
  let sheenColor = new THREE.Color(0xffffff);
  let colorHex = opts.color;

  if (tissue === 'muscle') {
    albedoMap = albedoMap ?? textures.muscleAlbedo;
    bumpMap = textures.muscleBump;
    roughnessMap = textures.muscleRoughness;
    bumpScale = opts.bumpScale ?? 0.022;
    roughness = opts.roughness ?? 0.46;
    clearcoat = opts.clearcoat ?? 0.34;
    sheen = 0.42;
    sheenRoughness = 0.42;
    sheenColor = new THREE.Color(0xd99292);
    if (opts.color === 0xc24151) colorHex = 0xa63a3e;
  } else if (tissue === 'tendon' || tissue === 'ligament') {
    albedoMap = albedoMap ?? textures.tendonAlbedo;
    bumpMap = textures.tendonBump;
    bumpScale = opts.bumpScale ?? 0.014;
    roughness = opts.roughness ?? 0.32;
    clearcoat = opts.clearcoat ?? 0.48;
    sheen = 0.68;
    sheenRoughness = 0.28;
    sheenColor = new THREE.Color(0xf5f2eb);
  } else if (tissue === 'bone') {
    albedoMap = albedoMap ?? textures.boneAlbedo;
    bumpMap = textures.boneBump;
    bumpScale = opts.bumpScale ?? 0.014;
    roughness = opts.roughness ?? 0.54;
    clearcoat = opts.clearcoat ?? 0.14;
    sheen = 0.12;
    sheenColor = new THREE.Color(0xf0eadc);
  } else if (tissue === 'cartilage') {
    bumpMap = textures.organicBump;
    bumpScale = 0.005;
    roughness = opts.roughness ?? 0.22;
    clearcoat = opts.clearcoat ?? 0.68;
    sheen = 0.35;
    sheenColor = new THREE.Color(0xe2eef5);
  } else if (tissue === 'skin') {
    bumpMap = null;
    roughness = opts.roughness ?? 0.28;
    clearcoat = opts.clearcoat ?? 0.45;
  } else if (tissue === 'vessel_artery' || tissue === 'vessel_vein') {
    albedoMap = albedoMap ?? textures.vesselAlbedo;
    bumpMap = textures.vesselBump;
    bumpScale = opts.bumpScale ?? 0.01;
    roughness = opts.roughness ?? (tissue === 'vessel_vein' ? 0.28 : 0.3);
    clearcoat = opts.clearcoat ?? 0.58;
    sheen = 0.36;
    sheenRoughness = 0.38;
    sheenColor = new THREE.Color(tissue === 'vessel_vein' ? 0x6f8cb8 : 0xd46a72);
  } else if (tissue === 'iris') {
    albedoMap = albedoMap ?? textures.irisAlbedo;
    roughness = 0.22;
    clearcoat = 0.65;
  } else if (tissue === 'sclera') {
    bumpMap = textures.organicBump;
    bumpScale = 0.003;
    roughness = 0.15;
    clearcoat = 0.85;
  } else {
    bumpMap = textures.organicBump;
    bumpScale = opts.bumpScale ?? 0.015;
    roughness = opts.roughness ?? 0.38;
    clearcoat = opts.clearcoat ?? 0.46;
    sheen = 0.25;
    sheenColor = new THREE.Color(0xf8e5e5);
  }

  // Tone down neon emissive washout for photorealistic clinical lighting
  const emissiveHex = opts.emissive ?? 0x000000;
  const emissiveInt = opts.emissiveIntensity !== undefined ? Math.min(opts.emissiveIntensity, 0.12) : 0;
  const depthWriteDefault = !isOuter && !isMuscle && baseOpacity >= 0.92;

  const mat = new THREE.MeshPhysicalMaterial({
    color: albedoMap && tissue === 'bone' ? 0xffffff : albedoMap && tissue === 'muscle' ? 0xf5d6d6 : colorHex,
    map: albedoMap,
    bumpMap,
    bumpScale,
    roughnessMap,
    roughness,
    metalness: opts.metalness ?? 0.02,
    clearcoat,
    clearcoatRoughness: isOuter ? 0.2 : 0.28,
    sheen,
    sheenRoughness,
    sheenColor,
    envMapIntensity: 0.78,
    transparent: isOuter || isMuscle || baseOpacity < 1,
    opacity: effectiveOpacity,
    depthWrite: depthWriteDefault,
    side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    wireframe: scientific,
    emissive: new THREE.Color(emissiveHex),
    emissiveIntensity: emissiveInt,
  });

  mat.userData.baseColorHex = mat.color.getHex();
  mat.userData.baseOpacity = baseOpacity;
  mat.userData.focusOpacity = focusOpacity;
  mat.userData.baseDepthWrite = depthWriteDefault;
  mat.userData.baseTransparent = mat.transparent;
  mat.userData.isOuterShell = isOuter;
  mat.userData.isMuscleLayer = isMuscle;
  mat.userData.isTendonOrLigament = tissue === 'tendon' || tissue === 'ligament';
  mat.userData.baseEmissive = emissiveHex;
  mat.userData.baseEmissiveIntensity = emissiveInt;
  return mat;
}

export function addMesh(
  parent: THREE.Object3D,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  partId: string,
  layer: PartLayer,
  collector: THREE.Mesh[],
  renderOrder?: number
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.userData.partId = partId;
  mesh.userData.layer = layer;
  const isOuter = layer === 'outer';
  mesh.castShadow = !isOuter;
  mesh.receiveShadow = !isOuter;
  mesh.renderOrder =
    renderOrder ?? (isOuter ? 8 : layer === 'muscles' ? 5 : layer === 'skeleton' ? 2 : 0);
  mesh.userData.baseRenderOrder = mesh.renderOrder;
  parent.add(mesh);
  collector.push(mesh);
  return mesh;
}

export function makeTube(
  points: THREE.Vector3[],
  radius: number,
  radialSegs = 10,
  tubularSegs = 22
): { geometry: THREE.TubeGeometry; curve: THREE.CatmullRomCurve3 } {
  const curve = new THREE.CatmullRomCurve3(points);
  const geometry = new THREE.TubeGeometry(curve, tubularSegs, radius, radialSegs, false);
  return { geometry, curve };
}

/**
 * Generates an organic variable-radius anatomical tube along a CatmullRomCurve3.
 * Used for fusiform muscle bellies, tapered tendons, flattened ribs, and long bones with epiphyses.
 */
export function createFusiformGeometry(
  points: THREE.Vector3[],
  radiusAt: (t: number) => number,
  tubularSegs = 24,
  radialSegs = 14,
  squashScale: [number, number] = [1, 1]
): { geometry: THREE.BufferGeometry; curve: THREE.CatmullRomCurve3 } {
  const curve = new THREE.CatmullRomCurve3(points);
  const ringVerts = radialSegs + 1;
  const ringCount = tubularSegs + 1;
  const positions = new Float32Array(ringCount * ringVerts * 3);
  const uvs = new Float32Array(ringCount * ringVerts * 2);
  const indices: number[] = [];

  for (let i = 0; i <= tubularSegs; i++) {
    const t = i / tubularSegs;
    curve.getPointAt(t, _flowPos);
    curve.getTangentAt(t, _tan).normalize();

    const ref = Math.abs(_tan.y) > 0.92 ? _refAlt : _refUp;
    _norm.crossVectors(_tan, ref).normalize();
    _binorm.crossVectors(_tan, _norm).normalize();

    const rBase = Math.max(0.0012, radiusAt(t));
    const rx = rBase * squashScale[0];
    const rz = rBase * squashScale[1];

    for (let j = 0; j <= radialSegs; j++) {
      const u = j / radialSegs;
      const theta = u * Math.PI * 2;
      const cosT = Math.cos(theta);
      const sinT = Math.sin(theta);

      const vx = _flowPos.x + _norm.x * (cosT * rx) + _binorm.x * (sinT * rz);
      const vy = _flowPos.y + _norm.y * (cosT * rx) + _binorm.y * (sinT * rz);
      const vz = _flowPos.z + _norm.z * (cosT * rx) + _binorm.z * (sinT * rz);

      const vIdx = i * ringVerts + j;
      positions[vIdx * 3] = vx;
      positions[vIdx * 3 + 1] = vy;
      positions[vIdx * 3 + 2] = vz;
      uvs[vIdx * 2] = u;
      uvs[vIdx * 2 + 1] = t;
    }
  }

  for (let i = 0; i < tubularSegs; i++) {
    for (let j = 0; j < radialSegs; j++) {
      const a = i * ringVerts + j;
      const b = (i + 1) * ringVerts + j;
      const c = (i + 1) * ringVerts + (j + 1);
      const d = i * ringVerts + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return { geometry, curve };
}

export function addFlowStream(
  parent: THREE.Object3D,
  curves: THREE.CatmullRomCurve3[],
  count: number,
  color: number,
  speed: number,
  baseScale: number,
  partId: string,
  layer: PartLayer,
  collector: THREE.Mesh[],
  anim: AnimationTargets
) {
  if (curves.length === 0) return;
  const geo = new THREE.SphereGeometry(baseScale, 8, 8);
  geo.scale(1.0, 1.55, 1.0);
  const mat = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.25,
    roughness: 0.3,
    metalness: 0.04,
  });
  mat.userData.baseColorHex = color;
  mat.userData.baseOpacity = 1.0;
  mat.userData.focusOpacity = 1.0;
  mat.userData.baseDepthWrite = true;
  mat.userData.baseTransparent = false;
  mat.userData.baseEmissive = color;
  mat.userData.baseEmissiveIntensity = 0.25;

  const instanced = new THREE.InstancedMesh(geo, mat, count);
  instanced.frustumCulled = false;
  instanced.userData.partId = partId;
  instanced.userData.layer = layer;
  instanced.renderOrder = 3;
  instanced.userData.baseRenderOrder = 3;

  const phaseOffsets = new Float32Array(count);
  const curveIndexPerInstance = new Uint8Array(count);

  for (let i = 0; i < count; i++) {
    phaseOffsets[i] = (i / count + ((i * 37) % 100) * 0.003) % 1;
    curveIndexPerInstance[i] = i % curves.length;
    const c = curves[curveIndexPerInstance[i]];
    c.getPointAt(phaseOffsets[i], _flowPos);
    _dummy.position.copy(_flowPos);
    _dummy.scale.setScalar(1);
    _dummy.updateMatrix();
    instanced.setMatrixAt(i, _dummy.matrix);
  }
  instanced.instanceMatrix.needsUpdate = true;

  parent.add(instanced);
  collector.push(instanced as unknown as THREE.Mesh);
  anim.flowStreams.push({
    instancedMesh: instanced,
    curves,
    count,
    speed,
    phaseOffsets,
    curveIndexPerInstance,
    baseScale,
  });
}

export interface EyePairOptions {
  /** Bilateral eye positions relative to the `eyes` group origin */
  leftPos: [number, number, number];
  rightPos: [number, number, number];
  /** Eyeball radius */
  radius: number;
  /** Direction eye looks */
  facing?: 'forwardZ' | 'forwardNegX' | 'lateralZ';
  irisColor?: number;
  slitPupil?: boolean;
  /** Convergence point behind the eyes for optic nerve chiasm */
  chiasmPos?: [number, number, number];
  extraocularMuscles?: boolean;
}

export function buildEyePair(
  group: THREE.Group,
  partId: string,
  textures: ProceduralTextureSet,
  scientific: boolean,
  collector: THREE.Mesh[],
  opts: EyePairOptions
) {
  const scleraMat = makeMaterial(
    { color: 0xf4efe8, layer: 'internal', tissue: 'sclera', roughness: 0.14, clearcoat: 0.88 },
    textures,
    scientific
  );
  const irisMat = makeMaterial(
    {
      color: opts.irisColor ?? 0x7aa3ad,
      layer: 'internal',
      tissue: 'iris',
      roughness: 0.24,
      clearcoat: 0.65,
    },
    textures,
    scientific
  );
  const pupilMat = makeMaterial(
    { color: 0x070a0f, layer: 'internal', tissue: 'sclera', roughness: 0.08, clearcoat: 0.95 },
    textures,
    scientific
  );
  const corneaMat = makeMaterial(
    {
      color: 0xf2f8fc,
      layer: 'internal',
      tissue: 'cartilage',
      opacity: 0.3,
      focusOpacity: 0.34,
      roughness: 0.05,
      clearcoat: 1.0,
    },
    textures,
    scientific
  );
  const nerveMat = makeMaterial(
    { color: 0xe6d496, layer: 'internal', tissue: 'tendon', roughness: 0.42 },
    textures,
    scientific
  );
  const eomMat = makeMaterial(
    { color: 0x9c323a, layer: 'internal', tissue: 'muscle', opacity: 0.94, roughness: 0.46 },
    textures,
    scientific
  );

  const r = opts.radius;
  const facing = opts.facing ?? 'forwardNegX';
  const chiasm = opts.chiasmPos
    ? new THREE.Vector3(...opts.chiasmPos)
    : facing === 'forwardZ'
      ? new THREE.Vector3(0, -0.02, -0.14)
      : new THREE.Vector3(0.14, -0.02, 0);

  const eyePositions = [opts.leftPos, opts.rightPos];

  eyePositions.forEach((pos, idx) => {
    const side = idx === 0 ? -1 : 1;
    const eyeHolder = new THREE.Group();
    eyeHolder.position.set(...pos);

    if (facing === 'forwardNegX') {
      eyeHolder.rotation.y = -Math.PI / 2 + side * -0.32;
    } else if (facing === 'lateralZ') {
      eyeHolder.rotation.y = side === 1 ? 0.32 : Math.PI - 0.32;
    }

    // Sclera globe
    addMesh(eyeHolder, new THREE.SphereGeometry(r, 24, 20), scleraMat, partId, 'internal', collector);

    // Iris disc with radial stroma texture
    const iris = addMesh(
      eyeHolder,
      new THREE.CylinderGeometry(r * 0.54, r * 0.54, r * 0.14, 24),
      irisMat,
      partId,
      'internal',
      collector
    );
    iris.rotation.x = Math.PI / 2;
    iris.position.set(0, 0, r * 0.85);

    // Pupil
    const pupilGeo = opts.slitPupil
      ? new THREE.BoxGeometry(r * 0.16, r * 0.62, r * 0.14)
      : new THREE.CylinderGeometry(r * 0.26, r * 0.26, r * 0.15, 20);
    const pupil = addMesh(eyeHolder, pupilGeo, pupilMat, partId, 'internal', collector);
    if (!opts.slitPupil) pupil.rotation.x = Math.PI / 2;
    pupil.position.set(0, 0, r * 0.89);

    // Refractive Cornea dome
    const cornea = addMesh(
      eyeHolder,
      new THREE.SphereGeometry(r * 0.61, 18, 14),
      corneaMat,
      partId,
      'internal',
      collector,
      3
    );
    cornea.scale.set(1, 1, 0.54);
    cornea.position.set(0, 0, r * 0.72);

    // Tapered Extraocular rectus muscles + tendinous scleral insertions
    if (opts.extraocularMuscles !== false) {
      for (const [my, mz] of [
        [r * 0.78, 0],
        [-r * 0.78, 0],
        [0, r * 0.78],
        [0, -r * 0.78],
      ]) {
        const band = createFusiformGeometry(
          [
            new THREE.Vector3(mz, my, r * 0.34),
            new THREE.Vector3(mz * 1.05, my * 1.05, -r * 0.45),
            new THREE.Vector3(mz * 0.35, my * 0.35, -r * 1.48),
          ],
          (t) => r * (0.08 + 0.11 * Math.sin(t * Math.PI)),
          12,
          8
        );
        addMesh(eyeHolder, band.geometry, eomMat, partId, 'internal', collector);
      }
    }

    group.add(eyeHolder);

    // Optic nerve running to optic chiasm
    const eyeWorldOrigin = new THREE.Vector3(...pos);
    const backOffset =
      facing === 'forwardZ'
        ? new THREE.Vector3(0, 0, -r * 0.9)
        : new THREE.Vector3(r * 0.85, 0, 0);
    const nerveStart = eyeWorldOrigin.clone().add(backOffset);
    const mid = nerveStart.clone().lerp(chiasm, 0.5);
    const nerve = makeTube([nerveStart, mid, chiasm], Math.max(0.011, r * 0.24), 10, 12);
    addMesh(group, nerve.geometry, nerveMat, partId, 'internal', collector);
  });
}

/**
 * Creates a realistic fusiform skeletal muscle belly with tapered proximal and distal collagen tendons.
 */
export function addMuscleBelly(
  group: THREE.Group,
  points: THREE.Vector3[],
  bellyRadius: number,
  muscleMat: THREE.Material,
  tendonMat: THREE.Material,
  partId: string,
  collector: THREE.Mesh[],
  squash: [number, number] = [1.0, 0.88]
) {
  if (points.length < 2) return;

  const curve = new THREE.CatmullRomCurve3(points);
  const p0 = curve.getPointAt(0);
  const p1 = curve.getPointAt(0.16);
  const pEnd0 = curve.getPointAt(0.84);
  const pEnd1 = curve.getPointAt(1);

  // Proximal tendon cord
  const proxTendon = createFusiformGeometry(
    [p0, p0.clone().lerp(p1, 0.55), p1],
    (t) => bellyRadius * (0.24 + 0.22 * t),
    8,
    10
  );
  addMesh(group, proxTendon.geometry, tendonMat, partId, 'muscles', collector, 5);

  // Sculpted fusiform muscle belly
  const bellyPts: THREE.Vector3[] = [];
  for (let i = 0; i <= 6; i++) {
    bellyPts.push(curve.getPointAt(0.13 + (i / 6) * 0.74));
  }
  const belly = createFusiformGeometry(
    bellyPts,
    (t) => bellyRadius * (0.42 + 0.64 * Math.pow(Math.sin(t * Math.PI), 0.72)),
    18,
    14,
    squash
  );
  addMesh(group, belly.geometry, muscleMat, partId, 'muscles', collector, 5);

  // Distal tendon cord
  const distTendon = createFusiformGeometry(
    [pEnd0, pEnd0.clone().lerp(pEnd1, 0.55), pEnd1],
    (t) => bellyRadius * (0.44 - 0.22 * t),
    8,
    10
  );
  addMesh(group, distTendon.geometry, tendonMat, partId, 'muscles', collector, 5);
}

// Deterministic pseudo-random helper for organic vascular branching
function seededNoise(seed: number): number {
  const s = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
}

export interface VesselBranchOpts {
  tubularSegs?: number;
  radialSegs?: number;
  tortuosity?: number;
  seed?: number;
  valveCount?: number;
  squash?: [number, number];
}

/**
 * Generates an organic tapered blood vessel geometry with natural physiological undulation
 * and subtle venous valve sinus bulges (characteristic of real human superficial/deep veins).
 */
export function createVesselBranchGeo(
  points: THREE.Vector3[],
  startR: number,
  endR: number,
  opts: VesselBranchOpts = {}
): { geometry: THREE.BufferGeometry; curve: THREE.CatmullRomCurve3 } {
  const {
    tubularSegs = 16,
    radialSegs = 8,
    tortuosity = 0.006,
    seed = 1,
    valveCount = 0,
    squash = [1, 1],
  } = opts;

  let pathPts = points;
  if (tortuosity > 0 && points.length >= 2) {
    const baseCurve = new THREE.CatmullRomCurve3(points);
    const totalSub = Math.max(points.length * 2, 5);
    pathPts = [];
    for (let i = 0; i <= totalSub; i++) {
      const t = i / totalSub;
      const pt = baseCurve.getPointAt(t);
      if (i > 0 && i < totalSub) {
        const env = Math.sin(t * Math.PI);
        const wx = (seededNoise(seed * 17 + i * 3.1) - 0.5) * 2 * tortuosity * env;
        const wy = (seededNoise(seed * 29 + i * 5.7) - 0.5) * 1.4 * tortuosity * env;
        const wz = (seededNoise(seed * 41 + i * 7.3) - 0.5) * 2 * tortuosity * env;
        pt.x += wx;
        pt.y += wy;
        pt.z += wz;
      }
      pathPts.push(pt);
    }
  }

  return createFusiformGeometry(
    pathPts,
    (t) => {
      let r = THREE.MathUtils.lerp(startR, endR, Math.pow(t, 0.88));
      if (valveCount > 0 && t > 0.08 && t < 0.92) {
        let bulge = 0;
        for (let v = 1; v <= valveCount; v++) {
          const vt = v / (valveCount + 1);
          const d = (t - vt) / 0.028;
          bulge += 0.17 * Math.exp(-d * d);
        }
        r *= 1 + bulge;
      }
      return r;
    },
    tubularSegs,
    radialSegs,
    squash
  );
}

export interface FineTreeOpts {
  /** Number of 2nd-order tributaries sprouting along parent curve */
  branchCount: number;
  /** Initial radius of 2nd-order twigs */
  baseRadius: number;
  /** World-space length of 2nd-order twigs */
  branchLength: number;
  /** Optional 3rd-order sub-twigs per 2nd-order branch (default 2) */
  subBranches?: number;
  /** Radial direction bias (e.g. outward normal vector) */
  outwardBias?: THREE.Vector3;
  /** Scale multiplier per axis for branch reach [x, y, z] */
  spreadAxis?: [number, number, number];
  /** Angle sign flip or alternate around parent curve */
  alternateSides?: boolean;
  /** Tortuosity amplitude */
  tortuosity?: number;
  /** Deterministic seed */
  seed?: number;
  /** T-range [minT, maxT] along parent curve */
  tRange?: [number, number];
  /** Depth of branching (2 or 3 tiers -> creates 3rd & 4th order capillary tips) */
  depth?: 1 | 2 | 3;
}

/**
 * Recursively grows multi-order fine venules / arterioles along any parent CatmullRomCurve3
 * and pushes their BufferGeometries into collectorGeos for single-draw-call merging.
 */
export function spawnFineVesselTree(
  collectorGeos: THREE.BufferGeometry[],
  parentCurve: THREE.CatmullRomCurve3,
  opts: FineTreeOpts
) {
  const {
    branchCount,
    baseRadius,
    branchLength,
    subBranches = 2,
    outwardBias,
    spreadAxis = [1, 1, 1],
    alternateSides = true,
    tortuosity = 0.008,
    seed = 11,
    tRange = [0.12, 0.92],
    depth = 2,
  } = opts;

  const upRef = new THREE.Vector3(0, 1, 0);
  const altRef = new THREE.Vector3(0, 0, 1);

  for (let i = 0; i < branchCount; i++) {
    const frac = branchCount === 1 ? 0.5 : i / (branchCount - 1);
    const t = THREE.MathUtils.lerp(tRange[0], tRange[1], frac);
    const origin = parentCurve.getPointAt(t);
    const tangent = parentCurve.getTangentAt(t).normalize();

    const ref = Math.abs(tangent.y) > 0.88 ? altRef : upRef;
    const perpA = new THREE.Vector3().crossVectors(tangent, ref).normalize();
    const perpB = new THREE.Vector3().crossVectors(tangent, perpA).normalize();

    const s1 = seededNoise(seed * 13 + i * 5.3);
    const s2 = seededNoise(seed * 23 + i * 9.1);
    const angle = alternateSides
      ? (i % 2 === 0 ? 0.45 : -0.45 + Math.PI) + (s1 - 0.5) * 1.15
      : s1 * Math.PI * 2;

    const dir = new THREE.Vector3()
      .addScaledVector(perpA, Math.cos(angle) * spreadAxis[0])
      .addScaledVector(perpB, Math.sin(angle) * spreadAxis[2])
      .addScaledVector(tangent, (0.35 + s2 * 0.45) * spreadAxis[1]);

    if (outwardBias) {
      dir.addScaledVector(outwardBias, 0.72);
    }
    dir.normalize();

    const len = branchLength * (0.76 + s1 * 0.48);
    const pMid = origin
      .clone()
      .addScaledVector(dir, len * 0.52)
      .add(
        new THREE.Vector3(
          (s2 - 0.5) * len * 0.28,
          (s1 - 0.5) * len * 0.22,
          (seededNoise(seed + i * 19) - 0.5) * len * 0.28
        )
      );
    const pTip = origin.clone().addScaledVector(dir, len);

    const startR = Math.max(0.0014, baseRadius * (0.85 + s2 * 0.3));
    const endR = Math.max(0.0011, startR * 0.26);

    const bRes = createVesselBranchGeo([origin, pMid, pTip], startR, endR, {
      tubularSegs: 8,
      radialSegs: 5,
      tortuosity,
      seed: seed + i * 7,
    });
    collectorGeos.push(bRes.geometry);

    // 3rd-order & optional 4th-order daughter capillary twigs
    if (depth >= 2 && subBranches > 0) {
      for (let j = 0; j < subBranches; j++) {
        const subT = 0.32 + (j / Math.max(1, subBranches)) * 0.52;
        const subOrig = bRes.curve.getPointAt(subT);
        const subTan = bRes.curve.getTangentAt(subT).normalize();
        const subRef = Math.abs(subTan.y) > 0.88 ? altRef : upRef;
        const subPerpA = new THREE.Vector3().crossVectors(subTan, subRef).normalize();
        const subPerpB = new THREE.Vector3().crossVectors(subTan, subPerpA).normalize();

        const sj = seededNoise(seed * 31 + i * 13 + j * 17);
        const subSign = j % 2 === 0 ? 1 : -1;
        const subDir = new THREE.Vector3()
          .addScaledVector(subTan, 0.58)
          .addScaledVector(subPerpA, subSign * (0.55 + sj * 0.35) * spreadAxis[0])
          .addScaledVector(subPerpB, ((sj - 0.5) * 0.8) * spreadAxis[2]);
        if (outwardBias) subDir.addScaledVector(outwardBias, 0.45);
        subDir.normalize();

        const subLen = len * (0.48 + sj * 0.26);
        const subMid = subOrig
          .clone()
          .addScaledVector(subDir, subLen * 0.5)
          .addScaledVector(subPerpB, (sj - 0.5) * subLen * 0.24);
        const subTip = subOrig.clone().addScaledVector(subDir, subLen);
        const subStartR = Math.max(0.0012, startR * (0.56 - subT * 0.18));
        const subEndR = 0.001;

        const subRes = createVesselBranchGeo([subOrig, subMid, subTip], subStartR, subEndR, {
          tubularSegs: 6,
          radialSegs: 5,
          tortuosity: tortuosity * 0.65,
          seed: seed + i * 29 + j * 11,
        });
        collectorGeos.push(subRes.geometry);

        if (depth >= 3 && j === 0) {
          const capOrig = subRes.curve.getPointAt(0.55);
          const capDir = subDir
            .clone()
            .addScaledVector(subPerpA, -subSign * 0.5)
            .addScaledVector(subPerpB, 0.35)
            .normalize();
          const capTip = capOrig.clone().addScaledVector(capDir, subLen * 0.58);
          const capGeo = createVesselBranchGeo([capOrig, capTip], subStartR * 0.58, 0.0009, {
            tubularSegs: 5,
            radialSegs: 4,
            tortuosity: tortuosity * 0.4,
            seed: seed + i * 43 + j,
          });
          collectorGeos.push(capGeo.geometry);
        }
      }
    }
  }
}

/**
 * Merges multiple compatible indexed BufferGeometries into a single draw-call geometry
 * and disposes all intermediate geometries immediately.
 */
export function mergeVesselGeometries(geos: THREE.BufferGeometry[]): THREE.BufferGeometry | null {
  const valid = geos.filter((g) => g && g.attributes.position && g.attributes.position.count > 0);
  if (valid.length === 0) return null;
  const merged = BufferGeometryUtils.mergeGeometries(valid, false);
  for (const g of geos) {
    g.dispose();
  }
  if (!merged) return null;
  merged.computeBoundingSphere();
  return merged;
}

