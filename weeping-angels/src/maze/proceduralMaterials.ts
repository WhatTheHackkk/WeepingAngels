import * as THREE from 'three';

export interface ProceduralMaterialLibrary {
  wallMainMaterial: THREE.MeshStandardMaterial;
  wallPlinthMaterial: THREE.MeshStandardMaterial;
  wallCapMaterial: THREE.MeshStandardMaterial;
  floorMaterial: THREE.MeshStandardMaterial;
  angelStoneMaterial: THREE.MeshStandardMaterial;
  angelMossStoneMaterial: THREE.MeshStandardMaterial;
  angelFaceMaterial: THREE.MeshStandardMaterial;
  angelBloodStainMaterial: THREE.MeshStandardMaterial;
  angelFangMaterial: THREE.MeshStandardMaterial;
  angelSocketMaterial: THREE.MeshBasicMaterial;
  scratchesDecalMaterial: THREE.MeshStandardMaterial;
  pipesDecalMaterial: THREE.MeshStandardMaterial;
  graffitiDecalMaterial: THREE.MeshStandardMaterial;
  contactShadowMaterial: THREE.MeshBasicMaterial;
  volumetricConeMaterial: THREE.ShaderMaterial;
  dispose: () => void;
}

/**
 * Converts a grayscale heightfield Uint8Array (size x size) into a seamless
 * Tangent-Space RGB Normal Map DataTexture using wrap-around Sobel derivatives.
 */
function heightfieldToNormalTexture(
  heightData: Uint8Array,
  size: number,
  strength: number,
  maxAnisotropy: number,
  repeatX: number = 1,
  repeatY: number = 1,
  clampEdge: boolean = false
): THREE.DataTexture {
  const normalBytes = new Uint8Array(size * size * 4);
  const mask = size - 1;

  const sampleH = (x: number, y: number): number => {
    const wx = clampEdge ? Math.max(0, Math.min(mask, x)) : x & mask;
    const wy = clampEdge ? Math.max(0, Math.min(mask, y)) : y & mask;
    return heightData[wy * size + wx] / 255.0;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tl = sampleH(x - 1, y - 1);
      const t = sampleH(x, y - 1);
      const tr = sampleH(x + 1, y - 1);
      const l = sampleH(x - 1, y);
      const r = sampleH(x + 1, y);
      const bl = sampleH(x - 1, y + 1);
      const b = sampleH(x, y + 1);
      const br = sampleH(x + 1, y + 1);

      const dX = (tr + 2.0 * r + br - (tl + 2.0 * l + bl)) * strength;
      const dY = (bl + 2.0 * b + br - (tl + 2.0 * t + tr)) * strength;
      const dZ = 1.0;

      const invLen = 1.0 / Math.sqrt(dX * dX + dY * dY + dZ * dZ);
      const nx = -dX * invLen;
      const ny = dY * invLen;
      const nz = dZ * invLen;

      const idx = (y * size + x) * 4;
      normalBytes[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      normalBytes[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      normalBytes[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      normalBytes[idx + 3] = 255;
    }
  }

  const normalTex = new THREE.DataTexture(normalBytes, size, size, THREE.RGBAFormat);
  normalTex.colorSpace = THREE.NoColorSpace;
  normalTex.wrapS = clampEdge ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  normalTex.wrapT = clampEdge ? THREE.ClampToEdgeWrapping : THREE.RepeatWrapping;
  normalTex.repeat.set(repeatX, repeatY);
  normalTex.generateMipmaps = true;
  normalTex.minFilter = THREE.LinearMipmapLinearFilter;
  normalTex.magFilter = THREE.LinearFilter;
  normalTex.anisotropy = maxAnisotropy;
  normalTex.needsUpdate = true;
  return normalTex;
}

/**
 * Shared deterministic multi-octave FBM noise sampler for procedural PBR synthesis.
 */
function createNoiseSampler(size: number, initialSeed: number) {
  const mask = size - 1;
  const grid = new Float32Array(size * size);
  let seed = initialSeed;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < grid.length; i++) {
    grid[i] = rand();
  }

  const sampleSmooth = (fx: number, fy: number, period: number): number => {
    const pMask = period - 1;
    const x0 = Math.floor(fx) & pMask;
    const y0 = Math.floor(fy) & pMask;
    const x1 = (x0 + 1) & pMask;
    const y1 = (y0 + 1) & pMask;
    const tx = fx - Math.floor(fx);
    const ty = fy - Math.floor(fy);
    const sx = tx * tx * (3 - 2 * tx);
    const sy = ty * ty * (3 - 2 * ty);

    const i00 = ((y0 * 29) & mask) * size + ((x0 * 43) & mask);
    const i10 = ((y0 * 29) & mask) * size + ((x1 * 43) & mask);
    const i01 = ((y1 * 29) & mask) * size + ((x0 * 43) & mask);
    const i11 = ((y1 * 29) & mask) * size + ((x1 * 43) & mask);

    const nx0 = grid[i00] + sx * (grid[i10] - grid[i00]);
    const nx1 = grid[i01] + sx * (grid[i11] - grid[i01]);
    return nx0 + sy * (nx1 - nx0);
  };

  const fbm = (u: number, v: number, baseFreq: number = 8): number => {
    const n1 = sampleSmooth(u * baseFreq, v * baseFreq, baseFreq);
    const n2 = sampleSmooth(u * baseFreq * 2, v * baseFreq * 2, baseFreq * 2) * 0.5;
    const n3 = sampleSmooth(u * baseFreq * 4, v * baseFreq * 4, baseFreq * 4) * 0.25;
    const n4 = sampleSmooth(u * baseFreq * 8, v * baseFreq * 8, baseFreq * 8) * 0.125;
    return (n1 + n2 + n3 + n4) / 1.875;
  };

  return { grid, rand, sampleSmooth, fbm };
}

/**
 * Generates an ultra-high-detail (512x512 seamless) Cracked Grey-Brown Granite & Porous Stone PBR
 * texture suite strictly matching the uploaded 3D Character Sheet.
 */
function createWeatheredAngelStonePBRMaps(maxAnisotropy: number): {
  stoneAlbedo: THREE.DataTexture;
  stoneNormal: THREE.DataTexture;
  stoneRoughness: THREE.DataTexture;
  stoneAO: THREE.DataTexture;
} {
  const size = 512;
  const albedoBytes = new Uint8Array(size * size * 4);
  const heightBytes = new Uint8Array(size * size);
  const roughnessBytes = new Uint8Array(size * size * 4);
  const aoBytes = new Uint8Array(size * size * 4);

  const { grid: noiseGrid, sampleSmooth } = createNoiseSampler(size, 77319);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;

      const n1 = sampleSmooth(u * 8, v * 8, 8);
      const n2 = sampleSmooth(u * 16, v * 16, 16) * 0.5;
      const n3 = sampleSmooth(u * 32, v * 32, 32) * 0.25;
      const n4 = sampleSmooth(u * 64, v * 64, 64) * 0.125;
      const grain = noiseGrid[y * size + x];
      const fbm = (n1 + n2 + n3 + n4) / 1.875;

      const crackSignal1 = Math.abs(sampleSmooth(u * 16 + n1 * 2.1, v * 16 + n2 * 2.1, 16) - 0.5);
      const crackSignal2 = Math.abs(sampleSmooth(u * 32 - n2 * 1.7, v * 32 + n1 * 1.7, 32) - 0.5);
      const crackSignal3 = Math.abs(sampleSmooth(u * 64 + n3 * 1.2, v * 64 - n2 * 1.2, 64) - 0.5);
      const crack1 = crackSignal1 < 0.038 ? (0.038 - crackSignal1) / 0.038 : 0;
      const crack2 = crackSignal2 < 0.028 ? ((0.028 - crackSignal2) / 0.028) * 0.78 : 0;
      const crack3 = crackSignal3 < 0.022 ? ((0.022 - crackSignal3) / 0.022) * 0.52 : 0;
      const porousPit = grain < 0.08 ? (0.08 - grain) * 10.5 : 0;
      const crackDepth = Math.min(1.0, crack1 + crack2 + crack3 + porousPit * 0.55);

      const weepColumn = sampleSmooth(u * 48 + (n2 - 0.5) * 0.7, v * 4, 48);
      const weepFlow = sampleSmooth(u * 24, v * 8, 24);
      const verticalWeep = Math.max(0, (weepColumn - 0.5) * 2.3) * (0.45 + 0.55 * weepFlow);

      const mossMask =
        Math.max(0, (0.5 - fbm) * 2.7) * (0.42 + 0.58 * sampleSmooth(u * 16, v * 8, 16));
      const mossIntensity = Math.min(1.0, mossMask * 1.32);

      const sootSignal = sampleSmooth(u * 32 - n1 * 0.5, v * 4, 32);
      const darkWeepStain =
        sootSignal > 0.58
          ? Math.min(1.0, ((sootSignal - 0.58) / 0.42) * (0.6 + verticalWeep * 0.95))
          : 0;

      const h = Math.max(
        0,
        Math.min(
          1,
          0.68 +
            (fbm - 0.5) * 0.4 +
            (grain - 0.5) * 0.24 -
            crackDepth * 0.78 -
            verticalWeep * 0.24 +
            mossIntensity * 0.07
        )
      );
      heightBytes[y * size + x] = Math.round(h * 255);

      const ao = Math.max(
        0.08,
        Math.min(
          1.0,
          0.92 -
            crackDepth * 0.78 -
            verticalWeep * 0.36 -
            mossIntensity * 0.28 -
            darkWeepStain * 0.38 -
            (1 - grain) * 0.12
        )
      );
      const aoByte = Math.round(ao * 255);

      const rough = Math.max(
        0.42,
        Math.min(
          0.99,
          0.82 +
            crackDepth * 0.16 +
            mossIntensity * 0.16 -
            darkWeepStain * 0.25 -
            (h - 0.5) * 0.1
        )
      );
      const roughByte = Math.round(rough * 255);

      const baseStone = 84 + h * 72 - crackDepth * 62 - verticalWeep * 32;
      let r = baseStone * 1.04;
      let g = baseStone * 0.98;
      let b = baseStone * 0.89;

      if (mossIntensity > 0.01) {
        const mR = 46 + grain * 18;
        const mG = 54 + grain * 22;
        const mB = 30 + grain * 12;
        r = r * (1 - mossIntensity * 0.74) + mR * (mossIntensity * 0.74);
        g = g * (1 - mossIntensity * 0.7) + mG * (mossIntensity * 0.7);
        b = b * (1 - mossIntensity * 0.78) + mB * (mossIntensity * 0.78);
      }

      if (darkWeepStain > 0.01) {
        const dR = 24 + grain * 14;
        const dG = 16 + grain * 10;
        const dB = 14 + grain * 9;
        r = r * (1 - darkWeepStain * 0.82) + dR * (darkWeepStain * 0.82);
        g = g * (1 - darkWeepStain * 0.86) + dG * (darkWeepStain * 0.86);
        b = b * (1 - darkWeepStain * 0.86) + dB * (darkWeepStain * 0.86);
      }

      const idx4 = (y * size + x) * 4;
      albedoBytes[idx4] = Math.max(8, Math.min(255, Math.round(r)));
      albedoBytes[idx4 + 1] = Math.max(8, Math.min(255, Math.round(g)));
      albedoBytes[idx4 + 2] = Math.max(8, Math.min(255, Math.round(b)));
      albedoBytes[idx4 + 3] = 255;

      roughnessBytes[idx4] = roughByte;
      roughnessBytes[idx4 + 1] = roughByte;
      roughnessBytes[idx4 + 2] = roughByte;
      roughnessBytes[idx4 + 3] = 255;

      aoBytes[idx4] = aoByte;
      aoBytes[idx4 + 1] = aoByte;
      aoBytes[idx4 + 2] = aoByte;
      aoBytes[idx4 + 3] = 255;
    }
  }

  const buildTex = (data: Uint8Array, cs: THREE.ColorSpace) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.colorSpace = cs;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  };

  const stoneAlbedo = buildTex(albedoBytes, THREE.SRGBColorSpace);
  const stoneRoughness = buildTex(roughnessBytes, THREE.NoColorSpace);
  const stoneAO = buildTex(aoBytes, THREE.NoColorSpace);
  const stoneNormal = heightfieldToNormalTexture(heightBytes, size, 4.5, maxAnisotropy, 2, 2);

  return { stoneAlbedo, stoneNormal, stoneRoughness, stoneAO };
}

/**
 * Generates a dedicated high-resolution (512x512) Face PBR Albedo Texture for the Weeping Angel
 * matching the "FACE CLOSEUP" panel in the uploaded Character Sheet (using per-pixel FBM tear channels).
 */
function createAngelFaceWeepingTexture(
  maxAnisotropy: number,
  disposables: THREE.Texture[]
): THREE.DataTexture {
  const size = 512;
  const bytes = new Uint8Array(size * size * 4);
  const { grid, sampleSmooth, fbm } = createNoiseSampler(size, 31987);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const grain = grid[y * size + x];
      const baseFbm = fbm(u, v, 8);
      const fineFbm = fbm(u * 2, v * 2, 16);

      // Cracked grey-brown stone skin base
      const crackSig = Math.abs(sampleSmooth(u * 24 + baseFbm * 1.6, v * 24 - fineFbm * 1.6, 24) - 0.5);
      const crack = crackSig < 0.026 ? (0.026 - crackSig) / 0.026 : 0;
      const pore = grain < 0.07 ? (0.07 - grain) * 8.0 : 0;

      // Dark stone-weeping tear channels streaming below eye level (v > 0.42)
      const warpU = u + (fineFbm - 0.5) * 0.028;
      const streakPattern = sampleSmooth(warpU * 64, v * 4, 64);
      const eyeBandMask = v > 0.41 && v < 0.86 ? Math.sin(((v - 0.41) / 0.45) * Math.PI) : 0;
      const tearIntensity =
        streakPattern > 0.54
          ? Math.min(1.0, ((streakPattern - 0.54) / 0.46) * eyeBandMask * 1.55)
          : 0;

      const lum = 112 + (baseFbm - 0.5) * 42 + (grain - 0.5) * 18 - crack * 55 - pore * 28;
      let r = lum * 1.04;
      let g = lum * 0.98;
      let b = lum * 0.89;

      if (tearIntensity > 0.01) {
        r = r * (1 - tearIntensity * 0.84) + 18 * (tearIntensity * 0.84);
        g = g * (1 - tearIntensity * 0.88) + 12 * (tearIntensity * 0.88);
        b = b * (1 - tearIntensity * 0.88) + 11 * (tearIntensity * 0.88);
      }

      const idx = (y * size + x) * 4;
      bytes[idx] = Math.max(8, Math.min(255, Math.round(r)));
      bytes[idx + 1] = Math.max(8, Math.min(255, Math.round(g)));
      bytes[idx + 2] = Math.max(8, Math.min(255, Math.round(b)));
      bytes[idx + 3] = 255;
    }
  }

  const tex = new THREE.DataTexture(bytes, size, size, THREE.RGBAFormat);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  disposables.push(tex);
  return tex;
}

/**
 * Generates a high-resolution (512x512 seamless) full PBR texture suite for
 * the dark concrete walls — with multi-layered blood seepage soaking into the concrete pores,
 * wet glistening crevices, and jagged dried splatter radiants.
 */
function createSeamlessConcretePBRMaps(maxAnisotropy: number): {
  albedoMap: THREE.DataTexture;
  normalMap: THREE.DataTexture;
  roughnessMap: THREE.DataTexture;
  aoMap: THREE.DataTexture;
  bumpMap: THREE.DataTexture;
} {
  const size = 512;
  const albedoBytes = new Uint8Array(size * size * 4);
  const heightBytes = new Uint8Array(size * size);
  const roughnessBytes = new Uint8Array(size * size * 4);
  const aoBytes = new Uint8Array(size * size * 4);
  const bumpBytes = new Uint8Array(size * size * 4);

  const { grid, sampleSmooth: sampleTileableNoise } = createNoiseSampler(size, 918273);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const n1 = sampleTileableNoise(u * 8, v * 8, 8);
      const n2 = sampleTileableNoise(u * 16, v * 16, 16) * 0.5;
      const n3 = sampleTileableNoise(u * 32, v * 32, 32) * 0.25;
      const n4 = sampleTileableNoise(u * 64, v * 64, 64) * 0.125;
      const microGrain = grid[y * size + x];

      const fbm = (n1 + n2 + n3 + n4) / 1.875;

      const seamY = Math.min(y % 128, 128 - (y % 128));
      const seamX = Math.min(x % 256, 256 - (x % 256));
      const grooveY = seamY < 3 ? (3 - seamY) / 3 : 0;
      const grooveX = seamX < 2 ? (2 - seamX) / 2 : 0;
      const seamFactor = Math.max(grooveY, grooveX * 0.65);

      const pit = microGrain < 0.055 ? (0.055 - microGrain) * 14.0 : 0.0;
      const microCrackSig = Math.abs(
        sampleTileableNoise(u * 32 + n1 * 1.8, v * 32 - n2 * 1.8, 32) - 0.5
      );
      const microCrack = microCrackSig < 0.028 ? (0.028 - microCrackSig) / 0.028 : 0;

      // Concrete pore heightfield [0..1]
      const concreteHeight = Math.max(
        0,
        Math.min(
          1,
          fbm * 0.72 + microGrain * 0.28 - seamFactor * 0.55 - pit * 0.48 - microCrack * 0.42
        )
      );

      // Capillary blood seepage that soaks preferentially into low concrete pores & crevices!
      const warpU = u + (n2 - 0.5) * 0.14 + (n3 - 0.5) * 0.06;
      const warpV = v + (n1 - 0.5) * 0.08;
      const seepageField = sampleTileableNoise(warpU * 8, warpV * 8, 8);
      const streakField = sampleTileableNoise(warpU * 48, v * 4, 48);
      const poreAffinity = (1.0 - concreteHeight) * 0.55 + microCrack * 0.65 + seamFactor * 0.45;

      const rawBloodPotential =
        (seepageField - 0.52) * 2.1 + (streakField - 0.5) * 0.85 + poreAffinity * 0.55;
      // Wet glistening blood core inside deep crevices vs jagged dried outer splatter halo
      const wetCoreBlood = Math.max(0, Math.min(1, (rawBloodPotential - 0.38) * 3.2));
      const driedOuterBlood = Math.max(0, Math.min(1, (rawBloodPotential - 0.12) * 2.2));

      // Viscous blood slightly fills and rounds out the deepest pore bottoms while creating a meniscus rim
      const meniscusRim = driedOuterBlood * (1.0 - wetCoreBlood) * 0.08;
      const finalHeight = Math.max(
        0,
        Math.min(1, concreteHeight - wetCoreBlood * 0.06 + meniscusRim)
      );
      const hByte = Math.round(finalHeight * 255);
      heightBytes[y * size + x] = hByte;

      const edgeArchAO = 1.0 - Math.pow(Math.abs(v - 0.5) * 1.95, 4.0) * 0.32;
      const aoVal = Math.max(
        0.14,
        Math.min(
          1.0,
          (0.76 +
            fbm * 0.24 -
            seamFactor * 0.58 -
            pit * 0.5 -
            microCrack * 0.45 -
            driedOuterBlood * 0.28) *
            edgeArchAO
        )
      );
      const aoByte = Math.round(aoVal * 255);

      // Multi-layered roughness:
      // - Unstained concrete: ~0.88 matte
      // - Dried splatter radiant rim: ~0.92 chalky crust
      // - Wet glistening blood crevice core: ~0.16 mirror-wet specular!
      const roughVal = Math.max(
        0.14,
        Math.min(
          0.98,
          0.86 +
            (0.5 - fbm) * 0.18 +
            pit * 0.1 +
            driedOuterBlood * 0.08 -
            wetCoreBlood * 0.72
        )
      );
      const roughByte = Math.round(roughVal * 255);

      const baseLum = 22 + concreteHeight * 26 - seamFactor * 14;
      let r = baseLum * 0.94;
      let g = baseLum * 0.96;
      let b = baseLum * 1.08;

      if (driedOuterBlood > 0.01) {
        // Dried oxidized brown-crimson splatter radiant soaked into pores
        const dryR = 54 + microGrain * 22;
        const dryG = 8 + microGrain * 5;
        const dryB = 9 + microGrain * 5;
        r = r * (1 - driedOuterBlood * 0.78) + dryR * (driedOuterBlood * 0.78);
        g = g * (1 - driedOuterBlood * 0.86) + dryG * (driedOuterBlood * 0.86);
        b = b * (1 - driedOuterBlood * 0.86) + dryB * (driedOuterBlood * 0.86);
      }

      if (wetCoreBlood > 0.01) {
        // Deep, wet glistening arterial-venous blood pooling inside the concrete crevices
        const wetR = 92 + microGrain * 28;
        const wetG = 4 + microGrain * 3;
        const wetB = 6 + microGrain * 4;
        r = r * (1 - wetCoreBlood * 0.92) + wetR * (wetCoreBlood * 0.92);
        g = g * (1 - wetCoreBlood * 0.96) + wetG * (wetCoreBlood * 0.96);
        b = b * (1 - wetCoreBlood * 0.96) + wetB * (wetCoreBlood * 0.96);
      }

      const idx4 = (y * size + x) * 4;
      albedoBytes[idx4] = Math.max(8, Math.min(255, Math.round(r)));
      albedoBytes[idx4 + 1] = Math.max(5, Math.min(255, Math.round(g)));
      albedoBytes[idx4 + 2] = Math.max(7, Math.min(255, Math.round(b)));
      albedoBytes[idx4 + 3] = 255;

      roughnessBytes[idx4] = roughByte;
      roughnessBytes[idx4 + 1] = roughByte;
      roughnessBytes[idx4 + 2] = roughByte;
      roughnessBytes[idx4 + 3] = 255;

      aoBytes[idx4] = aoByte;
      aoBytes[idx4 + 1] = aoByte;
      aoBytes[idx4 + 2] = aoByte;
      aoBytes[idx4 + 3] = 255;

      bumpBytes[idx4] = hByte;
      bumpBytes[idx4 + 1] = hByte;
      bumpBytes[idx4 + 2] = hByte;
      bumpBytes[idx4 + 3] = 255;
    }
  }

  const configureTex = (data: Uint8Array, colorSpace: THREE.ColorSpace): THREE.DataTexture => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.colorSpace = colorSpace;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  };

  const albedoMap = configureTex(albedoBytes, THREE.SRGBColorSpace);
  const roughnessMap = configureTex(roughnessBytes, THREE.NoColorSpace);
  const aoMap = configureTex(aoBytes, THREE.NoColorSpace);
  const bumpMap = configureTex(bumpBytes, THREE.NoColorSpace);
  const normalMap = heightfieldToNormalTexture(heightBytes, size, 3.6, maxAnisotropy, 1, 1);

  return { albedoMap, normalMap, roughnessMap, aoMap, bumpMap };
}

/**
 * Generates seamless full PBR textures for the dark industrial concrete floor tiles.
 */
function createFloorPBRMaps(maxAnisotropy: number): {
  floorAlbedo: THREE.DataTexture;
  floorNormal: THREE.DataTexture;
  floorRoughness: THREE.DataTexture;
  floorAO: THREE.DataTexture;
} {
  const size = 512;
  const albedoBytes = new Uint8Array(size * size * 4);
  const heightBytes = new Uint8Array(size * size);
  const roughnessBytes = new Uint8Array(size * size * 4);
  const aoBytes = new Uint8Array(size * size * 4);

  let seed = 44109;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const tileX = x % 128;
      const tileY = y % 128;
      const distEdge = Math.min(tileX, 128 - tileX, tileY, 128 - tileY);
      const isGroove = distEdge < 4 ? (4 - distEdge) / 4 : 0;

      const grain = rand();
      const h = Math.max(0, Math.min(1, 0.65 + (grain - 0.5) * 0.25 - isGroove * 0.58));
      heightBytes[y * size + x] = Math.round(h * 255);

      const ao = Math.max(0.2, Math.min(1.0, 0.92 - isGroove * 0.68 - (1 - grain) * 0.08));
      const aoByte = Math.round(ao * 255);

      const rough = Math.max(0.42, Math.min(0.95, 0.68 + isGroove * 0.24 + (grain - 0.5) * 0.14));
      const roughByte = Math.round(rough * 255);

      const lum = 18 + h * 18 - isGroove * 10;
      const idx4 = (y * size + x) * 4;
      albedoBytes[idx4] = Math.round(lum * 0.95);
      albedoBytes[idx4 + 1] = Math.round(lum * 0.94);
      albedoBytes[idx4 + 2] = Math.round(lum * 1.08);
      albedoBytes[idx4 + 3] = 255;

      roughnessBytes[idx4] = roughByte;
      roughnessBytes[idx4 + 1] = roughByte;
      roughnessBytes[idx4 + 2] = roughByte;
      roughnessBytes[idx4 + 3] = 255;

      aoBytes[idx4] = aoByte;
      aoBytes[idx4 + 1] = aoByte;
      aoBytes[idx4 + 2] = aoByte;
      aoBytes[idx4 + 3] = 255;
    }
  }

  const makeFloorTex = (data: Uint8Array, cs: THREE.ColorSpace) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.colorSpace = cs;
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(21, 21);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    return tex;
  };

  const floorAlbedo = makeFloorTex(albedoBytes, THREE.SRGBColorSpace);
  const floorRoughness = makeFloorTex(roughnessBytes, THREE.NoColorSpace);
  const floorAO = makeFloorTex(aoBytes, THREE.NoColorSpace);
  const floorNormal = heightfieldToNormalTexture(heightBytes, size, 2.8, maxAnisotropy, 21, 21);

  return { floorAlbedo, floorNormal, floorRoughness, floorAO };
}

/**
 * AAA Procedural Multi-Layered Wall Blood & Claw-Gouge PBR Decal Synthesizer.
 *
 * Replaces flat canvas decals with a full 4-map PBR suite (Albedo+Alpha, Tangent-Space Normal Map,
 * Multi-Layered Roughness Map, and Cavity Ambient Occlusion Map) at 512x512 resolution:
 * - Samples an underlying porous concrete heightfield so blood seepage physically soaks into
 *   micro-pores and fracture crevices via capillary action.
 * - Creates deep carved 3D normal-mapped gouges and jagged, fractal splatter radiants.
 * - Assigns low roughness (0.10 - 0.18) to wet, glistening blood crevices so the player's
 *   flashlight triggers realistic specular reflections, and high roughness (0.85 - 0.95) to
 *   crusted, dried outer blood edges.
 */
function createOrganicWallBloodPBRDecalMaterial(
  archetype: 'claw-gouges' | 'crevice-hemorrhage' | 'arterial-splatter',
  seedNum: number,
  maxAnisotropy: number,
  disposables: THREE.Texture[]
): THREE.MeshStandardMaterial {
  const size = 512;
  const albedoBytes = new Uint8Array(size * size * 4);
  const heightBytes = new Uint8Array(size * size);
  const roughnessBytes = new Uint8Array(size * size * 4);
  const aoBytes = new Uint8Array(size * size * 4);

  const { grid, sampleSmooth, fbm } = createNoiseSampler(size, seedNum);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      const dx = (u - 0.5) * 2.0;
      const dy = (v - 0.5) * 2.0;
      const radialDist = Math.hypot(dx, dy);

      // Soft organic boundary falloff so the decal never clips against the quad border
      const edgeFade = Math.max(0, Math.min(1, (0.94 - radialDist) / 0.28));
      if (edgeFade <= 0.001) {
        const idx4 = (y * size + x) * 4;
        heightBytes[y * size + x] = 128;
        albedoBytes[idx4 + 3] = 0;
        roughnessBytes[idx4] = 220;
        roughnessBytes[idx4 + 1] = 220;
        roughnessBytes[idx4 + 2] = 220;
        roughnessBytes[idx4 + 3] = 255;
        aoBytes[idx4] = 255;
        aoBytes[idx4 + 1] = 255;
        aoBytes[idx4 + 2] = 255;
        aoBytes[idx4 + 3] = 255;
        continue;
      }

      const grain = grid[y * size + x];
      const lowNoise = fbm(u, v, 8);
      const midNoise = fbm(u * 2.0 + 0.3, v * 2.0 + 0.7, 16);
      const highNoise = sampleSmooth(u * 64, v * 64, 64);

      // Underlying concrete pore height [0..1]
      const concretePore =
        0.55 + (lowNoise - 0.5) * 0.35 + (midNoise - 0.5) * 0.25 - (grain < 0.08 ? 0.28 : 0);

      let gougeDepth = 0.0;
      let wetBloodDensity = 0.0;
      let driedSplatterDensity = 0.0;

      if (archetype === 'claw-gouges') {
        // 5 Deep, Jagged Stone-Claw Furrows raked diagonally across the concrete with capillary blood seepage
        const warpX = u + (midNoise - 0.5) * 0.085 + (highNoise - 0.5) * 0.022;
        const warpY = v + (lowNoise - 0.5) * 0.065;

        // Rotate coordinates by ~34 degrees for diagonal claw rakes
        const rotU = (warpX - 0.5) * 0.83 + (warpY - 0.5) * 0.56;
        const rotV = -(warpX - 0.5) * 0.56 + (warpY - 0.5) * 0.83;

        const furrowCenters = [-0.26, -0.13, 0.0, 0.13, 0.26];
        for (let f = 0; f < 5; f++) {
          const fc = furrowCenters[f] + Math.sin(rotV * 7.5 + f * 1.4) * 0.022;
          const distToFurrow = Math.abs(rotU - fc);
          const lengthTaper = Math.max(
            0,
            1.0 - Math.pow(rotV / (0.68 - Math.abs(f - 2) * 0.06), 2.0)
          );
          const width = (0.032 + midNoise * 0.024) * lengthTaper;

          if (distToFurrow < width && lengthTaper > 0.02) {
            const profile = 1.0 - distToFurrow / width;
            // Jagged chiseled stone groove
            gougeDepth = Math.max(gougeDepth, Math.pow(profile, 1.4) * lengthTaper);
            wetBloodDensity = Math.max(wetBloodDensity, Math.pow(profile, 0.85) * lengthTaper);
          }

          // Jagged splatter radiants & capillary pore soak surrounding each claw furrow
          const haloWidth = width * 3.6;
          if (distToFurrow < haloWidth && lengthTaper > 0.05) {
            const haloProfile = 1.0 - distToFurrow / haloWidth;
            const capillary = haloProfile * (1.15 - concretePore) * (0.6 + highNoise * 0.7);
            driedSplatterDensity = Math.max(driedSplatterDensity, capillary * lengthTaper);
          }
        }

        // Irregular gravity-fed blood streaks weeping downward from the claw gouges
        const streakCoord = u * 48 + (midNoise - 0.5) * 2.4;
        const streakVal = sampleSmooth(streakCoord, v * 4, 48);
        if (v > 0.35 && streakVal > 0.56) {
          const downwardFade = Math.max(0, 1.0 - Math.abs(v - 0.62) * 2.4) * (1.0 - Math.abs(dx));
          const streakStrength = ((streakVal - 0.56) / 0.44) * downwardFade * (1.1 - concretePore * 0.5);
          wetBloodDensity = Math.max(wetBloodDensity, streakStrength * 0.9);
          driedSplatterDensity = Math.max(driedSplatterDensity, streakStrength * 1.25);
        }
      } else if (archetype === 'crevice-hemorrhage') {
        // Deep branching structural wall fracture with heavy dark blood weeping out of the fissure
        const crackWarp1 = Math.abs(
          sampleSmooth(u * 8 + midNoise * 1.9, v * 8 - lowNoise * 1.4, 8) - 0.5
        );
        const crackWarp2 = Math.abs(
          sampleSmooth(u * 16 - lowNoise * 1.5, v * 16 + midNoise * 1.5, 16) - 0.5
        );

        const mainFissure = crackWarp1 < 0.065 ? (0.065 - crackWarp1) / 0.065 : 0;
        const branchFissure = crackWarp2 < 0.045 ? ((0.045 - crackWarp2) / 0.045) * 0.75 : 0;
        gougeDepth = Math.min(1.0, (mainFissure + branchFissure) * edgeFade);

        // Viscous blood weeping downward from the fracture network and soaking into concrete pores
        const weepFlow = sampleSmooth(u * 32 + (midNoise - 0.5) * 1.8, v * 4, 32);
        const corePool = Math.max(
          0,
          (1.0 - radialDist * 1.15) * (0.55 + lowNoise * 0.65) - (concretePore - 0.45) * 0.6
        );

        wetBloodDensity = Math.min(
          1.0,
          (gougeDepth * 1.25 + corePool * 0.85 + Math.max(0, weepFlow - 0.52) * 1.4 * edgeFade) *
            edgeFade
        );
        driedSplatterDensity = Math.min(
          1.0,
          (wetBloodDensity * 1.3 +
            Math.max(0, 1.0 - radialDist * 1.05) * (1.0 - concretePore) * 1.35) *
            edgeFade
        );
      } else {
        // 'arterial-splatter': High-velocity jagged arterial impact burst + downward smeared drag trail
        const angle = Math.atan2(dy + 0.14, dx);
        const normAngle = (angle + Math.PI) / (Math.PI * 2);

        // Multi-frequency angular rays for sharp, jagged splatter radiants (zero circular blobs!)
        const ray1 = sampleSmooth(normAngle * 32, radialDist * 8, 32);
        const ray2 = sampleSmooth(normAngle * 64 + midNoise * 2.0, radialDist * 16, 64);
        const jaggedRadius =
          0.26 + ray1 * 0.34 + Math.pow(ray2, 2.0) * 0.36 + (lowNoise - 0.5) * 0.16;

        const impactDist = Math.hypot(dx, dy + 0.14);
        const burstFactor = Math.max(0, (jaggedRadius - impactDist) / Math.max(0.08, jaggedRadius));

        // Downward smeared drag trail from the impact center
        const smearWidth = 0.28 + (midNoise - 0.5) * 0.14;
        const inSmearBand =
          v > 0.36 && Math.abs(dx + Math.sin(v * 9.0) * 0.08) < smearWidth
            ? (1.0 - Math.abs(dx + Math.sin(v * 9.0) * 0.08) / smearWidth) *
              Math.sin(((v - 0.36) / 0.58) * Math.PI)
            : 0;

        // Modulate by concrete pore depth so blood collects inside the porous stone cavities
        const poreSoak = 1.18 - concretePore * 0.65;
        const combined = Math.max(burstFactor, inSmearBand * 0.92) * poreSoak * edgeFade;

        gougeDepth = Math.max(0, (combined - 0.45) * 0.55);
        wetBloodDensity = Math.max(0, Math.min(1, (combined - 0.28) * 1.85));
        driedSplatterDensity = Math.max(0, Math.min(1, (combined - 0.08) * 2.1));
      }

      const alphaMask = Math.max(0, Math.min(1, Math.max(wetBloodDensity, driedSplatterDensity)));

      // Heightfield for Sobel Normal Map:
      // Deeply recessed inside claw gouges/fractures, raised viscous meniscus ridge along wet blood edges
      const viscousMeniscus = wetBloodDensity * (1.0 - wetBloodDensity) * 0.95;
      const heightVal = Math.max(
        0,
        Math.min(1, concretePore - gougeDepth * 0.68 + viscousMeniscus * 0.24)
      );
      heightBytes[y * size + x] = Math.round(heightVal * 255);

      // Multi-layered Roughness:
      // Wet blood crevices = 0.11 (mirror-like wet glistening under flashlight)
      // Dried splatter radiant edges = 0.88 (matte coagulated crust soaked into concrete)
      const roughVal = Math.max(
        0.1,
        Math.min(0.96, 0.88 - wetBloodDensity * 0.76 + (1.0 - concretePore) * 0.08)
      );
      const roughByte = Math.round(roughVal * 255);

      // Cavity Ambient Occlusion: dark inside carved gouges and thick coagulated clots
      const aoVal = Math.max(
        0.12,
        Math.min(1.0, 0.96 - gougeDepth * 0.72 - wetBloodDensity * 0.38 - (1.0 - concretePore) * 0.2)
      );
      const aoByte = Math.round(aoVal * 255);

      // Albedo: Beer-Lambert style absorption from oxidized dried crimson edge to deep venous wet core
      const dryR = 64 + grain * 24;
      const dryG = 7 + grain * 4;
      const dryB = 8 + grain * 4;

      const wetR = 108 + (1.0 - gougeDepth) * 32;
      const wetG = 3 + grain * 3;
      const wetB = 5 + grain * 3;

      const blend = Math.min(1.0, wetBloodDensity * 1.15);
      const r = dryR * (1 - blend) + wetR * blend;
      const g = dryG * (1 - blend) + wetG * blend;
      const b = dryB * (1 - blend) + wetB * blend;

      const idx4 = (y * size + x) * 4;
      albedoBytes[idx4] = Math.max(6, Math.min(255, Math.round(r)));
      albedoBytes[idx4 + 1] = Math.max(2, Math.min(255, Math.round(g)));
      albedoBytes[idx4 + 2] = Math.max(3, Math.min(255, Math.round(b)));
      albedoBytes[idx4 + 3] = Math.round(Math.pow(alphaMask, 0.75) * 255);

      roughnessBytes[idx4] = roughByte;
      roughnessBytes[idx4 + 1] = roughByte;
      roughnessBytes[idx4 + 2] = roughByte;
      roughnessBytes[idx4 + 3] = 255;

      aoBytes[idx4] = aoByte;
      aoBytes[idx4 + 1] = aoByte;
      aoBytes[idx4 + 2] = aoByte;
      aoBytes[idx4 + 3] = 255;
    }
  }

  const makeDecalTex = (data: Uint8Array, cs: THREE.ColorSpace) => {
    const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
    tex.colorSpace = cs;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.anisotropy = maxAnisotropy;
    tex.needsUpdate = true;
    disposables.push(tex);
    return tex;
  };

  const decalAlbedo = makeDecalTex(albedoBytes, THREE.SRGBColorSpace);
  const decalRoughness = makeDecalTex(roughnessBytes, THREE.NoColorSpace);
  const decalAO = makeDecalTex(aoBytes, THREE.NoColorSpace);
  const decalNormal = heightfieldToNormalTexture(
    heightBytes,
    size,
    5.4,
    maxAnisotropy,
    1,
    1,
    true
  );
  disposables.push(decalNormal);

  return new THREE.MeshStandardMaterial({
    map: decalAlbedo,
    normalMap: decalNormal,
    normalScale: new THREE.Vector2(2.6, 2.6),
    roughnessMap: decalRoughness,
    roughness: 0.85,
    aoMap: decalAO,
    aoMapIntensity: 1.45,
    bumpMap: decalRoughness,
    bumpScale: 0.04,
    metalness: 0.14,
    transparent: true,
    alphaTest: 0.04,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.06,
    size / 2,
    size / 2,
    size * 0.48
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.78)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createVolumetricSpotLightMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color('#dbeafe') },
      uTime: { value: 0 },
      uOpacity: { value: 0.22 },
      uBeamLength: { value: 14.0 },
    },
    vertexShader: `
      varying vec3 vNormalView;
      varying vec3 vPositionView;
      varying vec2 vUv;
      varying float vAxialDist;

      void main() {
        vUv = uv;
        vAxialDist = -position.z;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        vPositionView = mvPosition.xyz;
        vNormalView = normalize(normalMatrix * normal);
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uTime;
      uniform float uOpacity;
      uniform float uBeamLength;

      varying vec3 vNormalView;
      varying vec3 vPositionView;
      varying vec2 vUv;
      varying float vAxialDist;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      void main() {
        vec3 viewDir = normalize(-vPositionView);
        float edgeDot = abs(dot(normalize(vNormalView), viewDir));
        float edgeFactor = pow(edgeDot, 1.85);

        float normDist = clamp(vAxialDist / max(uBeamLength, 0.001), 0.0, 1.0);
        float longitudinalFade = pow(1.0 - normDist, 1.65) * smoothstep(0.0, 0.08, normDist);

        vec2 dustCoord = vUv * vec2(18.0, 9.0) + vec2(uTime * 0.14, -uTime * 0.09);
        float dust = smoothstep(0.75, 1.0, hash(floor(dustCoord))) * 0.18;

        float alpha = (edgeFactor * longitudinalFade * uOpacity) + (dust * longitudinalFade * edgeFactor * 0.35);
        gl_FragColor = vec4(uColor, clamp(alpha, 0.0, 0.55));
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
  });
}

export function createProceduralMaterialLibrary(
  renderer: THREE.WebGLRenderer
): ProceduralMaterialLibrary {
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();
  const extraDisposables: THREE.Texture[] = [];

  const { albedoMap, normalMap, roughnessMap, aoMap, bumpMap } =
    createSeamlessConcretePBRMaps(maxAnisotropy);
  const { floorAlbedo, floorNormal, floorRoughness, floorAO } =
    createFloorPBRMaps(maxAnisotropy);
  const { stoneAlbedo, stoneNormal, stoneRoughness, stoneAO } =
    createWeatheredAngelStonePBRMaps(maxAnisotropy);
  const angelFaceTex = createAngelFaceWeepingTexture(maxAnisotropy, extraDisposables);
  const contactShadowTex = createContactShadowTexture();

  // 1. Primary Extruded Wall Cube Material (with capillary pore blood seepage & wet crevice specular)
  const wallMainMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2c303a'),
    map: albedoMap,
    normalMap: normalMap,
    normalScale: new THREE.Vector2(1.55, 1.55),
    roughnessMap: roughnessMap,
    roughness: 0.92,
    aoMap: aoMap,
    aoMapIntensity: 1.32,
    bumpMap: bumpMap,
    bumpScale: 0.05,
    metalness: 0.12,
  });

  // 2. Secondary Wall Plinth Base Material
  const wallPlinthMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#16131a'),
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.75, 0.75),
    roughnessMap: roughnessMap,
    aoMap: aoMap,
    aoMapIntensity: 1.35,
    roughness: 0.52,
    metalness: 0.55,
  });

  // 3. Accent Wall Crown / Bevel Cap Material
  const wallCapMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1d1924'),
    normalMap: normalMap,
    normalScale: new THREE.Vector2(0.8, 0.8),
    roughnessMap: roughnessMap,
    aoMap: aoMap,
    aoMapIntensity: 1.18,
    roughness: 0.6,
    metalness: 0.42,
  });

  // 4. Full PBR Floor Material
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#1b1d26'),
    map: floorAlbedo,
    normalMap: floorNormal,
    normalScale: new THREE.Vector2(1.15, 1.15),
    roughnessMap: floorRoughness,
    roughness: 0.82,
    aoMap: floorAO,
    aoMapIntensity: 1.25,
    metalness: 0.16,
  });

  // 5. Weeping Angel Cracked Grey-Brown Granite PBR Material (Matching 3D Character Sheet)
  const angelStoneMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#9e9689'),
    map: stoneAlbedo,
    normalMap: stoneNormal,
    normalScale: new THREE.Vector2(2.4, 2.4),
    roughnessMap: stoneRoughness,
    roughness: 0.89,
    aoMap: stoneAO,
    aoMapIntensity: 1.65,
    bumpMap: stoneRoughness,
    bumpScale: 0.055,
    metalness: 0.04,
  });

  // 6. Weeping Angel Mossy & Dirt-Creviced Stone Material (Base, Wing Coverts & Deep Robe Folds)
  const angelMossStoneMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#686d59'),
    map: stoneAlbedo,
    normalMap: stoneNormal,
    normalScale: new THREE.Vector2(2.7, 2.7),
    roughnessMap: stoneRoughness,
    roughness: 0.96,
    aoMap: stoneAO,
    aoMapIntensity: 1.8,
    metalness: 0.02,
  });

  // 7. Weeping Angel Dedicated Face Material with Dark Stone-Weeping Tear Streaks (FACE CLOSEUP)
  const angelFaceMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#a39b8e'),
    map: angelFaceTex,
    normalMap: stoneNormal,
    normalScale: new THREE.Vector2(2.1, 2.1),
    roughnessMap: stoneRoughness,
    roughness: 0.84,
    aoMap: stoneAO,
    aoMapIntensity: 1.55,
    metalness: 0.05,
  });

  // 8. Dark/Black Stone-Weeping Tear Streaks & Coagulated Ichor Material
  const angelBloodStainMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#191110'),
    map: stoneAlbedo,
    normalMap: stoneNormal,
    normalScale: new THREE.Vector2(1.75, 1.75),
    roughness: 0.32,
    metalness: 0.15,
  });

  // 9. Carved Stone Fingernails & Subtle Inner Snarl Teeth Material
  const angelFangMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#aba396'),
    normalMap: stoneNormal,
    normalScale: new THREE.Vector2(1.2, 1.2),
    roughness: 0.54,
    metalness: 0.12,
  });

  // 10. Deep Hollow Orbital & Parted Snarl Cavity Material
  const angelSocketMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color('#050404'),
  });

  // 11. Three AAA Multi-Layered Normal + Roughness + AO Wall Blood & Scratch Decal Materials
  const scratchesDecalMaterial = createOrganicWallBloodPBRDecalMaterial(
    'claw-gouges',
    104729,
    maxAnisotropy,
    extraDisposables
  );
  const pipesDecalMaterial = createOrganicWallBloodPBRDecalMaterial(
    'crevice-hemorrhage',
    229403,
    maxAnisotropy,
    extraDisposables
  );
  const graffitiDecalMaterial = createOrganicWallBloodPBRDecalMaterial(
    'arterial-splatter',
    389117,
    maxAnisotropy,
    extraDisposables
  );

  // 12. Radial Contact Shadow Material
  const contactShadowMaterial = new THREE.MeshBasicMaterial({
    map: contactShadowTex,
    transparent: true,
    opacity: 0.58,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });

  // 13. Volumetric SpotLight Cone ShaderMaterial
  const volumetricConeMaterial = createVolumetricSpotLightMaterial();

  return {
    wallMainMaterial,
    wallPlinthMaterial,
    wallCapMaterial,
    floorMaterial,
    angelStoneMaterial,
    angelMossStoneMaterial,
    angelFaceMaterial,
    angelBloodStainMaterial,
    angelFangMaterial,
    angelSocketMaterial,
    scratchesDecalMaterial,
    pipesDecalMaterial,
    graffitiDecalMaterial,
    contactShadowMaterial,
    volumetricConeMaterial,
    dispose: () => {
      albedoMap.dispose();
      normalMap.dispose();
      roughnessMap.dispose();
      aoMap.dispose();
      bumpMap.dispose();
      floorAlbedo.dispose();
      floorNormal.dispose();
      floorRoughness.dispose();
      floorAO.dispose();
      stoneAlbedo.dispose();
      stoneNormal.dispose();
      stoneRoughness.dispose();
      stoneAO.dispose();
      contactShadowTex.dispose();
      extraDisposables.forEach((t) => t.dispose());
      wallMainMaterial.dispose();
      wallPlinthMaterial.dispose();
      wallCapMaterial.dispose();
      floorMaterial.dispose();
      angelStoneMaterial.dispose();
      angelMossStoneMaterial.dispose();
      angelFaceMaterial.dispose();
      angelBloodStainMaterial.dispose();
      angelFangMaterial.dispose();
      angelSocketMaterial.dispose();
      scratchesDecalMaterial.dispose();
      pipesDecalMaterial.dispose();
      graffitiDecalMaterial.dispose();
      contactShadowMaterial.dispose();
      volumetricConeMaterial.dispose();
    },
  };
}
