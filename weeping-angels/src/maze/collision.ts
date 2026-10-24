import { MazeData, WallCubeAABB } from './mazeGenerator';

/**
 * Resolves 2D circle-vs-AABB collisions strictly against all nearby extruded 3D wall cubes.
 * Uses multi-pass iterative push-out so sliding along flat wall corridors and around 90-degree
 * corners is completely smooth with zero wall penetration or corner snagging.
 */
export function resolveMazeCollision(
  currentX: number,
  currentZ: number,
  targetX: number,
  targetZ: number,
  playerRadius: number,
  wallCubes: WallCubeAABB[]
): { x: number; z: number; collided: boolean } {
  let x = targetX;
  let z = targetZ;
  let collided = false;

  // Sub-step if the movement delta is large (prevents tunneling on frame spikes)
  const dxTotal = targetX - currentX;
  const dzTotal = targetZ - currentZ;
  const distSq = dxTotal * dxTotal + dzTotal * dzTotal;
  const maxStep = playerRadius * 0.45;
  const steps = distSq > maxStep * maxStep ? Math.ceil(Math.sqrt(distSq) / maxStep) : 1;

  let stepX = currentX;
  let stepZ = currentZ;

  for (let s = 1; s <= steps; s++) {
    stepX += dxTotal / steps;
    stepZ += dzTotal / steps;

    // 3 iterative passes per sub-step handle simultaneous multi-wall corner contacts
    for (let iter = 0; iter < 3; iter++) {
      for (let i = 0; i < wallCubes.length; i++) {
        const w = wallCubes[i];

        // Broadphase AABB rejection
        if (
          stepX + playerRadius < w.minX ||
          stepX - playerRadius > w.maxX ||
          stepZ + playerRadius < w.minZ ||
          stepZ - playerRadius > w.maxZ
        ) {
          continue;
        }

        // Closest point on the wall cube AABB to the player circle center
        const closestX = Math.max(w.minX, Math.min(stepX, w.maxX));
        const closestZ = Math.max(w.minZ, Math.min(stepZ, w.maxZ));

        const diffX = stepX - closestX;
        const diffZ = stepZ - closestZ;
        const dSq = diffX * diffX + diffZ * diffZ;

        if (dSq < playerRadius * playerRadius) {
          collided = true;
          if (dSq > 1e-8) {
            const d = Math.sqrt(dSq);
            const overlap = playerRadius - d;
            stepX += (diffX / d) * overlap;
            stepZ += (diffZ / d) * overlap;
          } else {
            // Player center is inside AABB (rare edge case) - push out along shallowest axis
            const penLeft = Math.abs(stepX - w.minX);
            const penRight = Math.abs(w.maxX - stepX);
            const penTop = Math.abs(stepZ - w.minZ);
            const penBottom = Math.abs(w.maxZ - stepZ);
            const minPen = Math.min(penLeft, penRight, penTop, penBottom);

            if (minPen === penLeft) stepX = w.minX - playerRadius;
            else if (minPen === penRight) stepX = w.maxX + playerRadius;
            else if (minPen === penTop) stepZ = w.minZ - playerRadius;
            else stepZ = w.maxZ + playerRadius;
          }
        }
      }
    }
  }

  x = stepX;
  z = stepZ;
  return { x, z, collided };
}

/**
 * Maps a 3D world position (x, z) to the closest logical cell (0..9, 0..9) in the 10x10 grid.
 */
export function worldToLogicalCell(
  worldX: number,
  worldZ: number,
  maze: MazeData
): { row: number; col: number } {
  const offsetX = -((maze.voxelCols - 1) * maze.tileSize) / 2;
  const offsetZ = -((maze.voxelRows - 1) * maze.tileSize) / 2;

  const vc = Math.round((worldX - offsetX) / maze.tileSize);
  const vr = Math.round((worldZ - offsetZ) / maze.tileSize);

  const col = Math.max(0, Math.min(maze.logicalCols - 1, Math.floor((vc - 1) / 2)));
  const row = Math.max(0, Math.min(maze.logicalRows - 1, Math.floor((vr - 1) / 2)));

  return { row, col };
}
