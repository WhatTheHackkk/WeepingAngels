import React from 'react';
import {
  RotateCcw,
  Volume2,
  VolumeX,
  Pause,
  KeyRound,
  Navigation,
  Eye,
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
  onTogglePause?: () => void;
  onReturnToMainMenu?: () => void;
  playerWorldPos: { x: number; z: number; yaw: number };
  angelsPos: AngelHudMarker[];
}

export const ControlDock: React.FC<ControlDockProps> = ({
  maze,
  telemetry,
  collectedKeycardIds,
  isPointerLocked,
  cameraMode,
  audioEnabled,
  onToggleAudio,
  isBlueprintOpen,
  onResetPosition,
  onTogglePause,
  onReturnToMainMenu,
}) => {
  const totalKeycards = maze.keycardNodes.length;
  const collectedCount = collectedKeycardIds.size;

  return (
    <>
      {/* Center Precision Aiming Reticle (Glows softly when near a keycard) */}
      {cameraMode === 'first-person' && !isBlueprintOpen && (
        <div className="fixed inset-0 z-10 pointer-events-none flex items-center justify-center">
          <div
            className={`w-2 h-2 rounded-full border transition-all duration-150 ${
              telemetry.nearbyKeycard
                ? 'border-violet-300 bg-violet-400/80 scale-150 shadow-[0_0_16px_#c084fc]'
                : 'border-[#c5a059]/40 bg-white/20 scale-100'
            }`}
          />
        </div>
      )}

      {/* TOP-LEFT MINIMALIST CONTROLS: Replay/Restart Sector, Pause Game, Mute Audio */}
      <div className="fixed top-5 left-5 z-30 pointer-events-auto flex items-center gap-2.5 font-ancient">
        {/* Replay / Restart Sector Button */}
        <button
          onClick={onResetPosition}
          title="Replay / Restart Sector (Take to starting point)"
          aria-label="Restart Sector"
          className="p-3 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-[#c5a059]/40 text-[#d4af37] hover:text-white hover:border-[#ffd700] hover:shadow-[0_0_18px_rgba(212,175,55,0.5)] transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.8)] active:scale-95"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        {/* Pause Game Button */}
        {(onTogglePause || onReturnToMainMenu) && (
          <button
            onClick={onTogglePause || onReturnToMainMenu}
            title="Pause Game (Resume or Return to Menu)"
            aria-label="Pause Game"
            className="p-3 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-[#c5a059]/40 text-[#d4af37] hover:text-white hover:border-[#ffd700] hover:shadow-[0_0_18px_rgba(212,175,55,0.5)] transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.8)] active:scale-95"
          >
            <Pause className="w-4 h-4" />
          </button>
        )}

        {/* Audio Mute/Unmute Button */}
        <button
          onClick={onToggleAudio}
          title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
          aria-label={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
          className="p-3 rounded-full bg-black/60 hover:bg-black/90 backdrop-blur-md border border-[#c5a059]/40 text-[#d4af37] hover:text-white hover:border-[#ffd700] hover:shadow-[0_0_18px_rgba(212,175,55,0.5)] transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.8)] active:scale-95"
        >
          {audioEnabled ? (
            <Volume2 className="w-4 h-4 text-[#d4af37]" />
          ) : (
            <VolumeX className="w-4 h-4 text-slate-500" />
          )}
        </button>
      </div>

      {/* TOP-RIGHT SUBTLE OBJECTIVE GLYPHS (3 Violet Sigils) */}
      <div className="fixed top-5 right-5 z-20 pointer-events-none select-none font-ancient">
        <div className="bg-black/60 backdrop-blur-md border border-[#c5a059]/35 rounded-xl px-4 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.85)] flex items-center gap-3">
          <KeyRound className="w-4 h-4 text-[#c084fc]" />
          <span className="text-xs text-[#e2d8c3] tracking-[0.2em] uppercase font-bold">
            SEALS:
          </span>
          <div className="flex items-center gap-1.5 text-sm">
            {Array.from({ length: totalKeycards }).map((_, idx) => {
              const isCollected = idx < collectedCount;
              return (
                <span
                  key={idx}
                  className={`transition-all duration-300 ${
                    isCollected
                      ? 'text-[#c084fc] drop-shadow-[0_0_8px_#c084fc]'
                      : 'text-slate-600'
                  }`}
                >
                  {isCollected ? '◆' : '◇'}
                </span>
              );
            })}
          </div>
          <span className="text-xs font-mono-tabular text-slate-400">
            [{collectedCount} / {totalKeycards}]
          </span>
        </div>
      </div>

      {/* CONTEXTUAL PROMPT: Close-Proximity Keycard Pickup */}
      {telemetry.nearbyKeycard && !isBlueprintOpen && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none font-ancient">
          <div className="bg-black/85 backdrop-blur-md border border-[#c084fc]/70 rounded-xl px-5 py-2.5 shadow-[0_0_24px_rgba(192,132,252,0.45)] flex items-center gap-2.5 animate-pulse">
            <KeyRound className="w-4 h-4 shrink-0 text-[#c084fc]" />
            <span className="text-xs tracking-[0.18em] text-[#f5edff] uppercase font-bold">
              CLICK KEYCARD TO CLAIM VIOLET SEAL
            </span>
          </div>
        </div>
      )}

      {/* CONTEXTUAL PROMPT: Extraction Portal Locked */}
      {!telemetry.isExitUnlocked &&
        telemetry.distanceToObjective < 3.0 &&
        !telemetry.nearbyKeycard &&
        !isBlueprintOpen && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none font-ancient">
            <div className="bg-black/85 backdrop-blur-md border border-amber-500/70 rounded-xl px-5 py-2.5 shadow-[0_0_24px_rgba(245,158,11,0.4)] flex items-center gap-2.5">
              <KeyRound className="w-4 h-4 shrink-0 text-amber-400" />
              <span className="text-xs tracking-[0.16em] text-[#fef3c7] uppercase font-bold">
                PORTAL SEALED — RECOVER ALL 3 VIOLET SEALS ({collectedCount} / {totalKeycards})
              </span>
            </div>
          </div>
        )}

      {/* CONTEXTUAL PROMPT: Extraction Portal Active */}
      {telemetry.isExitUnlocked &&
        !telemetry.objectiveReached &&
        !telemetry.nearbyKeycard &&
        !isBlueprintOpen && (
          <div className="fixed top-24 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none font-ancient">
            <div className="bg-black/85 backdrop-blur-md border border-emerald-500/80 rounded-xl px-5 py-2.5 shadow-[0_0_30px_rgba(16,185,129,0.55)] flex items-center gap-2.5 animate-bounce">
              <Navigation className="w-4 h-4 shrink-0 text-emerald-400" />
              <span className="text-xs tracking-[0.18em] text-emerald-200 uppercase font-bold">
                GATEWAY AWAKENED — ENTER THE PULSING EXTRACTION BEACON
              </span>
            </div>
          </div>
        )}

      {/* SUBTLE BOTTOM HINT: Hold M for Map · B to Blink */}
      {!isBlueprintOpen && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 pointer-events-none select-none font-ancient">
          <div className="px-3.5 py-1 rounded-full bg-black/40 backdrop-blur-sm border border-[#c5a059]/20 text-[10px] sm:text-[11px] text-[#c5a059]/60 tracking-[0.25em] uppercase">
            [ HOLD M: BLUEPRINT MAP · B: BLINK {isPointerLocked ? '' : '· CLICK VIEW TO LOCK MOUSE'} ]
          </div>
        </div>
      )}
    </>
  );
};
