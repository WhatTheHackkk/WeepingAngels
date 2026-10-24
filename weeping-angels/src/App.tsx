/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { generateMaze10x10, generateRandomSeed, KeycardNode, MazeData } from './maze/mazeGenerator';
import { resolveMazeCollision, worldToLogicalCell } from './maze/collision';
import { createProceduralMaterialLibrary } from './maze/proceduralMaterials';
import {
  createFlashlightRig,
  createFloatingKeycardsGroup,
  createMazeWallInstancedMeshes,
  createObjectiveBeaconGroup,
  FlashlightRig,
  KeycardsManagerRig,
  ObjectiveBeaconRig,
  prepareGeometryForFullPBR,
} from './maze/compositeModels';
import {
  AngelBehaviorMode,
  AngelPoseState,
  createWeepingAngelEntity,
  WeepingAngelRig,
} from './maze/weepingAngel';
import { AngelHudMarker, ControlDock, TelemetryState } from './components/ControlDock';
import { BlueprintModal } from './components/BlueprintModal';
import { JumpscareOverlay } from './components/JumpscareOverlay';
import { ExtractionPhase, ExtractionVictoryOverlay } from './components/ExtractionVictoryOverlay';
import { StudioIntro } from './components/StudioIntro';
import { CinematicMainMenu } from './components/CinematicMainMenu';
import { LoreBriefingModal } from './components/LoreBriefingModal';
import { soundEngine } from './maze/soundEffects';

export type AppPhase = 'studio-intro' | 'main-menu' | 'briefing' | 'playing';

// Pre-allocated module-scope math & raycasting objects (Zero GC in 60 FPS render loop)
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _localAimPoint = new THREE.Vector3();
const _worldAimPoint = new THREE.Vector3();
const _flashlightWorldDir = new THREE.Vector3();
const _cameraEuler = new THREE.Euler(0, 0, 0, 'YXZ');
const _raycaster = new THREE.Raycaster();
const _rayMouseNDC = new THREE.Vector2();
const _centerNDC = new THREE.Vector2(0, 0);

const PLAYER_EYE_HEIGHT = 1.62;
const PLAYER_RADIUS = 0.44;
const MOVE_SPEED = 5.4;
const KEY_TURN_SPEED = 2.15;
const RAW_MOUSE_SENSITIVITY = 0.0022;
const JUMP_VELOCITY = 4.85;
const GRAVITY = 14.2;
const MAX_JUMP_OFFSET = 1.45;
const FIRST_PERSON_FOG_DENSITY = 0.095;
const KEYCARD_PICKUP_PROXIMITY = 4.35; // Close proximity distance (meters) for keycard pickup
const AUTO_BLINK_INTERVAL = 6.8; // Seconds between involuntary player blinks
const BLINK_DURATION = 0.24; // Duration of an eyelid blink in seconds
const TOTAL_WEEPING_ANGELS = 4; // Multi-Angel Entity Population across the 10x10 maze
const TELEPORT_DURATION_MS = 1650; // Duration of portal teleportation warp sequence in ms

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // Completely randomized seed on initialization so every single run has a 100% unique 10x10 layout
  const [maze, setMaze] = useState<MazeData>(() => generateMaze10x10(generateRandomSeed()));
  const mazeRef = useRef<MazeData>(maze);
  mazeRef.current = maze;

  // View mode permanently locked to First-Person (WASD)
  const cameraMode = 'first-person' as const;
  const cameraModeRef = useRef<'first-person'>('first-person');

  const [beamProfile, setBeamProfile] = useState<'tactical' | 'overdrive' | 'amber'>('tactical');
  const [angelBehaviorMode, setAngelBehaviorMode] = useState<AngelBehaviorMode>('quantum-ai');
  const angelBehaviorModeRef = useRef<AngelBehaviorMode>('quantum-ai');
  angelBehaviorModeRef.current = angelBehaviorMode;

  // UI and Keycard/Beacon accent color permanently locked to Violet (#a855f7)
  const neonColor = '#a855f7';
  const [showSolutionPath, setShowSolutionPath] = useState<boolean>(false);
  const [edgeTurnEnabled, setEdgeTurnEnabled] = useState<boolean>(false);
  const edgeTurnRef = useRef<boolean>(false);
  edgeTurnRef.current = edgeTurnEnabled;

  const [audioEnabled, setAudioEnabled] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isBlueprintOpen, setIsBlueprintOpen] = useState<boolean>(false);
  const isBlueprintOpenRef = useRef<boolean>(false);
  isBlueprintOpenRef.current = isBlueprintOpen;

  const [appPhase, setAppPhase] = useState<AppPhase>('studio-intro');
  const appPhaseRef = useRef<AppPhase>('studio-intro');
  appPhaseRef.current = appPhase;

  const [isPointerLocked, setIsPointerLocked] = useState<boolean>(false);
  const [isBlinking, setIsBlinking] = useState<boolean>(false);
  const [isGameOver, setIsGameOver] = useState<boolean>(false);
  const [extractionPhase, setExtractionPhase] = useState<ExtractionPhase>('none');
  const [teleportProgress, setTeleportProgress] = useState<number>(0);
  const [finalEscapeTimeMs, setFinalEscapeTimeMs] = useState<number>(0);
  const [webglLost, setWebglLost] = useState<boolean>(false);

  const [visitedCells, setVisitedCells] = useState<Set<string>>(() => new Set(['0,0']));
  const visitedCellsRef = useRef<Set<string>>(new Set(['0,0']));

  const [collectedKeycardIds, setCollectedKeycardIds] = useState<Set<string>>(() => new Set());
  const collectedKeycardIdsRef = useRef<Set<string>>(new Set());

  const [playerWorldPos, setPlayerWorldPos] = useState<{ x: number; z: number; yaw: number }>({
    x: maze.startWorldPos.x,
    z: maze.startWorldPos.z,
    yaw: maze.initialYaw,
  });

  const [angelsPos, setAngelsPos] = useState<AngelHudMarker[]>(() =>
    maze.angelSpawnCells.map((sp, idx) => ({
      id: sp.id,
      index: idx,
      x: sp.worldX,
      z: sp.worldZ,
      isQuantumLocked: true,
      poseState: 'passive' as AngelPoseState,
      distanceToPlayer: Math.hypot(
        sp.worldX - maze.startWorldPos.x,
        sp.worldZ - maze.startWorldPos.z
      ),
    }))
  );

  const [telemetry, setTelemetry] = useState<TelemetryState>({
    playerRow: 0,
    playerCol: 0,
    distanceToObjective: Math.hypot(
      maze.objectiveWorldPos.x - maze.startWorldPos.x,
      maze.objectiveWorldPos.z - maze.startWorldPos.z
    ),
    stepsRemaining: maze.maxPathDistance,
    visitedCount: 1,
    objectiveReached: false,
    isExitUnlocked: false,
    elapsedSeconds: 0,
    nearbyKeycard: null,
    angelDistance: 10.4,
    angelQuantumLocked: true,
    angelPoseState: 'passive',
    activeHuntingAngelsCount: 0,
    totalAngelsCount: TOTAL_WEEPING_ANGELS,
    blinkCountdown: AUTO_BLINK_INTERVAL,
  });

  // Mutable simulation state stored in refs so React UI updates never recreate WebGL context
  const playerStateRef = useRef({
    x: maze.startWorldPos.x,
    z: maze.startWorldPos.z,
    y: 0,
    vx: 0,
    vz: 0,
    vy: 0,
    isGrounded: true,
    yaw: maze.initialYaw,
    pitch: 0,
    bobPhase: 0,
    stepAccumulator: 0,
    mouseX: 0,
    mouseY: 0,
    isDraggingLook: false,
    objectiveReached: false,
    extractionPhase: 'none' as ExtractionPhase,
    teleportStartTime: 0,
    finalEscapeTimeMs: 0,
    isGameOver: false,
    killingAngelIndex: 0,
    gameOverStartTime: 0,
    blinkTimer: AUTO_BLINK_INTERVAL,
    blinkRemaining: 0,
    startTime: performance.now(),
  });

  const sceneRefs = useRef<{
    scene: THREE.Scene | null;
    fpCamera: THREE.PerspectiveCamera | null;
    overheadCamera: THREE.PerspectiveCamera | null;
    orbitControls: OrbitControls | null;
    pointerLockControls: PointerLockControls | null;
    flashlightRig: FlashlightRig | null;
    objectiveRig: ObjectiveBeaconRig | null;
    keycardsRig: KeycardsManagerRig | null;
    angelRigs: WeepingAngelRig[];
    wallsHolder: THREE.Group | null;
    keycardsHolder: THREE.Group | null;
    solutionBreadcrumbGroup: THREE.Group | null;
    playerAvatarGroup: THREE.Group | null;
    hemiLight: THREE.HemisphereLight | null;
    keyLight: THREE.DirectionalLight | null;
    rebuildMazeGeometry: ((newMaze: MazeData) => void) | null;
  }>({
    scene: null,
    fpCamera: null,
    overheadCamera: null,
    orbitControls: null,
    pointerLockControls: null,
    flashlightRig: null,
    objectiveRig: null,
    keycardsRig: null,
    angelRigs: [],
    wallsHolder: null,
    keycardsHolder: null,
    solutionBreadcrumbGroup: null,
    playerAvatarGroup: null,
    hemiLight: null,
    keyLight: null,
    rebuildMazeGeometry: null,
  });

  // Trigger a simulated player blink (briefly blacks out vision & breaks Quantum-Lock)
  const handleTriggerManualBlink = useCallback(() => {
    const p = playerStateRef.current;
    if (p.isGameOver || p.extractionPhase !== 'none') return;
    p.blinkRemaining = BLINK_DURATION;
    p.blinkTimer = AUTO_BLINK_INTERVAL;
    setIsBlinking(true);
  }, []);

  // Reset player to start cell (0,0), respawn all 4 Weeping Angels, and restore keycards + locked exit
  const handleResetPosition = useCallback(() => {
    const currentMaze = mazeRef.current;
    const p = playerStateRef.current;
    p.x = currentMaze.startWorldPos.x;
    p.z = currentMaze.startWorldPos.z;
    p.y = 0;
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.isGrounded = true;
    p.yaw = currentMaze.initialYaw;
    p.pitch = 0;
    p.objectiveReached = false;
    p.extractionPhase = 'none';
    p.teleportStartTime = 0;
    p.isGameOver = false;
    p.killingAngelIndex = 0;
    p.blinkTimer = AUTO_BLINK_INTERVAL;
    p.blinkRemaining = 0;
    p.startTime = performance.now();

    setIsGameOver(false);
    setIsBlinking(false);
    setExtractionPhase('none');
    setTeleportProgress(0);
    setIsBlueprintOpen(false);
    isBlueprintOpenRef.current = false;
    soundEngine.setThreatSightLineActive(false);
    soundEngine.startAmbientLoop();

    if (sceneRefs.current.fpCamera) {
      sceneRefs.current.fpCamera.fov = 68;
      sceneRefs.current.fpCamera.updateProjectionMatrix();
    }
    if (sceneRefs.current.rebuildMazeGeometry) {
      sceneRefs.current.rebuildMazeGeometry(currentMaze);
    }
    if (sceneRefs.current.objectiveRig) {
      sceneRefs.current.objectiveRig.setUnlocked(false);
    }
    sceneRefs.current.angelRigs.forEach((angel) => {
      angel.setPermanentFreeze(false);
      angel.resetToSpawn(currentMaze);
    });

    const freshSet = new Set(['0,0']);
    visitedCellsRef.current = freshSet;
    setVisitedCells(freshSet);

    const freshKeycards = new Set<string>();
    collectedKeycardIdsRef.current = freshKeycards;
    setCollectedKeycardIds(freshKeycards);

    setPlayerWorldPos({
      x: p.x,
      z: p.z,
      yaw: p.yaw,
    });

    let minAngelDist = 24.0;
    const resetMarkers: AngelHudMarker[] = sceneRefs.current.angelRigs.map((a, idx) => {
      const d = Math.hypot(a.worldX - p.x, a.worldZ - p.z);
      if (d < minAngelDist) minAngelDist = d;
      return {
        id: a.id,
        index: idx,
        x: a.worldX,
        z: a.worldZ,
        isQuantumLocked: true,
        poseState: 'passive',
        distanceToPlayer: d,
      };
    });
    setAngelsPos(resetMarkers);

    setTelemetry({
      playerRow: 0,
      playerCol: 0,
      distanceToObjective: Math.hypot(
        currentMaze.objectiveWorldPos.x - p.x,
        currentMaze.objectiveWorldPos.z - p.z
      ),
      stepsRemaining: currentMaze.maxPathDistance,
      visitedCount: 1,
      objectiveReached: false,
      isExitUnlocked: false,
      elapsedSeconds: 0,
      nearbyKeycard: null,
      angelDistance: minAngelDist,
      angelQuantumLocked: true,
      angelPoseState: 'passive',
      activeHuntingAngelsCount: 0,
      totalAngelsCount: sceneRefs.current.angelRigs.length || TOTAL_WEEPING_ANGELS,
      blinkCountdown: AUTO_BLINK_INTERVAL,
    });
  }, []);

  // Generate a brand-new 10x10 Recursive Backtracker maze with a fresh crypto-random seed
  const handleGenerateNewMaze = useCallback(() => {
    const newSeed = generateRandomSeed();
    const newMaze = generateMaze10x10(newSeed);
    mazeRef.current = newMaze;
    setMaze(newMaze);

    const p = playerStateRef.current;
    p.x = newMaze.startWorldPos.x;
    p.z = newMaze.startWorldPos.z;
    p.y = 0;
    p.vx = 0;
    p.vz = 0;
    p.vy = 0;
    p.isGrounded = true;
    p.yaw = newMaze.initialYaw;
    p.pitch = 0;
    p.objectiveReached = false;
    p.extractionPhase = 'none';
    p.teleportStartTime = 0;
    p.isGameOver = false;
    p.killingAngelIndex = 0;
    p.blinkTimer = AUTO_BLINK_INTERVAL;
    p.blinkRemaining = 0;
    p.startTime = performance.now();

    setIsGameOver(false);
    setIsBlinking(false);
    setExtractionPhase('none');
    setTeleportProgress(0);
    setIsBlueprintOpen(false);
    isBlueprintOpenRef.current = false;
    soundEngine.setThreatSightLineActive(false);
    soundEngine.startAmbientLoop();

    if (sceneRefs.current.fpCamera) {
      sceneRefs.current.fpCamera.fov = 68;
      sceneRefs.current.fpCamera.updateProjectionMatrix();
    }
    if (sceneRefs.current.rebuildMazeGeometry) {
      sceneRefs.current.rebuildMazeGeometry(newMaze);
    }
    if (sceneRefs.current.objectiveRig) {
      sceneRefs.current.objectiveRig.setUnlocked(false);
    }
    sceneRefs.current.angelRigs.forEach((angel) => {
      angel.setPermanentFreeze(false);
      angel.resetToSpawn(newMaze);
    });

    const freshSet = new Set(['0,0']);
    visitedCellsRef.current = freshSet;
    setVisitedCells(freshSet);

    const freshKeycards = new Set<string>();
    collectedKeycardIdsRef.current = freshKeycards;
    setCollectedKeycardIds(freshKeycards);

    setPlayerWorldPos({
      x: p.x,
      z: p.z,
      yaw: p.yaw,
    });

    let minAngelDist = 24.0;
    const resetMarkers: AngelHudMarker[] = sceneRefs.current.angelRigs.map((a, idx) => {
      const d = Math.hypot(a.worldX - p.x, a.worldZ - p.z);
      if (d < minAngelDist) minAngelDist = d;
      return {
        id: a.id,
        index: idx,
        x: a.worldX,
        z: a.worldZ,
        isQuantumLocked: true,
        poseState: 'passive',
        distanceToPlayer: d,
      };
    });
    setAngelsPos(resetMarkers);

    setTelemetry({
      playerRow: 0,
      playerCol: 0,
      distanceToObjective: Math.hypot(
        newMaze.objectiveWorldPos.x - p.x,
        newMaze.objectiveWorldPos.z - p.z
      ),
      stepsRemaining: newMaze.maxPathDistance,
      visitedCount: 1,
      objectiveReached: false,
      isExitUnlocked: false,
      elapsedSeconds: 0,
      nearbyKeycard: null,
      angelDistance: minAngelDist,
      angelQuantumLocked: true,
      angelPoseState: 'passive',
      activeHuntingAngelsCount: 0,
      totalAngelsCount: sceneRefs.current.angelRigs.length || TOTAL_WEEPING_ANGELS,
      blinkCountdown: AUTO_BLINK_INTERVAL,
    });
  }, []);

  // Sync beam profile
  const handleBeamProfileChange = useCallback((profile: 'tactical' | 'overdrive' | 'amber') => {
    setBeamProfile(profile);
    soundEngine.playFlashlightClick();
    if (sceneRefs.current.flashlightRig) {
      sceneRefs.current.flashlightRig.setBeamProfile(profile);
    }
  }, []);

  // Sync Weeping Angel behavior / inspection pose mode across all 4 Angels
  const handleAngelBehaviorModeChange = useCallback((mode: AngelBehaviorMode) => {
    setAngelBehaviorMode(mode);
    angelBehaviorModeRef.current = mode;
    sceneRefs.current.angelRigs.forEach((angel) => {
      if (mode === 'inspect-passive') {
        angel.setPoseState('passive');
      } else if (mode === 'inspect-aggressive') {
        angel.setPoseState('aggressive');
      }
    });
  }, []);

  const handleStudioIntroComplete = useCallback(() => {
    setAppPhase('main-menu');
    soundEngine.startMenuAudio();
  }, []);

  const handleEnterLabyrinth = useCallback(() => {
    soundEngine.playButtonClick();
    setAppPhase('briefing');
  }, []);

  const handleBreachContainment = useCallback(() => {
    soundEngine.stopMenuAudio();
    soundEngine.startAmbientLoop();
    playerStateRef.current.startTime = performance.now();
    setAppPhase('playing');
  }, []);

  const handleBackToMenu = useCallback(() => {
    soundEngine.playButtonClick();
    setAppPhase('main-menu');
  }, []);

  // Toggle solution path breadcrumbs in 3D scene
  useEffect(() => {
    if (sceneRefs.current.solutionBreadcrumbGroup) {
      sceneRefs.current.solutionBreadcrumbGroup.visible = showSolutionPath;
    }
  }, [showSolutionPath]);

  // Main Three.js WebGL Lifecycle (Initialized once inside dedicated ref container)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2') || probeCanvas.getContext('webgl');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.15;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.setClearColor(0x000000, 1);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const onContextLost = (e: Event) => {
      e.preventDefault();
      setWebglLost(true);
    };
    const onContextRestored = () => {
      setWebglLost(false);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', onContextRestored);

    // 2. Scene with pitch-black background & dense low-hanging volumetric FogExp2
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);
    scene.fog = new THREE.FogExp2(0x000000, FIRST_PERSON_FOG_DENSITY);

    // 3. Studio Environment Reflection (RoomEnvironment + PMREMGenerator)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    scene.environmentIntensity = 0.1;
    pmremGenerator.dispose();

    // 4. Warm Key Light + Cool HemisphereLight Fill
    const hemiLight = new THREE.HemisphereLight(0x3b82f6, 0x090d16, 0.14);
    hemiLight.position.set(0, 25, 0);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1e0, 0.18);
    keyLight.position.set(18, 36, 16);
    scene.add(keyLight);

    // 5. First-Person PerspectiveCamera + PointerLockControls + Tactical Overhead Camera
    const aspect = container.clientWidth / Math.max(container.clientHeight, 1);
    const fpCamera = new THREE.PerspectiveCamera(68, aspect, 0.08, 95);
    fpCamera.position.set(
      mazeRef.current.startWorldPos.x,
      PLAYER_EYE_HEIGHT,
      mazeRef.current.startWorldPos.z
    );
    _cameraEuler.set(0, mazeRef.current.initialYaw, 0, 'YXZ');
    fpCamera.quaternion.setFromEuler(_cameraEuler);
    scene.add(fpCamera);

    // Instantiate THREE.PointerLockControls and override its internal mousemove listener
    // so we handle raw movementX/movementY 1:1 with zero smoothing or lag
    const pointerLockControls = new PointerLockControls(fpCamera, renderer.domElement);
    pointerLockControls.disconnect(); // We handle raw 1:1 movementX/Y directly without intermediate damping

    const onPointerLockChange = () => {
      const locked = document.pointerLockElement === renderer.domElement;
      setIsPointerLocked(locked);
      if (locked) {
        playerStateRef.current.mouseX = 0;
        playerStateRef.current.mouseY = 0;
      }
    };
    document.addEventListener('pointerlockchange', onPointerLockChange);

    const overheadCamera = new THREE.PerspectiveCamera(48, aspect, 0.5, 220);
    overheadCamera.position.set(0, 62, 26);
    overheadCamera.lookAt(0, 0, 0);

    const orbitControls = new OrbitControls(overheadCamera, renderer.domElement);
    orbitControls.enableDamping = !isSoftwareGl;
    orbitControls.dampingFactor = 0.06;
    orbitControls.maxPolarAngle = Math.PI / 2.15;
    orbitControls.minDistance = 16;
    orbitControls.maxDistance = 110;
    orbitControls.enabled = false;

    // 6. Full PBR Procedural Material Library (Concrete + Weathered Angel Granite)
    const materials = createProceduralMaterialLibrary(renderer);

    // 7. Full PBR Floor Plane (with UV2 + Tangents for Normal Map & AO Map)
    const totalWorldSize = mazeRef.current.voxelCols * mazeRef.current.tileSize;
    const floorGeo = new THREE.PlaneGeometry(totalWorldSize, totalWorldSize, 21, 21);
    floorGeo.rotateX(-Math.PI / 2);
    prepareGeometryForFullPBR(floorGeo);
    const floorMesh = new THREE.Mesh(floorGeo, materials.floorMaterial);
    floorMesh.receiveShadow = !isSoftwareGl;
    scene.add(floorMesh);

    // 8. Camera-Attached Volumetric SpotLight Flashlight Rig (2048x2048 PCFSoftShadowMap)
    const flashlightRig = createFlashlightRig(materials, isSoftwareGl);
    fpCamera.add(flashlightRig.root);

    // 9. Composite 9-Part Objective Extraction Beacon Group (at the randomized exit corner)
    const objectiveRig = createObjectiveBeaconGroup(materials, isSoftwareGl);
    objectiveRig.setUnlocked(false);
    scene.add(objectiveRig.group);

    // 10. Multi-Angel Population: Instantiate 4 Sculpted Weeping Angel Entities across the 10x10 maze
    const angelRigs: WeepingAngelRig[] = [];
    for (let idx = 0; idx < TOTAL_WEEPING_ANGELS; idx++) {
      const rig = createWeepingAngelEntity(mazeRef.current, materials, isSoftwareGl, idx);
      scene.add(rig.group);
      angelRigs.push(rig);
    }

    // 11. Player Marker Avatar (Visible in Tactical Overhead Orbit view)
    const playerAvatarGroup = new THREE.Group();
    const avatarBody = new THREE.Mesh(
      new THREE.CylinderGeometry(0.32, 0.42, 1.3, 16),
      new THREE.MeshStandardMaterial({
        color: 0x38bdf8,
        emissive: 0x0284c7,
        emissiveIntensity: 1.2,
        roughness: 0.3,
        metalness: 0.6,
      })
    );
    avatarBody.position.y = 0.65;
    const avatarNose = new THREE.Mesh(
      new THREE.ConeGeometry(0.26, 0.7, 12),
      new THREE.MeshBasicMaterial({ color: 0xf8fafc })
    );
    avatarNose.rotation.x = -Math.PI / 2;
    avatarNose.position.set(0, 0.95, -0.45);
    playerAvatarGroup.add(avatarBody, avatarNose);
    playerAvatarGroup.visible = false;
    scene.add(playerAvatarGroup);

    // 12. Containers for extruded 3D wall cubes, 15% environmental decals, keycards, and breadcrumbs
    const wallsHolder = new THREE.Group();
    scene.add(wallsHolder);

    const keycardsHolder = new THREE.Group();
    scene.add(keycardsHolder);

    const solutionBreadcrumbGroup = new THREE.Group();
    solutionBreadcrumbGroup.visible = false;
    scene.add(solutionBreadcrumbGroup);

    let currentWallsDisposable: (() => void) | null = null;
    let currentKeycardsRig: KeycardsManagerRig | null = null;

    const breadcrumbGeo = new THREE.BoxGeometry(0.36, 0.04, 0.36);
    const breadcrumbMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.72,
    });

    const rebuildMazeGeometry = (mazeData: MazeData) => {
      if (currentWallsDisposable) {
        currentWallsDisposable();
        currentWallsDisposable = null;
      }
      wallsHolder.clear();

      const builtWalls = createMazeWallInstancedMeshes(
        mazeData.wallCubes,
        mazeData.landmarks,
        mazeData.tileSize,
        mazeData.wallHeight,
        materials,
        isSoftwareGl
      );
      wallsHolder.add(builtWalls.group);
      currentWallsDisposable = builtWalls.dispose;

      // Rebuild Floating Security Keycards at the 3 distant dead-end nodes
      if (currentKeycardsRig) {
        currentKeycardsRig.dispose();
        currentKeycardsRig = null;
      }
      keycardsHolder.clear();

      currentKeycardsRig = createFloatingKeycardsGroup(
        mazeData.keycardNodes,
        mazeData.objectiveWorldPos,
        materials,
        isSoftwareGl
      );
      keycardsHolder.add(currentKeycardsRig.group);
      sceneRefs.current.keycardsRig = currentKeycardsRig;

      // Position Objective Extraction Portal at the randomized exit corner
      objectiveRig.group.position.set(
        mazeData.objectiveWorldPos.x,
        0,
        mazeData.objectiveWorldPos.z
      );
      objectiveRig.setUnlocked(false);

      solutionBreadcrumbGroup.clear();
      mazeData.solutionPath.forEach((step) => {
        const marker = new THREE.Mesh(breadcrumbGeo, breadcrumbMat);
        marker.position.set(step.worldX, 0.03, step.worldZ);
        solutionBreadcrumbGroup.add(marker);
      });
    };

    rebuildMazeGeometry(mazeRef.current);

    sceneRefs.current = {
      scene,
      fpCamera,
      overheadCamera,
      orbitControls,
      pointerLockControls,
      flashlightRig,
      objectiveRig,
      keycardsRig: currentKeycardsRig,
      angelRigs,
      wallsHolder,
      keycardsHolder,
      solutionBreadcrumbGroup,
      playerAvatarGroup,
      hemiLight,
      keyLight,
      rebuildMazeGeometry,
    };

    if (!isSoftwareGl) {
      renderer.compile(scene, fpCamera);
    }

    // 13. Hyper-Responsive 1:1 Raw Mouse Delta Handling & Raycaster Keycard Pickup
    const keysPressed: Record<string, boolean> = {};

    const onKeyDown = (e: KeyboardEvent) => {
      if (appPhaseRef.current !== 'playing') return;
      keysPressed[e.code] = true;
      const p = playerStateRef.current;
      if (p.isGameOver) return;

      if (e.code === 'Space') {
        e.preventDefault();
        if (p.isGrounded && cameraModeRef.current === 'first-person') {
          p.vy = JUMP_VELOCITY;
          p.isGrounded = false;
          soundEngine.playJump();
        }
      } else if (e.code === 'KeyM') {
        setIsBlueprintOpen(true);
        isBlueprintOpenRef.current = true;
      } else if (e.code === 'KeyB' && !e.repeat) {
        p.blinkRemaining = BLINK_DURATION;
        p.blinkTimer = AUTO_BLINK_INTERVAL;
        setIsBlinking(true);
      } else if (e.code === 'KeyH' && !e.repeat) {
        setIsCollapsed((prev) => !prev);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (appPhaseRef.current !== 'playing') return;
      keysPressed[e.code] = false;
      if (e.code === 'KeyM') {
        setIsBlueprintOpen(false);
        isBlueprintOpenRef.current = false;
      }
    };

    const onWindowBlur = () => {
      Object.keys(keysPressed).forEach((k) => {
        keysPressed[k] = false;
      });
      setIsBlueprintOpen(false);
      isBlueprintOpenRef.current = false;
      playerStateRef.current.isDraggingLook = false;
    };

    /**
     * 1:1 Instant Raw Mouse Movement Handler (Zero Smoothing, Zero Damping, Zero Lag).
     * Maps event.movementX and event.movementY directly to camera yaw/pitch and updates
     * the camera quaternion immediately.
     */
    const onMouseMove = (e: MouseEvent) => {
      if (appPhaseRef.current !== 'playing') return;
      const p = playerStateRef.current;
      if (p.isGameOver) return;

      const isLocked = document.pointerLockElement === renderer.domElement;

      if (!isLocked) {
        const rect = renderer.domElement.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          p.mouseX = THREE.MathUtils.clamp(((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1);
          p.mouseY = THREE.MathUtils.clamp(-((e.clientY - rect.top) / rect.height) * 2 + 1, -1, 1);
        }
      } else {
        p.mouseX = 0;
        p.mouseY = 0;
      }

      if (cameraModeRef.current === 'first-person' && (isLocked || p.isDraggingLook)) {
        const dx = e.movementX || 0;
        const dy = e.movementY || 0;

        // Instant 1:1 mapping from raw mouse movement deltas to camera yaw and pitch
        p.yaw -= dx * RAW_MOUSE_SENSITIVITY;
        p.pitch = THREE.MathUtils.clamp(
          p.pitch - dy * RAW_MOUSE_SENSITIVITY,
          -Math.PI / 2 + 0.05,
          Math.PI / 2 - 0.05
        );

        // Immediately apply rotation to fpCamera so there is zero frame delay
        _cameraEuler.set(p.pitch, p.yaw, 0, 'YXZ');
        fpCamera.quaternion.setFromEuler(_cameraEuler);
      }
    };

    /**
     * Raycaster Click-Listener for Keycard Pickup + PointerLock Engagement.
     */
    const onMouseDown = (e: MouseEvent) => {
      if (appPhaseRef.current !== 'playing') return;
      const p = playerStateRef.current;
      if (e.button !== 0 || cameraModeRef.current !== 'first-person' || p.isGameOver) return;

      p.isDraggingLook = true;

      // 1. Perform Raycast to check if the player clicked on a close-proximity Keycard
      const rig = sceneRefs.current.keycardsRig;
      if (rig && rig.hitProxies.length > 0) {
        const isLocked = document.pointerLockElement === renderer.domElement;
        const rect = renderer.domElement.getBoundingClientRect();

        if (isLocked) {
          _raycaster.setFromCamera(_centerNDC, fpCamera);
        } else {
          _rayMouseNDC.set(
            ((e.clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1,
            -((e.clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
          );
          _raycaster.setFromCamera(_rayMouseNDC, fpCamera);
        }

        const hits = _raycaster.intersectObjects(rig.group.children, true);
        let targetKeycardId: string | null = null;

        for (let i = 0; i < hits.length; i++) {
          const obj = hits[i].object;
          if (obj.userData && obj.userData.isKeycard && obj.userData.keycardId) {
            const distToPlayer = Math.hypot(
              obj.userData.worldX - p.x,
              obj.userData.worldZ - p.z
            );
            if (distToPlayer <= KEYCARD_PICKUP_PROXIMITY) {
              targetKeycardId = obj.userData.keycardId as string;
              break;
            }
          }
        }

        // Fallback: if player is in close proximity to a keycard and clicks center reticle
        if (!targetKeycardId && isLocked) {
          _raycaster.setFromCamera(_centerNDC, fpCamera);
          const centerHits = _raycaster.intersectObjects(rig.hitProxies, false);
          if (centerHits.length > 0) {
            const uData = centerHits[0].object.userData;
            if (
              uData?.keycardId &&
              Math.hypot(uData.worldX - p.x, uData.worldZ - p.z) <= KEYCARD_PICKUP_PROXIMITY
            ) {
              targetKeycardId = uData.keycardId;
            }
          }
        }

        if (targetKeycardId && !collectedKeycardIdsRef.current.has(targetKeycardId)) {
          const collectedNode = rig.collectKeycard(targetKeycardId);
          if (collectedNode) {
            const nextSet = new Set(collectedKeycardIdsRef.current);
            nextSet.add(targetKeycardId);
            collectedKeycardIdsRef.current = nextSet;
            setCollectedKeycardIds(nextSet);

            // Unlock the randomized Extraction Portal upon collecting the 3rd and final Keycard!
            const requiredKeycards = Math.max(1, mazeRef.current.keycardNodes.length);
            if (nextSet.size >= requiredKeycards) {
              objectiveRig.setUnlocked(true);
              soundEngine.playExtractionUnlocked();
            } else {
              soundEngine.playKeycardPickup();
            }
          }
        }
      }

      // 2. Request PointerLock on canvas click for 1:1 raw mouse look
      if (document.pointerLockElement !== renderer.domElement) {
        try {
          renderer.domElement.requestPointerLock?.();
        } catch {
          // Graceful fallback in restricted sandboxes
        }
      }
    };

    const onMouseUp = () => {
      playerStateRef.current.isDraggingLook = false;
    };

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = Math.max(container.clientHeight, 1);
      fpCamera.aspect = w / h;
      fpCamera.updateProjectionMatrix();
      overheadCamera.aspect = w / h;
      overheadCamera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('mouseup', onMouseUp);
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', onMouseMove);
    renderer.domElement.addEventListener('mousedown', onMouseDown);

    // 14. Continuous 60 FPS Animation, Physics & Multi-Angel Quantum-Lock AI Loop
    const clock = new THREE.Clock();
    let frameId = 0;
    let lastHudUpdate = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      if (gl && typeof gl.fenceSync === 'function') {
        const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
        gl.flush();
        const poll = () => {
          const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
          if (state === gl.UNSIGNALED) {
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
    }

    function tick() {
      const rawDelta = clock.getDelta();
      const dt = Math.min(rawDelta, 0.1);
      const elapsed = clock.getElapsedTime();
      const p = playerStateRef.current;
      const currentMaze = mazeRef.current;
      const isLocked = document.pointerLockElement === renderer.domElement;

      if (appPhaseRef.current !== 'playing') {
        renderer.render(scene, fpCamera);
        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      }

      if (p.isGameOver) {
        const killElapsed = Math.max(0, (performance.now() - p.gameOverStartTime) / 1000);
        const trauma = Math.max(0.25, 1.0 - killElapsed * 0.45);
        const shakeX = (Math.random() - 0.5) * 0.045 * trauma;
        const shakeY = (Math.random() - 0.5) * 0.045 * trauma;

        fpCamera.position.set(p.x + shakeX, PLAYER_EYE_HEIGHT + shakeY, p.z);
        const killerRig = angelRigs[p.killingAngelIndex] || angelRigs[0];
        if (killerRig) {
          killerRig.updateKillSequence(killElapsed, fpCamera);
        }

        _localAimPoint.set(0, -0.05, -1.0);
        flashlightRig.spotTarget.position.copy(_localAimPoint);
        flashlightRig.spotTarget.getWorldPosition(_worldAimPoint);
        flashlightRig.bodyGroup.lookAt(_worldAimPoint);
        renderer.render(scene, fpCamera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      }

      // Extraction & Teleportation Sequence State Machine (Absolute AI Immunity Override Active)
      if (p.extractionPhase === 'teleporting') {
        const tpElapsed = Math.max(0, performance.now() - p.teleportStartTime);
        const tp = Math.min(1.0, tpElapsed / TELEPORT_DURATION_MS);

        // Enforce permanent AI freeze & silent Track 2 / Heartbeat throughout teleportation
        soundEngine.setThreatSightLineActive(false);
        soundEngine.updateProximityHeartbeat(dt, Infinity, false);
        for (let i = 0; i < angelRigs.length; i++) {
          angelRigs[i].setPermanentFreeze(true);
        }

        // Smoothly pull player camera toward portal core with upward levitation & FOV warp
        const objPos = currentMaze.objectiveWorldPos;
        p.x = THREE.MathUtils.lerp(p.x, objPos.x, 0.08);
        p.z = THREE.MathUtils.lerp(p.z, objPos.z, 0.08);
        const levitateY = PLAYER_EYE_HEIGHT + Math.pow(tp, 1.4) * 0.85;
        const jitter = (Math.random() - 0.5) * 0.025 * tp;

        fpCamera.position.set(p.x + jitter, levitateY + jitter, p.z);
        _cameraEuler.set(p.pitch * (1 - tp * 0.5), p.yaw + tp * 0.35, jitter * 1.5, 'YXZ');
        fpCamera.quaternion.setFromEuler(_cameraEuler);

        fpCamera.fov = 68 + Math.sin(tp * Math.PI * 0.88) * 46;
        fpCamera.updateProjectionMatrix();

        objectiveRig.update(elapsed + tp * 6.0);
        renderer.render(scene, fpCamera);

        setTeleportProgress(tp);

        if (tp >= 1.0) {
          p.extractionPhase = 'victory';
          fpCamera.fov = 68;
          fpCamera.updateProjectionMatrix();
          if (document.pointerLockElement) {
            document.exitPointerLock?.();
          }
          soundEngine.playObjectiveReached();
          setExtractionPhase('victory');
        }

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      }

      // Freeze 3D Game Canvas when on Victory or Main Menu Screen
      if (p.extractionPhase === 'victory' || p.extractionPhase === 'main-menu') {
        soundEngine.setThreatSightLineActive(false);
        soundEngine.updateProximityHeartbeat(dt, Infinity, false);
        renderer.render(scene, fpCamera);

        if (isSoftwareGl) {
          afterDraw(tick);
        } else {
          frameId = requestAnimationFrame(tick);
        }
        return;
      }

      // 0. Manual Eyelid Blink Cycle (Triggered via [B] key or button — never involuntarily while staring)
      if (p.blinkRemaining > 0) {
        p.blinkRemaining -= dt;
        if (p.blinkRemaining <= 0) {
          p.blinkRemaining = 0;
          setIsBlinking(false);
        }
      }

      // 1. Optional keyboard yaw rotation (Q/E or Left/Right Arrows) — applied directly with zero lag
      let yawInput = 0;
      if (keysPressed['KeyQ'] || keysPressed['ArrowLeft']) yawInput += 1;
      if (keysPressed['KeyE'] || keysPressed['ArrowRight']) yawInput -= 1;

      if (
        edgeTurnRef.current &&
        !isLocked &&
        cameraModeRef.current === 'first-person' &&
        !p.isDraggingLook &&
        Math.abs(p.mouseX) > 0.68
      ) {
        const edgeStrength = (Math.abs(p.mouseX) - 0.68) / 0.32;
        yawInput -= Math.sign(p.mouseX) * edgeStrength * 0.65;
      }

      if (yawInput !== 0) {
        p.yaw += yawInput * KEY_TURN_SPEED * dt;
      }

      // 2. Spacebar Jump & Gravity Physics
      if (keysPressed['Space'] && p.isGrounded && cameraModeRef.current === 'first-person') {
        p.vy = JUMP_VELOCITY;
        p.isGrounded = false;
        soundEngine.playJump();
      }

      if (!p.isGrounded || p.y > 0 || p.vy !== 0) {
        p.vy -= GRAVITY * dt;
        p.y += p.vy * dt;

        if (p.y > MAX_JUMP_OFFSET) {
          p.y = MAX_JUMP_OFFSET;
          if (p.vy > 0) p.vy = 0;
        }

        if (p.y <= 0) {
          p.y = 0;
          p.vy = 0;
          if (!p.isGrounded) {
            p.isGrounded = true;
            soundEngine.playLanding();
          }
        }
      }

      // 3. WASD First-Person Movement & Strict Wall Collision Detection
      let moveForward = 0;
      let moveStrafe = 0;
      if (keysPressed['KeyW'] || keysPressed['ArrowUp']) moveForward += 1;
      if (keysPressed['KeyS'] || keysPressed['ArrowDown']) moveForward -= 1;
      if (keysPressed['KeyD']) moveStrafe += 1;
      if (keysPressed['KeyA']) moveStrafe -= 1;

      if (moveForward !== 0 && moveStrafe !== 0) {
        const inv = 1 / Math.SQRT2;
        moveForward *= inv;
        moveStrafe *= inv;
      }

      _forward.set(-Math.sin(p.yaw), 0, -Math.cos(p.yaw));
      _right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));

      const desiredVx = (_forward.x * moveForward + _right.x * moveStrafe) * MOVE_SPEED;
      const desiredVz = (_forward.z * moveForward + _right.z * moveStrafe) * MOVE_SPEED;

      p.vx = THREE.MathUtils.damp(p.vx, desiredVx, 14, dt);
      p.vz = THREE.MathUtils.damp(p.vz, desiredVz, 14, dt);

      const speedSq = p.vx * p.vx + p.vz * p.vz;
      if (speedSq > 0.0004) {
        const nextX = p.x + p.vx * dt;
        const nextZ = p.z + p.vz * dt;
        const resolved = resolveMazeCollision(
          p.x,
          p.z,
          nextX,
          nextZ,
          PLAYER_RADIUS,
          currentMaze.wallCubes
        );
        const stepDist = Math.hypot(resolved.x - p.x, resolved.z - p.z);
        p.x = resolved.x;
        p.z = resolved.z;

        if (p.isGrounded) {
          // Toned-down, calm stride frequency
          p.bobPhase += stepDist * 1.45;
          p.stepAccumulator += stepDist;
          if (p.stepAccumulator >= 2.25) {
            p.stepAccumulator = 0;
            soundEngine.playFootstep();
          }
        }
      } else {
        p.bobPhase = THREE.MathUtils.damp(
          p.bobPhase,
          Math.round(p.bobPhase / Math.PI) * Math.PI,
          10,
          dt
        );
      }

      // 4. Toned-Down, Subtle Head-Bobbing Math Equation (Non-disorienting during fast movement)
      const speedRatio =
        Math.min(Math.sqrt(speedSq) / MOVE_SPEED, 1.0) * (p.isGrounded ? 1.0 : 0.1);
      const headBobY = Math.sin(p.bobPhase * 2.0) * 0.018 * speedRatio;
      const headBobX = Math.cos(p.bobPhase) * 0.008 * speedRatio;
      const headBobRoll = Math.cos(p.bobPhase) * 0.002 * speedRatio;

      fpCamera.position.set(
        p.x + _right.x * headBobX,
        PLAYER_EYE_HEIGHT + p.y + headBobY,
        p.z + _right.z * headBobX
      );

      // 1:1 Direct Camera Rotation (no artificial smoothing or lag)
      _cameraEuler.set(p.pitch, p.yaw, headBobRoll, 'YXZ');
      fpCamera.quaternion.setFromEuler(_cameraEuler);

      // 5. Instant 1:1 Mouse-Tracked Volumetric SpotLight Flashlight Update
      const aimSpreadX = isLocked ? 0 : p.mouseX * 5.6;
      const aimSpreadY = isLocked ? 0 : p.mouseY * 3.6;
      const aimDepth = -9.0;

      _localAimPoint.set(aimSpreadX, aimSpreadY, aimDepth);
      flashlightRig.spotTarget.position.copy(_localAimPoint);

      flashlightRig.spotTarget.getWorldPosition(_worldAimPoint);
      flashlightRig.bodyGroup.lookAt(_worldAimPoint);

      _flashlightWorldDir.subVectors(_worldAimPoint, fpCamera.position).normalize();
      materials.volumetricConeMaterial.uniforms.uTime.value = elapsed;

      // 6. Update All 4 Weeping Angel Entities Independently (12m Radius + Quantum-Lock + Corner Evasion)
      // Holding [M] Blueprint obscures the player's 3D vision, which also breaks Quantum-Lock!
      const isVisionObscured = p.blinkRemaining > 0 || isBlueprintOpenRef.current;

      let anyAngelThreatActive = false;
      let closestAngelDist = Infinity;
      let closestAngelLocked = true;
      let closestAngelPose: AngelPoseState = 'passive';
      let activeHuntingCount = 0;

      for (let i = 0; i < angelRigs.length; i++) {
        if (p.isGameOver) break;
        const rig = angelRigs[i];
        const status = rig.updateAI(
          dt,
          p.x,
          p.z,
          fpCamera,
          _flashlightWorldDir,
          flashlightRig.spotLight.angle,
          flashlightRig.spotLight.distance,
          isVisionObscured,
          angelBehaviorModeRef.current,
          currentMaze,
          angelRigs,
          (intensity) => {
            soundEngine.playStoneScrape(intensity);
          },
          () => {
            // Jumpscare & Execution Sequence Triggered by Angel #i!
            p.isGameOver = true;
            p.killingAngelIndex = i;
            p.gameOverStartTime = performance.now();
            p.blinkRemaining = 0;
            setIsBlinking(false);
            setIsBlueprintOpen(false);
            isBlueprintOpenRef.current = false;
            setIsGameOver(true);

            if (document.pointerLockElement) {
              document.exitPointerLock?.();
            }

            // Snap camera level and position the cruel State B Angel directly in front of the lens
            p.pitch = 0.03;
            _cameraEuler.set(p.pitch, p.yaw, 0, 'YXZ');
            fpCamera.quaternion.setFromEuler(_cameraEuler);
            fpCamera.position.set(p.x, PLAYER_EYE_HEIGHT, p.z);
            rig.PositionForJumpscare(fpCamera);

            soundEngine.updateProximityHeartbeat(dt, Infinity, false);
            soundEngine.playAngelJumpscare();
          }
        );

        if (status.isSightLineThreatActive) {
          anyAngelThreatActive = true;
        }
        if (!status.isQuantumLocked) {
          activeHuntingCount++;
        }
        if (status.distanceToPlayer < closestAngelDist) {
          closestAngelDist = status.distanceToPlayer;
          closestAngelLocked = status.isQuantumLocked;
          closestAngelPose = status.poseState;
        }
      }

      // Parallel Track 2 & Dynamic Proximity Heartbeat Audio:
      // - Track 2 triggers dynamically whenever ANY active Angel enters the 12m unobserved LoS range.
      // - Heartbeat tempo (BPM) and volume increase dynamically as the player gets closer to the nearest Angel.
      if (!p.isGameOver) {
        soundEngine.setThreatSightLineActive(anyAngelThreatActive);
        soundEngine.updateProximityHeartbeat(dt, closestAngelDist, true);
      }

      // 7. Animate the 9-part Objective Extraction Beacon & Floating Keycards
      objectiveRig.update(elapsed);
      if (currentKeycardsRig) {
        currentKeycardsRig.update(elapsed);
      }

      // 8. Update Player Avatar for Tactical Overhead View
      playerAvatarGroup.position.set(p.x, p.y, p.z);
      playerAvatarGroup.rotation.y = p.yaw;

      // 9. Check distance to the randomized Extraction Portal (activates ONLY when all 3 keycards are collected)
      const distToObj = Math.hypot(
        currentMaze.objectiveWorldPos.x - p.x,
        currentMaze.objectiveWorldPos.z - p.z
      );
      const isExitUnlocked =
        collectedKeycardIdsRef.current.size >= Math.max(1, currentMaze.keycardNodes.length);

      if (isExitUnlocked && distToObj < 1.45 && !p.objectiveReached) {
        p.objectiveReached = true;
        p.extractionPhase = 'teleporting';
        p.teleportStartTime = performance.now();
        p.finalEscapeTimeMs = Math.max(1, performance.now() - p.startTime);
        p.blinkRemaining = 0;

        // Hard Override Flag: Instantly freeze 3D canvas & all Weeping Angel entities permanently
        for (let i = 0; i < angelRigs.length; i++) {
          angelRigs[i].setPermanentFreeze(true);
        }
        soundEngine.setThreatSightLineActive(false);
        soundEngine.updateProximityHeartbeat(dt, Infinity, false);
        soundEngine.playTeleportWarp();

        if (document.pointerLockElement) {
          document.exitPointerLock?.();
        }

        setIsBlinking(false);
        setIsBlueprintOpen(false);
        isBlueprintOpenRef.current = false;
        setFinalEscapeTimeMs(p.finalEscapeTimeMs);
        setTeleportProgress(0);
        setExtractionPhase('teleporting');
      }

      const now = performance.now();
      if (now - lastHudUpdate > 85) {
        lastHudUpdate = now;
        const cellCoords = worldToLogicalCell(p.x, p.z, currentMaze);
        const key = `${cellCoords.row},${cellCoords.col}`;
        if (!visitedCellsRef.current.has(key)) {
          const nextVisited = new Set(visitedCellsRef.current);
          nextVisited.add(key);
          visitedCellsRef.current = nextVisited;
          setVisitedCells(nextVisited);
        }

        // Check if player is within close proximity of any uncollected floating keycard
        let closestKeycard: KeycardNode | null = null;
        if (currentKeycardsRig) {
          let minKcDist = KEYCARD_PICKUP_PROXIMITY;
          for (let i = 0; i < currentKeycardsRig.items.length; i++) {
            const item = currentKeycardsRig.items[i];
            if (item.collected) continue;
            const d = Math.hypot(item.node.worldX - p.x, item.node.worldZ - p.z);
            if (d <= minKcDist) {
              minKcDist = d;
              closestKeycard = item.node;
            }
          }
        }

        const logicalCell = currentMaze.logicalGrid[cellCoords.row]?.[cellCoords.col];
        const stepsRem = logicalCell
          ? Math.max(0, currentMaze.maxPathDistance - logicalCell.distanceFromStart)
          : currentMaze.maxPathDistance;

        setPlayerWorldPos({ x: p.x, z: p.z, yaw: p.yaw });
        setAngelsPos(
          angelRigs.map((a, idx) => ({
            id: a.id,
            index: idx,
            x: a.worldX,
            z: a.worldZ,
            isQuantumLocked: a.isQuantumLocked,
            poseState: a.poseState,
            distanceToPlayer: Math.hypot(a.worldX - p.x, a.worldZ - p.z),
          }))
        );
        setTelemetry({
          playerRow: cellCoords.row,
          playerCol: cellCoords.col,
          distanceToObjective: distToObj,
          stepsRemaining: stepsRem,
          visitedCount: visitedCellsRef.current.size,
          objectiveReached: p.objectiveReached,
          isExitUnlocked,
          elapsedSeconds: (now - p.startTime) / 1000,
          nearbyKeycard: closestKeycard,
          angelDistance: closestAngelDist,
          angelQuantumLocked: activeHuntingCount === 0 ? closestAngelLocked : false,
          angelPoseState: activeHuntingCount > 0 ? 'aggressive' : closestAngelPose,
          activeHuntingAngelsCount: activeHuntingCount,
          totalAngelsCount: angelRigs.length,
          blinkCountdown: Math.max(0, p.blinkTimer),
        });
      }

      // 10. Render First-Person (WASD) Camera
      renderer.render(scene, fpCamera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      document.removeEventListener('pointerlockchange', onPointerLockChange);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('mouseup', onMouseUp);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('mousemove', onMouseMove);
      renderer.domElement.removeEventListener('mousedown', onMouseDown);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', onContextRestored);

      if (currentWallsDisposable) currentWallsDisposable();
      if (currentKeycardsRig) currentKeycardsRig.dispose();
      floorGeo.dispose();
      breadcrumbGeo.dispose();
      breadcrumbMat.dispose();
      flashlightRig.dispose();
      objectiveRig.dispose();
      angelRigs.forEach((a) => a.dispose());
      materials.dispose();
      orbitControls.dispose();
      pointerLockControls.dispose();
      renderer.dispose();
    };
  }, []);

  const handleToggleAudio = useCallback(() => {
    setAudioEnabled((prev) => {
      const next = !prev;
      soundEngine.enabled = next;
      return next;
    });
  }, []);

  const handleBlueprintHoldChange = useCallback((held: boolean) => {
    setIsBlueprintOpen(held);
    isBlueprintOpenRef.current = held;
  }, []);

  const handleReturnToMainMenu = useCallback(() => {
    soundEngine.stopAmbientLoop();
    soundEngine.setThreatSightLineActive(false);
    soundEngine.startMenuAudio();
    playerStateRef.current.extractionPhase = 'none';
    playerStateRef.current.isGameOver = false;
    setExtractionPhase('none');
    setIsGameOver(false);
    setAppPhase('main-menu');
    if (document.pointerLockElement) {
      document.exitPointerLock?.();
    }
  }, []);

  return (
    <main className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* Dedicated Full-Bleed WebGL Canvas Container */}
      <div
        ref={canvasMountRef}
        className="w-full h-full cursor-crosshair transition-[filter] duration-150 ease-out"
        style={{
          filter: isBlueprintOpen
            ? 'blur(20px) brightness(0.32)'
            : extractionPhase !== 'none'
              ? 'blur(16px) brightness(0.35) contrast(1.18)'
              : 'none',
        }}
        aria-label="3D Procedural Maze Viewport"
      />

      {/* Phase 1: Studio Intro ("PROJECT 27 PRESENTS...") */}
      {appPhase === 'studio-intro' && (
        <StudioIntro onComplete={handleStudioIntroComplete} />
      )}

      {/* Phase 2: Gothic Main Menu Suite */}
      {appPhase === 'main-menu' && (
        <CinematicMainMenu
          onEnterLabyrinth={handleEnterLabyrinth}
          beamProfile={beamProfile}
          onBeamProfileChange={handleBeamProfileChange}
          edgeTurnEnabled={edgeTurnEnabled}
          onToggleEdgeTurn={() => setEdgeTurnEnabled((prev) => !prev)}
          audioEnabled={audioEnabled}
          onToggleAudio={handleToggleAudio}
        />
      )}

      {/* Phase 3: Lore & Briefing Warning Screen */}
      {appPhase === 'briefing' && (
        <LoreBriefingModal
          onBreachContainment={handleBreachContainment}
          onBackToMenu={handleBackToMenu}
        />
      )}

      {/* Simulated Eyelid Blink Vignette & Full-Screen Static/Glitch Jumpscare Game-Over Overlay */}
      {appPhase === 'playing' && (
        <JumpscareOverlay
          isBlinking={isBlinking && extractionPhase === 'none'}
          isGameOver={isGameOver}
          elapsedSeconds={telemetry.elapsedSeconds}
          collectedKeycardsCount={collectedKeycardIds.size}
          totalKeycardsCount={maze.keycardNodes.length}
          onRetryCurrentMaze={handleResetPosition}
          onGenerateNewMaze={handleGenerateNewMaze}
          onReturnToMainMenu={handleReturnToMainMenu}
        />
      )}

      {/* Portal Teleportation Warp Animation & Randomized Horror Victory Screen */}
      {appPhase === 'playing' && extractionPhase !== 'none' && (
        <ExtractionVictoryOverlay
          phase={extractionPhase}
          teleportProgress={teleportProgress}
          finalEscapeTimeMs={finalEscapeTimeMs}
          collectedKeycardsCount={collectedKeycardIds.size}
          totalKeycardsCount={maze.keycardNodes.length}
          visitedCount={visitedCells.size}
          totalAngelsCount={angelsPos.length || TOTAL_WEEPING_ANGELS}
          maze={maze}
          onReturnToMainMenu={handleReturnToMainMenu}
          onDeployNewMaze={handleGenerateNewMaze}
          onReplayCurrentSector={handleResetPosition}
        />
      )}

      {/* High-Risk Blueprint UI Modal (Triggered while holding 'M', obscuring the 3D view) */}
      {appPhase === 'playing' && (
        <BlueprintModal
          isOpen={isBlueprintOpen && !isGameOver && extractionPhase === 'none'}
          maze={maze}
          visitedCells={visitedCells}
          collectedKeycardIds={collectedKeycardIds}
          playerWorldPos={playerWorldPos}
          angelsPos={angelsPos}
          neonColor={neonColor}
          showSolutionPath={showSolutionPath}
          telemetry={telemetry}
        />
      )}

      {/* WebGL Context Lost Fallback */}
      {webglLost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 text-slate-200">
          <div className="max-w-md p-6 border border-slate-800 rounded-xl bg-[#0b0f17] text-center">
            <h2 className="font-display text-lg font-bold text-white">
              WebGL Rendering Context Suspended
            </h2>
            <p className="text-xs text-slate-400 mt-2">
              The hardware graphics context was interrupted. Click below to reinitialize the 10×10
              labyrinth renderer.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-violet-500 text-white font-semibold text-xs rounded-lg"
            >
              Restore 3D Viewport
            </button>
          </div>
        </div>
      )}

      {/* Semantic DOM Overlay & Unified Collapsible Bottom Control Dock (Hidden on Death or Victory/Teleport Screen) */}
      {appPhase === 'playing' && !isGameOver && extractionPhase === 'none' && (
        <ControlDock
          maze={maze}
          telemetry={telemetry}
          visitedCells={visitedCells}
          collectedKeycardIds={collectedKeycardIds}
          isPointerLocked={isPointerLocked}
          cameraMode={cameraMode}
          beamProfile={beamProfile}
          onBeamProfileChange={handleBeamProfileChange}
          angelBehaviorMode={angelBehaviorMode}
          onAngelBehaviorModeChange={handleAngelBehaviorModeChange}
          onTriggerManualBlink={handleTriggerManualBlink}
          neonColor={neonColor}
          showSolutionPath={showSolutionPath}
          onToggleSolutionPath={() => setShowSolutionPath((prev) => !prev)}
          edgeTurnEnabled={edgeTurnEnabled}
          onToggleEdgeTurn={() => setEdgeTurnEnabled((prev) => !prev)}
          audioEnabled={audioEnabled}
          onToggleAudio={handleToggleAudio}
          isCollapsed={isCollapsed}
          onToggleCollapse={() => setIsCollapsed((prev) => !prev)}
          isBlueprintOpen={isBlueprintOpen}
          onBlueprintHoldChange={handleBlueprintHoldChange}
          onGenerateNewMaze={handleGenerateNewMaze}
          onResetPosition={handleResetPosition}
          onReturnToMainMenu={handleReturnToMainMenu}
          playerWorldPos={playerWorldPos}
          angelsPos={angelsPos}
        />
      )}
    </main>
  );
}
