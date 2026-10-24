import * as THREE from 'three';
import { MazeData, WallCubeAABB } from './mazeGenerator';
import { resolveMazeCollision } from './collision';
import { prepareGeometryForFullPBR } from './compositeModels';
import { ProceduralMaterialLibrary } from './proceduralMaterials';

export type AngelPoseState = 'passive' | 'aggressive';
export type AngelBehaviorMode = 'quantum-ai' | 'inspect-passive' | 'inspect-aggressive';

export interface WeepingAngelRig {
  id: string;
  angelIndex: number;
  group: THREE.Group;
  poseState: AngelPoseState;
  isQuantumLocked: boolean;
  isPermanentlyFrozen: boolean;
  worldX: number;
  worldZ: number;
  yaw: number;
  distanceToPlayer: number;
  setPoseState: (state: AngelPoseState) => void;
  setPermanentFreeze: (frozen: boolean) => void;
  resetToSpawn: (maze: MazeData) => void;
  updateAI: (
    dt: number,
    playerX: number,
    playerZ: number,
    fpCamera: THREE.PerspectiveCamera,
    flashlightWorldDir: THREE.Vector3,
    flashlightAngle: number,
    flashlightDistance: number,
    isPlayerBlinking: boolean,
    behaviorMode: AngelBehaviorMode,
    maze: MazeData,
    otherAngels: WeepingAngelRig[],
    onScrapeStep: (intensity: number) => void,
    onJumpscareTrigger: () => void
  ) => {
    isQuantumLocked: boolean;
    isSightLineThreatActive: boolean;
    poseState: AngelPoseState;
    distanceToPlayer: number;
  };
  PositionForJumpscare: (fpCamera: THREE.PerspectiveCamera) => void;
  updateKillSequence: (killElapsed: number, fpCamera: THREE.PerspectiveCamera) => void;
  dispose: () => void;
}

// Pre-allocated math helpers for zero-GC 60 FPS Quantum-Lock checks
const _projScreenMatrix = new THREE.Matrix4();
const _frustum = new THREE.Frustum();
const _angelBoundingBox = new THREE.Box3();
const _angelMin = new THREE.Vector3();
const _angelMax = new THREE.Vector3();
const _toAngelVec = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _dirToAngel2D = new THREE.Vector2();
const _camForward2D = new THREE.Vector2();

const ANGEL_SPRINT_SPEED = 7.2; // Relentless corridor sprint speed when unseen inside 12m
const ANGEL_PROXIMITY_TRIGGER_DIST = 12.0; // Strict 12-meter proximity activation boundary
const ANGEL_COLLISION_RADIUS = 0.42;
const JUMPSCARE_TRIGGER_DIST = 1.12;
const SAMPLE_HEIGHTS = [0.38, 0.92, 1.38, 1.74];

/**
 * Exact 2D Line-Segment vs Shrunken Wall AABB Slab Intersection (Liang-Barsky).
 * Using a slight inward margin (0.09m) prevents corridor wall corners from falsely
 * occluding line-of-sight when the player is staring past a corner at the Angel.
 */
function segmentIntersectsWallAABB(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  wall: WallCubeAABB
): boolean {
  const margin = 0.09;
  const minX = wall.minX + margin;
  const maxX = wall.maxX - margin;
  const minZ = wall.minZ + margin;
  const maxZ = wall.maxZ - margin;

  const dx = x1 - x0;
  const dz = z1 - z0;

  let tMin = 0.0;
  let tMax = 1.0;

  if (Math.abs(dx) < 1e-7) {
    if (x0 < minX || x0 > maxX) return false;
  } else {
    const invDx = 1.0 / dx;
    let t1 = (minX - x0) * invDx;
    let t2 = (maxX - x0) * invDx;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  if (Math.abs(dz) < 1e-7) {
    if (z0 < minZ || z0 > maxZ) return false;
  } else {
    const invDz = 1.0 / dz;
    let t1 = (minZ - z0) * invDz;
    let t2 = (maxZ - z0) * invDz;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tMin = Math.max(tMin, t1);
    tMax = Math.min(tMax, t2);
    if (tMin > tMax) return false;
  }

  return tMax >= tMin && tMax > 0.02 && tMin < 0.98;
}

/**
 * Checks if a 2D line segment from (x0, z0) to (x1, z1) has unobstructed line-of-sight
 * through the maze's extruded 3D wall cubes.
 */
function hasUnobstructedLineOfSight(
  x0: number,
  z0: number,
  x1: number,
  z1: number,
  maze: MazeData
): boolean {
  const dx = x1 - x0;
  const dz = z1 - z0;
  const dist = Math.hypot(dx, dz);
  if (dist < 1.85) return true;

  const segMinX = Math.min(x0, x1);
  const segMaxX = Math.max(x0, x1);
  const segMinZ = Math.min(z0, z1);
  const segMaxZ = Math.max(z0, z1);

  const walls = maze.wallCubes;
  for (let i = 0; i < walls.length; i++) {
    const w = walls[i];
    if (w.maxX < segMinX || w.minX > segMaxX || w.maxZ < segMinZ || w.minZ > segMaxZ) {
      continue;
    }
    if (segmentIntersectsWallAABB(x0, z0, x1, z1, w)) {
      return false;
    }
  }
  return true;
}

/**
 * Builds the high-fidelity Weeping Angel entity strictly replicating the uploaded
 * 3D Character Sheet (FRONT, BACK, LEFT, RIGHT, LOW ANGLE, 3/4 VIEW, TOP VIEW,
 * FACE CLOSEUP, HAND CLOSEUP, WING DETAIL, BASE DETAIL):
 *
 * - Stepped mossy circular stone pedestal with bare carved stone feet & 10 toes peeking from the hem
 * - Classical floor-length pleated robes (chiton/peplos) with deep fluted folds, belted waist,
 *   V-neck draped bodice, and kimono-like hanging shoulder sleeves
 * - Feather-by-feather weathered stone wings (4 overlapping tiers = 76 individual beveled feathers)
 *   with central feather shafts and mossy crevices
 * - Uncovered, haunting classical face with sculpted upper/lower eyelids around sightless hollow stone eyes,
 *   parted wavy hair with braided crown & rear chignon bun, and distinct dark/black stone-weeping tear
 *   stains streaming down the cheeks, philtrum, lips, and chin
 * - Anatomical hands with 3-segment phalanges, knuckle creases, and flat carved stone fingernails
 * - State A ('passive'): Melancholic weeping face, right arm outstretched in a grasping pose, left arm
 *   draped down along the robe side (exact turnaround sheet pose)
 * - State B ('aggressive'): Cruel, malicious predatory glare with furrowed brow, mouth slightly parted
 *   in a silent snarl exposing subtle stone teeth, and fingers clawing aggressively forward
 */
export function createWeepingAngelEntity(
  maze: MazeData,
  materials: ProceduralMaterialLibrary,
  isSoftwareGl: boolean,
  angelIndex: number = 0
): WeepingAngelRig {
  const group = new THREE.Group();
  group.name = `WeepingAngelStatueGroup_${angelIndex}`;

  const geometriesToDispose: THREE.BufferGeometry[] = [];

  const regGeo = <T extends THREE.BufferGeometry>(geo: T): T => {
    prepareGeometryForFullPBR(geo);
    geometriesToDispose.push(geo);
    return geo;
  };

  // ============================================================================
  // 1. BASE DETAIL: Stepped Cracked Stone Pedestal with Moss Crevices & Bare Feet
  // ============================================================================
  const shadowGeo = regGeo(new THREE.PlaneGeometry(1.9, 1.9));
  shadowGeo.rotateX(-Math.PI / 2);
  const shadowMesh = new THREE.Mesh(shadowGeo, materials.contactShadowMaterial);
  shadowMesh.position.y = 0.02;
  group.add(shadowMesh);

  const lowerPlinthGeo = regGeo(new THREE.CylinderGeometry(0.49, 0.52, 0.075, 32));
  lowerPlinthGeo.translate(0, 0.0375, 0);
  const lowerPlinthMesh = new THREE.Mesh(lowerPlinthGeo, materials.angelMossStoneMaterial);
  lowerPlinthMesh.castShadow = !isSoftwareGl;
  lowerPlinthMesh.receiveShadow = !isSoftwareGl;
  group.add(lowerPlinthMesh);

  const upperPlinthGeo = regGeo(new THREE.CylinderGeometry(0.43, 0.465, 0.052, 32));
  upperPlinthGeo.translate(0, 0.095, 0);
  const upperPlinthMesh = new THREE.Mesh(upperPlinthGeo, materials.angelStoneMaterial);
  upperPlinthMesh.castShadow = !isSoftwareGl;
  upperPlinthMesh.receiveShadow = !isSoftwareGl;
  group.add(upperPlinthMesh);

  // Mossy stone clumps along the pedestal groove (matching BASE DETAIL)
  const mossClumpGeo = regGeo(new THREE.SphereGeometry(0.048, 8, 8));
  mossClumpGeo.scale(1.8, 0.45, 1.1);
  for (let m = 0; m < 10; m++) {
    const ang = (m / 10) * Math.PI * 2 + 0.2;
    const moss = new THREE.Mesh(mossClumpGeo, materials.angelMossStoneMaterial);
    moss.position.set(Math.cos(ang) * 0.445, 0.076, Math.sin(ang) * 0.445);
    moss.rotation.y = -ang;
    group.add(moss);
  }

  // Bare Carved Stone Feet, Toes & Toenails Peeking from Beneath the Robe Hem (BASE DETAIL)
  const footGeo = regGeo(new THREE.BoxGeometry(0.082, 0.042, 0.145));
  const toeGeo = regGeo(new THREE.SphereGeometry(0.0115, 8, 8));
  toeGeo.scale(0.85, 0.68, 1.38);

  [-1, 1].forEach((side) => {
    const footMesh = new THREE.Mesh(footGeo, materials.angelStoneMaterial);
    footMesh.position.set(side * 0.095, 0.132, 0.245);
    footMesh.rotation.y = side * 0.1;
    group.add(footMesh);

    for (let t = 0; t < 5; t++) {
      const toe = new THREE.Mesh(toeGeo, materials.angelStoneMaterial);
      const toeOffset = (t - 2) * 0.0155 * -side;
      const toeLen = 0.322 - t * 0.0055;
      toe.position.set(side * 0.095 + toeOffset, 0.123, toeLen);
      group.add(toe);
    }
  });

  // ============================================================================
  // 2. CLASSICAL DRAPED ROBES (FRONT / BACK / LEFT / RIGHT / LOW ANGLE)
  // ============================================================================
  const skirtPoints = [
    new THREE.Vector2(0.0, 0.115),
    new THREE.Vector2(0.415, 0.115),
    new THREE.Vector2(0.385, 0.25),
    new THREE.Vector2(0.345, 0.52),
    new THREE.Vector2(0.305, 0.8),
    new THREE.Vector2(0.235, 1.04),
    new THREE.Vector2(0.205, 1.13),
    new THREE.Vector2(0.0, 1.13),
  ];
  const skirtGeo = new THREE.LatheGeometry(skirtPoints, 64);
  const skirtPos = skirtGeo.attributes.position;
  for (let i = 0; i < skirtPos.count; i++) {
    const vx = skirtPos.getX(i);
    const vy = skirtPos.getY(i);
    const vz = skirtPos.getZ(i);
    const r = Math.hypot(vx, vz);
    if (r > 0.05) {
      const angle = Math.atan2(vz, vx);
      // Multi-harmonic classical Greco-Roman drapery pleats (deep vertical flutes + sharp ridges)
      const primaryPleat = Math.sin(angle * 18) * 0.026 * (1.25 - vy * 0.55);
      const secondaryPleat = Math.cos(angle * 11 + vy * 1.8) * 0.015;
      const fineRidge = Math.sin(angle * 32) * 0.0075;
      const newR = Math.max(0.08, r + primaryPleat + secondaryPleat + fineRidge);
      const scale = newR / r;
      skirtPos.setX(i, vx * scale);
      skirtPos.setZ(i, vz * scale);
    }
  }
  skirtGeo.computeVertexNormals();
  regGeo(skirtGeo);

  const skirtMesh = new THREE.Mesh(skirtGeo, materials.angelStoneMaterial);
  skirtMesh.castShadow = !isSoftwareGl;
  skirtMesh.receiveShadow = !isSoftwareGl;
  group.add(skirtMesh);

  // Vertical cascading drapery column folds around the skirt (FRONT / BACK / LEFT / RIGHT)
  const drapeColumnGeo = regGeo(new THREE.CylinderGeometry(0.036, 0.078, 0.98, 12));
  drapeColumnGeo.scale(1.15, 1.0, 0.48);
  const drapeAngles = [0, 0.42, -0.42, Math.PI, Math.PI - 0.38, Math.PI + 0.38, Math.PI / 2, -Math.PI / 2];
  drapeAngles.forEach((ang, idx) => {
    const fold = new THREE.Mesh(
      drapeColumnGeo,
      idx % 2 === 0 ? materials.angelMossStoneMaterial : materials.angelStoneMaterial
    );
    const radius = 0.275;
    fold.position.set(Math.sin(ang) * radius, 0.61, Math.cos(ang) * radius);
    fold.rotation.y = ang;
    fold.rotation.x = -0.13;
    fold.castShadow = !isSoftwareGl;
    group.add(fold);
  });

  // High Waist Cincture Belt (FRONT / BACK / LEFT / RIGHT)
  const beltGeo = regGeo(new THREE.TorusGeometry(0.21, 0.022, 12, 36));
  beltGeo.scale(1.06, 0.82, 0.84);
  const beltMesh = new THREE.Mesh(beltGeo, materials.angelMossStoneMaterial);
  beltMesh.position.set(0, 1.1, 0.01);
  beltMesh.rotation.x = Math.PI / 2 + 0.05;
  group.add(beltMesh);

  // Pleated Upper Torso & Bodice
  const torsoGeo = regGeo(new THREE.CylinderGeometry(0.225, 0.19, 0.45, 32));
  const torsoPos = torsoGeo.attributes.position;
  for (let i = 0; i < torsoPos.count; i++) {
    const vx = torsoPos.getX(i);
    const vz = torsoPos.getZ(i);
    const angle = Math.atan2(vz, vx);
    const pleat = 1.0 + Math.sin(angle * 20) * 0.042;
    torsoPos.setX(i, vx * 1.1 * pleat);
    torsoPos.setZ(i, vz * 0.78 * pleat);
  }
  torsoGeo.computeVertexNormals();
  const torsoMesh = new THREE.Mesh(torsoGeo, materials.angelStoneMaterial);
  torsoMesh.position.set(0, 1.31, 0);
  torsoMesh.castShadow = !isSoftwareGl;
  torsoMesh.receiveShadow = !isSoftwareGl;
  group.add(torsoMesh);

  // Draped V-Neck & Catenary Chest Folds (FRONT / LOW ANGLE)
  const sashGeo = regGeo(new THREE.TorusGeometry(0.205, 0.034, 12, 28));
  sashGeo.scale(1.04, 1.35, 0.78);
  const sashLeft = new THREE.Mesh(sashGeo, materials.angelMossStoneMaterial);
  sashLeft.position.set(-0.022, 1.31, 0.024);
  sashLeft.rotation.set(0.32, 0.1, 0.46);
  const sashRight = new THREE.Mesh(sashGeo, materials.angelMossStoneMaterial);
  sashRight.position.set(0.022, 1.31, 0.024);
  sashRight.rotation.set(0.32, -0.1, -0.46);
  group.add(sashLeft, sashRight);

  // Draped Kimono-Style Hanging Shoulder Sleeves / Cowls (Visible in LEFT & RIGHT views)
  const sleeveGeo = regGeo(new THREE.ConeGeometry(0.115, 0.44, 16, 1, true));
  [-1, 1].forEach((side) => {
    const sleeve = new THREE.Mesh(sleeveGeo, materials.angelMossStoneMaterial);
    sleeve.position.set(side * 0.24, 1.25, -0.01);
    sleeve.rotation.z = side * 0.16;
    sleeve.castShadow = !isSoftwareGl;
    group.add(sleeve);
  });

  // Classical Sculpted Neck & Clavicle Hollow with Dark Weeping Stain
  const neckGeo = regGeo(new THREE.CylinderGeometry(0.072, 0.088, 0.15, 20));
  const neckMesh = new THREE.Mesh(neckGeo, materials.angelStoneMaterial);
  neckMesh.position.set(0, 1.56, 0.01);
  group.add(neckMesh);

  // ============================================================================
  // 3. FACE CLOSEUP: Classical Head, Hollow Eyes, Weeping Tear Streaks & Cruel Snarl
  // ============================================================================
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.655, 0.02);
  group.add(headGroup);

  // Classical Oval Cranium with UV-mapped Weeping Tear-Stain PBR Material
  const craniumGeo = regGeo(new THREE.SphereGeometry(0.144, 32, 32));
  craniumGeo.scale(0.86, 1.07, 0.97);
  const craniumMesh = new THREE.Mesh(craniumGeo, materials.angelFaceMaterial);
  craniumMesh.position.set(0, 0.04, 0);
  craniumMesh.castShadow = !isSoftwareGl;
  headGroup.add(craniumMesh);

  // Sculpted Cheekbones
  const cheekGeo = regGeo(new THREE.SphereGeometry(0.048, 14, 14));
  cheekGeo.scale(1.12, 0.78, 0.88);
  [-1, 1].forEach((side) => {
    const cheek = new THREE.Mesh(cheekGeo, materials.angelFaceMaterial);
    cheek.position.set(side * 0.074, 0.012, 0.096);
    headGroup.add(cheek);
  });

  // Articulated Brow Ridges (Melancholic in State A -> Ruthless Predatory Glare in State B)
  const browGeo = regGeo(new THREE.BoxGeometry(0.064, 0.018, 0.034));
  const leftBrow = new THREE.Mesh(browGeo, materials.angelMossStoneMaterial);
  leftBrow.position.set(-0.046, 0.08, 0.126);
  const rightBrow = new THREE.Mesh(browGeo, materials.angelMossStoneMaterial);
  rightBrow.position.set(0.046, 0.08, 0.126);
  headGroup.add(leftBrow, rightBrow);

  // Classical Nose Bridge & Nostril Wings (FACE CLOSEUP)
  const noseGeo = regGeo(new THREE.ConeGeometry(0.022, 0.08, 8));
  const noseMesh = new THREE.Mesh(noseGeo, materials.angelStoneMaterial);
  noseMesh.position.set(0, 0.032, 0.142);
  noseMesh.rotation.x = 0.2;
  headGroup.add(noseMesh);

  // Deep Orbital Sockets + Blank Sightless Stone Eyeballs + Carved Upper/Lower Eyelids (FACE CLOSEUP)
  const socketGeo = regGeo(new THREE.SphereGeometry(0.033, 14, 14));
  socketGeo.scale(1.15, 0.92, 0.82);
  const eyeballGeo = regGeo(new THREE.SphereGeometry(0.024, 14, 14));
  const eyelidGeo = regGeo(new THREE.TorusGeometry(0.025, 0.0055, 8, 16, Math.PI));

  [-1, 1].forEach((side) => {
    const ex = side * 0.046;
    const ey = 0.048;
    const ez = 0.116;

    const socket = new THREE.Mesh(socketGeo, materials.angelSocketMaterial);
    socket.position.set(ex, ey, ez);
    headGroup.add(socket);

    // Blank, pupil-less weathered stone eyeball (matching FACE CLOSEUP)
    const eyeball = new THREE.Mesh(eyeballGeo, materials.angelStoneMaterial);
    eyeball.position.set(ex, ey, ez + 0.005);
    headGroup.add(eyeball);

    // Carved upper stone eyelid rim
    const upperLid = new THREE.Mesh(eyelidGeo, materials.angelMossStoneMaterial);
    upperLid.position.set(ex, ey + 0.003, ez + 0.012);
    upperLid.rotation.set(0.22, 0, 0);
    headGroup.add(upperLid);

    // Carved lower stone eyelid rim
    const lowerLid = new THREE.Mesh(eyelidGeo, materials.angelMossStoneMaterial);
    lowerLid.position.set(ex, ey - 0.003, ez + 0.011);
    lowerLid.rotation.set(Math.PI - 0.22, 0, 0);
    headGroup.add(lowerLid);
  });

  // Distinct Dark/Black Stone-Weeping Tear Stains Streaming Down the Cheeks (FACE CLOSEUP)
  const tearStreakGeo = regGeo(new THREE.CylinderGeometry(0.0032, 0.0065, 0.108, 6));
  const tearStreams = [
    { x: -0.056, y: -0.004, z: 0.125, rz: 0.06, scaleY: 1.05 },
    { x: -0.046, y: -0.008, z: 0.13, rz: -0.02, scaleY: 1.18 },
    { x: -0.036, y: -0.002, z: 0.132, rz: -0.07, scaleY: 0.92 },
    { x: -0.065, y: 0.004, z: 0.118, rz: 0.14, scaleY: 0.85 },
    { x: 0.056, y: -0.004, z: 0.125, rz: -0.06, scaleY: 1.05 },
    { x: 0.046, y: -0.008, z: 0.13, rz: 0.02, scaleY: 1.18 },
    { x: 0.036, y: -0.002, z: 0.132, rz: 0.07, scaleY: 0.92 },
    { x: 0.065, y: 0.004, z: 0.118, rz: -0.14, scaleY: 0.85 },
  ];
  tearStreams.forEach((ts) => {
    const streak = new THREE.Mesh(tearStreakGeo, materials.angelBloodStainMaterial);
    streak.position.set(ts.x, ts.y, ts.z);
    streak.scale.set(1, ts.scaleY, 1);
    streak.rotation.set(-0.11, 0, ts.rz);
    headGroup.add(streak);
  });

  // Center-Parted Wavy Classical Hair, Braided Crown & Rear Chignon Bun (FACE CLOSEUP & BACK)
  const hairCrownGeo = regGeo(new THREE.TorusGeometry(0.132, 0.044, 14, 32));
  const hairCrownMesh = new THREE.Mesh(hairCrownGeo, materials.angelMossStoneMaterial);
  hairCrownMesh.position.set(0, 0.086, -0.016);
  hairCrownMesh.rotation.x = Math.PI / 2 - 0.36;
  headGroup.add(hairCrownMesh);

  const braidBandGeo = regGeo(new THREE.TorusGeometry(0.136, 0.022, 10, 32));
  const braidBandMesh = new THREE.Mesh(braidBandGeo, materials.angelStoneMaterial);
  braidBandMesh.position.set(0, 0.106, -0.004);
  braidBandMesh.rotation.x = Math.PI / 2 - 0.2;
  headGroup.add(braidBandMesh);

  // Sculpted wavy hair locks framing the forehead and temples
  const hairWaveGeo = regGeo(new THREE.CylinderGeometry(0.026, 0.022, 0.145, 10));
  for (let w = 0; w < 8; w++) {
    const side = w % 2 === 0 ? -1 : 1;
    const row = Math.floor(w / 2);
    const lock = new THREE.Mesh(
      hairWaveGeo,
      row % 2 === 0 ? materials.angelMossStoneMaterial : materials.angelStoneMaterial
    );
    lock.position.set(
      side * (0.095 + row * 0.014),
      0.082 - row * 0.024,
      0.082 - row * 0.048
    );
    lock.rotation.set(0.42 + row * 0.18, 0, side * 0.32);
    headGroup.add(lock);
  }

  // Coiled Rear Chignon Bun at the Nape (BACK / LEFT / RIGHT)
  const chignonGeo = regGeo(new THREE.SphereGeometry(0.086, 18, 18));
  chignonGeo.scale(1.06, 0.92, 1.14);
  const chignonMesh = new THREE.Mesh(chignonGeo, materials.angelMossStoneMaterial);
  chignonMesh.position.set(0, 0.036, -0.156);
  headGroup.add(chignonMesh);

  // Sculpted Upper Lip, Inner Snarl Cavity & Subtle Carved Stone Teeth
  const upperLipGeo = regGeo(new THREE.TorusGeometry(0.026, 0.0065, 8, 16, Math.PI));
  const upperLipMesh = new THREE.Mesh(upperLipGeo, materials.angelStoneMaterial);
  upperLipMesh.position.set(0, -0.016, 0.13);
  upperLipMesh.rotation.set(Math.PI * 0.55, 0, 0);
  headGroup.add(upperLipMesh);

  const mouthCavityGeo = regGeo(new THREE.SphereGeometry(0.042, 12, 12));
  mouthCavityGeo.scale(1.05, 0.85, 0.75);
  const mouthCavityMesh = new THREE.Mesh(mouthCavityGeo, materials.angelSocketMaterial);
  mouthCavityMesh.position.set(0, -0.028, 0.106);
  headGroup.add(mouthCavityMesh);

  // Subtle carved stone teeth inside the cruel parted snarl (Visible in State B)
  const toothGeo = regGeo(new THREE.ConeGeometry(0.0045, 0.016, 5));
  const snarlTeethGroup = new THREE.Group();
  snarlTeethGroup.position.set(0, -0.02, 0.125);
  headGroup.add(snarlTeethGroup);

  for (let t = -3; t <= 3; t++) {
    const upperTooth = new THREE.Mesh(toothGeo, materials.angelFangMaterial);
    upperTooth.position.set(t * 0.0075, -0.003, -Math.abs(t) * 0.0015);
    upperTooth.rotation.x = Math.PI;
    snarlTeethGroup.add(upperTooth);
  }

  // Articulated Lower Jaw, Lower Lip & Central Chin Weeping Stain (FACE CLOSEUP)
  const jawGroup = new THREE.Group();
  jawGroup.position.set(0, -0.026, 0.035);
  headGroup.add(jawGroup);

  const jawBoneGeo = regGeo(new THREE.CylinderGeometry(0.068, 0.044, 0.072, 16));
  jawBoneGeo.scale(0.9, 1.0, 1.28);
  const jawBoneMesh = new THREE.Mesh(jawBoneGeo, materials.angelFaceMaterial);
  jawBoneMesh.position.set(0, -0.028, 0.048);
  jawGroup.add(jawBoneMesh);

  const lowerLipMesh = new THREE.Mesh(upperLipGeo, materials.angelStoneMaterial);
  lowerLipMesh.position.set(0, 0.003, 0.094);
  lowerLipMesh.rotation.set(-Math.PI * 0.45, 0, 0);
  jawGroup.add(lowerLipMesh);

  // Distinct dark weeping stain running vertically down the center of the lips and chin (FACE CLOSEUP)
  const chinWeepGeo = regGeo(new THREE.CylinderGeometry(0.0065, 0.0035, 0.068, 6));
  const chinWeepMesh = new THREE.Mesh(chinWeepGeo, materials.angelBloodStainMaterial);
  chinWeepMesh.position.set(0, -0.024, 0.098);
  chinWeepMesh.rotation.x = 0.14;
  jawGroup.add(chinWeepMesh);

  // ============================================================================
  // 4. HAND CLOSEUP: Outstretched Grasping Stone Hands with 3-Segment Fingers & Nails
  // ============================================================================
  const upperArmGeo = regGeo(new THREE.CylinderGeometry(0.052, 0.044, 0.32, 16));
  upperArmGeo.translate(0, -0.16, 0);

  const forearmGeo = regGeo(new THREE.CylinderGeometry(0.044, 0.034, 0.3, 16));
  forearmGeo.translate(0, -0.15, 0);

  const palmGeo = regGeo(new THREE.BoxGeometry(0.072, 0.084, 0.026));
  const phalanx1Geo = regGeo(new THREE.CylinderGeometry(0.0082, 0.0072, 0.036, 10));
  phalanx1Geo.translate(0, -0.018, 0);
  const phalanx2Geo = regGeo(new THREE.CylinderGeometry(0.0072, 0.0062, 0.03, 10));
  phalanx2Geo.translate(0, -0.015, 0);
  const phalanx3Geo = regGeo(new THREE.CylinderGeometry(0.0062, 0.005, 0.024, 10));
  phalanx3Geo.translate(0, -0.012, 0);
  // Flat carved stone fingernail plate on the dorsal fingertip (matching HAND CLOSEUP)
  const fingernailGeo = regGeo(new THREE.BoxGeometry(0.0075, 0.012, 0.0025));

  interface ArticulatedFinger {
    knuckle: THREE.Group;
    midJoint: THREE.Group;
    distalJoint: THREE.Group;
    isThumb: boolean;
  }

  const buildArmHierarchy = (side: -1 | 1) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.235, 1.45, 0.02);
    group.add(shoulder);

    const upperArm = new THREE.Mesh(upperArmGeo, materials.angelStoneMaterial);
    upperArm.castShadow = !isSoftwareGl;
    shoulder.add(upperArm);

    const elbow = new THREE.Group();
    elbow.position.set(0, -0.3, 0);
    shoulder.add(elbow);

    const forearm = new THREE.Mesh(forearmGeo, materials.angelStoneMaterial);
    forearm.castShadow = !isSoftwareGl;
    elbow.add(forearm);

    const wrist = new THREE.Group();
    wrist.position.set(0, -0.29, 0);
    elbow.add(wrist);

    const palm = new THREE.Mesh(palmGeo, materials.angelMossStoneMaterial);
    palm.position.set(0, -0.04, 0);
    wrist.add(palm);

    const fingers: ArticulatedFinger[] = [];

    const fingerSpecs = [
      { x: -0.026 * side, y: -0.076, z: 0.004, scale: 0.96, splay: -0.15 * side, isThumb: false },
      { x: -0.009 * side, y: -0.08, z: 0.005, scale: 1.06, splay: -0.04 * side, isThumb: false },
      { x: 0.009 * side, y: -0.078, z: 0.004, scale: 1.0, splay: 0.06 * side, isThumb: false },
      { x: 0.025 * side, y: -0.072, z: 0.002, scale: 0.85, splay: 0.17 * side, isThumb: false },
      { x: -0.036 * side, y: -0.034, z: 0.012, scale: 0.92, splay: -0.56 * side, isThumb: true },
    ];

    fingerSpecs.forEach((spec) => {
      const knuckle = new THREE.Group();
      knuckle.position.set(spec.x, spec.y, spec.z);
      knuckle.rotation.z = spec.splay;
      knuckle.scale.setScalar(spec.scale);
      wrist.add(knuckle);

      const seg1 = new THREE.Mesh(phalanx1Geo, materials.angelMossStoneMaterial);
      knuckle.add(seg1);

      const midJoint = new THREE.Group();
      midJoint.position.set(0, -0.034, 0);
      knuckle.add(midJoint);

      const seg2 = new THREE.Mesh(phalanx2Geo, materials.angelStoneMaterial);
      midJoint.add(seg2);

      const distalJoint = new THREE.Group();
      distalJoint.position.set(0, -0.028, 0);
      midJoint.add(distalJoint);

      const seg3 = new THREE.Mesh(phalanx3Geo, materials.angelStoneMaterial);
      distalJoint.add(seg3);

      // Carved stone fingernail with dark grime rim (matching HAND CLOSEUP)
      const nail = new THREE.Mesh(fingernailGeo, materials.angelFangMaterial);
      nail.position.set(0, -0.016, 0.0045);
      distalJoint.add(nail);

      fingers.push({ knuckle, midJoint, distalJoint, isThumb: spec.isThumb });
    });

    return { shoulder, elbow, wrist, fingers };
  };

  const leftArm = buildArmHierarchy(-1);
  const rightArm = buildArmHierarchy(1);

  // ============================================================================
  // 5. WING DETAIL: Feather-by-Feather Weathered Stone Wings with Moss Crevices
  // ============================================================================
  const featherShape = new THREE.Shape();
  featherShape.moveTo(0, 0);
  featherShape.quadraticCurveTo(0.062, 0.22, 0.048, 0.62);
  featherShape.quadraticCurveTo(0.015, 0.86, 0.0, 0.96);
  featherShape.quadraticCurveTo(-0.036, 0.74, -0.042, 0.28);
  featherShape.closePath();

  const featherGeo = regGeo(
    new THREE.ExtrudeGeometry(featherShape, {
      depth: 0.024,
      bevelEnabled: true,
      bevelSegments: 2,
      steps: 1,
      bevelSize: 0.008,
      bevelThickness: 0.008,
    })
  );

  // Carved feather shaft (rachis) ridge running down each primary feather
  const rachisGeo = regGeo(new THREE.CylinderGeometry(0.003, 0.006, 0.85, 6));
  rachisGeo.translate(0, 0.425, 0.016);

  const buildWing = (side: -1 | 1) => {
    const wingPivot = new THREE.Group();
    wingPivot.position.set(side * 0.13, 1.44, -0.145);
    group.add(wingPivot);

    // High-arched classical wing shoulder curve (FRONT / BACK / WING DETAIL)
    const archCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.22, 0.4, -0.09),
      new THREE.Vector3(side * 0.5, 0.44, -0.16),
      new THREE.Vector3(side * 0.68, 0.12, -0.21),
      new THREE.Vector3(side * 0.6, -0.34, -0.19),
    ]);
    const boneGeo = regGeo(new THREE.TubeGeometry(archCurve, 22, 0.042, 10, false));
    const boneMesh = new THREE.Mesh(boneGeo, materials.angelMossStoneMaterial);
    boneMesh.castShadow = !isSoftwareGl;
    wingPivot.add(boneMesh);

    // Tier 0: 7 Marginal Shoulder Covert Feathers (Heavy Moss Crevices — WING DETAIL)
    for (let i = 0; i < 7; i++) {
      const t = i / 6;
      const anchor = archCurve.getPoint(t * 0.62);
      const marginal = new THREE.Mesh(featherGeo, materials.angelMossStoneMaterial);
      marginal.position.set(anchor.x, anchor.y + 0.01, anchor.z + 0.026);
      marginal.scale.set(0.82, 0.24 + Math.sin(t * Math.PI) * 0.1, 1.15);
      marginal.rotation.z = Math.PI - side * (0.15 + t * 0.32);
      marginal.rotation.y = side * 0.1;
      marginal.rotation.x = 0.2;
      wingPivot.add(marginal);
    }

    // Tier 1: 9 Lesser Covert Feathers
    for (let i = 0; i < 9; i++) {
      const t = i / 8;
      const anchor = archCurve.getPoint(t * 0.78);
      const covert = new THREE.Mesh(
        featherGeo,
        i % 2 === 0 ? materials.angelMossStoneMaterial : materials.angelStoneMaterial
      );
      covert.position.set(anchor.x, anchor.y - 0.02, anchor.z + 0.016);
      covert.scale.set(0.94, 0.36 + Math.sin(t * Math.PI) * 0.16, 1.1);
      covert.rotation.z = Math.PI - side * (0.12 + t * 0.38);
      covert.rotation.y = side * 0.12;
      covert.rotation.x = 0.16;
      wingPivot.add(covert);
    }

    // Tier 2: 10 Median Secondary Plume Feathers
    for (let i = 0; i < 10; i++) {
      const t = i / 9;
      const anchor = archCurve.getPoint(t * 0.88);
      const secondary = new THREE.Mesh(
        featherGeo,
        i % 2 === 0 ? materials.angelStoneMaterial : materials.angelMossStoneMaterial
      );
      secondary.position.set(anchor.x, anchor.y - 0.08, anchor.z);
      secondary.scale.set(1.06, 0.62 + Math.sin(t * Math.PI) * 0.26, 1.0);
      secondary.rotation.z = Math.PI - side * (0.14 + t * 0.42);
      secondary.rotation.y = side * 0.14;
      secondary.rotation.x = 0.12;
      secondary.castShadow = !isSoftwareGl;
      wingPivot.add(secondary);
    }

    // Tier 3: 12 Long Sweeping Primary Flight Feathers with Carved Central Rachis Shafts
    for (let i = 0; i < 12; i++) {
      const t = i / 11;
      const anchor = archCurve.getPoint(t);
      const primary = new THREE.Mesh(
        featherGeo,
        i % 3 === 0 ? materials.angelMossStoneMaterial : materials.angelStoneMaterial
      );
      const shaft = new THREE.Mesh(rachisGeo, materials.angelMossStoneMaterial);
      primary.add(shaft);

      primary.position.set(anchor.x, anchor.y - 0.14, anchor.z - 0.016);
      const lengthScale = 0.84 + Math.sin(t * Math.PI) * 0.5 + (1 - t) * 0.22;
      primary.scale.set(1.14, lengthScale, 1.0);
      primary.rotation.z = Math.PI - side * (0.08 + t * 0.45);
      primary.rotation.y = side * 0.15;
      primary.rotation.x = 0.09;
      primary.castShadow = !isSoftwareGl;
      primary.receiveShadow = !isSoftwareGl;
      wingPivot.add(primary);
    }

    return wingPivot;
  };

  const leftWing = buildWing(-1);
  const rightWing = buildWing(1);

  // ============================================================================
  // 6. CRUEL FACIAL EXPRESSIONS & DUAL MORPH STATES (STATE A vs STATE B)
  // ============================================================================
  let currentPose: AngelPoseState = 'passive';

  const applyPoseState = (state: AngelPoseState) => {
    currentPose = state;

    if (state === 'passive') {
      // STATE A (OBSERVED / PASSIVE — Exact 3D Character Sheet Pose):
      // - Haunting, melancholic uncovered face with dark weeping streaks & closed lips
      // - Right arm outstretched forward with a grasping stone hand (FRONT / LEFT / RIGHT / HAND CLOSEUP)
      // - Left arm hanging naturally down along the left side of the pleated robes
      headGroup.rotation.set(0.03, 0, 0);
      leftBrow.position.set(-0.046, 0.082, 0.126);
      leftBrow.rotation.set(0, 0, 0.09);
      rightBrow.position.set(0.046, 0.082, 0.126);
      rightBrow.rotation.set(0, 0, -0.09);

      jawGroup.position.set(0, -0.026, 0.035);
      jawGroup.rotation.set(0.02, 0, 0);
      snarlTeethGroup.visible = false;

      // Right arm outstretched forward in the signature grasping pose from the Character Sheet
      rightArm.shoulder.rotation.set(-1.46, 0.08, 0.06);
      rightArm.elbow.rotation.set(-0.18, 0, -0.06);
      rightArm.wrist.rotation.set(-0.42, -0.1, 0.05);
      rightArm.fingers.forEach((f, idx) => {
        if (f.isThumb) {
          f.knuckle.rotation.x = 0.36;
          f.midJoint.rotation.x = 0.42;
          f.distalJoint.rotation.x = 0.38;
        } else {
          const curl = 0.32 + idx * 0.05;
          f.knuckle.rotation.x = curl;
          f.midJoint.rotation.x = curl * 1.15;
          f.distalJoint.rotation.x = curl * 0.95;
        }
      });

      // Left arm hanging down gracefully along the left side of the pleated robe (FRONT / LEFT / 3/4 VIEW)
      leftArm.shoulder.rotation.set(0.08, 0.05, -0.11);
      leftArm.elbow.rotation.set(-0.16, 0, 0.04);
      leftArm.wrist.rotation.set(0.06, 0.12, 0);
      leftArm.fingers.forEach((f, idx) => {
        const relaxCurl = 0.22 + idx * 0.04;
        f.knuckle.rotation.x = relaxCurl;
        f.midJoint.rotation.x = relaxCurl;
        f.distalJoint.rotation.x = relaxCurl;
      });

      // Wings poised behind the back (FRONT / BACK / WING DETAIL)
      leftWing.rotation.set(-0.04, 0.26, -0.06);
      rightWing.rotation.set(-0.04, -0.26, 0.06);
    } else {
      // STATE B (HUNTING / ATTACKING — Ruthless Cruelty & Malice):
      // - Hollow eyes glaring with predatory intent beneath sharply angled brow ridges
      // - Mouth slightly parted in a cruel, silent snarl exposing subtle stone teeth
      // - Fingers clawing aggressively forward as both arms reach for the victim
      headGroup.rotation.set(-0.06, 0, 0);
      leftBrow.position.set(-0.044, 0.075, 0.13);
      leftBrow.rotation.set(0.18, 0, -0.28);
      rightBrow.position.set(0.044, 0.075, 0.13);
      rightBrow.rotation.set(0.18, 0, 0.28);

      // Mouth slightly parted in a silent, malicious snarl
      jawGroup.position.set(0, -0.036, 0.035);
      jawGroup.rotation.set(0.28, 0, 0);
      snarlTeethGroup.visible = true;

      // Right arm lunging forward with fingers flexed into a tense, predatory claw
      rightArm.shoulder.rotation.set(-1.58, 0.12, 0.12);
      rightArm.elbow.rotation.set(-0.22, 0, -0.08);
      rightArm.wrist.rotation.set(-0.66, -0.14, 0.08);
      rightArm.fingers.forEach((f, idx) => {
        if (f.isThumb) {
          f.knuckle.rotation.x = 0.56;
          f.midJoint.rotation.x = 0.68;
          f.distalJoint.rotation.x = 0.72;
        } else {
          const clawCurl = 0.52 + (idx % 2) * 0.12;
          f.knuckle.rotation.x = clawCurl;
          f.midJoint.rotation.x = clawCurl * 1.38;
          f.distalJoint.rotation.x = clawCurl * 1.45;
        }
      });

      // Left arm raised forward to claw aggressively alongside the right hand
      leftArm.shoulder.rotation.set(-1.42, -0.14, -0.14);
      leftArm.elbow.rotation.set(-0.28, 0, 0.1);
      leftArm.wrist.rotation.set(-0.62, 0.14, -0.08);
      leftArm.fingers.forEach((f, idx) => {
        if (f.isThumb) {
          f.knuckle.rotation.x = 0.56;
          f.midJoint.rotation.x = 0.68;
          f.distalJoint.rotation.x = 0.72;
        } else {
          const clawCurl = 0.48 + ((idx + 1) % 2) * 0.14;
          f.knuckle.rotation.x = clawCurl;
          f.midJoint.rotation.x = clawCurl * 1.38;
          f.distalJoint.rotation.x = clawCurl * 1.45;
        }
      });

      // Wings flared outward with predatory menace
      leftWing.rotation.set(0.12, -0.1, 0.2);
      rightWing.rotation.set(0.12, 0.1, -0.2);
    }
  };

  // Pick the designated spawn coordinate for this Angel index from maze.angelSpawnCells
  const pickSpawnPosition = (m: MazeData): { x: number; z: number; yaw: number } => {
    if (m.angelSpawnCells && m.angelSpawnCells.length > 0) {
      const node = m.angelSpawnCells[angelIndex % m.angelSpawnCells.length];
      return { x: node.worldX, z: node.worldZ, yaw: node.yaw };
    }

    const offsetX = -((m.voxelCols - 1) * m.tileSize) / 2;
    const offsetZ = -((m.voxelRows - 1) * m.tileSize) / 2;
    const startX = m.startWorldPos ? m.startWorldPos.x : offsetX + m.tileSize;
    const startZ = m.startWorldPos ? m.startWorldPos.z : offsetZ + m.tileSize;

    const fallbackR = Math.min(2 + angelIndex * 2, m.logicalRows - 1);
    const fallbackC = Math.min(2 + angelIndex * 2, m.logicalCols - 1);
    const wx = offsetX + (fallbackC * 2 + 1) * m.tileSize;
    const wz = offsetZ + (fallbackR * 2 + 1) * m.tileSize;
    const yawToPlayer = Math.atan2(startX - wx, startZ - wz);
    return { x: wx, z: wz, yaw: yawToPlayer };
  };

  const initialSpawn = pickSpawnPosition(maze);
  let worldX = initialSpawn.x;
  let worldZ = initialSpawn.z;
  let yaw = initialSpawn.yaw;
  let isQuantumLocked = true;
  let isPermanentlyFrozen = false;
  let activePursuitTarget: { x: number; z: number } | null = null;
  let scrapeAccumulator = 0;

  group.position.set(worldX, 0, worldZ);
  group.rotation.y = yaw;
  applyPoseState('passive');

  return {
    id: `angel-${angelIndex}`,
    angelIndex,
    group,
    get poseState() {
      return currentPose;
    },
    get isQuantumLocked() {
      return isQuantumLocked;
    },
    get isPermanentlyFrozen() {
      return isPermanentlyFrozen;
    },
    get worldX() {
      return worldX;
    },
    get worldZ() {
      return worldZ;
    },
    get yaw() {
      return yaw;
    },
    distanceToPlayer: 15,
    setPoseState: applyPoseState,
    setPermanentFreeze: (frozen: boolean) => {
      isPermanentlyFrozen = frozen;
      if (frozen) {
        isQuantumLocked = true;
        activePursuitTarget = null;
        if (currentPose !== 'passive') {
          applyPoseState('passive');
        }
      }
    },
    resetToSpawn: (m: MazeData) => {
      const sp = pickSpawnPosition(m);
      worldX = sp.x;
      worldZ = sp.z;
      yaw = sp.yaw;
      scrapeAccumulator = 0;
      isQuantumLocked = true;
      isPermanentlyFrozen = false;
      activePursuitTarget = null;
      group.position.set(worldX, 0, worldZ);
      group.rotation.set(0, yaw, 0);
      applyPoseState('passive');
    },
    PositionForJumpscare: (fpCamera: THREE.PerspectiveCamera) => {
      // Snap Angel in State B (Cruel Malice Snarl & Clawed Hands) directly in front of camera lens
      applyPoseState('aggressive');
      const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(fpCamera.quaternion);
      camDir.y = 0;
      if (camDir.lengthSq() > 0.001) camDir.normalize();
      else camDir.set(0, 0, -1);

      worldX = fpCamera.position.x + camDir.x * 0.82;
      worldZ = fpCamera.position.z + camDir.z * 0.82;
      yaw = Math.atan2(fpCamera.position.x - worldX, fpCamera.position.z - worldZ);

      group.position.set(worldX, fpCamera.position.y - 1.62, worldZ);
      group.rotation.set(0, yaw, 0);
    },
    updateKillSequence: (killElapsed: number, fpCamera: THREE.PerspectiveCamera) => {
      // Gruesome close-up execution animation: the Angel lunges inches from the camera lens
      // while its clawed stone hands slash and clamp forward
      const lungeProgress = Math.min(1.0, killElapsed * 4.5);
      const distFromLens = 0.86 - lungeProgress * 0.24;

      const camDir = new THREE.Vector3(0, 0, -1).applyQuaternion(fpCamera.quaternion);
      camDir.y = 0;
      if (camDir.lengthSq() > 0.001) camDir.normalize();
      else camDir.set(0, 0, -1);

      worldX = fpCamera.position.x + camDir.x * distFromLens;
      worldZ = fpCamera.position.z + camDir.z * distFromLens;
      yaw = Math.atan2(fpCamera.position.x - worldX, fpCamera.position.z - worldZ);

      group.position.set(worldX, fpCamera.position.y - 1.64, worldZ);
      group.rotation.set(0, yaw, 0);

      // Violent predatory clawing motion & cruel snarl tremor during execution
      const slashWave = Math.sin(killElapsed * 18.0);
      const secondaryWave = Math.cos(killElapsed * 14.0);

      headGroup.rotation.set(-0.08 + secondaryWave * 0.04, slashWave * 0.05, secondaryWave * 0.04);
      jawGroup.rotation.set(0.32 + Math.abs(slashWave) * 0.12, 0, 0);

      rightArm.shoulder.rotation.set(
        -1.64 + slashWave * 0.18,
        0.16 + secondaryWave * 0.1,
        0.12
      );
      leftArm.shoulder.rotation.set(
        -1.56 - slashWave * 0.18,
        -0.16 - secondaryWave * 0.1,
        -0.12
      );
    },
    updateAI: (
      dt,
      playerX,
      playerZ,
      fpCamera,
      flashlightWorldDir,
      flashlightAngle,
      flashlightDistance,
      isPlayerBlinking,
      behaviorMode,
      mazeData,
      otherAngels,
      onScrapeStep,
      onJumpscareTrigger
    ) => {
      const distToPlayer = Math.hypot(playerX - worldX, playerZ - worldZ);

      // ============================================================================
      // 0. ABSOLUTE AI IMMUNITY OVERRIDE (Portal Extraction / Victory Triggered):
      // Permanently freezes the Angel in State A, disables 12m aggro & Track 2, and
      // makes it 100% immune to movement even if the player looks away or turns around.
      // ============================================================================
      if (isPermanentlyFrozen) {
        isQuantumLocked = true;
        activePursuitTarget = null;
        if (currentPose !== 'passive') {
          applyPoseState('passive');
        }
        return {
          isQuantumLocked: true,
          isSightLineThreatActive: false,
          poseState: currentPose,
          distanceToPlayer: distToPlayer,
        };
      }

      if (behaviorMode === 'inspect-passive') {
        isQuantumLocked = true;
        if (currentPose !== 'passive') applyPoseState('passive');
        return {
          isQuantumLocked: true,
          isSightLineThreatActive: false,
          poseState: currentPose,
          distanceToPlayer: distToPlayer,
        };
      }
      if (behaviorMode === 'inspect-aggressive') {
        isQuantumLocked = true;
        if (currentPose !== 'aggressive') applyPoseState('aggressive');
        return {
          isQuantumLocked: true,
          isSightLineThreatActive: false,
          poseState: currentPose,
          distanceToPlayer: distToPlayer,
        };
      }

      // ============================================================================
      // 1. RULE A (Outside 12m): Complete Quantum-Lock & Stationary
      // ============================================================================
      if (distToPlayer > ANGEL_PROXIMITY_TRIGGER_DIST) {
        activePursuitTarget = null;
        isQuantumLocked = true;
        if (currentPose !== 'passive') {
          applyPoseState('passive');
        }
        return {
          isQuantumLocked: true,
          isSightLineThreatActive: false,
          poseState: currentPose,
          distanceToPlayer: distToPlayer,
        };
      }

      // ============================================================================
      // 2. RULE C (Corner-Occlusion / Evaded):
      // If the player rounds a corner and breaks direct line-of-sight naturally,
      // this Angel halts pursuit, cuts Track 2, and freezes permanently at its
      // last known coordinate until direct line-of-sight is re-established.
      // ============================================================================
      const invDist = 1.0 / Math.max(distToPlayer, 0.1);
      const perpX = -(playerZ - worldZ) * invDist * 0.36;
      const perpZ = (playerX - worldX) * invDist * 0.36;

      const hasDirectCorridorLoS =
        hasUnobstructedLineOfSight(playerX, playerZ, worldX, worldZ, mazeData) ||
        hasUnobstructedLineOfSight(playerX, playerZ, worldX + perpX, worldZ + perpZ, mazeData) ||
        hasUnobstructedLineOfSight(playerX, playerZ, worldX - perpX, worldZ - perpZ, mazeData);

      if (!hasDirectCorridorLoS) {
        activePursuitTarget = null;
        isQuantumLocked = true;
        return {
          isQuantumLocked: true,
          isSightLineThreatActive: false,
          poseState: currentPose,
          distanceToPlayer: distToPlayer,
        };
      }

      // ============================================================================
      // 3. RULE C (Observed Inside 12m): Instant Freeze in State A
      // ============================================================================
      fpCamera.updateMatrixWorld();
      _projScreenMatrix.multiplyMatrices(
        fpCamera.projectionMatrix,
        fpCamera.matrixWorldInverse
      );
      _frustum.setFromProjectionMatrix(_projScreenMatrix);

      _angelMin.set(worldX - 0.72, 0.0, worldZ - 0.72);
      _angelMax.set(worldX + 0.72, 2.25, worldZ + 0.72);
      _angelBoundingBox.set(_angelMin, _angelMax);

      const inCameraFrustum = _frustum.intersectsBox(_angelBoundingBox);

      fpCamera.getWorldDirection(_camForward);
      _camForward2D.set(_camForward.x, _camForward.z);
      if (_camForward2D.lengthSq() > 1e-5) _camForward2D.normalize();

      _dirToAngel2D.set(worldX - playerX, worldZ - playerZ);
      const horizDist = _dirToAngel2D.length();
      if (horizDist > 1e-5) _dirToAngel2D.divideScalar(horizDist);

      const horizDot = _camForward2D.dot(_dirToAngel2D);
      const angelAngularRadius = Math.atan2(0.75, Math.max(horizDist, 0.25));
      const vFovHalfRad = THREE.MathUtils.degToRad(fpCamera.fov * 0.5);
      const hFovHalfRad = Math.atan(Math.tan(vFovHalfRad) * Math.max(fpCamera.aspect, 1.0));
      const maxLockAngle = hFovHalfRad + angelAngularRadius + 0.08;
      const inCameraDotCone =
        horizDist < 0.35 || horizDot >= Math.cos(Math.min(Math.PI * 0.85, maxLockAngle));

      let inFlashlightBeam = false;
      const flNormLen = flashlightWorldDir.length();
      if (flNormLen > 1e-5 && horizDist <= flashlightDistance) {
        const beamCosThreshold = Math.cos(
          Math.min(Math.PI * 0.85, flashlightAngle * 1.28 + angelAngularRadius)
        );
        for (let hIdx = 0; hIdx < SAMPLE_HEIGHTS.length; hIdx++) {
          _toAngelVec.set(
            worldX - fpCamera.position.x,
            SAMPLE_HEIGHTS[hIdx] - fpCamera.position.y,
            worldZ - fpCamera.position.z
          );
          const d3 = _toAngelVec.length();
          if (d3 < 0.35) {
            inFlashlightBeam = true;
            break;
          }
          _toAngelVec.divideScalar(d3);
          const beamDot = _toAngelVec.dot(flashlightWorldDir);
          if (beamDot >= beamCosThreshold) {
            inFlashlightBeam = true;
            break;
          }
        }
      }

      const isWithinPlayerGazeOrBeam =
        inCameraFrustum || inCameraDotCone || inFlashlightBeam;

      // Observed inside 12m = Instant Freeze (Quantum-Locked in State A)
      isQuantumLocked = isWithinPlayerGazeOrBeam && !isPlayerBlinking;

      if (isQuantumLocked) {
        activePursuitTarget = { x: playerX, z: playerZ };

        if (currentPose !== 'passive') {
          applyPoseState('passive');
        }
        return {
          isQuantumLocked: true,
          isSightLineThreatActive: false,
          poseState: currentPose,
          distanceToPlayer: distToPlayer,
        };
      }

      // ============================================================================
      // 4. RULE B (Inside 12m + Unobserved + Clear LoS):
      // Breaches quantum-lock, switches to State B, triggers parallel threat Track 2,
      // and aggressively pursues the player!
      // ============================================================================
      if (currentPose !== 'aggressive') {
        applyPoseState('aggressive');
      }

      activePursuitTarget = { x: playerX, z: playerZ };
      let dirX = activePursuitTarget.x - worldX;
      let dirZ = activePursuitTarget.z - worldZ;
      const dirLen = Math.hypot(dirX, dirZ);

      if (dirLen > 0.01) {
        dirX /= dirLen;
        dirZ /= dirLen;

        // Inter-angel separation force so multiple Angels never clip into each other
        for (let i = 0; i < otherAngels.length; i++) {
          const other = otherAngels[i];
          if (other.angelIndex === angelIndex) continue;
          const sepDx = worldX - other.worldX;
          const sepDz = worldZ - other.worldZ;
          const sepDist = Math.hypot(sepDx, sepDz);
          if (sepDist > 0.001 && sepDist < 1.05) {
            const push = ((1.05 - sepDist) / 1.05) * 0.85;
            dirX += (sepDx / sepDist) * push;
            dirZ += (sepDz / sepDist) * push;
          }
        }

        const combinedLen = Math.hypot(dirX, dirZ) || 1.0;
        const normX = dirX / combinedLen;
        const normZ = dirZ / combinedLen;

        const speedMultiplier = isPlayerBlinking ? 1.35 : 1.0;
        const stepDist = ANGEL_SPRINT_SPEED * speedMultiplier * dt;

        const nextX = worldX + normX * stepDist;
        const nextZ = worldZ + normZ * stepDist;

        const resolved = resolveMazeCollision(
          worldX,
          worldZ,
          nextX,
          nextZ,
          ANGEL_COLLISION_RADIUS,
          mazeData.wallCubes
        );

        const movedDist = Math.hypot(resolved.x - worldX, resolved.z - worldZ);
        worldX = resolved.x;
        worldZ = resolved.z;

        yaw = Math.atan2(playerX - worldX, playerZ - worldZ);
        group.position.set(worldX, 0, worldZ);
        group.rotation.set(0, yaw, 0);

        scrapeAccumulator += movedDist;
        if (scrapeAccumulator >= 1.85) {
          scrapeAccumulator = 0;
          const proxIntensity = Math.max(0.25, Math.min(1.5, 8.0 / Math.max(distToPlayer, 1.5)));
          onScrapeStep(proxIntensity);
        }
      }

      // 5. Jumpscare & Execution Trigger — Strictly guarded so it can NEVER fire while observed
      const newDist = Math.hypot(playerX - worldX, playerZ - worldZ);
      if (newDist <= JUMPSCARE_TRIGGER_DIST && !isQuantumLocked) {
        onJumpscareTrigger();
      }

      return {
        isQuantumLocked: false,
        isSightLineThreatActive: true,
        poseState: currentPose,
        distanceToPlayer: newDist,
      };
    },
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
    },
  };
}
