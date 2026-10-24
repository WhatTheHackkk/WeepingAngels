import React, { useEffect, useRef } from 'react';
import { MazeData } from '../maze/mazeGenerator';
import { AngelHudMarker, TelemetryState } from './ControlDock';

interface BlueprintModalProps {
  isOpen: boolean;
  maze: MazeData;
  visitedCells: Set<string>;
  collectedKeycardIds: Set<string>;
  playerWorldPos: { x: number; z: number; yaw: number };
  angelsPos: AngelHudMarker[];
  neonColor: string;
  showSolutionPath: boolean;
  telemetry: TelemetryState;
}

export const BlueprintModal: React.FC<BlueprintModalProps> = ({
  isOpen,
  maze,
  visitedCells,
  collectedKeycardIds,
  playerWorldPos,
  angelsPos,
  neonColor,
  showSolutionPath,
  telemetry,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    // 1. Deep Blueprint Obsidian-Violet Grid Background
    ctx.fillStyle = '#05030d';
    ctx.fillRect(0, 0, size, size);

    const vRows = maze.voxelRows;
    const vCols = maze.voxelCols;
    const cellPx = size / vCols;

    // Subtle blueprint CAD sub-grid
    ctx.strokeStyle = 'rgba(168, 85, 247, 0.09)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= vCols * 2; i++) {
      const p = (i * cellPx) / 2;
      ctx.beginPath();
      ctx.moveTo(p, 0);
      ctx.lineTo(p, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, p);
      ctx.lineTo(size, p);
      ctx.stroke();
    }

    // 2. Render Extruded Wall Blocks & Carved Passages with Glowing Violet Edges
    for (let vr = 0; vr < vRows; vr++) {
      for (let vc = 0; vc < vCols; vc++) {
        const x = vc * cellPx;
        const y = vr * cellPx;

        if (maze.voxelGrid[vr][vc] === 1) {
          ctx.fillStyle = 'rgba(22, 12, 42, 0.92)';
          ctx.fillRect(x, y, cellPx, cellPx);

          ctx.strokeStyle = 'rgba(168, 85, 247, 0.44)';
          ctx.lineWidth = 1.25;
          ctx.strokeRect(x + 0.5, y + 0.5, cellPx - 1, cellPx - 1);
        } else {
          const lr = Math.floor((vr - 1) / 2);
          const lc = Math.floor((vc - 1) / 2);
          const isVisited = visitedCells.has(`${lr},${lc}`);
          if (isVisited) {
            ctx.fillStyle = 'rgba(168, 85, 247, 0.15)';
            ctx.fillRect(x, y, cellPx, cellPx);
          }
        }
      }
    }

    // 3. Draw 10x10 Logical Node Coordinates in subtle blueprint typography
    ctx.font = '500 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (let r = 0; r < maze.logicalRows; r++) {
      for (let c = 0; c < maze.logicalCols; c++) {
        const cx = (c * 2 + 1.5) * cellPx;
        const cy = (r * 2 + 1.5) * cellPx;
        ctx.fillStyle = 'rgba(148, 163, 184, 0.28)';
        ctx.fillText(`${r},${c}`, cx, cy);
      }
    }

    // 4. Render the 15% Environmental Landmark Decals on the Blueprint
    maze.landmarks.forEach((lm) => {
      const lx = (lm.gridX + 0.5) * cellPx;
      const ly = (lm.gridZ + 0.5) * cellPx;

      ctx.save();
      if (lm.type === 'scratches') {
        ctx.fillStyle = '#10b981';
        ctx.shadowColor = '#10b981';
      } else if (lm.type === 'pipes') {
        ctx.fillStyle = '#f97316';
        ctx.shadowColor = '#f97316';
      } else {
        ctx.fillStyle = '#eab308';
        ctx.shadowColor = '#eab308';
      }
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(lx, ly, cellPx * 0.18, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // 5. Optional Shortest Topological Solution Path
    if (showSolutionPath && maze.solutionPath.length > 1) {
      ctx.save();
      ctx.strokeStyle = neonColor;
      ctx.shadowColor = neonColor;
      ctx.shadowBlur = 12;
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      maze.solutionPath.forEach((node, idx) => {
        const vx = (node.col * 2 + 1.5) * cellPx;
        const vy = (node.row * 2 + 1.5) * cellPx;
        if (idx === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      });
      ctx.stroke();
      ctx.restore();
    }

    // 6. Start Node (0, 0)
    const startX = (maze.startCell.col * 2 + 1.5) * cellPx;
    const startY = (maze.startCell.row * 2 + 1.5) * cellPx;
    ctx.save();
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(startX, startY, cellPx * 0.34, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 7. Furthest Dead-End Keycard Nodes (Glowing Diamond Icons)
    maze.keycardNodes.forEach((kc) => {
      if (collectedKeycardIds.has(kc.id)) return;
      const kx = (kc.col * 2 + 1.5) * cellPx;
      const ky = (kc.row * 2 + 1.5) * cellPx;
      const r = cellPx * 0.36;

      ctx.save();
      ctx.fillStyle = kc.color;
      ctx.shadowColor = kc.color;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.moveTo(kx, ky - r);
      ctx.lineTo(kx + r, ky);
      ctx.lineTo(kx, ky + r);
      ctx.lineTo(kx - r, ky);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    });

    // 8. Dynamic Extraction Portal Node (Outer Target Ring — Dimmed Amber if Locked, Glowing Violet if Unlocked)
    const objX = (maze.objectiveCell.col * 2 + 1.5) * cellPx;
    const objY = (maze.objectiveCell.row * 2 + 1.5) * cellPx;
    ctx.save();
    const portalColor = telemetry.isExitUnlocked ? neonColor : '#64748b';
    ctx.strokeStyle = portalColor;
    ctx.shadowColor = portalColor;
    ctx.shadowBlur = telemetry.isExitUnlocked ? 18 : 4;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.arc(objX, objY, cellPx * 0.58, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 9. All 4 Weeping Angel Entity Markers + 12-Meter Proximity Rings
    const offsetX = -((maze.voxelCols - 1) * maze.tileSize) / 2;
    const offsetZ = -((maze.voxelRows - 1) * maze.tileSize) / 2;
    const radius12mPx = (12.0 / maze.tileSize) * cellPx;

    angelsPos.forEach((angel) => {
      const angelNormX = (angel.x - offsetX) / maze.tileSize + 0.5;
      const angelNormZ = (angel.z - offsetZ) / maze.tileSize + 0.5;
      const ax = angelNormX * cellPx;
      const ay = angelNormZ * cellPx;

      // Subtle 12-meter proximity trigger ring
      ctx.save();
      ctx.strokeStyle = angel.isQuantumLocked
        ? 'rgba(245, 158, 11, 0.16)'
        : 'rgba(244, 63, 94, 0.34)';
      ctx.setLineDash([4, 4]);
      ctx.lineWidth = 1.1;
      ctx.beginPath();
      ctx.arc(ax, ay, radius12mPx, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ctx.save();
      const angelColor = angel.isQuantumLocked ? '#f59e0b' : '#f43f5e';
      ctx.fillStyle = angelColor;
      ctx.strokeStyle = '#ffffff';
      ctx.shadowColor = angelColor;
      ctx.shadowBlur = 16;
      ctx.lineWidth = 1.5;
      const ar = cellPx * 0.44;
      ctx.beginPath();
      ctx.moveTo(ax, ay - ar);
      ctx.lineTo(ax + ar * 0.9, ay + ar * 0.75);
      ctx.lineTo(ax - ar * 0.9, ay + ar * 0.75);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });

    // 10. Player Position & Volumetric Flashlight Cone Vector
    const normX = (playerWorldPos.x - offsetX) / maze.tileSize + 0.5;
    const normZ = (playerWorldPos.z - offsetZ) / maze.tileSize + 0.5;
    const px = normX * cellPx;
    const py = normZ * cellPx;

    const dirX = -Math.sin(playerWorldPos.yaw);
    const dirZ = -Math.cos(playerWorldPos.yaw);
    const baseAngle = Math.atan2(dirZ, dirX);

    ctx.save();
    const coneGrad = ctx.createRadialGradient(px, py, 2, px, py, cellPx * 3.4);
    coneGrad.addColorStop(0, 'rgba(168, 85, 247, 0.58)');
    coneGrad.addColorStop(1, 'rgba(168, 85, 247, 0.0)');
    ctx.fillStyle = coneGrad;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, cellPx * 3.4, baseAngle - 0.46, baseAngle + 0.46);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.shadowColor = '#a855f7';
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.arc(px, py, cellPx * 0.36, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }, [
    isOpen,
    maze,
    visitedCells,
    collectedKeycardIds,
    playerWorldPos,
    angelsPos,
    neonColor,
    showSolutionPath,
    telemetry.isExitUnlocked,
  ]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-black/80 pointer-events-none select-none"
      role="dialog"
      aria-label="High-Risk Tactical Blueprint Map"
    >
      <div className="w-[min(86vw,760px)] bg-[#070412] border-2 border-violet-500/70 rounded-2xl p-6 shadow-[0_0_80px_rgba(168,85,247,0.38)]">
        {/* Top Blueprint Header */}
        <div className="flex items-center justify-between border-b border-violet-500/30 pb-3.5 mb-4">
          <div>
            <div className="font-display text-lg font-bold tracking-wider text-violet-300">
              TACTICAL LABYRINTH BLUEPRINT // 10×10 GRID ({angelsPos.length} WEEPING ANGELS)
            </div>
            <div className="text-xs text-slate-400 font-mono-tabular mt-0.5">
              Seed #{maze.seed} · WARNING: View Obscured While Holding [M] — Angels Within 12m LoS Will Hunt!
            </div>
          </div>
          <div className="text-right font-mono-tabular">
            <div className="text-xs text-violet-300 font-semibold">
              KEYCARDS: {collectedKeycardIds.size} / {maze.keycardNodes.length} · PORTAL:{' '}
              <span className={telemetry.isExitUnlocked ? 'text-emerald-400' : 'text-amber-300'}>
                {telemetry.isExitUnlocked ? 'UNLOCKED' : 'SEALED'}
              </span>
            </div>
            <div className="text-xs text-slate-400 mt-0.5">
              Closest Angel: {telemetry.angelDistance.toFixed(1)}m · Extraction:{' '}
              {telemetry.distanceToObjective.toFixed(1)}m
            </div>
          </div>
        </div>

        {/* High-Contrast Glowing Violet 2D Map Canvas */}
        <div className="relative mx-auto aspect-square w-full max-w-[540px] rounded-xl overflow-hidden border border-violet-500/50 shadow-[inset_0_0_30px_rgba(168,85,247,0.22)]">
          <canvas ref={canvasRef} width={630} height={630} className="w-full h-full block" />
        </div>

        {/* Blueprint Legend */}
        <div className="mt-4 pt-3 border-t border-violet-500/25 flex flex-wrap items-center justify-between gap-3 text-xs font-mono-tabular text-slate-300">
          <div className="flex items-center gap-3">
            <span>Player: White Core</span>
            <span>·</span>
            <span className="text-rose-400 font-semibold">
              Triangles ({angelsPos.length}): Weeping Angels (12m Ring)
            </span>
            <span>·</span>
            <span className="text-violet-300">Diamonds (3): Violet Keycards</span>
            <span>·</span>
            <span className="text-emerald-400">Ring: Extraction Portal</span>
          </div>
          <div className="text-violet-400 font-semibold">Release [M] to Resume 3D Vision</div>
        </div>
      </div>
    </div>
  );
};
