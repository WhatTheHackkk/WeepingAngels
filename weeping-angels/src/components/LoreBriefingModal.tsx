import React, { useEffect, useState } from 'react';
import { ShieldAlert, KeyRound, Eye, Compass, Terminal, ArrowRight, CornerDownLeft } from 'lucide-react';
import { soundEngine } from '../maze/soundEffects';

interface LoreBriefingModalProps {
  onBreachContainment: () => void;
  onBackToMenu: () => void;
}

export const LoreBriefingModal: React.FC<LoreBriefingModalProps> = ({
  onBreachContainment,
  onBackToMenu,
}) => {
  const [typedChars, setTypedChars] = useState(0);

  useEffect(() => {
    soundEngine.playBreachAlarm();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        soundEngine.playButtonClick();
        onBreachContainment();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        soundEngine.playButtonClick();
        onBackToMenu();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBreachContainment, onBackToMenu]);

  // Fast typewriter effect for terminal feeling
  useEffect(() => {
    const timer = setInterval(() => {
      setTypedChars((prev) => prev + 1);
    }, 18);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/92 backdrop-blur-xl flex items-center justify-center p-4 md:p-8 select-none pointer-events-auto overflow-y-auto"
      role="dialog"
      aria-label="Classified Lore and Briefing Warning Dossier"
    >
      {/* CRT Scanline Overlay */}
      <div
        className="fixed inset-0 pointer-events-none opacity-25"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(239, 68, 68, 0.12) 0px, rgba(239, 68, 68, 0.12) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* Main Terminal Dossier Card */}
      <div
        className="relative z-10 w-full max-w-3xl rounded-2xl p-6 sm:p-9 border border-red-900/80 bg-[#060308]/95 backdrop-blur-2xl text-slate-100 shadow-[0_0_80px_rgba(220,38,38,0.35),inset_0_0_40px_rgba(127,29,29,0.25)]"
      >
        {/* Terminal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-red-900/60 font-mono-tabular text-xs">
          <div className="flex items-center gap-2 text-red-400 font-bold tracking-[0.22em] uppercase">
            <Terminal className="w-4 h-4 text-red-500" />
            <span>PROJECT 27 // CLASSIFIED BRIEFING DOSSIER</span>
          </div>
          <span className="px-2.5 py-0.5 rounded bg-red-950/80 border border-red-700/60 text-red-300 tracking-widest text-[10px] uppercase font-bold animate-pulse">
            CLEARANCE LEVEL: BLACK
          </span>
        </div>

        {/* Sub-Header */}
        <div className="mt-5 text-center sm:text-left">
          <h2 className="font-display text-2xl sm:text-3xl font-bold tracking-[0.16em] text-white uppercase"
            style={{ textShadow: '0 0 24px rgba(239, 68, 68, 0.65)' }}
          >
            CONTAINMENT BREACH INITIATIVE
          </h2>
          <p className="mt-1 font-mono-tabular text-xs tracking-[0.24em] text-red-400 font-semibold uppercase">
            RULES OF ENGAGEMENT // SECTOR 10×10 LABYRINTH
          </p>
        </div>

        {/* 4 Classified Rules */}
        <div className="mt-6 space-y-3.5 font-mono-tabular text-xs sm:text-sm">
          {/* Rule 1 */}
          <div className="p-3.5 rounded-xl bg-[#0a050d] border border-red-900/50 hover:border-violet-600/70 transition-colors">
            <div className="flex items-center gap-2 text-violet-400 font-bold uppercase tracking-wider text-xs">
              <KeyRound className="w-4 h-4 text-violet-400 shrink-0" />
              <span>01. 3 VIOLET SECURITY KEYCARDS (SPATIAL DISPERSION)</span>
            </div>
            <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
              Three violet security keycards are hidden deep in isolated dead-ends across separate wings of the 10×10 labyrinth. All 3 must be recovered to disengage the extraction portal seal.
            </p>
          </div>

          {/* Rule 2 */}
          <div className="p-3.5 rounded-xl bg-[#0a050d] border border-red-900/50 hover:border-red-600/70 transition-colors">
            <div className="flex items-center gap-2 text-red-400 font-bold uppercase tracking-wider text-xs">
              <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
              <span>02. 12-METER AGGRO RADIUS</span>
            </div>
            <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
              Entities remain completely dormant beyond 12 meters. Once inside 12 meters, any unobserved Weeping Angel will sprint at lethal velocity. Listen for grinding granite and mounting heartbeat tempo.
            </p>
          </div>

          {/* Rule 3 */}
          <div className="p-3.5 rounded-xl bg-[#0a050d] border border-red-900/50 hover:border-amber-600/70 transition-colors">
            <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-xs">
              <Eye className="w-4 h-4 text-amber-400 shrink-0" />
              <span>03. STRICT QUANTUM-LOCK & CORNER OCCLUSION</span>
            </div>
            <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
              Direct line-of-sight and your flashlight beam permanently quantum-lock angels into inert stone. Breaking line-of-sight around corridor corners naturally halts pursuit. <strong className="text-red-400">DO NOT BLINK [B]</strong> while staring directly at them.
            </p>
          </div>

          {/* Rule 4 */}
          <div className="p-3.5 rounded-xl bg-[#0a050d] border border-red-900/50 hover:border-violet-500/70 transition-colors">
            <div className="flex items-center gap-2 text-violet-300 font-bold uppercase tracking-wider text-xs">
              <Compass className="w-4 h-4 text-violet-400 shrink-0" />
              <span>04. RANDOMIZED EXTRACTION PORTAL</span>
            </div>
            <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
              The exit portal is positioned in a distant sector corner. It illuminates only after verifying all 3 Keycards. Entering triggers absolute AI immunity and dimensional extraction.
            </p>
          </div>
        </div>

        {/* Bottom Action Footer with Enter prompt */}
        <div className="mt-7 pt-5 border-t border-red-950/80 flex flex-col sm:flex-row items-center justify-between gap-4 font-mono-tabular">
          <div className="text-center sm:text-left">
            <div className="text-xs tracking-[0.25em] text-red-400 font-bold uppercase flex items-center gap-1.5">
              <CornerDownLeft className="w-4 h-4 text-red-400 animate-pulse" />
              <span>PRESS [ENTER] TO BREACH CONTAINMENT</span>
            </div>
            <div className="text-[10px] text-slate-500 tracking-wider uppercase mt-0.5">
              CUTS MENU AUDIO &amp; LAUNCHES FIRST-PERSON ENGINE
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <button
              onClick={() => {
                soundEngine.playButtonClick();
                onBackToMenu();
              }}
              onMouseEnter={() => soundEngine.playButtonHover()}
              className="py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/25 text-slate-300 hover:text-white text-xs font-bold tracking-widest uppercase transition-all cursor-pointer"
            >
              [ ABORT / ESC ]
            </button>

            <button
              onClick={() => {
                soundEngine.playButtonClick();
                onBreachContainment();
              }}
              onMouseEnter={() => soundEngine.playButtonHover()}
              className="flex-1 sm:flex-none py-3 px-6 rounded-xl bg-red-700 hover:bg-red-600 border border-red-400/80 text-white text-xs sm:text-sm font-bold tracking-[0.2em] uppercase transition-all cursor-pointer shadow-[0_0_30px_rgba(220,38,38,0.65)] hover:shadow-[0_0_45px_rgba(239,68,68,0.9)] flex items-center justify-center gap-2"
            >
              <span>[ BREACH CONTAINMENT ]</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
