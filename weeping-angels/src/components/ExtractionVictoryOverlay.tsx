import React, { useEffect, useRef, useState } from 'react';
import { KeyRound, Compass, Timer, Play, RotateCcw, Skull } from 'lucide-react';
import { MazeData } from '../maze/mazeGenerator';
import { soundEngine } from '../maze/soundEffects';

export type ExtractionPhase = 'none' | 'teleporting' | 'victory' | 'main-menu';

interface ExtractionVictoryOverlayProps {
  phase: ExtractionPhase;
  teleportProgress: number; // 0.0 to 1.0
  finalEscapeTimeMs: number;
  collectedKeycardsCount: number;
  totalKeycardsCount: number;
  visitedCount: number;
  totalAngelsCount: number;
  maze: MazeData;
  onReturnToMainMenu: () => void;
  onDeployNewMaze: () => void;
  onReplayCurrentSector: () => void;
}

/**
 * Classy, chilling horror victory header catchphrase pool for "Weeping Angels: The Final Gaze"
 */
const HORROR_VICTORY_HEADERS: readonly string[] = [
  'TEMPORARY RESPITE',
  "TIME'S GRUDGING MERCY",
  'A FLEETING ESCAPE',
  'BORROWED TIME',
  'MERCY OF THE STONE',
  'WHISPERS IN THE DARK',
  'BREATHING ROOM',
  'MOMENTARY LUCK',
];

/**
 * Formats milliseconds into exact Minutes:Seconds:Milliseconds (MM:SS:MS).
 */
export function formatExactEscapeTime(ms: number): string {
  const clamped = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.floor(clamped / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  const millis = Math.floor((clamped % 1000) / 10);
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}:${String(
    millis
  ).padStart(2, '0')}`;
}

export const ExtractionVictoryOverlay: React.FC<ExtractionVictoryOverlayProps> = ({
  phase,
  teleportProgress,
  finalEscapeTimeMs,
  collectedKeycardsCount,
  totalKeycardsCount,
  visitedCount,
  totalAngelsCount,
  maze,
  onReturnToMainMenu,
  onDeployNewMaze,
  onReplayCurrentSector,
}) => {
  const warpCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cathedralCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [victoryHeader, setVictoryHeader] = useState<string>(HORROR_VICTORY_HEADERS[0]);
  const lastHeaderIdxRef = useRef<number>(-1);

  // Randomly select ONE horror header from the 8-item catchphrase pool when the victory screen triggers
  useEffect(() => {
    if (phase !== 'victory') return;
    let idx = Math.floor(Math.random() * HORROR_VICTORY_HEADERS.length);
    if (idx === lastHeaderIdxRef.current && HORROR_VICTORY_HEADERS.length > 1) {
      idx = (idx + 1) % HORROR_VICTORY_HEADERS.length;
    }
    lastHeaderIdxRef.current = idx;
    setVictoryHeader(HORROR_VICTORY_HEADERS[idx]);
  }, [phase]);

  // Keyboard shortcut support on Victory & Main Menu screens
  useEffect(() => {
    if (phase !== 'victory' && phase !== 'main-menu') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        onDeployNewMaze();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [phase, onDeployNewMaze]);

  // Render the VHS Static / Dimensional Distortion Burst if 'teleporting' phase is active
  useEffect(() => {
    if (phase !== 'teleporting') return;
    const canvas = warpCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const p = Math.min(1, Math.max(0, teleportProgress));

    ctx.clearRect(0, 0, w, h);

    const cx = w * 0.5;
    const cy = h * 0.5;
    const maxRadius = Math.hypot(cx, cy) * (0.35 + p * 1.45);

    const radialGrad = ctx.createRadialGradient(cx, cy, 2, cx, cy, maxRadius);
    const whiteFlash = Math.pow(p, 2.2);
    radialGrad.addColorStop(0, `rgba(255, 255, 255, ${Math.min(1, 0.35 + whiteFlash * 0.95)})`);
    radialGrad.addColorStop(0.45, `rgba(220, 38, 38, ${Math.min(0.85, 0.25 + p * 0.65)})`);
    radialGrad.addColorStop(1, `rgba(6, 2, 4, ${Math.min(0.96, p * 0.92)})`);

    ctx.fillStyle = radialGrad;
    ctx.fillRect(0, 0, w, h);
  }, [phase, teleportProgress]);

  // Render the Gothic Cathedral Video Intro Loop when in 'main-menu'
  useEffect(() => {
    if (phase !== 'main-menu') return;
    const canvas = cathedralCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = 0;
    const startTime = performance.now();

    // Pre-generate drifting cathedral ash motes
    const motes = Array.from({ length: 65 }, (_, i) => ({
      x: ((i * 73) % 100) / 100,
      y: ((i * 41) % 100) / 100,
      r: 0.7 + (i % 4) * 0.55,
      speedY: 0.008 + (i % 5) * 0.004,
      driftX: 0.006 + (i % 3) * 0.003,
      phase: i * 1.3,
    }));

    const renderCathedralFrame = (now: number) => {
      const t = (now - startTime) * 0.001;
      const w = canvas.width;
      const h = canvas.height;

      // 1. Deep nocturnal gothic nave gradient
      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#040205');
      bgGrad.addColorStop(0.48, '#0c0509');
      bgGrad.addColorStop(1, '#020103');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      // 2. Gothic Stained-Glass Rose Window & Moonlight God-Rays
      const cx = w * 0.5;
      const roseY = h * 0.26;
      const pulse = 0.85 + Math.sin(t * 1.7) * 0.12 + Math.sin(t * 7.3) * 0.03;

      const roseGlow = ctx.createRadialGradient(cx, roseY, 6, cx, roseY, h * 0.52);
      roseGlow.addColorStop(0, `rgba(185, 28, 28, ${0.28 * pulse})`);
      roseGlow.addColorStop(0.35, `rgba(127, 29, 29, ${0.14 * pulse})`);
      roseGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = roseGlow;
      ctx.fillRect(0, 0, w, h);

      // Rose Window Tracery Geometry
      ctx.save();
      ctx.translate(cx, roseY);
      ctx.strokeStyle = `rgba(220, 38, 38, ${0.22 * pulse})`;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(0, 0, h * 0.14, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 12; i++) {
        const angle = (i * Math.PI) / 6 + t * 0.03;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.cos(angle) * h * 0.14, Math.sin(angle) * h * 0.14);
        ctx.stroke();
      }
      ctx.restore();

      // 3. Towering Pointed Gothic Cathedral Ribbed Vault Arches
      ctx.save();
      for (let archIdx = 0; archIdx < 4; archIdx++) {
        const depthScale = 0.42 + archIdx * 0.22;
        const archHalfW = w * 0.36 * depthScale;
        const pillarBaseY = h;
        const archPeakY = h * (0.18 - archIdx * 0.035);

        ctx.strokeStyle = `rgba(38, 20, 26, ${0.75 - archIdx * 0.12})`;
        ctx.lineWidth = 4 + archIdx * 3;
        ctx.beginPath();
        ctx.moveTo(cx - archHalfW, pillarBaseY);
        ctx.lineTo(cx - archHalfW, h * 0.42);
        ctx.quadraticCurveTo(cx - archHalfW * 0.65, archPeakY, cx, archPeakY);
        ctx.quadraticCurveTo(cx + archHalfW * 0.65, archPeakY, cx + archHalfW, h * 0.42);
        ctx.lineTo(cx + archHalfW, pillarBaseY);
        ctx.stroke();
      }
      ctx.restore();

      // 4. Central Weeping Angel Stone Silhouette in the Cathedral Nave
      ctx.save();
      const angelY = h * 0.66;
      const wingSpan = h * 0.22;
      ctx.fillStyle = '#070407';
      ctx.strokeStyle = `rgba(185, 28, 28, ${0.28 * pulse})`;
      ctx.lineWidth = 1.2;

      // Left & Right Stone Wings
      for (const dir of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(cx + dir * 10, angelY - 18);
        ctx.bezierCurveTo(
          cx + dir * wingSpan * 0.85,
          angelY - wingSpan * 0.95,
          cx + dir * wingSpan * 1.05,
          angelY - wingSpan * 0.1,
          cx + dir * 18,
          angelY + 45
        );
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }

      // Draped Robe & Weeping Head
      ctx.beginPath();
      ctx.arc(cx, angelY - 34, 13, 0, Math.PI * 2);
      ctx.moveTo(cx - 24, angelY + 95);
      ctx.lineTo(cx - 14, angelY - 20);
      ctx.lineTo(cx + 14, angelY - 20);
      ctx.lineTo(cx + 24, angelY + 95);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();

      // 5. Drifting Cathedral Ash & Dust Particles
      ctx.save();
      for (let i = 0; i < motes.length; i++) {
        const m = motes[i];
        const py = ((m.y - t * m.speedY) % 1 + 1) % 1;
        const px = ((m.x + Math.sin(t * 0.7 + m.phase) * m.driftX) % 1 + 1) % 1;
        const alpha = 0.15 + 0.35 * Math.sin(t * 1.8 + m.phase);
        ctx.fillStyle = i % 3 === 0 ? `rgba(239, 68, 68, ${alpha})` : `rgba(226, 232, 240, ${alpha * 0.65})`;
        ctx.beginPath();
        ctx.arc(px * w, py * h, m.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();

      // 6. Heavy Gothic Vignette & Film Grain Scanlines
      const vig = ctx.createRadialGradient(cx, h * 0.5, h * 0.12, cx, h * 0.5, h * 0.78);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0.12)');
      vig.addColorStop(0.7, 'rgba(4, 1, 3, 0.76)');
      vig.addColorStop(1, 'rgba(0, 0, 0, 0.96)');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, w, h);

      animId = requestAnimationFrame(renderCathedralFrame);
    };

    animId = requestAnimationFrame(renderCathedralFrame);
    return () => cancelAnimationFrame(animId);
  }, [phase]);

  if (phase === 'none' || phase === 'main-menu') return null;

  // PHASE 1: BRIEF TELEPORT TRANSITION (IF TRIGGERED)
  if (phase === 'teleporting') {
    return (
      <div
        className="fixed inset-0 z-50 pointer-events-none select-none flex items-center justify-center"
        aria-live="polite"
      >
        <canvas
          ref={warpCanvasRef}
          width={640}
          height={360}
          className="absolute inset-0 w-full h-full block"
        />
      </div>
    );
  }

  // PHASE 2: VICTORY / ROUND-CLEAR SCREEN ("WEEPING ANGELS: THE FINAL GAZE")
  if (phase === 'victory') {
    const formattedEscapeTime = formatExactEscapeTime(finalEscapeTimeMs);
    const verifiedKeycards = Math.max(3, collectedKeycardsCount);
    const totalKeycards = Math.max(3, totalKeycardsCount);

    return (
      <div
        className="fixed inset-0 z-50 text-slate-100 flex items-center justify-center p-4 md:p-8 select-none pointer-events-auto overflow-y-auto"
        role="dialog"
        aria-label="Weeping Angels: The Final Gaze — Round Clear Screen"
      >
        {/* Heavy Motion-Blur Streak & Dark Vignette Filter Over Frozen 3D World */}
        <div
          className="fixed inset-0 pointer-events-none backdrop-blur-md"
          style={{
            background:
              'radial-gradient(circle at 50% 50%, rgba(12, 3, 6, 0.48) 0%, rgba(6, 2, 4, 0.84) 64%, rgba(0, 0, 0, 0.96) 100%)',
          }}
        />
        <div
          className="fixed inset-0 pointer-events-none opacity-30"
          style={{
            backgroundImage:
              'repeating-linear-gradient(0deg, rgba(185, 28, 28, 0.1) 0px, rgba(185, 28, 28, 0.1) 1px, transparent 1px, transparent 3px)',
          }}
        />

        {/* Semi-Transparent, Suffocatingly Dark Obsidian Card with Faint Blood-Tinted Edge Glow */}
        <div
          className="relative z-10 w-full max-w-2xl rounded-2xl p-6 sm:p-9 border border-red-900/65 bg-[#050307]/88 backdrop-blur-xl"
          style={{
            boxShadow:
              '0 0 75px rgba(185, 28, 28, 0.28), 0 0 22px rgba(220, 38, 38, 0.18), inset 0 0 42px rgba(127, 29, 29, 0.22)',
          }}
        >
          {/* Top Faint Blood-Tinted Accent Line */}
          <div className="flex items-center justify-between gap-2 pb-4 border-b border-red-950/80 text-[11px] font-mono-tabular tracking-[0.25em] text-red-400/80 uppercase">
            <span>WEEPING ANGELS: THE FINAL GAZE</span>
            <span className="px-2.5 py-0.5 rounded bg-red-950/60 border border-red-800/50 text-red-300 font-semibold">
              SECTOR #{maze.seed.toString(16).toUpperCase().slice(0, 6)} CLEARED
            </span>
          </div>

          {/* 2. Randomized Horror Victory Header (Catchphrase Pool) + Sub-Line */}
          <div className="mt-6 text-center">
            <h1
              className="font-display text-3xl sm:text-5xl font-bold tracking-[0.18em] text-white uppercase"
              style={{
                textShadow:
                  '0 0 32px rgba(220, 38, 38, 0.72), 0 2px 10px rgba(0, 0, 0, 0.95)',
              }}
            >
              {victoryHeader}
            </h1>
            <p className="mt-2.5 font-mono-tabular text-xs sm:text-sm tracking-[0.36em] text-red-400/95 font-semibold uppercase">
              &ldquo;YOU ESCAPED... FOR NOW&rdquo;
            </p>
          </div>

          {/* 3. Round-Clear Metrics */}
          <div className="mt-7 grid grid-cols-1 sm:grid-cols-3 gap-3.5 font-mono-tabular">
            {/* Metric 1: FINAL ESCAPE TIME: (MM:SS:MS) */}
            <div className="bg-[#09050c]/90 border border-red-900/45 rounded-xl p-4 text-center shadow-[inset_0_0_24px_rgba(127,29,29,0.18)]">
              <div className="flex items-center justify-center gap-1.5 text-[10px] tracking-[0.2em] text-red-300/80 uppercase">
                <Timer className="w-3.5 h-3.5 text-red-500" />
                <span>FINAL ESCAPE TIME:</span>
              </div>
              <div
                className="mt-2 text-2xl sm:text-3xl font-bold tracking-[0.1em] text-white"
                style={{ textShadow: '0 0 18px rgba(239, 68, 68, 0.55)' }}
              >
                {formattedEscapeTime}
              </div>
              <div className="mt-1 text-[10px] tracking-widest text-slate-500 uppercase">
                (MM:SS:MS)
              </div>
            </div>

            {/* Metric 2: KEYCARDS VERIFIED: 3 / 3 */}
            <div className="bg-[#09050c]/90 border border-red-900/45 rounded-xl p-4 text-center shadow-[inset_0_0_24px_rgba(127,29,29,0.18)]">
              <div className="flex items-center justify-center gap-1.5 text-[10px] tracking-[0.2em] text-red-300/80 uppercase">
                <KeyRound className="w-3.5 h-3.5 text-red-500" />
                <span>KEYCARDS VERIFIED:</span>
              </div>
              <div
                className="mt-2 text-2xl sm:text-3xl font-bold tracking-[0.1em] text-white"
                style={{ textShadow: '0 0 18px rgba(239, 68, 68, 0.55)' }}
              >
                {verifiedKeycards} / {totalKeycards}
              </div>
              <div className="mt-1 text-[10px] tracking-widest text-slate-500 uppercase">
                PORTAL SEAL UNLOCKED
              </div>
            </div>

            {/* Metric 3: CELLS EXPLORED: [X] / 100 */}
            <div className="bg-[#09050c]/90 border border-red-900/45 rounded-xl p-4 text-center shadow-[inset_0_0_24px_rgba(127,29,29,0.18)]">
              <div className="flex items-center justify-center gap-1.5 text-[10px] tracking-[0.2em] text-red-300/80 uppercase">
                <Compass className="w-3.5 h-3.5 text-red-500" />
                <span>CELLS EXPLORED:</span>
              </div>
              <div
                className="mt-2 text-2xl sm:text-3xl font-bold tracking-[0.1em] text-white"
                style={{ textShadow: '0 0 18px rgba(239, 68, 68, 0.55)' }}
              >
                {visitedCount} / 100
              </div>
              <div className="mt-1 text-[10px] tracking-widest text-slate-500 uppercase">
                10×10 CONTAINMENT GRID
              </div>
            </div>
          </div>

          {/* Styled Psychological Quote Box */}
          <div className="mt-6 px-5 py-4 bg-[#080306]/95 border-l-2 border-red-600 border-y border-r border-red-950/60 rounded-r-xl shadow-[inset_0_0_28px_rgba(127,29,29,0.16)]">
            <p className="font-serif italic text-base sm:text-lg text-slate-100/95 leading-relaxed">
              &ldquo;The labyrinth released your body, but the sound of grinding granite will echo
              behind your eyes every time the lights go out.&rdquo;
            </p>
            <div className="mt-2.5 text-[11px] font-mono-tabular text-red-400/85 uppercase tracking-[0.18em]">
              — PROJECT 27 PSYCHOLOGICAL DEBRIEFING // CELLS EXPLORED: {visitedCount} / 100
            </div>
          </div>

          {/* 4. Interactive Next Round & Menu Flow Buttons */}
          <div className="mt-7 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3.5 pt-5 border-t border-red-950/80">
            <button
              onClick={() => {
                soundEngine.playButtonClick();
                onDeployNewMaze();
              }}
              onMouseEnter={() => soundEngine.playButtonHover()}
              className="flex-1 py-3.5 px-5 bg-red-700 hover:bg-red-600 text-white border border-red-400/60 font-mono-tabular text-xs sm:text-sm font-bold tracking-[0.18em] uppercase rounded-xl transition-all cursor-pointer shadow-[0_0_28px_rgba(220,38,38,0.55)] hover:shadow-[0_0_38px_rgba(239,68,68,0.8)] text-center"
            >
              [ ENTER THE NEXT LABYRINTH ]
            </button>

            <button
              onClick={() => {
                soundEngine.playButtonClick();
                onReturnToMainMenu();
              }}
              onMouseEnter={() => soundEngine.playButtonHover()}
              className="py-3.5 px-5 bg-white/10 hover:bg-white/20 text-white border border-white/40 hover:border-red-400/70 font-mono-tabular text-xs sm:text-sm font-bold tracking-[0.18em] uppercase rounded-xl transition-all cursor-pointer shadow-[0_0_22px_rgba(255,255,255,0.18)] hover:shadow-[0_0_30px_rgba(220,38,38,0.45)] text-center whitespace-nowrap"
            >
              [ RETURN TO MAIN MENU ]
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
};
