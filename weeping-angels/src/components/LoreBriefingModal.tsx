import React, { useEffect, useState, useRef } from 'react';
import { Sparkles, Flame } from 'lucide-react';
import { soundEngine } from '../maze/soundEffects';

interface LoreBriefingModalProps {
  onBreachContainment: () => void;
  onBackToMenu: () => void;
}

const LORE_PARAGRAPHS = [
  'They are the Lonely Assassins — entities as ancient as time, frozen into lifeless stone only whilst observed.',
  'To hold their gaze is your singular defense. To turn away is your doom.',
  'While watched, they cannot move, held fast by quantum lock. Yet the instant your eyes turn — or you blink — they strike with terrifying swiftness.',
  'Three violet sigils lie entombed within these sacred catacombs. Seek every stone to awaken the extraction gateway.',
  'Trust not the shadows. Never turn your back. And above all else...',
  'DO NOT BLINK.',
];

export const LoreBriefingModal: React.FC<LoreBriefingModalProps> = ({
  onBreachContainment,
  onBackToMenu,
}) => {
  const fullText = LORE_PARAGRAPHS.join('\n\n');
  const [displayedLength, setDisplayedLength] = useState(0);
  const [isTypingComplete, setIsTypingComplete] = useState(false);
  const clickCounterRef = useRef(0);

  // Keyboard shortcut listeners: Enter to descend, Escape to abort, Space to complete typewriter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Enter' || e.code === 'NumpadEnter') {
        e.preventDefault();
        soundEngine.playButtonClick();
        onBreachContainment();
      } else if (e.code === 'Escape') {
        e.preventDefault();
        soundEngine.playButtonClick();
        onBackToMenu();
      } else if (e.code === 'Space' && !isTypingComplete) {
        e.preventDefault();
        setDisplayedLength(fullText.length);
        setIsTypingComplete(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onBreachContainment, onBackToMenu, isTypingComplete, fullText.length]);

  // Antique Typewriter Effect with Audio Scribe Clicks
  useEffect(() => {
    if (displayedLength >= fullText.length) {
      setIsTypingComplete(true);
      return;
    }

    const nextChar = fullText[displayedLength];
    // Slightly longer pauses on punctuation
    const delay = nextChar === '.' || nextChar === '?' || nextChar === '!' ? 220 : nextChar === '\n' ? 140 : 28;

    const timer = setTimeout(() => {
      setDisplayedLength((prev) => {
        const next = prev + 1;
        clickCounterRef.current += 1;
        // Play typewriter sound every 2-3 characters to keep audio rich and crisp without overwhelming
        if (clickCounterRef.current % 2 === 0 && nextChar !== ' ' && nextChar !== '\n') {
          soundEngine.playTypewriterClick();
        }
        return next;
      });
    }, delay);

    return () => clearTimeout(timer);
  }, [displayedLength, fullText]);

  const displayedContent = fullText.slice(0, displayedLength);

  return (
    <div
      className="fixed inset-0 z-50 bg-black text-[#f1e6cf] flex flex-col justify-between p-6 sm:p-12 md:p-16 select-none pointer-events-auto overflow-hidden font-gothic"
      role="dialog"
      aria-label="Lore and Inscription of the Labyrinth"
    >
      {/* Background Gothic Cathedral Video */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="fixed inset-0 w-full h-full object-cover pointer-events-none brightness-[0.42] contrast-125 filter saturate-90"
      >
        <source src="/FinalGenerated.mp4" type="video/mp4" />
        <source src="/Music/FinalGenerated.mp4" type="video/mp4" />
      </video>

      {/* Atmospheric Vignette & Subtle Warm Embers Gradient */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse at 25% 30%, rgba(20, 14, 5, 0.45) 0%, rgba(5, 3, 7, 0.85) 60%, rgba(0, 0, 0, 0.98) 100%)',
        }}
      />

      {/* Subtle CRT / Ancient parchment noise lines */}
      <div
        className="fixed inset-0 pointer-events-none opacity-15"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(212, 175, 55, 0.08) 0px, rgba(212, 175, 55, 0.08) 1px, transparent 1px, transparent 4px)',
        }}
      />

      {/* TOP LEFT: Golden Antique Typewriter Lore Inscription */}
      <div className="relative z-10 max-w-2xl text-left">
        {/* Ancient Header */}
        <div className="flex items-center gap-2.5 text-[#d4af37] text-xs sm:text-sm tracking-[0.35em] uppercase font-ancient font-semibold mb-4 text-glow-gold">
          <Sparkles className="w-4 h-4 text-[#ffd700] animate-pulse" />
          <span>CHRONICLES OF THE SEPULCHRE // LIBER PRIMUS</span>
        </div>

        {/* Written Lore in Ancient Font and Golden Letters */}
        <div
          className="font-ancient text-base sm:text-lg md:text-xl text-[#f3e5ab] leading-relaxed tracking-wide space-y-4 whitespace-pre-line"
          style={{
            textShadow:
              '0 0 16px rgba(212, 175, 55, 0.6), 0 0 32px rgba(180, 130, 20, 0.3), 0 2px 8px rgba(0,0,0,0.95)',
          }}
        >
          {displayedContent}
          {!isTypingComplete && (
            <span className="inline-block w-2.5 h-5 ml-1 bg-[#ffd700] shadow-[0_0_12px_#ffd700] animate-pulse align-middle" />
          )}
        </div>

        {/* Fast Skip prompt while typing */}
        {!isTypingComplete && (
          <button
            onClick={() => {
              setDisplayedLength(fullText.length);
              setIsTypingComplete(true);
            }}
            className="mt-6 text-[11px] font-ancient tracking-[0.25em] text-[#c5a059]/70 hover:text-[#ffd700] uppercase transition-colors cursor-pointer"
          >
            [ PRESS SPACE TO REVEAL FULL INSCRIPTION ]
          </button>
        )}
      </div>

      {/* BOTTOM ACTION BAR: Aesthetic Ancient Controls */}
      <div className="relative z-10 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-[#c5a059]/30 font-gothic">
        <div className="flex items-center gap-2 text-xs sm:text-sm text-[#c5a059] tracking-[0.2em] font-ancient">
          <Flame className="w-4 h-4 text-[#d4af37] shrink-0" />
          <span>THREE VIOLET SEALS · QUANTUM ENTITIES AWAKE</span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {/* Abort / Return to Menu Button */}
          <button
            onClick={() => {
              soundEngine.playButtonClick();
              onBackToMenu();
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="px-5 py-3 rounded-lg bg-black/60 hover:bg-black/90 border border-[#8a7243]/50 hover:border-[#ffd700] text-[#c5a059] hover:text-[#fff] text-xs font-ancient tracking-[0.2em] uppercase transition-all cursor-pointer shadow-[0_0_15px_rgba(0,0,0,0.8)]"
          >
            [ RETREAT // ESC ]
          </button>

          {/* Enter the Labyrinth Button */}
          <button
            onClick={() => {
              soundEngine.playButtonClick();
              onBreachContainment();
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="flex-1 sm:flex-none px-7 py-3 rounded-lg bg-gradient-to-r from-[#8a5d1b] via-[#b8860b] to-[#8a5d1b] hover:from-[#a06d20] hover:via-[#d4af37] hover:to-[#a06d20] border border-[#ffd700] text-[#0d0702] font-ancient font-black text-xs sm:text-sm tracking-[0.22em] uppercase transition-all cursor-pointer shadow-[0_0_30px_rgba(212,175,55,0.7)] hover:shadow-[0_0_45px_rgba(255,215,0,0.95)] hover:scale-[1.02] active:scale-[0.98]"
          >
            [ DESCEND INTO LABYRINTH // ENTER ]
          </button>
        </div>
      </div>
    </div>
  );
};
