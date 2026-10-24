import React, { useEffect, useState } from 'react';
import { soundEngine } from '../maze/soundEffects';

interface StudioIntroProps {
  onComplete: () => void;
}

export const StudioIntro: React.FC<StudioIntroProps> = ({ onComplete }) => {
  const fullText = 'PROJECT 27 PRESENTS...';
  const [displayedText, setDisplayedText] = useState('');
  const [isFadingOut, setIsFadingOut] = useState(false);

  useEffect(() => {
    // Play the low, vibrating industrial drone sound effect
    soundEngine.playIndustrialDrone();

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex++;
      if (currentIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, currentIndex));
        soundEngine.playTypewriterClick();
      } else {
        clearInterval(interval);
        // Hold for dramatic tension before fade-out transition
        setTimeout(() => {
          setIsFadingOut(true);
          setTimeout(() => {
            soundEngine.stopIndustrialDrone();
            onComplete();
          }, 850);
        }, 1600);
      }
    }, 95);

    const onKeyDown = () => {
      handleSkip();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      clearInterval(interval);
      window.removeEventListener('keydown', onKeyDown);
      soundEngine.stopIndustrialDrone();
    };
  }, [onComplete]);

  const handleSkip = () => {
    if (isFadingOut) return;
    setIsFadingOut(true);
    setTimeout(() => {
      soundEngine.stopIndustrialDrone();
      onComplete();
    }, 400);
  };

  return (
    <div
      onClick={handleSkip}
      className={`fixed inset-0 z-50 bg-black flex flex-col items-center justify-center select-none cursor-pointer transition-opacity duration-700 ease-in-out ${
        isFadingOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      {/* Pitch-black studio background with subtle central film grain */}
      <div className="text-center px-6">
        <h1
          className="font-mono-tabular text-xl sm:text-3xl md:text-4xl font-bold tracking-[0.35em] text-red-500 uppercase"
          style={{
            textShadow:
              '0 0 25px rgba(239, 68, 68, 0.75), 0 0 50px rgba(185, 28, 28, 0.45)',
          }}
        >
          {displayedText}
          <span className="inline-block w-3 h-6 ml-1.5 bg-red-500 animate-pulse align-middle" />
        </h1>

        <p className="mt-8 text-[11px] font-mono-tabular tracking-[0.28em] text-slate-500/70 uppercase">
          [ CLICK OR PRESS ANY KEY TO SKIP ]
        </p>
      </div>
    </div>
  );
};
