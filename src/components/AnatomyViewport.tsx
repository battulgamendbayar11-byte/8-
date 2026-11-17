import React, { useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { UI_STRINGS } from '../data/anatomyData';
import { buildSpeciesModel, BuiltPartEntry, BuiltSpeciesModel } from '../three/anatomyModels';
import { createProceduralTextures, ProceduralTextureSet } from '../three/proceduralTextures';
import {
  LabelMode,
  Language,
  LayerFilter,
  RenderMode,
  SpeciesData,
} from '../types/anatomy';

export interface AnatomyViewportHandle {
  zoomIn: () => void;
  zoomOut: () => void;
  resetCamera: () => void;
}

interface AnatomyViewportProps {
  species: SpeciesData;
  language: Language;
  layerFilter: LayerFilter;
  renderMode: RenderMode;
  explodeFactor: number;
  selectedPartId: string | null;
  autoRotate: boolean;
  labelMode: LabelMode;
  live4D: boolean;
  onSelectPart: (partId: string | null) => void;
}

// Reusable math scratch objects (zero GC in render loop)
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _vecC = new THREE.Vector3();
const _proj = new THREE.Vector3();
const _emissiveHover = new THREE.Color(0x5c1418);
const _emissiveZero = new THREE.Color(0x000000);
const _ghostTint = new THREE.Color(0xcbd5e1);
const _ghostColor = new THREE.Color();

function detectSoftwareWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || '');
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return false;
  }
}

function computeFocusTargetCenter(
  entry: BuiltPartEntry,
  species: SpeciesData,
  out: THREE.Vector3
): THREE.Vector3 {
  const maxExtent = Math.max(entry.localBoundsSize.x, entry.localBoundsSize.y, entry.localBoundsSize.z);
  const baseCenterY = entry.basePosition.y + entry.localBoundsCenter.y;
  const targetY =
    maxExtent < 1.35
      ? THREE.MathUtils.lerp(species.cameraTarget[1], baseCenterY, 0.35)
      : baseCenterY;
  return out.set(0, targetY, 0.72);
}

export const AnatomyViewport = React.forwardRef<AnatomyViewportHandle, AnatomyViewportProps>(
  function AnatomyViewport(
    {
      species,
      language,
      layerFilter,
      renderMode,
      explodeFactor,
      selectedPartId,
      autoRotate,
      labelMode,
      live4D,
      onSelectPart,
    },
    ref
  ) {
    const mountRef = useRef<HTMLDivElement | null>(null);
    const labelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const subLabelRefs = useRef<Record<string, HTMLButtonElement | null>>({});
    const wasFocusedRef = useRef(false);
    const [contextLost, setContextLost] = useState(false);
    const [hoveredPartId, setHoveredPartId] = useState<string | null>(null);

    // Mutable refs synced from React props so WebGL canvas is never torn down
    const stateRef = useRef({
      species,
      layerFilter,
      renderMode,
      explodeFactor,
      selectedPartId,
      hoveredPartId: null as string | null,
      autoRotate,
      labelMode,
      live4D,
      onSelectPart,
    });
    stateRef.current.species = species;
    stateRef.current.layerFilter = layerFilter;
    stateRef.current.renderMode = renderMode;
    stateRef.current.explodeFactor = explodeFactor;
    stateRef.current.selectedPartId = selectedPartId;
    stateRef.current.autoRotate = autoRotate;
    stateRef.current.labelMode = labelMode;
    stateRef.current.live4D = live4D;
    stateRef.current.onSelectPart = onSelectPart;

    const engineRef = useRef<{
      scene: THREE.Scene;
      camera: THREE.PerspectiveCamera;
      renderer: THREE.WebGLRenderer;
      controls: OrbitControls;
      textures: ProceduralTextureSet;
      builtModel: BuiltSpeciesModel | null;
      groundGroup: THREE.Group;
      currentExplode: number;
      cameraTargetGoal: THREE.Vector3 | null;
      cameraPosGoal: THREE.Vector3 | null;
      requestWake: () => void;
      isSoftwareGl: boolean;
    } | null>(null);

    useImperativeHandle(ref, () => ({
      zoomIn: () => {
        const eng = engineRef.current;
        if (!eng) return;
        const offset = eng.camera.position.clone().sub(eng.controls.target);
        offset.multiplyScalar(0.8);
        if (offset.length() < eng.controls.minDistance) {
          offset.setLength(eng.controls.minDistance);
        }
        eng.cameraPosGoal = eng.controls.target.clone().add(offset);
        eng.cameraTargetGoal = eng.controls.target.clone();
        eng.requestWake();
      },
      zoomOut: () => {
        const eng = engineRef.current;
        if (!eng) return;
        const offset = eng.camera.position.clone().sub(eng.controls.target);
        offset.multiplyScalar(1.22);
        if (offset.length() > eng.controls.maxDistance) {
          offset.setLength(eng.controls.maxDistance);
        }
        eng.cameraPosGoal = eng.controls.target.clone().add(offset);
        eng.cameraTargetGoal = eng.controls.target.clone();
        eng.requestWake();
      },
      resetCamera: () => {
        const eng = engineRef.current;
        if (!eng) return;
        const sp = stateRef.current.species;
        const selId = stateRef.current.selectedPartId;
        if (selId && eng.builtModel) {
          const entry = eng.builtModel.parts.find((p) => p.partId === selId);
          if (entry) {
            const center = computeFocusTargetCenter(entry, sp, new THREE.Vector3());
            const enlargedRadius = Math.max(0.28, 0.5 * entry.localBoundsSize.length() * entry.focusScale);
            const fovRad = THREE.MathUtils.degToRad(eng.camera.fov);
            const dist = THREE.MathUtils.clamp((enlargedRadius / Math.tan(fovRad * 0.5)) * 1.15, 1.45, 6.2);
            eng.cameraTargetGoal = center;
            eng.cameraPosGoal = center.clone().add(new THREE.Vector3(0.2 * dist, 0.08 * dist, dist));
            eng.requestWake();
            return;
          }
        }
        eng.cameraPosGoal = new THREE.Vector3(...sp.cameraPosition);
        eng.cameraTargetGoal = new THREE.Vector3(...sp.cameraTarget);
        eng.requestWake();
      },
    }));

    // Initialize WebGL scene once
    useEffect(() => {
      const container = mountRef.current;
      if (!container) return;

      const isSoftwareGl = detectSoftwareWebGL();
      const width = Math.max(container.clientWidth, 1);
      const height = Math.max(container.clientHeight, 1);

      const scene = new THREE.Scene();
      scene.background = new THREE.Color(0xedeff2);
      scene.fog = new THREE.FogExp2(0xedeff2, 0.016);

      const camera = new THREE.PerspectiveCamera(44, width / height, 0.1, 80);
      camera.position.set(...stateRef.current.species.cameraPosition);

      const renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        powerPreference: 'high-performance',
      });
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.04;
      renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
      renderer.setSize(width, height);
      renderer.shadowMap.enabled = !isSoftwareGl;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;

      const canvas = renderer.domElement;
      canvas.style.display = 'block';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      container.appendChild(canvas);

      // Photorealistic clinical studio environment reflections
      const pmremGenerator = new THREE.PMREMGenerator(renderer);
      const envTex = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environment = envTex;
      scene.environmentIntensity = 0.72;
      pmremGenerator.dispose();

      // Calibrated 3-point + softbox studio lighting for biological tissue realism
      const hemiLight = new THREE.HemisphereLight(0xfefefe, 0xcbd5e1, 0.85);
      scene.add(hemiLight);

      const keyLight = new THREE.DirectionalLight(0xfff7ed, 1.65);
      keyLight.position.set(4.5, 6.5, 5.5);
      keyLight.castShadow = !isSoftwareGl;
      keyLight.shadow.mapSize.set(isSoftwareGl ? 1024 : 2048, isSoftwareGl ? 1024 : 2048);
      keyLight.shadow.camera.near = 1;
      keyLight.shadow.camera.far = 20;
      keyLight.shadow.camera.left = -4;
      keyLight.shadow.camera.right = 4;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -4;
      keyLight.shadow.bias = -0.0003;
      keyLight.shadow.normalBias = 0.018;
      scene.add(keyLight);

      const rimLight = new THREE.DirectionalLight(0xdce6f2, 0.72);
      rimLight.position.set(-4.5, 3.0, -4.5);
      scene.add(rimLight);

      if (!isSoftwareGl) {
        RectAreaLightUniformsLib.init();
        const warmKeyRect = new THREE.RectAreaLight(0xfff7ed, 3.2, 4.2, 5.5);
        warmKeyRect.position.set(3.8, 2.4, 4.6);
        warmKeyRect.lookAt(0, 0.1, 0);
        scene.add(warmKeyRect);

        const coolRimRect = new THREE.RectAreaLight(0xe0e9f5, 2.1, 3.8, 5.0);
        coolRimRect.position.set(-4.0, 1.8, -3.4);
        coolRimRect.lookAt(0, 0.1, 0);
        scene.add(coolRimRect);
      }

      const textures = createProceduralTextures(renderer.capabilities.getMaxAnisotropy());

      // Grounding stage reticle & soft contact shadow
      const groundGroup = new THREE.Group();
      groundGroup.position.y = stateRef.current.species.groundY;

      const reticleMat = new THREE.MeshBasicMaterial({
        map: textures.stageReticle,
        transparent: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1,
        polygonOffsetUnits: -1,
      });
      const reticleDisc = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 5.8), reticleMat);
      reticleDisc.rotation.x = -Math.PI / 2;
      groundGroup.add(reticleDisc);

      const shadowMat = new THREE.MeshBasicMaterial({
        map: textures.contactShadow,
        transparent: true,
        opacity: 0.44,
        depthWrite: false,
      });
      const shadowDisc = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), shadowMat);
      shadowDisc.rotation.x = -Math.PI / 2;
      shadowDisc.position.y = 0.02;
      groundGroup.add(shadowDisc);
      scene.add(groundGroup);

      // OrbitControls
      const controls = new OrbitControls(camera, canvas);
      controls.enableDamping = !isSoftwareGl;
      controls.dampingFactor = 0.07;
      controls.minDistance = 2.0;
      controls.maxDistance = 12.5;
      controls.maxPolarAngle = Math.PI * 0.88;
      controls.target.set(...stateRef.current.species.cameraTarget);
      controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;
      controls.autoRotateSpeed = 0.9;

      // Build initial species
      const initialBuilt = buildSpeciesModel(
        stateRef.current.species,
        textures,
        stateRef.current.renderMode === 'scientific'
      );
      initialBuilt.update4D(0, 0);
      scene.add(initialBuilt.root);

      if (!isSoftwareGl) {
        renderer.compile(scene, camera);
      }

      let frameId = 0;
      let isMounted = true;
      let activeAnimating = true;
      let lastTime = performance.now();
      let elapsed4D = 0;

      const afterDraw = (cb: () => void) => {
        const gl = renderer.getContext() as WebGL2RenderingContext;
        if (gl && typeof gl.fenceSync === 'function') {
          const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
          gl.flush();
          const poll = () => {
            if (!isMounted) {
              if (sync) gl.deleteSync(sync);
              return;
            }
            const status = sync ? gl.getSyncParameter(sync, gl.SYNC_STATUS) : gl.SIGNALED;
            if (status === gl.UNSIGNALED) {
              frameId = window.setTimeout(poll, 5);
            } else {
              if (sync) gl.deleteSync(sync);
              frameId = window.setTimeout(cb, 80);
            }
          };
          frameId = window.setTimeout(poll, 5);
        } else {
          frameId = window.setTimeout(cb, 80);
        }
      };

      const updateProjectedLabels = () => {
        const eng = engineRef.current;
        if (!eng || !eng.builtModel) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        const {
          labelMode: lm,
          layerFilter: lf,
          selectedPartId: selId,
          species: sp,
        } = stateRef.current;
        const labelsOn = lm !== 'off';
        const isDetailed = lm === 'detailed';
        const hasFocus = selId !== null;

        const isLayerVisible = (layer: string) =>
          lf === 'all' || lf === layer;

        const subTargetPartId =
          selId ?? (sp.parts.some((p) => p.id === 'skeleton') ? 'skeleton' : null);

        for (const entry of eng.builtModel.parts) {
          const el = labelRefs.current[entry.partId];
          const partData = sp.parts.find((p) => p.id === entry.partId);
          const isSelectedEntry = entry.partId === selId;
          // In focus mode, hide background ghost labels so only the enlarged organ and its detailed pins remain clean
          const partVisible =
            labelsOn &&
            (hasFocus ? isSelectedEntry : isLayerVisible(entry.layer));

          entry.group.updateMatrixWorld();

          if (el) {
            if (!partVisible) {
              el.style.opacity = '0';
              el.style.pointerEvents = 'none';
            } else {
              _vecA.copy(entry.labelAnchorLocal).applyMatrix4(entry.group.matrixWorld);
              _proj.copy(_vecA).project(camera);

              const sx = ((_proj.x + 1) * 0.5) * w;
              const sy = ((-_proj.y + 1) * 0.5) * h;

              if (_proj.z > 1 || _proj.z < -1 || sx < 16 || sx > w - 16 || sy < 16 || sy > h - 16) {
                el.style.opacity = '0';
                el.style.pointerEvents = 'none';
              } else {
                el.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
                el.style.opacity = '1';
                el.style.pointerEvents = 'auto';
              }
            }
          }

          if (partData) {
            const showSubForPart =
              isDetailed && partVisible && subTargetPartId === entry.partId;
            for (const sub of partData.subParts) {
              const subEl = subLabelRefs.current[`${entry.partId}:${sub.id}`];
              if (!subEl) continue;

              if (!showSubForPart) {
                subEl.style.opacity = '0';
                subEl.style.pointerEvents = 'none';
                continue;
              }

              _vecA
                .set(sub.anchorLocal[0], sub.anchorLocal[1], sub.anchorLocal[2])
                .applyMatrix4(entry.group.matrixWorld);
              _proj.copy(_vecA).project(camera);

              const sx = ((_proj.x + 1) * 0.5) * w;
              const sy = ((-_proj.y + 1) * 0.5) * h;

              if (_proj.z > 1 || _proj.z < -1 || sx < 20 || sx > w - 20 || sy < 20 || sy > h - 20) {
                subEl.style.opacity = '0';
                subEl.style.pointerEvents = 'none';
              } else {
                subEl.style.transform = `translate3d(${sx.toFixed(1)}px, ${sy.toFixed(1)}px, 0) translate(-50%, -50%)`;
                subEl.style.opacity = '1';
                subEl.style.pointerEvents = 'auto';
              }
            }
          }
        }
      };

      const tick = () => {
        if (!isMounted) return;
        const eng = engineRef.current;
        if (!eng) return;

        const now = performance.now();
        const dt = Math.min((now - lastTime) / 1000, 0.1);
        lastTime = now;

        let needsMoreFrames = false;

        // 1. Smoothly damp explode factor
        const targetExplode = stateRef.current.explodeFactor;
        if (Math.abs(eng.currentExplode - targetExplode) > 0.001) {
          eng.currentExplode = THREE.MathUtils.damp(eng.currentExplode, targetExplode, 8, dt);
          needsMoreFrames = true;
        } else {
          eng.currentExplode = targetExplode;
        }

        if (eng.builtModel) {
          const selId = stateRef.current.selectedPartId;
          const isFocused = selId !== null;
          const sp = stateRef.current.species;

          for (const entry of eng.builtModel.parts) {
            const isSelected = isFocused && entry.partId === selId;
            const targetScale = isSelected ? entry.focusScale : 1.0;

            if (Math.abs(entry.currentScale - targetScale) > 0.001) {
              entry.currentScale = THREE.MathUtils.damp(entry.currentScale, targetScale, 8, dt);
              needsMoreFrames = true;
            } else {
              entry.currentScale = targetScale;
            }
            entry.group.scale.setScalar(entry.currentScale);

            if (isSelected) {
              computeFocusTargetCenter(entry, sp, _vecA);
              _vecC
                .copy(_vecA)
                .sub(entry.basePosition)
                .addScaledVector(entry.explodeOffset, -eng.currentExplode)
                .addScaledVector(entry.localBoundsCenter, -entry.currentScale);
            } else if (isFocused) {
              _vecC.set(0, 0, -0.58);
            } else {
              _vecC.set(0, 0, 0);
            }

            if (entry.currentFocusOffset.distanceTo(_vecC) > 0.0015) {
              entry.currentFocusOffset.x = THREE.MathUtils.damp(entry.currentFocusOffset.x, _vecC.x, 8, dt);
              entry.currentFocusOffset.y = THREE.MathUtils.damp(entry.currentFocusOffset.y, _vecC.y, 8, dt);
              entry.currentFocusOffset.z = THREE.MathUtils.damp(entry.currentFocusOffset.z, _vecC.z, 8, dt);
              needsMoreFrames = true;
            } else {
              entry.currentFocusOffset.copy(_vecC);
            }

            _vecB
              .copy(entry.explodeOffset)
              .multiplyScalar(eng.currentExplode)
              .add(entry.basePosition)
              .add(entry.currentFocusOffset);
            entry.group.position.copy(_vecB);
          }

          if (stateRef.current.live4D) {
            elapsed4D += dt;
            eng.builtModel.update4D(dt, elapsed4D);
            needsMoreFrames = true;
          } else {
            eng.builtModel.update4D(0, elapsed4D);
          }
        }

        // 2. Smoothly damp camera preset / focus goals
        if (eng.cameraTargetGoal) {
          controls.target.lerp(eng.cameraTargetGoal, 1 - Math.exp(-7 * dt));
          if (controls.target.distanceTo(eng.cameraTargetGoal) < 0.005) {
            controls.target.copy(eng.cameraTargetGoal);
            eng.cameraTargetGoal = null;
          } else {
            needsMoreFrames = true;
          }
        }

        if (eng.cameraPosGoal) {
          camera.position.lerp(eng.cameraPosGoal, 1 - Math.exp(-7 * dt));
          if (camera.position.distanceTo(eng.cameraPosGoal) < 0.01) {
            camera.position.copy(eng.cameraPosGoal);
            eng.cameraPosGoal = null;
          } else {
            needsMoreFrames = true;
          }
        }

        controls.autoRotate = !isSoftwareGl && stateRef.current.autoRotate;
        if (controls.autoRotate) {
          needsMoreFrames = true;
        }

        const controlsChanged = controls.update();
        if (controlsChanged) {
          needsMoreFrames = true;
        }

        renderer.render(scene, camera);
        updateProjectedLabels();

        if (needsMoreFrames) {
          if (isSoftwareGl) {
            afterDraw(tick);
          } else {
            frameId = requestAnimationFrame(tick);
          }
        } else {
          activeAnimating = false;
        }
      };

      const requestWake = () => {
        if (!isMounted) return;
        if (!activeAnimating) {
          activeAnimating = true;
          lastTime = performance.now();
          if (isSoftwareGl) {
            frameId = window.setTimeout(tick, 0);
          } else {
            frameId = requestAnimationFrame(tick);
          }
        }
      };

      engineRef.current = {
        scene,
        camera,
        renderer,
        controls,
        textures,
        builtModel: initialBuilt,
        groundGroup,
        currentExplode: stateRef.current.explodeFactor,
        cameraTargetGoal: null,
        cameraPosGoal: null,
        requestWake,
        isSoftwareGl,
      };

      // Cancel scripted camera transition if user interacts manually
      const onControlsStart = () => {
        if (engineRef.current) {
          engineRef.current.cameraPosGoal = null;
          engineRef.current.cameraTargetGoal = null;
        }
        requestWake();
      };
      const onControlsChange = () => {
        requestWake();
      };
      controls.addEventListener('start', onControlsStart);
      controls.addEventListener('change', onControlsChange);

      // Raycasting (click & throttled hover)
      const raycaster = new THREE.Raycaster();
      const pointer = new THREE.Vector2();
      let downX = 0;
      let downY = 0;
      let lastHoverCheck = 0;

      const getIntersections = (clientX: number, clientY: number) => {
        const eng = engineRef.current;
        if (!eng || !eng.builtModel) return [];
        const rect = canvas.getBoundingClientRect();
        pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
        pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
        raycaster.setFromCamera(pointer, camera);

        const visibleMeshes = eng.builtModel.allInteractiveMeshes.filter(
          (m) => m.visible && m.parent?.visible
        );
        return raycaster.intersectObjects(visibleMeshes, false);
      };

      const pickPriorityHit = (hits: THREE.Intersection[]) => {
        const selId = stateRef.current.selectedPartId;
        if (selId) {
          const selHit = hits.find((h) => h.object.userData.partId === selId);
          if (selHit) return selHit;
        }
        if (stateRef.current.layerFilter === 'muscles') {
          return hits.find((h) => h.object.userData.layer === 'muscles') ?? hits[0];
        }
        return (
          hits.find((h) => h.object.userData.layer === 'internal') ??
          hits.find((h) => h.object.userData.layer === 'skeleton') ??
          hits.find((h) => h.object.userData.layer === 'muscles') ??
          hits[0]
        );
      };

      const onPointerDown = (e: PointerEvent) => {
        downX = e.clientX;
        downY = e.clientY;
      };

      const onPointerUp = (e: PointerEvent) => {
        const dist = Math.hypot(e.clientX - downX, e.clientY - downY);
        if (dist > 6) return; // Dragged to orbit, do not trigger selection
        const hits = getIntersections(e.clientX, e.clientY);
        if (hits.length > 0) {
          const pickedHit = pickPriorityHit(hits);
          const partId = pickedHit.object.userData.partId as string | undefined;
          if (partId) {
            stateRef.current.onSelectPart(partId);
          }
        } else if (stateRef.current.selectedPartId !== null) {
          stateRef.current.onSelectPart(null);
        }
      };

      const onPointerMove = (e: PointerEvent) => {
        const now = performance.now();
        if (now - lastHoverCheck < 45) return;
        lastHoverCheck = now;

        const hits = getIntersections(e.clientX, e.clientY);
        if (hits.length > 0) {
          const pickedHit = pickPriorityHit(hits);
          const partId = (pickedHit.object.userData.partId as string) || null;
          canvas.style.cursor = 'pointer';
          if (stateRef.current.hoveredPartId !== partId) {
            stateRef.current.hoveredPartId = partId;
            setHoveredPartId(partId);
          }
        } else {
          canvas.style.cursor = 'grab';
          if (stateRef.current.hoveredPartId !== null) {
            stateRef.current.hoveredPartId = null;
            setHoveredPartId(null);
          }
        }
      };

      canvas.style.cursor = 'grab';
      canvas.addEventListener('pointerdown', onPointerDown);
      canvas.addEventListener('pointerup', onPointerUp);
      canvas.addEventListener('pointermove', onPointerMove);

      // WebGL context safety
      const onContextLost = (e: Event) => {
        e.preventDefault();
        setContextLost(true);
      };
      const onContextRestored = () => {
        setContextLost(false);
        requestWake();
      };
      canvas.addEventListener('webglcontextlost', onContextLost);
      canvas.addEventListener('webglcontextrestored', onContextRestored);

      // Resize observer for crisp layout resizing
      const resizeObserver = new ResizeObserver(() => {
        const w = Math.max(container.clientWidth, 1);
        const h = Math.max(container.clientHeight, 1);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        requestWake();
      });
      resizeObserver.observe(container);

      // Kick off first draw
      if (isSoftwareGl) {
        frameId = window.setTimeout(tick, 0);
      } else {
        frameId = requestAnimationFrame(tick);
      }

      return () => {
        isMounted = false;
        cancelAnimationFrame(frameId);
        clearTimeout(frameId);
        resizeObserver.disconnect();
        controls.removeEventListener('start', onControlsStart);
        controls.removeEventListener('change', onControlsChange);
        controls.dispose();
        canvas.removeEventListener('pointerdown', onPointerDown);
        canvas.removeEventListener('pointerup', onPointerUp);
        canvas.removeEventListener('pointermove', onPointerMove);
        canvas.removeEventListener('webglcontextlost', onContextLost);
        canvas.removeEventListener('webglcontextrestored', onContextRestored);

        if (engineRef.current?.builtModel) {
          scene.remove(engineRef.current.builtModel.root);
          engineRef.current.builtModel.dispose();
        }
        reticleDisc.geometry.dispose();
        reticleMat.dispose();
        shadowDisc.geometry.dispose();
        shadowMat.dispose();
        textures.dispose();
        envTex.dispose();
        renderer.dispose();
        if (canvas.parentElement === container) {
          container.removeChild(canvas);
        }
        engineRef.current = null;
      };
    }, []);

    // Rebuild 3D model when species changes
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng) return;

      if (eng.builtModel) {
        eng.scene.remove(eng.builtModel.root);
        eng.builtModel.dispose();
      }

      const nextModel = buildSpeciesModel(
        species,
        eng.textures,
        renderMode === 'scientific'
      );
      nextModel.update4D(0, 0);
      eng.builtModel = nextModel;
      eng.scene.add(nextModel.root);

      wasFocusedRef.current = false;
      eng.controls.minDistance = 2.0;
      eng.groundGroup.position.y = species.groundY;
      eng.cameraPosGoal = new THREE.Vector3(...species.cameraPosition);
      eng.cameraTargetGoal = new THREE.Vector3(...species.cameraTarget);
      eng.requestWake();
    }, [species]);

    // Sync Layer Filter, Render Mode, Focus Ghosting & Hover Highlights
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng || !eng.builtModel) return;

      const isSci = renderMode === 'scientific';
      const hasFocus = selectedPartId !== null;

      for (const entry of eng.builtModel.parts) {
        const isSelected = entry.partId === selectedPartId;
        const isHovered = entry.partId === hoveredPartId && !isSelected;
        const visible =
          layerFilter === 'all' || layerFilter === entry.layer || (hasFocus && isSelected);
        entry.group.visible = visible;

        for (const mesh of entry.meshes) {
          const mat = mesh.material as THREE.MeshPhysicalMaterial;
          mat.wireframe = isSci;

          const baseColorHex = (mat.userData.baseColorHex as number) ?? 0xffffff;
          const baseOpacity = (mat.userData.baseOpacity as number) ?? 1;
          const focusOpacity = (mat.userData.focusOpacity as number) ?? Math.max(0.88, baseOpacity);
          const baseDepthWrite = (mat.userData.baseDepthWrite as boolean) ?? true;
          const baseTransparent = (mat.userData.baseTransparent as boolean) ?? false;
          const baseRenderOrder = (mesh.userData.baseRenderOrder as number) ?? 0;

          if (hasFocus) {
            if (isSelected) {
              // Foreground enlarged high-detail organ with crisp PBR shading
              mat.color.setHex(baseColorHex);
              mat.opacity = isSci ? Math.max(0.65, focusOpacity) : focusOpacity;
              mat.transparent = mat.opacity < 0.99 || isSci;
              mat.depthWrite = mat.opacity >= 0.88 && !isSci;
              mesh.renderOrder = 6;

              const baseEmissive = mat.userData.baseEmissive as number | undefined;
              if (baseEmissive !== undefined) {
                mat.emissive.setHex(baseEmissive);
                mat.emissiveIntensity = (mat.userData.baseEmissiveIntensity as number) ?? 0;
              } else {
                mat.emissive.copy(_emissiveZero);
                mat.emissiveIntensity = 0;
              }
            } else {
              // Background anatomical ghost silhouette for spatial context
              _ghostColor.setHex(baseColorHex).lerp(_ghostTint, 0.58);
              mat.color.copy(_ghostColor);
              mat.transparent = true;
              mat.opacity = isSci
                ? 0.14
                : mat.userData.isOuterShell
                  ? 0.055
                  : mat.userData.isMuscleLayer
                    ? 0.075
                    : 0.12;
              mat.depthWrite = false;
              mesh.renderOrder = 1;
              mat.emissive.copy(_emissiveZero);
              mat.emissiveIntensity = 0;
            }
          } else {
            mat.color.setHex(baseColorHex);
            mat.transparent = baseTransparent || isSci;
            mat.depthWrite = baseDepthWrite && !isSci;
            mesh.renderOrder = baseRenderOrder;

            if (mat.userData.isOuterShell) {
              mat.opacity = isSci ? 0.42 : baseOpacity;
            } else if (mat.userData.isMuscleLayer) {
              const isolatedMuscles = layerFilter === 'muscles';
              mat.opacity = isSci
                ? (isolatedMuscles ? 0.88 : 0.65)
                : (isolatedMuscles ? 0.94 : baseOpacity);
              mat.depthWrite = isolatedMuscles && !isSci;
            } else {
              mat.opacity = isSci ? 0.95 : baseOpacity;
            }

            if (isHovered) {
              mat.emissive.copy(_emissiveHover);
              mat.emissiveIntensity = 0.18;
            } else {
              const baseEmissive = mat.userData.baseEmissive as number | undefined;
              if (baseEmissive !== undefined) {
                mat.emissive.setHex(baseEmissive);
                mat.emissiveIntensity = (mat.userData.baseEmissiveIntensity as number) ?? 0;
              } else {
                mat.emissive.copy(_emissiveZero);
                mat.emissiveIntensity = 0;
              }
            }
          }
        }
      }

      eng.requestWake();
    }, [species, layerFilter, renderMode, selectedPartId, hoveredPartId]);

    // Focus camera onto enlarged foreground organ or restore full-body framing
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng || !eng.builtModel) return;

      if (selectedPartId) {
        const entry = eng.builtModel.parts.find((p) => p.partId === selectedPartId);
        if (entry) {
          const center = computeFocusTargetCenter(entry, species, new THREE.Vector3());
          const enlargedRadius = Math.max(
            0.28,
            0.5 * entry.localBoundsSize.length() * entry.focusScale
          );
          const fovRad = THREE.MathUtils.degToRad(eng.camera.fov);
          const dist = THREE.MathUtils.clamp(
            (enlargedRadius / Math.tan(fovRad * 0.5)) * 1.15,
            1.45,
            6.2
          );
          eng.cameraTargetGoal = center;
          eng.cameraPosGoal = center.clone().add(new THREE.Vector3(0.2 * dist, 0.08 * dist, dist));
          eng.controls.minDistance = 0.85;
          wasFocusedRef.current = true;
          eng.requestWake();
        }
      } else if (wasFocusedRef.current) {
        wasFocusedRef.current = false;
        eng.controls.minDistance = 2.0;
        eng.cameraPosGoal = new THREE.Vector3(...species.cameraPosition);
        eng.cameraTargetGoal = new THREE.Vector3(...species.cameraTarget);
        eng.requestWake();
      }
    }, [selectedPartId, species]);

    // Wake animation loop when view parameters change
    useEffect(() => {
      const eng = engineRef.current;
      if (!eng) return;
      eng.requestWake();
    }, [explodeFactor, autoRotate, labelMode, live4D, language]);

    const t = UI_STRINGS[language];
    const isDetailed = labelMode === 'detailed';
    const selectedPart = selectedPartId
      ? species.parts.find((p) => p.id === selectedPartId) ?? null
      : null;

    return (
      <div className="relative w-full h-full overflow-hidden bg-[radial-gradient(circle_at_50%_42%,#ffffff_0%,#f1f3f6_60%,#e6e9ee_100%)]">
        {/* Isolated WebGL canvas mount */}
        <div ref={mountRef} className="absolute inset-0" />

        {/* Focused Organ Inspection Header Bar */}
        {selectedPart && (
          <div className="absolute top-4 left-4 z-20 flex items-center gap-2.5 rounded-xl border border-neutral-200 bg-white/95 px-3 py-2 shadow-sm">
            <button
              type="button"
              onClick={() => onSelectPart(null)}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 hover:bg-red-100 transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t.exitFocusView}</span>
            </button>
            <div className="h-4 w-px bg-neutral-200" />
            <div className="flex flex-col leading-tight pr-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                {t.focusedOrganHint}
              </span>
              <span className="text-xs font-semibold text-neutral-900">
                {selectedPart.name[language]}{' '}
                <span className="font-mono-tabular font-normal text-red-700">
                  ({selectedPart.latinName})
                </span>
              </span>
            </div>
          </div>
        )}

        {/* Projected 3D Organ & Bone Landmark Labels Overlay */}
        <div
          aria-hidden={labelMode === 'off'}
          className="absolute inset-0 pointer-events-none overflow-hidden z-10"
        >
          {species.parts.map((part) => {
            const isSelected = part.id === selectedPartId;
            return (
              <button
                key={`${species.id}-${part.id}`}
                ref={(el) => {
                  labelRefs.current[part.id] = el;
                }}
                type="button"
                onClick={() => onSelectPart(part.id)}
                style={{ opacity: 0, pointerEvents: 'none' }}
                className={`absolute top-0 left-0 flex items-center gap-2 px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-red-600 ${
                  isSelected
                    ? 'bg-red-600 text-white border border-red-700 shadow-md shadow-red-950/15'
                    : 'bg-white/95 text-neutral-900 border border-neutral-300 shadow-sm hover:border-red-500 hover:text-red-800'
                }`}
              >
                <span
                  className="w-2 h-2 rounded-full shrink-0 border border-black/15"
                  style={{ backgroundColor: isSelected ? '#ffffff' : part.hexColor }}
                />
                <span className="flex flex-col items-start leading-tight text-left">
                  <span>{part.name[language]}</span>
                  {isDetailed && (
                    <span
                      className={`font-mono-tabular text-[10px] ${
                        isSelected ? 'text-red-100' : 'text-red-700/85'
                      }`}
                    >
                      {part.latinName}
                    </span>
                  )}
                </span>
              </button>
            );
          })}

          {species.parts.flatMap((part) =>
            part.subParts.map((sub) => {
              const key = `${part.id}:${sub.id}`;
              const isBone = part.layer === 'skeleton';
              return (
                <button
                  key={`${species.id}-${key}`}
                  ref={(el) => {
                    subLabelRefs.current[key] = el;
                  }}
                  type="button"
                  onClick={() => onSelectPart(part.id)}
                  style={{ opacity: 0, pointerEvents: 'none' }}
                  className={`absolute top-0 left-0 flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-red-600 ${
                    isBone
                      ? 'bg-neutral-900/92 text-neutral-50 border border-neutral-700 shadow-sm hover:border-red-400'
                      : 'bg-white/95 text-neutral-800 border border-red-300 shadow-sm hover:border-red-600'
                  }`}
                >
                  <span
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: isBone ? '#f4efe4' : part.hexColor }}
                  />
                  <span className="flex items-baseline gap-1.5">
                    <span>{sub.name[language]}</span>
                    <span
                      className={`font-mono-tabular text-[9.5px] ${
                        isBone ? 'text-neutral-300' : 'text-neutral-500'
                      }`}
                    >
                      {sub.latin}
                    </span>
                  </span>
                </button>
              );
            })
          )}
        </div>

        {/* WebGL context lost fallback */}
        {contextLost && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/95 p-6">
            <div className="max-w-sm rounded-xl border border-neutral-200 bg-white p-6 text-center shadow-lg">
              <h3 className="text-base font-semibold text-red-700">{t.webglLostTitle}</h3>
              <p className="mt-2 text-sm text-neutral-600">{t.webglLostDesc}</p>
            </div>
          </div>
        )}

        {/* Subtle interaction hint in bottom-left */}
        <div className="pointer-events-none absolute bottom-4 left-4 hidden xl:block text-[11px] text-neutral-500 tracking-wide">
          {t.controlsHint}
        </div>
      </div>
    );
  }
);
