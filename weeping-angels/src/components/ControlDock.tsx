import React, { useEffect, useRef } from 'react';
import {
  Compass,
  Eye,
  EyeOff,
  Flashlight,
  Footprints,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  Shuffle,
  Volume2,
  VolumeX,
  Navigation,
  Map,
  KeyRound,
  ShieldAlert,
} from 'lucide-react';
import { KeycardNode, MazeData } from '../maze/mazeGenerator';
import { AngelBehaviorMode, AngelPoseState } from '../maze/weepingAngel';

export interface AngelHudMarker {
  id: string;
  index: number;
  x: number;
  z: number;
  isQuantumLocked: boolean;
  poseState: AngelPoseState;
  distanceToPlayer: number;
}

export interface TelemetryState {
  playerRow: number;
  playerCol: number;
  distanceToObjective: number;
  stepsRemaining: number;
  visitedCount: number;
  objectiveReached: boolean;
  isExitUnlocked: boolean;
  elapsedSeconds: number;
  nearbyKeycard: KeycardNode | null;
  angelDistance: number;
  angelQuantumLocked: boolean;
  angelPoseState: AngelPoseState;
  activeHuntingAngelsCount: number;
  totalAngelsCount: number;
  blinkCountdown: number;
}

interface ControlDockProps {
  maze: MazeData;
  telemetry: TelemetryState;
  visitedCells: Set<string>;
  collectedKeycardIds: Set<string>;
  isPointerLocked: boolean;
  cameraMode: 'first-person';
  beamProfile: 'tactical' | 'overdrive' | 'amber';
  onBeamProfileChange: (profile: 'tactical' | 'overdrive' | 'amber') => void;
  angelBehaviorMode: AngelBehaviorMode;
  onAngelBehaviorModeChange: (mode: AngelBehaviorMode) => void;
  onTriggerManualBlink: () => void;
  neonColor: string;
  showSolutionPath: boolean;
  onToggleSolutionPath: () => void;
  edgeTurnEnabled: boolean;
  onToggleEdgeTurn: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isBlueprintOpen: boolean;
  onBlueprintHoldChange: (held: boolean) => void;
  onGenerateNewMaze: () => void;
  onResetPosition: () => void;
  playerWorldPos: { x: number; z: number; yaw: number };
  angelsPos: AngelHudMarker[];
}

export const ControlDock: React.FC<ControlDockProps> = ({
  maze,
  telemetry,
  visitedCells,
  collectedKeycardIds,
  isPointerLocked,
  cameraMode,
  beamProfile,
  onBeamProfileChange,
  angelBehaviorMode,
  onAngelBehaviorModeChange,
  onTriggerManualBlink,
  neonColor,
  showSolutionPath,
  onToggleSolutionPath,
  edgeTurnEnabled,
  onToggleEdgeTurn,
  audioEnabled,
  onToggleAudio,
  isCollapsed,
  onToggleCollapse,
  isBlueprintOpen,
  onBlueprintHoldChange,
  onGenerateNewMaze,
  onResetPosition,
  playerWorldPos,
  angelsPos,
}) => {
  const miniMapCanvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = miniMapCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const size = canvas.width;
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, size, size);

    const vRows = maze.voxelRows;
    const vCols = maze.voxelCols;
    const cellPx = size / vCols;

    // 1. Draw extruded wall cubes and carved passages
    for (let vr = 0; vr < vRows; vr++) {
      for (let vc = 0; vc < vCols; vc++) {
        if (maze.voxelGrid[vr][vc] === 1) {
          ctx.fillStyle = '#1e2532';
          ctx.fillRect(vc * cellPx, vr * cellPx, Math.ceil(cellPx), Math.ceil(cellPx));
        } else {
          const lr = Math.floor((vr - 1) / 2);
          const lc = Math.floor((vc - 1) / 2);
          const isVisited = visitedCells.has(`${lr},${lc}`);
          ctx.fillStyle = isVisited ? '#111927' : '#090c12';
          ctx.fillRect(vc * cellPx, vr * cellPx, Math.ceil(cellPx), Math.ceil(cellPx));
        }
      }
    }

    // 2. Optional shortest solution path
    if (showSolutionPath && maze.solutionPath.length > 1) {
      ctx.strokeStyle = neonColor;
      ctx.lineWidth = 2;
      ctx.beginPath();
      maze.solutionPath.forEach((node, idx) => {
        const vx = (node.col * 2 + 1 + 0.5) * cellPx;
        const vy = (node.row * 2 + 1 + 0.5) * cellPx;
        if (idx === 0) ctx.moveTo(vx, vy);
        else ctx.lineTo(vx, vy);
      });
      ctx.stroke();
    }

    // 3. Draw Start Node (0,0)
    const startX = (maze.startCell.col * 2 + 1 + 0.5) * cellPx;
    const startY = (maze.startCell.row * 2 + 1 + 0.5) * cellPx;
    ctx.fillStyle = '#64748b';
    ctx.beginPath();
    ctx.arc(startX, startY, cellPx * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // 4. Draw Uncollected Keycard Nodes at Furthest Dead-Ends
    maze.keycardNodes.forEach((kc) => {
      if (collectedKeycardIds.has(kc.id)) return;
      const kx = (kc.col * 2 + 1 + 0.5) * cellPx;
      const ky = (kc.row * 2 + 1 + 0.5) * cellPx;
      ctx.fillStyle = kc.color;
      ctx.beginPath();
      ctx.arc(kx, ky, cellPx * 0.48, 0, Math.PI * 2);
      ctx.fill();
    });

    // 4b. Draw Dynamic Extraction Portal Marker (Dimmed Slate if Locked, Glowing Violet Ring if Unlocked)
    const extX = (maze.objectiveCell.col * 2 + 1 + 0.5) * cellPx;
    const extY = (maze.objectiveCell.row * 2 + 1 + 0.5) * cellPx;
    ctx.strokeStyle = telemetry.isExitUnlocked ? '#c084fc' : '#475569';
    ctx.lineWidth = telemetry.isExitUnlocked ? 1.8 : 1.1;
    ctx.beginPath();
    ctx.arc(extX, extY, cellPx * 0.62, 0, Math.PI * 2);
    ctx.stroke();

    // 5. Draw All Weeping Angel Entities (Amber if Quantum-Locked State A, Rose-Crimson if Hunting State B)
    const offsetX = -((maze.voxelCols - 1) * maze.tileSize) / 2;
    const offsetZ = -((maze.voxelRows - 1) * maze.tileSize) / 2;
    angelsPos.forEach((angel) => {
      const angelNormX = (angel.x - offsetX) / maze.tileSize + 0.5;
      const angelNormZ = (angel.z - offsetZ) / maze.tileSize + 0.5;
      const ax = angelNormX * cellPx;
      const ay = angelNormZ * cellPx;
      ctx.fillStyle = angel.isQuantumLocked ? '#f59e0b' : '#f43f5e';
      ctx.beginPath();
      ctx.arc(ax, ay, cellPx * 0.52, 0, Math.PI * 2);
      ctx.fill();
    });

    // 6. Draw Player Position & Flashlight Cone Heading
    const normX = (playerWorldPos.x - offsetX) / maze.tileSize + 0.5;
    const normZ = (playerWorldPos.z - offsetZ) / maze.tileSize + 0.5;
    const px = normX * cellPx;
    const py = normZ * cellPx;

    const dirX = -Math.sin(playerWorldPos.yaw);
    const dirZ = -Math.cos(playerWorldPos.yaw);
    const baseAngle = Math.atan2(dirZ, dirX);

    ctx.fillStyle = 'rgba(219, 234, 254, 0.26)';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.arc(px, py, cellPx * 2.8, baseAngle - 0.42, baseAngle + 0.42);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.arc(px, py, cellPx * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }, [
    maze,
    visitedCells,
    collectedKeycardIds,
    showSolutionPath,
    neonColor,
    playerWorldPos,
    angelsPos,
    telemetry.isExitUnlocked,
  ]);

  const formatTime = (sec: number) => {
    const mins = Math.floor(sec / 60);
    const rem = Math.floor(sec % 60);
    return `${String(mins).padStart(2, '0')}:${String(rem).padStart(2, '0')}`;
  };

  const totalKeycards = maze.keycardNodes.length;
  const collectedCount = collectedKeycardIds.size;

  return (
    <>
      {/* Center Precision Aiming Reticle (Highlights in Violet when in proximity of a Keycard) */}
      {cameraMode === 'first-person' && !isBlueprintOpen && (
        <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div
            className={`w-2.5 h-2.5 rounded-full border transition-transform duration-100 ${
              telemetry.nearbyKeycard
                ? 'border-violet-300 bg-violet-500/60 scale-150 shadow-[0_0_12px_#a855f7]'
                : 'border-white/50 bg-white/15 scale-100'
            }`}
          />
        </div>
      )}

      {/* Minimal Top-Left Spec Header, Keycard Inventory, Extraction Status & Multi-Angel Telemetry */}
      <div className="fixed top-4 left-5 z-20 pointer-events-none select-none">
        <div className="bg-[#08060e]/92 border border-violet-500/35 rounded-lg px-4 py-2.5 shadow-[0_10px_30px_rgba(0,0,0,0.85)]">
          <div className="flex items-center gap-2.5">
            <h1 className="font-display text-sm font-semibold tracking-wider text-violet-100 whitespace-nowrap">
              UMBRA LABYRINTH
            </h1>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-violet-300 font-mono-tabular font-semibold whitespace-nowrap">
              Keycards: {collectedCount} / {totalKeycards}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span
              className={`text-xs font-mono-tabular font-semibold whitespace-nowrap ${
                telemetry.isExitUnlocked ? 'text-emerald-400' : 'text-amber-300/90'
              }`}
            >
              {telemetry.isExitUnlocked
                ? 'EXTRACTION PORTAL: UNLOCKED'
                : `PORTAL LOCKED (${totalKeycards - collectedCount} Keycards Left)`}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span
              className={`text-xs font-mono-tabular font-semibold whitespace-nowrap ${
                telemetry.activeHuntingAngelsCount === 0 ? 'text-violet-300' : 'text-rose-400'
              }`}
            >
              Angels ({telemetry.totalAngelsCount}):{' '}
              {telemetry.activeHuntingAngelsCount === 0
                ? 'ALL QUANTUM LOCKED (State A)'
                : `${telemetry.activeHuntingAngelsCount} HUNTING IN 12M (State B)`}
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-xs text-slate-300 font-mono-tabular whitespace-nowrap">
              Closest: {telemetry.angelDistance.toFixed(1)}m
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-400 font-mono-tabular">
            <span>
              Cell ({telemetry.playerRow}, {telemetry.playerCol})
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-violet-300">
              {telemetry.distanceToObjective.toFixed(1)}m to Sector ({maze.objectiveCell.row},{' '}
              {maze.objectiveCell.col}) Portal
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-violet-200/90">
              12m AI Radius: {telemetry.angelQuantumLocked ? '100% Frozen' : 'Pursuing LoS'} ([B] to Blink)
            </span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span>{formatTime(telemetry.elapsedSeconds)}</span>
            <span className="text-slate-600" aria-hidden="true">
              ·
            </span>
            <span className="text-slate-300">
              {isPointerLocked ? '1:1 Mouse Locked (ESC to Free)' : 'Click View to Lock Mouse'}
            </span>
          </div>
        </div>
      </div>

      {/* Close-Proximity Keycard Pickup Prompt */}
      {telemetry.nearbyKeycard && !isBlueprintOpen && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
          <div className="bg-[#0b0714]/95 border border-violet-500/70 rounded-lg px-4 py-2 shadow-[0_0_24px_rgba(168,85,247,0.35)] flex items-center gap-2.5">
            <KeyRound className="w-4 h-4 shrink-0 text-violet-400" />
            <span className="text-xs font-mono-tabular text-slate-100 whitespace-nowrap">
              Click on Keycard to Collect:{' '}
              <strong className="text-violet-300">{telemetry.nearbyKeycard.label}</strong>
            </span>
          </div>
        </div>
      )}

      {/* Extraction Portal Locked Prompt when standing near the portal with < 3 keycards */}
      {!telemetry.isExitUnlocked &&
        telemetry.distanceToObjective < 2.5 &&
        !telemetry.nearbyKeycard &&
        !isBlueprintOpen && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
            <div className="bg-[#0b0714]/95 border border-amber-500/70 rounded-lg px-4 py-2 shadow-[0_0_24px_rgba(245,158,11,0.3)] flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="text-xs font-mono-tabular text-slate-100 whitespace-nowrap">
                EXTRACTION PORTAL SEALED — Collect All 3 Violet Keycards ({collectedCount} /{' '}
                {totalKeycards}) to Unlock!
              </span>
            </div>
          </div>
        )}

      {/* Extraction Portal Active Alert Banner once all 3 Violet Keycards are collected */}
      {telemetry.isExitUnlocked &&
        !telemetry.objectiveReached &&
        !telemetry.nearbyKeycard &&
        !isBlueprintOpen && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none">
            <div className="bg-[#0b0714]/95 border border-emerald-500/70 rounded-lg px-4 py-2 shadow-[0_0_24px_rgba(16,185,129,0.35)] flex items-center gap-2.5">
              <Navigation className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="text-xs font-mono-tabular text-slate-100 whitespace-nowrap">
                ALL 3 KEYCARDS VERIFIED — Enter Pulsing Extraction Portal at Sector (
                <strong className="text-emerald-300">
                  {maze.objectiveCell.row}, {maze.objectiveCell.col}
                </strong>
                ) · <strong className="text-violet-300">{telemetry.distanceToObjective.toFixed(1)}m</strong>
              </span>
            </div>
          </div>
        )}

      {/* Unified Collapsible Bottom Control Dock */}
      <div
        className="fixed left-1/2 -translate-x-1/2 z-20 transition-transform duration-200 ease-out pointer-events-auto"
        style={{
          bottom: '16px',
          width: 'min(1040px, 96vw)',
          transform: isCollapsed ? 'translate(-50%, calc(100% - 28px))' : 'translate(-50%, 0)',
        }}
      >
        <div className="flex justify-center">
          <button
            onClick={onToggleCollapse}
            title="Toggle Controls (Shortcut: H)"
            className="flex items-center gap-1.5 px-3.5 py-1 bg-[#0b0814] border border-b-0 border-violet-500/35 rounded-t-lg text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5 text-violet-400" />
                <span>Show Controls (H)</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5 text-violet-400" />
                <span>Hide Controls (H)</span>
              </>
            )}
          </button>
        </div>

        <div className="bg-[#090712]/95 border border-violet-500/35 rounded-xl p-3.5 shadow-[0_16px_48px_rgba(0,0,0,0.9)]">
          <div className="flex flex-wrap lg:flex-nowrap items-center justify-between gap-3.5">
            {/* Zone 1: 10x10 Topological Mini-Map + Keycard Inventory & Blueprint Trigger */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="relative w-20 h-20 rounded-lg overflow-hidden border border-violet-500/40 bg-[#07090d] shrink-0">
                <canvas
                  ref={miniMapCanvasRef}
                  width={126}
                  height={126}
                  className="w-full h-full block"
                />
              </div>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-200 whitespace-nowrap">
                    Keycards:
                  </span>
                  <span className="text-xs font-mono-tabular font-bold text-violet-300 whitespace-nowrap">
                    {collectedCount} / {totalKeycards}
                  </span>
                  <span className="text-slate-600">·</span>
                  <span
                    className={`text-[11px] font-mono-tabular font-semibold whitespace-nowrap ${
                      telemetry.angelQuantumLocked ? 'text-violet-300' : 'text-rose-400'
                    }`}
                  >
                    Angel: {telemetry.angelDistance.toFixed(1)}m
                  </span>
                </div>
                <div className="text-[11px] text-slate-400 font-mono-tabular whitespace-nowrap">
                  {maze.deadEndCount} Dead-Ends · {maze.landmarks.length} Wall Decals
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <button
                    onPointerDown={() => onBlueprintHoldChange(true)}
                    onPointerUp={() => onBlueprintHoldChange(false)}
                    onPointerLeave={() => onBlueprintHoldChange(false)}
                    title="Hold 'M' key or hold this button to open the full-screen High-Risk Blueprint Map"
                    className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      isBlueprintOpen
                        ? 'bg-violet-500 text-white font-semibold'
                        : 'bg-violet-500/20 text-violet-300 border border-violet-500/45 hover:bg-violet-500/30'
                    }`}
                  >
                    <Map className="w-3 h-3" />
                    <span>Hold [M] Blueprint</span>
                  </button>
                  <button
                    onClick={onTriggerManualBlink}
                    title="Simulate an eyelid blink (Shortcut: B) — briefly breaks Quantum-Lock!"
                    className="flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium bg-rose-500/15 text-rose-300 border border-rose-500/40 hover:bg-rose-500/25 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <EyeOff className="w-3 h-3" />
                    <span>[B] Blink</span>
                  </button>
                  <button
                    onClick={onToggleSolutionPath}
                    className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      showSolutionPath
                        ? 'bg-violet-500/25 text-violet-200 border border-violet-500/50'
                        : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-slate-200'
                    }`}
                  >
                    <Navigation className="w-3 h-3" />
                    <span>Path</span>
                  </button>
                </div>
              </div>
            </div>

            <div className="hidden lg:block w-px h-14 bg-violet-950/70 shrink-0" />

            {/* Zone 2: Weeping Angel Entity Mode & Locked First-Person / Beam Controls */}
            <div className="flex flex-col gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                <span className="text-[11px] text-slate-400 mr-0.5 whitespace-nowrap">Angel:</span>
                <div className="flex items-center gap-1 p-0.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                  {(
                    [
                      { id: 'quantum-ai', label: 'Quantum Hunt AI' },
                      { id: 'inspect-passive', label: 'State A (Weeping)' },
                      { id: 'inspect-aggressive', label: 'State B (Screaming)' },
                    ] as const
                  ).map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() => onAngelBehaviorModeChange(mode.id)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        angelBehaviorMode === mode.id
                          ? 'bg-violet-500/25 text-violet-200 border border-violet-500/50'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-2.5 py-1 bg-violet-950/35 border border-violet-500/40 rounded-lg">
                  <Footprints className="w-3 h-3 text-violet-400 shrink-0" />
                  <span className="text-[11px] font-semibold text-violet-200 whitespace-nowrap">
                    First-Person (WASD)
                  </span>
                </div>

                <div className="flex items-center gap-1 p-0.5 bg-slate-900/90 border border-slate-800 rounded-lg">
                  <Flashlight className="w-3 h-3 text-violet-400 ml-1.5 shrink-0" />
                  {(['tactical', 'overdrive', 'amber'] as const).map((profile) => (
                    <button
                      key={profile}
                      onClick={() => onBeamProfileChange(profile)}
                      className={`px-2 py-0.5 rounded text-[11px] font-medium capitalize transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        beamProfile === profile
                          ? 'bg-violet-500/25 text-violet-200 border border-violet-500/50'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {profile}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="hidden lg:block w-px h-14 bg-violet-950/70 shrink-0" />

            {/* Zone 3: Violet Accent Status + Maze Actions & Controls Legend */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] text-slate-400 whitespace-nowrap">Accent:</span>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-violet-500/25 text-violet-200 border border-violet-500/50 whitespace-nowrap">
                    Violet (#a855f7)
                  </span>
                  <button
                    onClick={onToggleEdgeTurn}
                    title="Toggle screen-edge yaw turning when pointer is unlocked"
                    className={`flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer border ${
                      edgeTurnEnabled
                        ? 'bg-violet-500/25 text-violet-200 border-violet-500/50'
                        : 'bg-slate-900 text-slate-500 border-slate-800 hover:text-slate-300'
                    }`}
                  >
                    <Compass className="w-3 h-3" />
                    <span>Edge</span>
                  </button>
                </div>

                <div className="text-[11px] text-slate-400 font-mono-tabular whitespace-nowrap">
                  Move: <span className="text-slate-200">WASD</span> · Jump:{' '}
                  <span className="text-slate-200">Space</span> · Blink:{' '}
                  <span className="text-rose-300">B</span> · Map:{' '}
                  <span className="text-violet-300">Hold M</span>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={onResetPosition}
                  title="Reset Sector & Respawn Weeping Angel"
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={onToggleAudio}
                  title={audioEnabled ? 'Mute Audio' : 'Enable Audio'}
                  className="p-2 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  {audioEnabled ? (
                    <Volume2 className="w-4 h-4 text-violet-400" />
                  ) : (
                    <VolumeX className="w-4 h-4 text-slate-500" />
                  )}
                </button>
                <button
                  onClick={onGenerateNewMaze}
                  className="flex items-center gap-1.5 px-3 py-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold text-xs rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-[0_0_18px_rgba(168,85,247,0.4)]"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  <span>New 10×10</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};
