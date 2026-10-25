import React, { useEffect } from 'react';
import { Play, RotateCcw, Home, Pause as PauseIcon } from 'lucide-react';
import { soundEngine } from '../maze/soundEffects';

interface PauseModalProps {
  isOpen: boolean;
  onResume: () => void;
  onRestartSector: () => void;
  onReturnToMainMenu: () => void;
}

export const PauseModal: React.FC<PauseModalProps> = ({
  isOpen,
  onResume,
  onRestartSector,
  onReturnToMainMenu,
}) => {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Escape' || e.code === 'KeyP') {
        e.preventDefault();
        soundEngine.playButtonClick();
        onResume();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onResume]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 font-gothic select-none pointer-events-auto"
      role="dialog"
      aria-label="Game Paused Modal"
    >
      <div className="relative w-full max-w-md rounded-2xl p-6 sm:p-8 bg-[#0d0912]/95 border border-[#c5a059]/50 shadow-[0_0_60px_rgba(212,175,55,0.3)] text-[#e2d8c3] text-center">
        {/* Header */}
        <div className="flex flex-col items-center gap-2 mb-6">
          <div className="p-3 rounded-full bg-[#2a1b08] border border-[#ffd700]/70 text-[#ffd700] shadow-[0_0_20px_rgba(212,175,55,0.4)]">
            <PauseIcon className="w-6 h-6" />
          </div>
          <h2
            className="font-ancient text-2xl sm:text-3xl font-bold tracking-[0.22em] text-[#fff6dc] uppercase mt-2"
            style={{ textShadow: '0 0 20px rgba(212,175,55,0.6)' }}
          >
            GAME PAUSED
          </h2>
          <p className="text-[11px] font-ancient text-[#c5a059]/80 tracking-[0.25em] uppercase">
            THE ENTITIES ARE FROZEN IN TIME
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-3 font-ancient">
          {/* 1. Resume */}
          <button
            onClick={() => {
              soundEngine.playButtonClick();
              onResume();
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-[#8a5d1b] via-[#b8860b] to-[#8a5d1b] hover:from-[#a06d20] hover:via-[#d4af37] hover:to-[#a06d20] border border-[#ffd700] text-[#0d0702] font-black text-xs sm:text-sm tracking-[0.25em] uppercase transition-all cursor-pointer shadow-[0_0_25px_rgba(212,175,55,0.65)] hover:shadow-[0_0_40px_rgba(255,215,0,0.9)] flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <Play className="w-4 h-4 fill-current" />
            <span>[ RESUME GAME // ESC ]</span>
          </button>

          {/* 2. Replay / Restart Sector */}
          <button
            onClick={() => {
              soundEngine.playButtonClick();
              onRestartSector();
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3 px-6 rounded-xl bg-black/60 hover:bg-[#1a140e] text-[#d8d0c2] hover:text-[#fff6dc] font-semibold text-xs sm:text-sm tracking-[0.22em] uppercase border border-[#c5a059]/40 hover:border-[#ffd700]/70 transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <RotateCcw className="w-4 h-4 text-[#d4af37]" />
            <span>[ RESTART SECTOR ]</span>
          </button>

          {/* 3. Return to Main Menu */}
          <button
            onClick={() => {
              soundEngine.playButtonClick();
              onReturnToMainMenu();
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3 px-6 rounded-xl bg-black/60 hover:bg-[#1a140e] text-[#d8d0c2] hover:text-[#fff6dc] font-semibold text-xs sm:text-sm tracking-[0.22em] uppercase border border-[#c5a059]/40 hover:border-[#ffd700]/70 transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <Home className="w-4 h-4 text-[#d4af37]" />
            <span>[ RETURN TO MAIN MENU ]</span>
          </button>
        </div>
      </div>
    </div>
  );
};
