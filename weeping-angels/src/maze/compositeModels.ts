import * as THREE from 'three';
import { KeycardNode, WallCubeAABB, WallLandmarkDecal } from './mazeGenerator';
import { ProceduralMaterialLibrary } from './proceduralMaterials';

export interface ObjectiveBeaconRig {
  group: THREE.Group;
  coreSphere: THREE.Mesh;
  auraShell: THREE.Mesh;
  outerRing: THREE.Mesh;
  innerRing: THREE.Mesh;
  finialCap: THREE.Mesh;
  pointLight: THREE.PointLight;
  isUnlocked: boolean;
  setUnlocked: (unlocked: boolean) => void;
  update: (elapsedTime: number) => void;
  setNeonColor: (hexColor: string) => void;
  dispose: () => void;
}

export interface KeycardInstanceRig {
  node: KeycardNode;
  rootGroup: THREE.Group;
  floatingCardGroup: THREE.Group;
  haloRing: THREE.Mesh;
  hitProxyMesh: THREE.Mesh;
  pointLight: THREE.PointLight;
  collected: boolean;
}

export interface KeycardsManagerRig {
  group: THREE.Group;
  items: KeycardInstanceRig[];
  hitProxies: THREE.Object3D[];
  update: (elapsedTime: number) => void;
  collectKeycard: (id: string) => KeycardNode | null;
  dispose: () => void;
}

export interface FlashlightRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  spotLight: THREE.SpotLight;
  spotTarget: THREE.Object3D;
  volumetricCone: THREE.Mesh;
  emitterLensMat: THREE.MeshBasicMaterial;
  setBeamProfile: (profile: 'tactical' | 'overdrive' | 'amber') => void;
  dispose: () => void;
}

/**
 * Helper to prepare BufferGeometry for full PBR (Tangent-Space Normal Map + Ambient Occlusion UV2/UV1).
 */
export function prepareGeometryForFullPBR(geometry: THREE.BufferGeometry): void {
  if (geometry.attributes.uv) {
    geometry.setAttribute('uv1', geometry.attributes.uv);
    geometry.setAttribute('uv2', geometry.attributes.uv);
  }
  if (
    geometry.index &&
    geometry.attributes.position &&
    geometry.attributes.normal &&
    geometry.attributes.uv
  ) {
    geometry.computeTangents();
  }
}

/**
 * Builds the 7-part composite glowing, floating Security Keycard meshes placed at the
 * furthest dead-end nodes of the 10x10 maze, complete with raycaster hit proxies.
 */
export function createFloatingKeycardsGroup(
  keycardNodes: KeycardNode[],
  objectiveWorldPos: { x: number; z: number },
  materials: ProceduralMaterialLibrary,
  isSoftwareGl: boolean
): KeycardsManagerRig {
  const group = new THREE.Group();
  group.name = 'FloatingKeycardsGroup';

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];

  // Shared Geometries for Keycard Composite Parts
  const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
  shadowGeo.rotateX(-Math.PI / 2);
  geometriesToDispose.push(shadowGeo);

  const projectorBaseGeo = new THREE.CylinderGeometry(0.36, 0.44, 0.08, 6);
  projectorBaseGeo.translate(0, 0.04, 0);
  geometriesToDispose.push(projectorBaseGeo);

  const baseEmitterRingGeo = new THREE.TorusGeometry(0.3, 0.015, 10, 32);
  baseEmitterRingGeo.rotateX(Math.PI / 2);
  geometriesToDispose.push(baseEmitterRingGeo);

  // Chamfered Keycard Body Shape
  const cardW = 0.46;
  const cardH = 0.3;
  const chamfer = 0.045;
  const cardShape = new THREE.Shape();
  cardShape.moveTo(-cardW / 2 + chamfer, -cardH / 2);
  cardShape.lineTo(cardW / 2 - chamfer, -cardH / 2);
  cardShape.lineTo(cardW / 2, -cardH / 2 + chamfer);
  cardShape.lineTo(cardW / 2, cardH / 2 - chamfer);
  cardShape.lineTo(cardW / 2 - chamfer, cardH / 2);
  cardShape.lineTo(-cardW / 2 + chamfer, cardH / 2);
  cardShape.lineTo(-cardW / 2, cardH / 2 - chamfer);
  cardShape.lineTo(-cardW / 2, -cardH / 2 + chamfer);
  cardShape.closePath();

  const cardBodyGeo = new THREE.ExtrudeGeometry(cardShape, {
    depth: 0.022,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.008,
    bevelThickness: 0.008,
  });
  cardBodyGeo.translate(0, 0, -0.011);
  geometriesToDispose.push(cardBodyGeo);

  // Glowing Neon Security Strip across the card
  const neonStripGeo = new THREE.BoxGeometry(cardW * 0.84, 0.055, 0.032);
  geometriesToDispose.push(neonStripGeo);

  const neonTopBarGeo = new THREE.BoxGeometry(cardW * 0.55, 0.024, 0.032);
  geometriesToDispose.push(neonTopBarGeo);

  // Gold Smart-Chip Pad
  const chipGeo = new THREE.BoxGeometry(0.085, 0.07, 0.034);
  geometriesToDispose.push(chipGeo);

  // Orbiting Holographic Halo Ring
  const haloRingGeo = new THREE.TorusGeometry(0.36, 0.012, 12, 40);
  geometriesToDispose.push(haloRingGeo);

  // Invisible Raycast Hit Proxy Volume (generous bounds for instant mouse click pickup)
  const hitProxyGeo = new THREE.BoxGeometry(1.15, 1.35, 1.15);
  geometriesToDispose.push(hitProxyGeo);

  // Shared non-tinted materials
  const projectorBaseMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e293b'),
    roughness: 0.48,
    metalness: 0.82,
  });
  const cardChassisMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f172a'),
    roughness: 0.24,
    metalness: 0.86,
  });
  const goldChipMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fbbf24'),
    emissive: new THREE.Color('#d97706'),
    emissiveIntensity: 0.4,
    roughness: 0.18,
    metalness: 0.96,
  });
  const hitProxyMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  materialsToDispose.push(projectorBaseMat, cardChassisMat, goldChipMat, hitProxyMat);

  const items: KeycardInstanceRig[] = [];
  const hitProxies: THREE.Object3D[] = [];

  keycardNodes.forEach((node) => {
    const rootGroup = new THREE.Group();

    // If this keycard is in the same dead-end cell as the main Objective Beacon,
    // offset it slightly so both the Beacon and the Floating Keycard are clearly distinct and clickable
    const isAtMainBeacon =
      Math.hypot(node.worldX - objectiveWorldPos.x, node.worldZ - objectiveWorldPos.z) < 0.2;
    const posX = isAtMainBeacon ? node.worldX + 0.72 : node.worldX;
    const posZ = isAtMainBeacon ? node.worldZ + 0.72 : node.worldZ;

    rootGroup.position.set(posX, 0, posZ);

    const cardColor = new THREE.Color(node.color);
    const neonMat = new THREE.MeshStandardMaterial({
      color: cardColor,
      emissive: cardColor,
      emissiveIntensity: 3.4,
      roughness: 0.15,
      metalness: 0.1,
    });
    materialsToDispose.push(neonMat);

    // Part 1: Contact Shadow
    const shadowMesh = new THREE.Mesh(shadowGeo, materials.contactShadowMaterial);
    shadowMesh.position.y = 0.02;
    rootGroup.add(shadowMesh);

    // Part 2: Hexagonal Floor Projector Base
    const baseMesh = new THREE.Mesh(projectorBaseGeo, projectorBaseMat);
    baseMesh.receiveShadow = !isSoftwareGl;
    rootGroup.add(baseMesh);

    // Part 3: Glowing Base Emitter Ring
    const baseRingMesh = new THREE.Mesh(baseEmitterRingGeo, neonMat);
    baseRingMesh.position.y = 0.085;
    rootGroup.add(baseRingMesh);

    // Floating Card Sub-Group
    const floatingCardGroup = new THREE.Group();
    floatingCardGroup.position.set(0, 1.25, 0);
    // Slight ergonomic tilt so the keycard face is immediately readable
    floatingCardGroup.rotation.z = 0.18;
    rootGroup.add(floatingCardGroup);

    // Part 4: Chamfered Polycarbonate/Titanium Keycard Body
    const bodyMesh = new THREE.Mesh(cardBodyGeo, cardChassisMat);
    bodyMesh.castShadow = !isSoftwareGl;
    floatingCardGroup.add(bodyMesh);

    // Part 5: Glowing Neon Security Strip & Top Authorization Bar
    const stripMesh = new THREE.Mesh(neonStripGeo, neonMat);
    stripMesh.position.set(0, -0.055, 0);
    floatingCardGroup.add(stripMesh);

    const topBarMesh = new THREE.Mesh(neonTopBarGeo, neonMat);
    topBarMesh.position.set(0.05, 0.085, 0);
    floatingCardGroup.add(topBarMesh);

    // Part 6: Gold Smart-Chip Pad
    const chipMesh = new THREE.Mesh(chipGeo, goldChipMat);
    chipMesh.position.set(-0.12, 0.035, 0);
    floatingCardGroup.add(chipMesh);

    // Part 7: Orbiting Holographic Halo Ring
    const haloRing = new THREE.Mesh(haloRingGeo, neonMat);
    haloRing.position.set(0, 1.25, 0);
    rootGroup.add(haloRing);

    // Local PointLight so the floating keycard illuminates the dead-end walls
    const pointLight = new THREE.PointLight(cardColor, 5.5, 6.5, 1.8);
    pointLight.position.set(0, 1.25, 0);
    rootGroup.add(pointLight);

    // Invisible Raycast Hit Proxy
    const hitProxyMesh = new THREE.Mesh(hitProxyGeo, hitProxyMat);
    hitProxyMesh.position.set(0, 1.2, 0);
    hitProxyMesh.userData = {
      isKeycard: true,
      keycardId: node.id,
      keycardNode: node,
      worldX: posX,
      worldZ: posZ,
    };
    rootGroup.add(hitProxyMesh);
    hitProxies.push(hitProxyMesh);

    // Also tag visible card meshes so raycasting hits any sub-part seamlessly
    floatingCardGroup.traverse((child) => {
      child.userData = hitProxyMesh.userData;
    });

    group.add(rootGroup);

    items.push({
      node: {
        ...node,
        worldX: posX,
        worldZ: posZ,
      },
      rootGroup,
      floatingCardGroup,
      haloRing,
      hitProxyMesh,
      pointLight,
      collected: false,
    });
  });

  return {
    group,
    items,
    hitProxies,
    update: (elapsedTime: number) => {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.collected) continue;

        const phase = elapsedTime * 2.2 + i * 1.4;
        const bobY = 1.24 + Math.sin(phase) * 0.07;

        item.floatingCardGroup.position.y = bobY;
        item.floatingCardGroup.rotation.y = elapsedTime * 1.55 + i;

        item.haloRing.position.y = bobY;
        item.haloRing.rotation.x = Math.PI / 2 + Math.sin(phase * 0.8) * 0.35;
        item.haloRing.rotation.y = -elapsedTime * 1.1;

        item.pointLight.intensity = 5.2 + Math.sin(phase * 1.8) * 1.1;
      }
    },
    collectKeycard: (id: string) => {
      const found = items.find((it) => it.node.id === id && !it.collected);
      if (!found) return null;
      found.collected = true;
      found.rootGroup.visible = false;
      group.remove(found.rootGroup);
      const proxyIdx = hitProxies.indexOf(found.hitProxyMesh);
      if (proxyIdx !== -1) {
        hitProxies.splice(proxyIdx, 1);
      }
      return found.node;
    },
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
    },
  };
}

/**
 * Builds the 9-part composite Objective Beacon featuring the glowing neon sphere
 * at the furthest dead-end node. Pivoted at bottom-center (y = 0) flush with the floor.
 */
export function createObjectiveBeaconGroup(
  materials: ProceduralMaterialLibrary,
  isSoftwareGl: boolean
): ObjectiveBeaconRig {
  const group = new THREE.Group();
  group.name = 'ObjectiveBeaconGroup';

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];

  const neonColor = new THREE.Color('#a855f7');

  // Part 1: Soft Radial Contact Shadow Plane
  const shadowGeo = new THREE.PlaneGeometry(2.3, 2.3);
  shadowGeo.rotateX(-Math.PI / 2);
  geometriesToDispose.push(shadowGeo);
  const shadowMesh = new THREE.Mesh(shadowGeo, materials.contactShadowMaterial);
  shadowMesh.position.y = 0.02;
  group.add(shadowMesh);

  // Part 2: Primary Pedestal Base - Octagonal Heavy Anchor Plinth
  const plinthGeo = new THREE.CylinderGeometry(0.68, 0.82, 0.18, 8);
  plinthGeo.translate(0, 0.09, 0);
  geometriesToDispose.push(plinthGeo);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1a202c'),
    roughness: 0.68,
    metalness: 0.72,
  });
  materialsToDispose.push(plinthMat);
  const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
  plinthMesh.castShadow = !isSoftwareGl;
  plinthMesh.receiveShadow = !isSoftwareGl;
  group.add(plinthMesh);

  // Part 3: Secondary Lathe-Turned Tiered Emitter Collar
  const lathePoints = [
    new THREE.Vector2(0.0, 0.18),
    new THREE.Vector2(0.58, 0.18),
    new THREE.Vector2(0.52, 0.28),
    new THREE.Vector2(0.38, 0.34),
    new THREE.Vector2(0.42, 0.42),
    new THREE.Vector2(0.24, 0.48),
    new THREE.Vector2(0.0, 0.48),
  ];
  const collarGeo = new THREE.LatheGeometry(lathePoints, 24);
  geometriesToDispose.push(collarGeo);
  const collarMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2d3748'),
    roughness: 0.32,
    metalness: 0.9,
  });
  materialsToDispose.push(collarMat);
  const collarMesh = new THREE.Mesh(collarGeo, collarMat);
  collarMesh.castShadow = !isSoftwareGl;
  collarMesh.receiveShadow = !isSoftwareGl;
  group.add(collarMesh);

  // Part 4: Accent Base Emissive Flux Ring
  const baseRingGeo = new THREE.TorusGeometry(0.46, 0.022, 12, 32);
  baseRingGeo.rotateX(Math.PI / 2);
  geometriesToDispose.push(baseRingGeo);
  const emissiveAccentMat = new THREE.MeshStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 2.8,
    roughness: 0.2,
    metalness: 0.1,
  });
  materialsToDispose.push(emissiveAccentMat);
  const baseRingMesh = new THREE.Mesh(baseRingGeo, emissiveAccentMat);
  baseRingMesh.position.y = 0.35;
  group.add(baseRingMesh);

  // Part 5: 4 Extruded Beveled Containment Pylons framing the neon sphere
  const clawShape = new THREE.Shape();
  clawShape.moveTo(0, 0);
  clawShape.lineTo(0.11, 0);
  clawShape.lineTo(0.16, 0.55);
  clawShape.lineTo(0.08, 1.15);
  clawShape.lineTo(0.02, 1.08);
  clawShape.lineTo(0.06, 0.52);
  clawShape.closePath();

  const clawExtrudeGeo = new THREE.ExtrudeGeometry(clawShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelSegments: 2,
    steps: 1,
    bevelSize: 0.015,
    bevelThickness: 0.015,
  });
  clawExtrudeGeo.translate(0, 0, -0.03);
  geometriesToDispose.push(clawExtrudeGeo);

  const clawMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e2533'),
    roughness: 0.44,
    metalness: 0.84,
  });
  materialsToDispose.push(clawMat);

  for (let i = 0; i < 4; i++) {
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    const pylonPivot = new THREE.Group();
    pylonPivot.rotation.y = angle;
    const clawMesh = new THREE.Mesh(clawExtrudeGeo, clawMat);
    clawMesh.position.set(0.48, 0.28, 0);
    clawMesh.castShadow = !isSoftwareGl;
    pylonPivot.add(clawMesh);
    group.add(pylonPivot);
  }

  // Part 6: Primary Hero Silhouette — Glowing Neon Sphere Objective
  const sphereGeo = new THREE.SphereGeometry(0.42, 48, 48);
  geometriesToDispose.push(sphereGeo);
  const coreSphereMat = new THREE.MeshStandardMaterial({
    color: neonColor,
    emissive: neonColor,
    emissiveIntensity: 3.6,
    roughness: 0.12,
    metalness: 0.15,
  });
  materialsToDispose.push(coreSphereMat);
  const coreSphere = new THREE.Mesh(sphereGeo, coreSphereMat);
  coreSphere.position.set(0, 1.48, 0);
  group.add(coreSphere);

  // Part 7: Volumetric Neon Corona Shell around the sphere
  const auraGeo = new THREE.SphereGeometry(0.62, 32, 32);
  geometriesToDispose.push(auraGeo);
  const auraMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: neonColor.clone() },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        vNormal = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vViewPos;
      void main() {
        vec3 viewDir = normalize(vViewPos);
        float rim = 1.0 - max(dot(viewDir, vNormal), 0.0);
        float glow = pow(rim, 2.1) * (0.65 + 0.15 * sin(uTime * 3.5));
        gl_FragColor = vec4(uColor, glow * 0.65);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.FrontSide,
  });
  materialsToDispose.push(auraMat);
  const auraShell = new THREE.Mesh(auraGeo, auraMat);
  auraShell.position.copy(coreSphere.position);
  group.add(auraShell);

  // Part 8: Secondary Read — Outer Gyroscopic Containment Ring
  const outerRingGeo = new THREE.TorusGeometry(0.68, 0.026, 16, 64);
  geometriesToDispose.push(outerRingGeo);
  const ringMetalMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#94a3b8'),
    roughness: 0.22,
    metalness: 0.94,
  });
  materialsToDispose.push(ringMetalMat);
  const outerRing = new THREE.Mesh(outerRingGeo, ringMetalMat);
  outerRing.position.copy(coreSphere.position);
  group.add(outerRing);

  // Part 9: Inner Orthogonal Flux Ring + Upper Resonator Finial Cap
  const innerRingGeo = new THREE.TorusGeometry(0.56, 0.018, 14, 48);
  geometriesToDispose.push(innerRingGeo);
  const innerRingMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#475569'),
    emissive: neonColor,
    emissiveIntensity: 0.45,
    roughness: 0.54,
    metalness: 0.78,
  });
  materialsToDispose.push(innerRingMat);
  const innerRing = new THREE.Mesh(innerRingGeo, innerRingMat);
  innerRing.position.copy(coreSphere.position);
  group.add(innerRing);

  const capPoints = [
    new THREE.Vector2(0.0, 0.18),
    new THREE.Vector2(0.18, 0.0),
    new THREE.Vector2(0.11, -0.05),
    new THREE.Vector2(0.0, -0.05),
  ];
  const finialGeo = new THREE.LatheGeometry(capPoints, 16);
  geometriesToDispose.push(finialGeo);
  const finialCap = new THREE.Mesh(finialGeo, collarMat);
  finialCap.position.set(0, 2.32, 0);
  group.add(finialCap);

  // Part 10: Volumetric Vertical Extraction Beam Pillar & Floor Portal Boundary Ring (Active when Unlocked)
  const pillarGeo = new THREE.CylinderGeometry(0.32, 0.58, 7.5, 28, 1, true);
  pillarGeo.translate(0, 3.75, 0);
  geometriesToDispose.push(pillarGeo);
  const pillarMat = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: neonColor.clone() },
      uTime: { value: 0 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      varying vec2 vUv;
      void main() {
        float verticalFade = pow(1.0 - vUv.y, 1.45);
        float scan = 0.65 + 0.35 * sin(vUv.y * 28.0 - uTime * 7.5);
        float pulse = 0.72 + 0.28 * sin(uTime * 4.8);
        float alpha = verticalFade * scan * pulse * 0.42;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
  materialsToDispose.push(pillarMat);
  const beaconPillarMesh = new THREE.Mesh(pillarGeo, pillarMat);
  beaconPillarMesh.visible = false;
  group.add(beaconPillarMesh);

  const floorRingGeo = new THREE.RingGeometry(0.84, 1.15, 48);
  floorRingGeo.rotateX(-Math.PI / 2);
  geometriesToDispose.push(floorRingGeo);
  const floorRingMesh = new THREE.Mesh(floorRingGeo, emissiveAccentMat);
  floorRingMesh.position.y = 0.025;
  floorRingMesh.visible = false;
  group.add(floorRingMesh);

  const pointLight = new THREE.PointLight(neonColor, 1.4, 6.0, 1.6);
  pointLight.position.set(0, 1.48, 0);
  group.add(pointLight);

  const beaconTopLight = new THREE.PointLight(neonColor, 0.0, 22.0, 1.4);
  beaconTopLight.position.set(0, 3.4, 0);
  group.add(beaconTopLight);

  let isUnlocked = false;
  coreSphere.visible = false;
  auraShell.visible = false;
  emissiveAccentMat.emissiveIntensity = 0.45;
  innerRingMat.emissiveIntensity = 0.15;

  const setUnlocked = (unlocked: boolean) => {
    isUnlocked = unlocked;
    coreSphere.visible = unlocked;
    auraShell.visible = unlocked;
    beaconPillarMesh.visible = unlocked;
    floorRingMesh.visible = unlocked;
    emissiveAccentMat.emissiveIntensity = unlocked ? 3.8 : 0.45;
    innerRingMat.emissiveIntensity = unlocked ? 1.1 : 0.15;
    pointLight.distance = unlocked ? 18.0 : 5.5;
    pointLight.intensity = unlocked ? 14.0 : 1.4;
    beaconTopLight.intensity = unlocked ? 8.5 : 0.0;
  };

  return {
    group,
    coreSphere,
    auraShell,
    outerRing,
    innerRing,
    finialCap,
    pointLight,
    get isUnlocked() {
      return isUnlocked;
    },
    setUnlocked,
    update: (elapsedTime: number) => {
      const speedMult = isUnlocked ? 1.0 : 0.25;
      const bobOffset = Math.sin(elapsedTime * 2.4 * speedMult) * (isUnlocked ? 0.075 : 0.02);
      coreSphere.position.y = 1.48 + bobOffset;
      auraShell.position.y = 1.48 + bobOffset;
      outerRing.position.y = 1.48 + bobOffset * 0.5;
      innerRing.position.y = 1.48 + bobOffset * 0.5;
      finialCap.position.y = 2.34 + bobOffset * 1.15;

      outerRing.rotation.x = elapsedTime * 0.85 * speedMult;
      outerRing.rotation.y = elapsedTime * 0.55 * speedMult;
      innerRing.rotation.y = -elapsedTime * 1.25 * speedMult;
      innerRing.rotation.z = elapsedTime * 0.75 * speedMult;
      finialCap.rotation.y = elapsedTime * 0.9 * speedMult;

      (auraShell.material as THREE.ShaderMaterial).uniforms.uTime.value = elapsedTime;
      pillarMat.uniforms.uTime.value = elapsedTime;

      if (isUnlocked) {
        const pulse = Math.sin(elapsedTime * 4.8);
        pointLight.intensity = 13.5 + pulse * 3.8;
        beaconTopLight.intensity = 8.5 + pulse * 3.2;
        const ringScale = 1.0 + 0.08 * Math.sin(elapsedTime * 3.6);
        floorRingMesh.scale.set(ringScale, ringScale, 1);
      } else {
        pointLight.intensity = 1.2 + Math.sin(elapsedTime * 1.8) * 0.35;
        beaconTopLight.intensity = 0.0;
      }
    },
    setNeonColor: (hexColor: string) => {
      const c = new THREE.Color(hexColor);
      coreSphereMat.color.copy(c);
      coreSphereMat.emissive.copy(c);
      emissiveAccentMat.color.copy(c);
      emissiveAccentMat.emissive.copy(c);
      innerRingMat.emissive.copy(c);
      pointLight.color.copy(c);
      beaconTopLight.color.copy(c);
      (auraShell.material as THREE.ShaderMaterial).uniforms.uColor.value.copy(c);
      pillarMat.uniforms.uColor.value.copy(c);
    },
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
    },
  };
}

/**
 * Builds the camera-attached Volumetric SpotLight Flashlight Rig with 2048x2048
 * PCFSoftShadowMap shadow resolution and a volumetric light cone.
 */
export function createFlashlightRig(
  materials: ProceduralMaterialLibrary,
  isSoftwareGl: boolean
): FlashlightRig {
  const root = new THREE.Group();
  root.name = 'FlashlightCameraRig';

  const geometriesToDispose: THREE.BufferGeometry[] = [];
  const materialsToDispose: THREE.Material[] = [];

  const bodyGroup = new THREE.Group();
  bodyGroup.position.set(0.32, -0.26, -0.42);
  root.add(bodyGroup);

  // Part 1: Main Anodized Barrel Tube
  const barrelGeo = new THREE.CylinderGeometry(0.036, 0.038, 0.26, 20);
  barrelGeo.rotateX(Math.PI / 2);
  geometriesToDispose.push(barrelGeo);
  const barrelMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1e2430'),
    roughness: 0.42,
    metalness: 0.86,
  });
  materialsToDispose.push(barrelMat);
  const barrelMesh = new THREE.Mesh(barrelGeo, barrelMat);
  bodyGroup.add(barrelMesh);

  // Part 2: Textured Knurled Grip Sleeve
  const gripGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.12, 16);
  gripGeo.rotateX(Math.PI / 2);
  geometriesToDispose.push(gripGeo);
  const gripMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#0f131a'),
    roughness: 0.78,
    metalness: 0.52,
  });
  materialsToDispose.push(gripMat);
  const gripMesh = new THREE.Mesh(gripGeo, gripMat);
  gripMesh.position.z = 0.03;
  bodyGroup.add(gripMesh);

  // Part 3: Heatsink Cooling Fins
  const finGeo = new THREE.CylinderGeometry(0.046, 0.046, 0.012, 20);
  finGeo.rotateX(Math.PI / 2);
  geometriesToDispose.push(finGeo);
  const finMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#475569'),
    roughness: 0.25,
    metalness: 0.92,
  });
  materialsToDispose.push(finMat);
  for (let i = 0; i < 3; i++) {
    const fin = new THREE.Mesh(finGeo, finMat);
    fin.position.z = -0.07 - i * 0.022;
    bodyGroup.add(fin);
  }

  // Part 4: Flared Strike Bezel Head
  const bezelGeo = new THREE.CylinderGeometry(0.056, 0.044, 0.07, 24);
  bezelGeo.rotateX(Math.PI / 2);
  geometriesToDispose.push(bezelGeo);
  const bezelMesh = new THREE.Mesh(bezelGeo, barrelMat);
  bezelMesh.position.z = -0.155;
  bodyGroup.add(bezelMesh);

  // Part 5: Optical Emitter Lens
  const lensGeo = new THREE.CircleGeometry(0.048, 24);
  geometriesToDispose.push(lensGeo);
  const emitterLensMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#f0f9ff'),
  });
  materialsToDispose.push(emitterLensMat);
  const lensMesh = new THREE.Mesh(lensGeo, emitterLensMat);
  lensMesh.position.z = -0.191;
  lensMesh.rotation.y = Math.PI;
  bodyGroup.add(lensMesh);

  // Part 6: Volumetric Light Cone Mesh
  const coneLength = 14.0;
  const coneRadius = Math.tan(Math.PI / 7.5) * coneLength;
  const coneGeo = new THREE.ConeGeometry(coneRadius, coneLength, 40, 24, true);
  coneGeo.translate(0, -coneLength / 2, 0);
  coneGeo.rotateX(Math.PI / 2);
  geometriesToDispose.push(coneGeo);

  const volumetricCone = new THREE.Mesh(coneGeo, materials.volumetricConeMaterial);
  volumetricCone.position.set(0, 0, -0.19);
  volumetricCone.renderOrder = 10;
  bodyGroup.add(volumetricCone);

  // Upgraded Mouse-Tracked SpotLight with 2048x2048 PCFSoftShadowMap
  const spotLight = new THREE.SpotLight(0xeef6ff, 52.0, 24.0, Math.PI / 5.2, 0.62, 1.5);
  spotLight.position.set(0.18, -0.14, -0.2);

  if (!isSoftwareGl) {
    spotLight.castShadow = true;
    spotLight.shadow.mapSize.width = 2048;
    spotLight.shadow.mapSize.height = 2048;
    spotLight.shadow.camera.near = 0.22;
    spotLight.shadow.camera.far = 22.0;
    spotLight.shadow.camera.fov = 36;
    spotLight.shadow.radius = 3.5;
    spotLight.shadow.bias = -0.0003;
    spotLight.shadow.normalBias = 0.018;
    spotLight.shadow.focus = 1.0;
  }

  const spotTarget = new THREE.Object3D();
  spotTarget.position.set(0, 0, -8);
  root.add(spotLight);
  root.add(spotTarget);
  spotLight.target = spotTarget;

  const bounceLight = new THREE.PointLight(0x93c5fd, 1.35, 4.2, 2.0);
  bounceLight.position.set(0, 0, -0.25);
  root.add(bounceLight);

  return {
    root,
    bodyGroup,
    spotLight,
    spotTarget,
    volumetricCone,
    emitterLensMat,
    setBeamProfile: (profile) => {
      if (profile === 'tactical') {
        spotLight.color.set('#eef6ff');
        spotLight.intensity = 52.0;
        spotLight.angle = Math.PI / 5.2;
        materials.volumetricConeMaterial.uniforms.uColor.value.set('#dbeafe');
        materials.volumetricConeMaterial.uniforms.uOpacity.value = 0.22;
        emitterLensMat.color.set('#f0f9ff');
      } else if (profile === 'overdrive') {
        spotLight.color.set('#ffffff');
        spotLight.intensity = 84.0;
        spotLight.angle = Math.PI / 4.5;
        materials.volumetricConeMaterial.uniforms.uColor.value.set('#e0f2fe');
        materials.volumetricConeMaterial.uniforms.uOpacity.value = 0.32;
        emitterLensMat.color.set('#ffffff');
      } else {
        spotLight.color.set('#fde68a');
        spotLight.intensity = 58.0;
        spotLight.angle = Math.PI / 5.5;
        materials.volumetricConeMaterial.uniforms.uColor.value.set('#fcd34d');
        materials.volumetricConeMaterial.uniforms.uOpacity.value = 0.25;
        emitterLensMat.color.set('#fef3c7');
      }
    },
    dispose: () => {
      geometriesToDispose.forEach((g) => g.dispose());
      materialsToDispose.forEach((m) => m.dispose());
    },
  };
}

/**
 * Extrudes the 3D cubes for the walls of the 10x10 maze using InstancedMesh with full PBR
 * UV2 + tangent attributes, and spawns PlaneGeometry environmental landmark decals on
 * exactly 15% of the wall meshes.
 */
export function createMazeWallInstancedMeshes(
  wallCubes: WallCubeAABB[],
  landmarks: WallLandmarkDecal[],
  tileSize: number,
  wallHeight: number,
  materials: ProceduralMaterialLibrary,
  isSoftwareGl: boolean
): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();
  group.name = 'ExtrudedMazeWallsGroup';

  const count = wallCubes.length;
  const plinthHeight = 0.24;
  const capHeight = 0.18;
  const bodyHeight = wallHeight - plinthHeight - capHeight;

  const bodyGeo = new THREE.BoxGeometry(tileSize, bodyHeight, tileSize);
  prepareGeometryForFullPBR(bodyGeo);
  const bodyInstanced = new THREE.InstancedMesh(bodyGeo, materials.wallMainMaterial, count);
  bodyInstanced.castShadow = !isSoftwareGl;
  bodyInstanced.receiveShadow = !isSoftwareGl;

  const plinthGeo = new THREE.BoxGeometry(tileSize * 1.02, plinthHeight, tileSize * 1.02);
  prepareGeometryForFullPBR(plinthGeo);
  const plinthInstanced = new THREE.InstancedMesh(plinthGeo, materials.wallPlinthMaterial, count);
  plinthInstanced.receiveShadow = !isSoftwareGl;

  const capGeo = new THREE.BoxGeometry(tileSize * 0.96, capHeight, tileSize * 0.96);
  prepareGeometryForFullPBR(capGeo);
  const capInstanced = new THREE.InstancedMesh(capGeo, materials.wallCapMaterial, count);
  capInstanced.receiveShadow = !isSoftwareGl;

  const dummyMatrix = new THREE.Matrix4();
  const tempColor = new THREE.Color();

  for (let i = 0; i < count; i++) {
    const w = wallCubes[i];

    dummyMatrix.makeTranslation(w.worldX, plinthHeight + bodyHeight / 2, w.worldZ);
    bodyInstanced.setMatrixAt(i, dummyMatrix);

    dummyMatrix.makeTranslation(w.worldX, plinthHeight / 2, w.worldZ);
    plinthInstanced.setMatrixAt(i, dummyMatrix);

    dummyMatrix.makeTranslation(w.worldX, plinthHeight + bodyHeight + capHeight / 2, w.worldZ);
    capInstanced.setMatrixAt(i, dummyMatrix);

    const hash = ((w.gridX * 73856093) ^ (w.gridZ * 19349663)) & 0xff;
    const shade = 0.92 + (hash / 255) * 0.16;
    tempColor.setRGB(shade, shade, shade * 1.03);
    bodyInstanced.setColorAt(i, tempColor);
  }

  bodyInstanced.instanceMatrix.needsUpdate = true;
  if (bodyInstanced.instanceColor) bodyInstanced.instanceColor.needsUpdate = true;
  plinthInstanced.instanceMatrix.needsUpdate = true;
  capInstanced.instanceMatrix.needsUpdate = true;

  bodyInstanced.computeBoundingSphere();
  plinthInstanced.computeBoundingSphere();
  capInstanced.computeBoundingSphere();

  group.add(bodyInstanced);
  group.add(plinthInstanced);
  group.add(capInstanced);

  // Spawn PlaneGeometry Environmental Landmark Decals on exactly 15% of the wall meshes
  const decalPlaneGeo = new THREE.PlaneGeometry(tileSize * 0.84, tileSize * 0.84);
  prepareGeometryForFullPBR(decalPlaneGeo);

  const scratchesList = landmarks.filter((l) => l.type === 'scratches');
  const pipesList = landmarks.filter((l) => l.type === 'pipes');
  const graffitiList = landmarks.filter((l) => l.type === 'graffiti');

  const dummyObj = new THREE.Object3D();
  const decalTint = new THREE.Color();

  const buildDecalInstanced = (
    list: WallLandmarkDecal[],
    mat: THREE.MeshStandardMaterial
  ): THREE.InstancedMesh | null => {
    if (list.length === 0) return null;
    const inst = new THREE.InstancedMesh(decalPlaneGeo, mat, list.length);
    inst.receiveShadow = !isSoftwareGl;
    list.forEach((item, idx) => {
      const h1 = ((item.gridX * 92837111) ^ (item.gridZ * 68928749) ^ (idx * 31337)) & 0xff;
      const h2 = ((item.gridZ * 47288202) ^ (item.gridX * 19349663) ^ (idx * 7919)) & 0xff;
      const norm1 = h1 / 255.0;
      const norm2 = h2 / 255.0;

      const scaleX = 0.78 + norm1 * 0.44;
      const scaleY = 0.82 + norm2 * 0.42;
      const rollZ = (norm1 - 0.5) * 0.52;

      dummyObj.position.set(item.worldX, item.worldY, item.worldZ);
      dummyObj.rotation.set(0, item.rotationY, rollZ);
      dummyObj.scale.set(scaleX, scaleY, 1.0);
      dummyObj.updateMatrix();
      inst.setMatrixAt(idx, dummyObj.matrix);

      const shade = 0.75 + norm2 * 0.45;
      decalTint.setRGB(shade * 1.1, shade * 0.85, shade * 0.85);
      inst.setColorAt(idx, decalTint);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (inst.instanceColor) inst.instanceColor.needsUpdate = true;
    inst.computeBoundingSphere();
    return inst;
  };

  const scratchesMesh = buildDecalInstanced(scratchesList, materials.scratchesDecalMaterial);
  const pipesMesh = buildDecalInstanced(pipesList, materials.pipesDecalMaterial);
  const graffitiMesh = buildDecalInstanced(graffitiList, materials.graffitiDecalMaterial);

  if (scratchesMesh) group.add(scratchesMesh);
  if (pipesMesh) group.add(pipesMesh);
  if (graffitiMesh) group.add(graffitiMesh);

  return {
    group,
    dispose: () => {
      bodyGeo.dispose();
      plinthGeo.dispose();
      capGeo.dispose();
      decalPlaneGeo.dispose();
    },
  };
}
