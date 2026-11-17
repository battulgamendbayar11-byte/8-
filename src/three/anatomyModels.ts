import * as THREE from 'three';
import { SpeciesData, SpeciesId } from '../types/anatomy';
import { buildHumanFemalePart, buildHumanPart } from './builders/humanAnatomy';
import {
  AnimationTargets,
  BuiltPartEntry,
  BuiltSpeciesModel,
  PartBuilderFn,
} from './modelUtils';
import { ProceduralTextureSet } from './proceduralTextures';

export type { BuiltPartEntry, BuiltSpeciesModel, FlowStream } from './modelUtils';

// Module-scope reusable math helpers for zero GC during 4D updates
const _dummy = new THREE.Object3D();
const _flowPos = new THREE.Vector3();
const _flowTan = new THREE.Vector3();
const _upAxis = new THREE.Vector3(0, 1, 0);
const _box = new THREE.Box3();
const _boxSize = new THREE.Vector3();
const _boxCenter = new THREE.Vector3();

const SPECIES_BUILDERS: Record<SpeciesId, PartBuilderFn> = {
  human: buildHumanPart,
  human_female: buildHumanFemalePart,
};

export function buildSpeciesModel(
  species: SpeciesData,
  textures: ProceduralTextureSet,
  scientific: boolean
): BuiltSpeciesModel {
  const root = new THREE.Group();
  const parts: BuiltPartEntry[] = [];
  const allInteractiveMeshes: THREE.Mesh[] = [];

  const anim: AnimationTargets = {
    heartGroups: [],
    breathGroups: [],
    spinGroups: [],
    pulseMeshes: [],
    flowStreams: [],
  };

  const builder = SPECIES_BUILDERS[species.id];

  for (const part of species.parts) {
    const group = new THREE.Group();
    group.position.set(...part.basePosition);

    const partMeshes: THREE.Mesh[] = [];
    builder(part.id, group, part.color, textures, scientific, partMeshes, anim);

    allInteractiveMeshes.push(...partMeshes);
    root.add(group);

    // Measure local bounding box in group space for smart focus enlargement & camera framing
    group.updateMatrixWorld(true);
    _box.makeEmpty();
    if (partMeshes.length > 0) {
      for (const m of partMeshes) {
        m.geometry.computeBoundingBox();
        if (m.geometry.boundingBox) {
          const cloned = m.geometry.boundingBox.clone();
          // Transform relative to part group
          const relMatrix = new THREE.Matrix4().copy(group.matrixWorld).invert().multiply(m.matrixWorld);
          cloned.applyMatrix4(relMatrix);
          _box.union(cloned);
        }
      }
    }
    if (_box.isEmpty()) {
      _boxCenter.set(0, 0, 0);
      _boxSize.set(0.5, 0.5, 0.5);
    } else {
      _box.getCenter(_boxCenter);
      _box.getSize(_boxSize);
    }

    const maxExtent = Math.max(_boxSize.x, _boxSize.y, _boxSize.z, 0.25);
    // Normalize small organs (heart, eyes, kidneys, uterus) up toward ~1.45-2.6x while keeping full-body layers ~1.12x
    const focusScale = THREE.MathUtils.clamp(1.65 / Math.pow(maxExtent, 0.65), 1.12, 2.55);

    parts.push({
      partId: part.id,
      layer: part.layer,
      group,
      meshes: partMeshes,
      basePosition: new THREE.Vector3(...part.basePosition),
      explodeOffset: new THREE.Vector3(...part.explodeOffset),
      labelAnchorLocal: new THREE.Vector3(...part.labelOffset),
      localBoundsCenter: _boxCenter.clone(),
      localBoundsSize: _boxSize.clone(),
      focusScale,
      currentScale: 1,
      currentFocusOffset: new THREE.Vector3(0, 0, 0),
    });
  }

  let heartPhase = 0;
  let breathPhase = 0;

  const update4D = (dt: number, elapsedSeconds: number) => {
    // 1. Lub-dub cardiac contraction waveform
    heartPhase += dt;
    for (const h of anim.heartGroups) {
      const phase = heartPhase * h.rate;
      const systole = Math.pow(Math.max(0, Math.sin(phase)), 6);
      const diastole = 0.45 * Math.pow(Math.max(0, Math.sin(phase - 0.85)), 4);
      const scale = 1 + h.amp * (systole + diastole);
      h.group.scale.setScalar(scale);
    }

    // 2. Smooth respiratory / ribcage / gill / air-sac breathing
    breathPhase += dt;
    for (const b of anim.breathGroups) {
      const wave = 0.5 + 0.5 * Math.sin(breathPhase * b.rate);
      const sx = 1 + b.amp * b.axisMask[0] * wave;
      const syB = 1 + b.amp * b.axisMask[1] * wave;
      const sz = 1 + b.amp * b.axisMask[2] * wave;
      b.group.scale.set(sx, syB, sz);
    }

    // 3. Rotary flagella & spinning plasmids
    for (const s of anim.spinGroups) {
      s.group.rotation[s.axis] = elapsedSeconds * s.speed;
    }

    // 4. Peristaltic dorsal vessel wave (insects)
    for (const p of anim.pulseMeshes) {
      const w = 0.5 + 0.5 * Math.sin(elapsedSeconds * p.rate - p.index * 0.9);
      p.mesh.scale.set(1.3, 0.85 + p.amp * w, 0.85 + p.amp * w);
    }

    // 5. Continuous vascular / hemocyanin / sap flow particles along curves
    for (const stream of anim.flowStreams) {
      for (let i = 0; i < stream.count; i++) {
        const curve = stream.curves[stream.curveIndexPerInstance[i]];
        const u = (stream.phaseOffsets[i] + elapsedSeconds * stream.speed) % 1;
        curve.getPointAt(u, _flowPos);
        curve.getTangentAt(u, _flowTan);
        _dummy.position.copy(_flowPos);
        _dummy.quaternion.setFromUnitVectors(_upAxis, _flowTan);
        _dummy.scale.setScalar(1);
        _dummy.updateMatrix();
        stream.instancedMesh.setMatrixAt(i, _dummy.matrix);
      }
      stream.instancedMesh.instanceMatrix.needsUpdate = true;
    }
  };

  return {
    root,
    parts,
    allInteractiveMeshes,
    update4D,
    dispose: () => {
      root.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.InstancedMesh).isInstancedMesh) {
          const mesh = obj as THREE.Mesh;
          mesh.geometry.dispose();
          if (Array.isArray(mesh.material)) {
            mesh.material.forEach((m) => m.dispose());
          } else {
            mesh.material.dispose();
          }
        }
      });
    },
  };
}
