export interface LogicalCell {
  row: number;
  col: number;
  visited: boolean;
  walls: {
    north: boolean;
    east: boolean;
    south: boolean;
    west: boolean;
  };
  distanceFromStart: number;
  degree: number;
  isDeadEnd: boolean;
  isFurthestDeadEnd: boolean;
  parent: { row: number; col: number } | null;
}

export type LandmarkType = 'scratches' | 'pipes' | 'graffiti';

export interface WallLandmarkDecal {
  wallIndex: number;
  gridX: number;
  gridZ: number;
  worldX: number;
  worldY: number;
  worldZ: number;
  rotationY: number;
  type: LandmarkType;
}

export interface KeycardNode {
  id: string;
  index: number;
  row: number;
  col: number;
  worldX: number;
  worldZ: number;
  distanceFromStart: number;
  color: string;
  label: string;
}

export interface AngelSpawnNode {
  id: string;
  index: number;
  row: number;
  col: number;
  worldX: number;
  worldZ: number;
  yaw: number;
}

export interface WallCubeAABB {
  gridX: number;
  gridZ: number;
  worldX: number;
  worldZ: number;
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  isOuterBorder: boolean;
  hasLandmark: boolean;
}

export interface MazeData {
  seed: number;
  logicalRows: number; // 10
  logicalCols: number; // 10
  voxelRows: number; // 21 (2 * 10 + 1)
  voxelCols: number; // 21 (2 * 10 + 1)
  tileSize: number; // World units per voxel cube
  wallHeight: number;
  logicalGrid: LogicalCell[][];
  voxelGrid: number[][]; // 1 = extruded 3D wall cube, 0 = open corridor
  wallCubes: WallCubeAABB[];
  landmarks: WallLandmarkDecal[]; // Exactly 15% of wallCubes
  keycardNodes: KeycardNode[]; // Strictly 3 Violet Keycards located at distant dead-end nodes
  angelSpawnCells: AngelSpawnNode[]; // 4 distinct Weeping Angel spawn coordinates scattered across the 10x10 maze
  startCell: { row: number; col: number };
  startWorldPos: { x: number; z: number };
  initialYaw: number;
  objectiveCell: { row: number; col: number };
  objectiveWorldPos: { x: number; z: number };
  deadEndCount: number;
  maxPathDistance: number;
  solutionPath: Array<{ row: number; col: number; worldX: number; worldZ: number }>;
}

/**
 * Generates a high-entropy random 32-bit unsigned seed so every single initialization
 * produces a 100% unique 10x10 maze layout.
 */
export function generateRandomSeed(): number {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    window.crypto.getRandomValues(buf);
    return buf[0] >>> 0;
  }
  return ((Math.random() * 0xffffffff) ^ Date.now() ^ Math.floor(performance.now() * 1000)) >>> 0;
}

/**
 * Deterministic seeded PRNG (Mulberry32) driven by the randomized seed.
 */
function createSeededRandom(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Generates a 10x10 maze using the Recursive Backtracker algorithm with a randomized seed,
 * extrudes 3D wall cubes, computes exact BFS distances to locate the furthest dead-end nodes
 * for spawning glowing floating keycards and the objective beacon, and spawns distinct
 * environmental landmark decals on exactly 15% of the wall meshes.
 */
export function generateMaze10x10(
  seed: number = generateRandomSeed(),
  logicalRows: number = 10,
  logicalCols: number = 10,
  tileSize: number = 2.6,
  wallHeight: number = 3.6
): MazeData {
  const rng = createSeededRandom(seed);

  // 1. Initialize 10x10 logical grid
  const logicalGrid: LogicalCell[][] = [];
  for (let r = 0; r < logicalRows; r++) {
    const rowCells: LogicalCell[] = [];
    for (let c = 0; c < logicalCols; c++) {
      rowCells.push({
        row: r,
        col: c,
        visited: false,
        walls: {
          north: true,
          east: true,
          south: true,
          west: true,
        },
        distanceFromStart: 0,
        degree: 0,
        isDeadEnd: false,
        isFurthestDeadEnd: false,
        parent: null,
      });
    }
    logicalGrid.push(rowCells);
  }

  // 2. Recursive Backtracker Algorithm using an explicit stack
  const stack: LogicalCell[] = [];
  const startCell = logicalGrid[0][0];
  startCell.visited = true;
  stack.push(startCell);

  const directions = [
    { dr: -1, dc: 0, wall: 'north' as const, opposite: 'south' as const },
    { dr: 0, dc: 1, wall: 'east' as const, opposite: 'west' as const },
    { dr: 1, dc: 0, wall: 'south' as const, opposite: 'north' as const },
    { dr: 0, dc: -1, wall: 'west' as const, opposite: 'east' as const },
  ];

  while (stack.length > 0) {
    const current = stack[stack.length - 1];

    const unvisitedNeighbors: Array<{
      neighbor: LogicalCell;
      wall: 'north' | 'east' | 'south' | 'west';
      opposite: 'north' | 'east' | 'south' | 'west';
    }> = [];

    for (const dir of directions) {
      const nr = current.row + dir.dr;
      const nc = current.col + dir.dc;
      if (nr >= 0 && nr < logicalRows && nc >= 0 && nc < logicalCols) {
        const candidate = logicalGrid[nr][nc];
        if (!candidate.visited) {
          unvisitedNeighbors.push({
            neighbor: candidate,
            wall: dir.wall,
            opposite: dir.opposite,
          });
        }
      }
    }

    if (unvisitedNeighbors.length > 0) {
      const chosenIndex = Math.floor(rng() * unvisitedNeighbors.length);
      const chosen = unvisitedNeighbors[chosenIndex];

      current.walls[chosen.wall] = false;
      chosen.neighbor.walls[chosen.opposite] = false;

      chosen.neighbor.visited = true;
      stack.push(chosen.neighbor);
    } else {
      stack.pop();
    }
  }

  // 3. Compute node degree and exact BFS shortest-path distance from start (0,0)
  for (let r = 0; r < logicalRows; r++) {
    for (let c = 0; c < logicalCols; c++) {
      const cell = logicalGrid[r][c];
      let openCount = 0;
      if (!cell.walls.north) openCount++;
      if (!cell.walls.east) openCount++;
      if (!cell.walls.south) openCount++;
      if (!cell.walls.west) openCount++;
      cell.degree = openCount;
      cell.isDeadEnd = openCount === 1 && !(r === 0 && c === 0);
      cell.distanceFromStart = -1;
    }
  }

  const queue: LogicalCell[] = [logicalGrid[0][0]];
  logicalGrid[0][0].distanceFromStart = 0;

  const allDeadEnds: LogicalCell[] = [];
  let furthestDeadEnd: LogicalCell = logicalGrid[logicalRows - 1][logicalCols - 1];
  let maxDeadEndDist = -1;

  while (queue.length > 0) {
    const curr = queue.shift()!;

    if (curr.isDeadEnd) {
      allDeadEnds.push(curr);
      if (curr.distanceFromStart > maxDeadEndDist) {
        maxDeadEndDist = curr.distanceFromStart;
        furthestDeadEnd = curr;
      }
    }

    for (const dir of directions) {
      if (!curr.walls[dir.wall]) {
        const nr = curr.row + dir.dr;
        const nc = curr.col + dir.dc;
        const nextCell = logicalGrid[nr][nc];
        if (nextCell.distanceFromStart === -1) {
          nextCell.distanceFromStart = curr.distanceFromStart + 1;
          nextCell.parent = { row: curr.row, col: curr.col };
          queue.push(nextCell);
        }
      }
    }
  }

  furthestDeadEnd.isFurthestDeadEnd = true;
  const deadEndCount = allDeadEnds.length;

  // 4. Map the 10x10 logical grid onto the extruded 3D cube voxel grid (21x21)
  const voxelRows = logicalRows * 2 + 1;
  const voxelCols = logicalCols * 2 + 1;
  const voxelGrid: number[][] = Array.from({ length: voxelRows }, () =>
    Array(voxelCols).fill(1)
  );

  for (let r = 0; r < logicalRows; r++) {
    for (let c = 0; c < logicalCols; c++) {
      const cell = logicalGrid[r][c];
      const vr = r * 2 + 1;
      const vc = c * 2 + 1;
      voxelGrid[vr][vc] = 0;

      if (!cell.walls.north) voxelGrid[vr - 1][vc] = 0;
      if (!cell.walls.south) voxelGrid[vr + 1][vc] = 0;
      if (!cell.walls.west) voxelGrid[vr][vc - 1] = 0;
      if (!cell.walls.east) voxelGrid[vr][vc + 1] = 0;
    }
  }

  const offsetX = -((voxelCols - 1) * tileSize) / 2;
  const offsetZ = -((voxelRows - 1) * tileSize) / 2;

  const voxelToWorld = (vr: number, vc: number) => ({
    x: offsetX + vc * tileSize,
    z: offsetZ + vr * tileSize,
  });

  const logicalToWorld = (r: number, c: number) => voxelToWorld(r * 2 + 1, c * 2 + 1);

  // 5. Locate 3 widely scattered nodes across separate wings of the maze for Violet Security Keycards
  const sortedDeadEnds = [...allDeadEnds].sort(
    (a, b) => b.distanceFromStart - a.distanceFromStart
  );

  const selectedKeycardCells: LogicalCell[] = [];
  const usedCellKeys = new Set<string>(['0,0']);

  const gridEuclideanDist = (a: { row: number; col: number }, b: { row: number; col: number }) =>
    Math.hypot(a.row - b.row, a.col - b.col);

  const allCandidateCells: LogicalCell[] = [];
  for (let r = 0; r < logicalRows; r++) {
    for (let c = 0; c < logicalCols; c++) {
      if (r === 0 && c === 0) continue;
      allCandidateCells.push(logicalGrid[r][c]);
    }
  }

  // Seed 1st keycard at a distant dead-end (or furthest cell from start)
  const firstAnchorPool = sortedDeadEnds.filter(
    (de) => gridEuclideanDist(de, { row: 0, col: 0 }) >= 5
  );
  const firstCardCell =
    firstAnchorPool.length > 0
      ? firstAnchorPool[Math.floor(Math.random() * Math.min(3, firstAnchorPool.length))]
      : sortedDeadEnds[0] ||
        [...allCandidateCells].sort((a, b) => b.distanceFromStart - a.distanceFromStart)[0];

  if (firstCardCell) {
    selectedKeycardCells.push(firstCardCell);
    usedCellKeys.add(`${firstCardCell.row},${firstCardCell.col}`);
  }

  // Select remaining keycards using Farthest-Point Sampling to maximize separation between all keycards
  while (selectedKeycardCells.length < 3) {
    let bestCell: LogicalCell | null = null;
    let bestScore = -Infinity;

    // First check if any well-separated dead-ends exist at least 5.5 logical cells (~29m) from every placed keycard
    const separatedDeadEnds = sortedDeadEnds.filter((cell) => {
      const key = `${cell.row},${cell.col}`;
      if (usedCellKeys.has(key)) return false;
      const distFromStart = gridEuclideanDist(cell, { row: 0, col: 0 });
      if (distFromStart < 4.5) return false;
      const minDistToSelected = Math.min(
        ...selectedKeycardCells.map((sel) => gridEuclideanDist(cell, sel))
      );
      return minDistToSelected >= 5.5;
    });

    const poolToEvaluate = separatedDeadEnds.length > 0 ? separatedDeadEnds : allCandidateCells;

    for (const cell of poolToEvaluate) {
      const key = `${cell.row},${cell.col}`;
      if (usedCellKeys.has(key)) continue;

      const distFromStart = gridEuclideanDist(cell, { row: 0, col: 0 });
      if (distFromStart < 4.0) continue;

      const minDistToSelected =
        selectedKeycardCells.length > 0
          ? Math.min(...selectedKeycardCells.map((sel) => gridEuclideanDist(cell, sel)))
          : distFromStart;

      const sumDistToSelected = selectedKeycardCells.reduce(
        (acc, sel) => acc + gridEuclideanDist(cell, sel),
        0
      );

      // Heavily prioritize maximum minimum distance from all existing keycards
      const score =
        minDistToSelected * 10 +
        sumDistToSelected * 1.5 +
        distFromStart * 0.8 +
        (cell.isDeadEnd ? 2.0 : 0);

      if (score > bestScore) {
        bestScore = score;
        bestCell = cell;
      }
    }

    if (!bestCell) break;
    selectedKeycardCells.push(bestCell);
    usedCellKeys.add(`${bestCell.row},${bestCell.col}`);
  }

  const keycardSpecs = [
    { color: '#a855f7', label: 'ALPHA-01 // VIOLET KEYCARD' },
    { color: '#a855f7', label: 'BETA-02 // VIOLET KEYCARD' },
    { color: '#a855f7', label: 'OMEGA-03 // VIOLET KEYCARD' },
  ];

  const keycardNodes: KeycardNode[] = selectedKeycardCells.map((cell, idx) => {
    const wp = logicalToWorld(cell.row, cell.col);
    const spec = keycardSpecs[idx % keycardSpecs.length];
    return {
      id: `keycard-${cell.row}-${cell.col}`,
      index: idx,
      row: cell.row,
      col: cell.col,
      worldX: wp.x,
      worldZ: wp.z,
      distanceFromStart: cell.distanceFromStart,
      color: spec.color,
      label: spec.label,
    };
  });

  // 5b. Select a Randomized Exit Corner / Extraction Portal cell (distinct from start & keycards)
  const farCornerCandidates: LogicalCell[] = [];
  for (let r = 0; r < logicalRows; r++) {
    for (let c = 0; c < logicalCols; c++) {
      const key = `${r},${c}`;
      if (usedCellKeys.has(key)) continue;
      const isFarCornerSector =
        (r >= logicalRows - 3 && c >= logicalCols - 3) ||
        (r >= logicalRows - 3 && c <= 2) ||
        (r <= 2 && c >= logicalCols - 3);
      if (isFarCornerSector && logicalGrid[r][c].distanceFromStart >= 8) {
        farCornerCandidates.push(logicalGrid[r][c]);
      }
    }
  }

  let extractionCell: LogicalCell = furthestDeadEnd;
  if (farCornerCandidates.length > 0) {
    // Shuffle far corner candidates with seeded RNG and pick one
    for (let i = farCornerCandidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = farCornerCandidates[i];
      farCornerCandidates[i] = farCornerCandidates[j];
      farCornerCandidates[j] = tmp;
    }
    extractionCell = farCornerCandidates[0];
  } else if (sortedDeadEnds.length > 3) {
    extractionCell = sortedDeadEnds[3];
  }
  usedCellKeys.add(`${extractionCell.row},${extractionCell.col}`);

  // 5c. Generate 4 Distinct Weeping Angel Spawn Coordinates Scattered Across the 10x10 Maze
  const startWorldPos = logicalToWorld(0, 0);
  const angelSpawnCells: AngelSpawnNode[] = [];

  // Angel #0: Placed ~2-3 cells from start (~8m - 11.5m away) for immediate tactical tension
  let angel0Cell = logicalGrid[Math.min(2, logicalRows - 1)][Math.min(2, logicalCols - 1)];
  let bestAngel0Score = Infinity;
  for (let r = 0; r < logicalRows; r++) {
    for (let c = 0; c < logicalCols; c++) {
      if (r === 0 && c === 0) continue;
      const cell = logicalGrid[r][c];
      if (cell.distanceFromStart < 2) continue;
      const wp = logicalToWorld(r, c);
      const dist = Math.hypot(wp.x - startWorldPos.x, wp.z - startWorldPos.z);
      const score = Math.abs(dist - 10.4) + Math.abs(cell.distanceFromStart - 2) * 1.3;
      if (score < bestAngel0Score) {
        bestAngel0Score = score;
        angel0Cell = cell;
      }
    }
  }

  const pushAngelSpawn = (cell: LogicalCell, idx: number) => {
    const wp = logicalToWorld(cell.row, cell.col);
    const yawToStart = Math.atan2(startWorldPos.x - wp.x, startWorldPos.z - wp.z);
    angelSpawnCells.push({
      id: `angel-${idx}`,
      index: idx,
      row: cell.row,
      col: cell.col,
      worldX: wp.x,
      worldZ: wp.z,
      yaw: yawToStart,
    });
  };

  pushAngelSpawn(angel0Cell, 0);

  // Angels #1, #2, #3: Scattered randomly across distinct sectors of the 10x10 maze
  const remainingAngelCandidates: LogicalCell[] = [];
  for (let r = 0; r < logicalRows; r++) {
    for (let c = 0; c < logicalCols; c++) {
      if (r === 0 && c === 0) continue;
      if (r === angel0Cell.row && c === angel0Cell.col) continue;
      if (logicalGrid[r][c].distanceFromStart >= 3) {
        remainingAngelCandidates.push(logicalGrid[r][c]);
      }
    }
  }

  // Fisher-Yates shuffle using the seeded PRNG
  for (let i = remainingAngelCandidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = remainingAngelCandidates[i];
    remainingAngelCandidates[i] = remainingAngelCandidates[j];
    remainingAngelCandidates[j] = tmp;
  }

  const targetAngelCount = 4;
  for (const cand of remainingAngelCandidates) {
    if (angelSpawnCells.length >= targetAngelCount) break;
    const candWp = logicalToWorld(cand.row, cand.col);
    const wellSpaced = angelSpawnCells.every(
      (existing) => Math.hypot(candWp.x - existing.worldX, candWp.z - existing.worldZ) >= tileSize * 4.2
    );
    if (wellSpaced) {
      pushAngelSpawn(cand, angelSpawnCells.length);
    }
  }

  // Fallback if tight spacing prevented reaching 4 angels
  for (const cand of remainingAngelCandidates) {
    if (angelSpawnCells.length >= targetAngelCount) break;
    const alreadyUsed = angelSpawnCells.some((a) => a.row === cand.row && a.col === cand.col);
    if (!alreadyUsed) {
      pushAngelSpawn(cand, angelSpawnCells.length);
    }
  }

  // 6. Build WallCubeAABB list for 3D instanced rendering and strict collision detection
  const wallCubes: WallCubeAABB[] = [];
  const halfTile = tileSize / 2;

  for (let vr = 0; vr < voxelRows; vr++) {
    for (let vc = 0; vc < voxelCols; vc++) {
      if (voxelGrid[vr][vc] === 1) {
        const { x, z } = voxelToWorld(vr, vc);
        const isOuterBorder =
          vr === 0 || vr === voxelRows - 1 || vc === 0 || vc === voxelCols - 1;
        wallCubes.push({
          gridX: vc,
          gridZ: vr,
          worldX: x,
          worldZ: z,
          minX: x - halfTile,
          maxX: x + halfTile,
          minZ: z - halfTile,
          maxZ: z + halfTile,
          isOuterBorder,
          hasLandmark: false,
        });
      }
    }
  }

  // 7. Environmental Landmarks: Spawn plane geometry decals on EXACTLY 15% of the wall meshes
  const targetLandmarkCount = Math.round(wallCubes.length * 0.15);

  interface CandidateWall {
    wallIndex: number;
    faces: Array<{ nx: number; nz: number; rotY: number }>;
  }

  const candidatesWithCorridorFace: CandidateWall[] = [];
  const fallbackCandidates: CandidateWall[] = [];

  for (let i = 0; i < wallCubes.length; i++) {
    const w = wallCubes[i];
    const vr = w.gridZ;
    const vc = w.gridX;
    const faces: Array<{ nx: number; nz: number; rotY: number }> = [];

    if (vr > 0 && voxelGrid[vr - 1][vc] === 0) {
      faces.push({ nx: 0, nz: -1, rotY: Math.PI });
    }
    if (vr < voxelRows - 1 && voxelGrid[vr + 1][vc] === 0) {
      faces.push({ nx: 0, nz: 1, rotY: 0 });
    }
    if (vc < voxelCols - 1 && voxelGrid[vr][vc + 1] === 0) {
      faces.push({ nx: 1, nz: 0, rotY: Math.PI / 2 });
    }
    if (vc > 0 && voxelGrid[vr][vc - 1] === 0) {
      faces.push({ nx: -1, nz: 0, rotY: -Math.PI / 2 });
    }

    if (faces.length > 0) {
      candidatesWithCorridorFace.push({ wallIndex: i, faces });
    } else {
      fallbackCandidates.push({
        wallIndex: i,
        faces: [{ nx: 0, nz: 1, rotY: 0 }],
      });
    }
  }

  for (let i = candidatesWithCorridorFace.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = candidatesWithCorridorFace[i];
    candidatesWithCorridorFace[i] = candidatesWithCorridorFace[j];
    candidatesWithCorridorFace[j] = temp;
  }

  const allCandidates = [...candidatesWithCorridorFace, ...fallbackCandidates];
  const selectedCandidates = allCandidates.slice(0, targetLandmarkCount);
  const landmarkTypes: LandmarkType[] = ['scratches', 'pipes', 'graffiti'];
  const landmarks: WallLandmarkDecal[] = [];

  const surfaceOffset = halfTile + 0.016;

  selectedCandidates.forEach((cand, idx) => {
    const wall = wallCubes[cand.wallIndex];
    wall.hasLandmark = true;
    const chosenFace = cand.faces[Math.floor(rng() * cand.faces.length)];
    const type = landmarkTypes[idx % landmarkTypes.length];

    const worldY = type === 'pipes' ? 1.55 : 1.45 + (rng() - 0.5) * 0.35;

    landmarks.push({
      wallIndex: cand.wallIndex,
      gridX: wall.gridX,
      gridZ: wall.gridZ,
      worldX: wall.worldX + chosenFace.nx * surfaceOffset,
      worldY,
      worldZ: wall.worldZ + chosenFace.nz * surfaceOffset,
      rotationY: chosenFace.rotY,
      type,
    });
  });

  // 8. Reconstruct shortest solution path from (0,0) to extractionCell
  const solutionPath: Array<{ row: number; col: number; worldX: number; worldZ: number }> = [];
  let trace: LogicalCell | null = extractionCell;
  while (trace) {
    const wp = logicalToWorld(trace.row, trace.col);
    solutionPath.unshift({
      row: trace.row,
      col: trace.col,
      worldX: wp.x,
      worldZ: wp.z,
    });
    if (trace.parent) {
      trace = logicalGrid[trace.parent.row][trace.parent.col];
    } else {
      trace = null;
    }
  }

  let initialYaw = Math.PI;
  if (!startCell.walls.east) {
    initialYaw = -Math.PI / 2;
  } else if (!startCell.walls.south) {
    initialYaw = Math.PI;
  }

  const objectiveWorldPos = logicalToWorld(extractionCell.row, extractionCell.col);

  return {
    seed,
    logicalRows,
    logicalCols,
    voxelRows,
    voxelCols,
    tileSize,
    wallHeight,
    logicalGrid,
    voxelGrid,
    wallCubes,
    landmarks,
    keycardNodes,
    angelSpawnCells,
    startCell: { row: 0, col: 0 },
    startWorldPos,
    initialYaw,
    objectiveCell: { row: extractionCell.row, col: extractionCell.col },
    objectiveWorldPos,
    deadEndCount,
    maxPathDistance: maxDeadEndDist,
    solutionPath,
  };
}
