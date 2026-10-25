import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Settings as SettingsIcon,
  BookOpen,
  Award,
  Volume2,
  VolumeX,
  X,
  ShieldAlert,
  Sparkles,
  Sliders,
  Check,
} from 'lucide-react';
import { soundEngine } from '../maze/soundEffects';

interface CinematicMainMenuProps {
  onEnterLabyrinth: () => void;
  beamProfile: 'tactical' | 'overdrive' | 'amber';
  onBeamProfileChange: (profile: 'tactical' | 'overdrive' | 'amber') => void;
  edgeTurnEnabled: boolean;
  onToggleEdgeTurn: () => void;
  audioEnabled: boolean;
  onToggleAudio: () => void;
}

export const CinematicMainMenu: React.FC<CinematicMainMenuProps> = ({
  onEnterLabyrinth,
  beamProfile,
  onBeamProfileChange,
  edgeTurnEnabled,
  onToggleEdgeTurn,
  audioEnabled,
  onToggleAudio,
}) => {
  const [activeModal, setActiveModal] = useState<'none' | 'settings' | 'logs' | 'credits'>('none');
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const [videoLoaded, setVideoLoaded] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Start eerie gothic ambient audio when the main menu mounts
  useEffect(() => {
    soundEngine.startMenuAudio();
    if (videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
    return () => {
      // Menu unmounts
    };
  }, []);

  // Mouse-parallax title tracking
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const w = window.innerWidth || 1;
      const h = window.innerHeight || 1;
      const nx = (e.clientX / w - 0.5) * 2;
      const ny = (e.clientY / h - 0.5) * 2;
      setParallax({ x: nx, y: ny });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const openModal = (modal: 'settings' | 'logs' | 'credits') => {
    soundEngine.playButtonClick();
    setActiveModal(modal);
  };

  const closeModal = () => {
    soundEngine.playButtonClick();
    setActiveModal('none');
  };

  return (
    <div
      className="fixed inset-0 z-40 bg-black text-[#e2d8c3] flex flex-col justify-between p-6 sm:p-12 select-none pointer-events-auto overflow-hidden font-gothic"
      role="region"
      aria-label="Weeping Angels: The Final Gaze Main Menu"
    >
      {/* Background Looping Gothic Cathedral Video (IntroPage.mp4) */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setVideoLoaded(true)}
        className="fixed inset-0 w-full h-full object-cover pointer-events-none brightness-95 contrast-110"
      >
        <source src="/IntroPage.mp4" type="video/mp4" />
        <source src="/FinalGenerated.mp4" type="video/mp4" />
      </video>

      {/* High-Visibility Subtle Vignette — Preserves rich cathedral video detail */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(0, 0, 0, 0.1) 0%, rgba(8, 6, 10, 0.38) 72%, rgba(0, 0, 0, 0.85) 100%)',
        }}
      />

      {/* Top Bar: Clean Audio Toggle on Top Right (Top-left badge removed) */}
      <header className="relative z-10 flex items-center justify-end w-full">
        <button
          onClick={onToggleAudio}
          onMouseEnter={() => soundEngine.playButtonHover()}
          className="p-3 rounded-full bg-black/60 backdrop-blur-md border border-[#c5a059]/40 text-[#d4af37] hover:text-white hover:border-[#ffd700] hover:shadow-[0_0_20px_rgba(212,175,55,0.45)] transition-all cursor-pointer shadow-[0_4px_16px_rgba(0,0,0,0.8)]"
          title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
          aria-label={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          {audioEnabled ? <Volume2 className="w-5 h-5 text-[#d4af37]" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
        </button>
      </header>

      {/* Center Hero: Mouse-Parallax Ancient Gold Title */}
      <main className="relative z-10 my-auto text-center flex flex-col items-center">
        <div
          style={{
            transform: `perspective(1000px) rotateX(${-parallax.y * 5}deg) rotateY(${
              parallax.x * 7
            }deg) translate3d(${parallax.x * 12}px, ${parallax.y * 8}px, 0)`,
            transition: 'transform 0.08s ease-out',
          }}
          className="flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1 rounded bg-black/60 border border-[#c5a059]/40 font-gothic text-[11px] sm:text-xs tracking-[0.35em] text-[#d4af37] font-bold uppercase mb-4 shadow-[0_0_20px_rgba(212,175,55,0.25)]">
            <span>PROJECT 27 PRESENTS</span>
          </div>

          <h1
            className="font-ancient text-4xl sm:text-6xl md:text-8xl font-black tracking-[0.16em] text-[#f7eedb] uppercase"
            style={{
              textShadow:
                '0 0 35px rgba(212, 175, 55, 0.65), 0 0 70px rgba(180, 130, 20, 0.35), 0 4px 18px rgba(0, 0, 0, 0.98)',
            }}
          >
            WEEPING ANGELS
          </h1>

          <div
            className="mt-2.5 font-gothic text-base sm:text-2xl md:text-3xl tracking-[0.55em] text-[#d4af37] uppercase font-bold"
            style={{ textShadow: '0 0 20px rgba(212, 175, 55, 0.55), 0 2px 8px rgba(0,0,0,0.9)' }}
          >
            THE FINAL GAZE
          </div>
        </div>

        {/* 4 Interactive Gothic Menu Buttons with Golden Glow Effects */}
        <nav aria-label="Main Menu Navigation" className="mt-10 flex flex-col items-center gap-3.5 w-full max-w-md px-4 font-gothic">
          {/* 1. ENTER THE LABYRINTH */}
          <button
            onClick={() => {
              soundEngine.playButtonClick();
              onEnterLabyrinth();
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="group w-full py-4 px-6 rounded-xl bg-gradient-to-r from-[#6b1414]/90 via-[#991b1b]/90 to-[#6b1414]/90 hover:from-[#851818] hover:via-[#b91c1c] hover:to-[#851818] text-[#fff6dc] font-gothic font-bold text-sm sm:text-base tracking-[0.25em] uppercase border border-[#d4af37]/75 shadow-[0_0_30px_rgba(212,175,55,0.35)] hover:shadow-[0_0_45px_rgba(255,215,0,0.6)] transition-all cursor-pointer flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current text-[#ffd700]" />
            <span>[ ENTER THE LABYRINTH ]</span>
          </button>

          {/* 2. SETTINGS */}
          <button
            onClick={() => openModal('settings')}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3 px-6 rounded-xl bg-black/65 hover:bg-[#1a140e]/80 text-[#d8d0c2] hover:text-[#fff6dc] font-gothic font-semibold text-xs sm:text-sm tracking-[0.22em] uppercase border border-[#c5a059]/35 hover:border-[#ffd700]/70 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:shadow-[0_0_25px_rgba(212,175,55,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <SettingsIcon className="w-4 h-4 text-[#d4af37]" />
            <span>[ SETTINGS ]</span>
          </button>

          {/* 3. CONTAINMENT LOGS */}
          <button
            onClick={() => openModal('logs')}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3 px-6 rounded-xl bg-black/65 hover:bg-[#1a140e]/80 text-[#d8d0c2] hover:text-[#fff6dc] font-gothic font-semibold text-xs sm:text-sm tracking-[0.22em] uppercase border border-[#c5a059]/35 hover:border-[#ffd700]/70 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:shadow-[0_0_25px_rgba(212,175,55,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <BookOpen className="w-4 h-4 text-[#d4af37]" />
            <span>[ CHRONICLES &amp; LOGS ]</span>
          </button>

          {/* 4. CREDITS */}
          <button
            onClick={() => openModal('credits')}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3 px-6 rounded-xl bg-black/65 hover:bg-[#1a140e]/80 text-[#d8d0c2] hover:text-[#fff6dc] font-gothic font-semibold text-xs sm:text-sm tracking-[0.22em] uppercase border border-[#c5a059]/35 hover:border-[#ffd700]/70 backdrop-blur-md shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:shadow-[0_0_25px_rgba(212,175,55,0.35)] transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <Award className="w-4 h-4 text-[#d4af37]" />
            <span>[ CREDITS ]</span>
          </button>
        </nav>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 text-center font-gothic text-[11px] text-[#c5a059]/60 tracking-[0.3em] uppercase">
        PROJECT 27 // ALL COGNITIVE RIGHTS RESERVED // DON'T BLINK
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: SETTINGS */}
      {/* ========================================================================= */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 font-gothic">
          <div className="relative w-full max-w-lg rounded-2xl p-6 sm:p-8 bg-[#0d0912]/95 border border-[#c5a059]/45 shadow-[0_0_60px_rgba(212,175,55,0.25)] text-[#e2d8c3]">
            <div className="flex items-center justify-between pb-4 border-b border-[#c5a059]/30">
              <div className="flex items-center gap-2 text-[#d4af37] text-sm font-ancient font-bold tracking-[0.25em] uppercase">
                <Sliders className="w-4 h-4 text-[#ffd700]" />
                <span>EXPEDITION SETTINGS</span>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#c5a059] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5 text-xs sm:text-sm font-gothic">
              {/* Flashlight Beam Profile */}
              <div>
                <label className="text-[#c5a059] block mb-2 uppercase tracking-wider text-xs font-ancient">
                  LANTERN BEAM PROFILE
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['tactical', 'overdrive', 'amber'] as const).map((profile) => (
                    <button
                      key={profile}
                      onClick={() => onBeamProfileChange(profile)}
                      className={`py-2 px-3 rounded-lg border text-xs font-ancient font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        beamProfile === profile
                          ? 'border-[#ffd700] bg-[#3a280c]/80 text-[#ffd700] shadow-[0_0_15px_rgba(212,175,55,0.4)]'
                          : 'border-[#5a4825]/40 bg-black/40 text-slate-400 hover:border-[#c5a059]'
                      }`}
                    >
                      {profile}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edge-Turn Assistance */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#5a4825]/40">
                <div>
                  <div className="font-ancient font-semibold text-[#f1e6cf] uppercase tracking-wider text-xs">
                    EDGE-SCREEN LOOK ASSIST
                  </div>
                  <div className="text-[11px] text-[#c5a059]/70 mt-0.5">
                    Rotate gaze when cursor approaches edge of viewport
                  </div>
                </div>
                <button
                  onClick={onToggleEdgeTurn}
                  className={`py-1.5 px-3 rounded-md border text-xs font-ancient font-bold uppercase transition-colors cursor-pointer ${
                    edgeTurnEnabled
                      ? 'bg-[#3a280c] border-[#ffd700] text-[#ffd700]'
                      : 'bg-black/60 border-slate-700 text-slate-500'
                  }`}
                >
                  {edgeTurnEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Audio Master */}
              <div className="flex items-center justify-between p-3.5 rounded-xl bg-black/50 border border-[#5a4825]/40">
                <div>
                  <div className="font-ancient font-semibold text-[#f1e6cf] uppercase tracking-wider text-xs">
                    SPATIAL AUDIO SANCTUARY
                  </div>
                  <div className="text-[11px] text-[#c5a059]/70 mt-0.5">
                    Cathedral echoes, grinding granite, heartbeat tempo
                  </div>
                </div>
                <button
                  onClick={onToggleAudio}
                  className={`py-1.5 px-3 rounded-md border text-xs font-ancient font-bold uppercase transition-colors cursor-pointer ${
                    audioEnabled
                      ? 'bg-[#3a280c] border-[#ffd700] text-[#ffd700]'
                      : 'bg-black/60 border-slate-700 text-slate-500'
                  }`}
                >
                  {audioEnabled ? 'ONLINE' : 'MUTED'}
                </button>
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-[#c5a059]/30 flex justify-end">
              <button
                onClick={closeModal}
                className="py-2.5 px-6 rounded-xl bg-[#2a1b08] hover:bg-[#3d270c] border border-[#ffd700] text-[#ffd700] font-ancient font-bold text-xs uppercase tracking-[0.2em] cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.4)]"
              >
                APPLY &amp; RETURN
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONTAINMENT LOGS */}
      {/* ========================================================================= */}
      {activeModal === 'logs' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 font-gothic">
          <div className="relative w-full max-w-2xl rounded-2xl p-6 sm:p-8 bg-[#0d0912]/95 border border-[#c5a059]/45 shadow-[0_0_60px_rgba(212,175,55,0.25)] text-[#e2d8c3] max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#c5a059]/30">
              <div className="flex items-center gap-2 text-[#d4af37] text-sm font-ancient font-bold tracking-[0.25em] uppercase">
                <BookOpen className="w-4 h-4 text-[#ffd700]" />
                <span>CHRONICLES OF THE SEPULCHRE // SACRED ARCHIVE</span>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#c5a059] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4 text-xs sm:text-sm font-gothic">
              <div className="p-4 rounded-xl bg-black/50 border border-[#5a4825]/40">
                <div className="text-[#ffd700] font-ancient font-bold tracking-wider text-xs">
                  CODEX I // THE QUANTUM LOCK
                </div>
                <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
                  Known to mortals as the Weeping Angels — solitary assassins crafted from unyielding granite. While held in sight by any living soul, they are frozen in permanent quantum lock. Turn away, or blink, and they cross great halls in fractions of a heartbeat.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/50 border border-[#5a4825]/40">
                <div className="text-[#ffd700] font-ancient font-bold tracking-wider text-xs">
                  CODEX II // PROXIMITY HUNTING
                </div>
                <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
                  The stone remains still beyond 12 cubits. When inside this proximity, their hunting senses awaken. Trust your ears: the grinding of granite upon stone and your mounting pulse shall signal their advance.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/50 border border-[#5a4825]/40">
                <div className="text-[#ffd700] font-ancient font-bold tracking-wider text-xs">
                  CODEX III // SHADOWS &amp; ARCHWAYS
                </div>
                <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
                  Corridor angles and heavy archways break their gaze. Rounding a masonry pillar temporarily halts their hunt until sightline is restored. Hold fast, and do not blink [B] while looking directly at them.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/50 border border-[#5a4825]/40">
                <div className="text-[#ffd700] font-ancient font-bold tracking-wider text-xs">
                  CODEX IV // THREE VIOLET SEALS
                </div>
                <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
                  The ancient extraction gateway remains sealed shut until all three violet sigils are recovered from the deepest dead-ends of the catacombs. Seek each relic to break the lock and ascend.
                </p>
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-[#c5a059]/30 flex justify-end">
              <button
                onClick={closeModal}
                className="py-2.5 px-6 rounded-xl bg-[#2a1b08] hover:bg-[#3d270c] border border-[#ffd700] text-[#ffd700] font-ancient font-bold text-xs uppercase tracking-[0.2em] cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.4)]"
              >
                CLOSE CODEX
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREDITS */}
      {/* ========================================================================= */}
      {activeModal === 'credits' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4 font-gothic">
          <div className="relative w-full max-w-md rounded-2xl p-6 sm:p-8 bg-[#0d0912]/95 border border-[#c5a059]/45 shadow-[0_0_60px_rgba(212,175,55,0.25)] text-[#e2d8c3] text-center">
            <div className="flex items-center justify-between pb-4 border-b border-[#c5a059]/30">
              <div className="flex items-center gap-2 text-[#d4af37] text-sm font-ancient font-bold tracking-[0.25em] uppercase">
                <Award className="w-4 h-4 text-[#ffd700]" />
                <span>PROJECT 27 // PRODUCTION CREDITS</span>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-white/10 text-[#c5a059] hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4 text-xs font-gothic">
              <div>
                <div className="text-[#c5a059] text-[10px] font-ancient tracking-[0.3em] uppercase">DEVELOPMENT &amp; ARCHITECTURE</div>
                <div className="text-base font-ancient font-bold text-[#ffd700] mt-0.5">PROJECT 27 TEAM</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Weeping Angels: The Final Gaze</div>
              </div>

              <div className="pt-3 border-t border-[#5a4825]/30">
                <div className="text-[#c5a059] text-[10px] font-ancient tracking-[0.3em] uppercase">3D GRAPHICS &amp; ENGINE</div>
                <div className="text-slate-200 font-semibold mt-0.5">Three.js PBR Engine · Procedural 10×10 Labyrinth</div>
              </div>

              <div className="pt-3 border-t border-[#5a4825]/30">
                <div className="text-[#c5a059] text-[10px] font-ancient tracking-[0.3em] uppercase">AUDIO &amp; SOUND DESIGN</div>
                <div className="text-slate-200 font-semibold mt-0.5">Web Audio Synthesizer · Multi-Track Adaptive System</div>
              </div>

              <div className="pt-3 border-t border-[#5a4825]/30 text-[10px] text-slate-500 leading-relaxed font-sans">
                Inspired by the iconic "Weeping Angels" created by Steven Moffat for Doctor Who (BBC).
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-[#c5a059]/30 flex justify-center">
              <button
                onClick={closeModal}
                className="py-2.5 px-6 rounded-xl bg-[#2a1b08] hover:bg-[#3d270c] border border-[#ffd700] text-[#ffd700] font-ancient font-bold text-xs uppercase tracking-[0.2em] cursor-pointer shadow-[0_0_20px_rgba(212,175,55,0.4)]"
              >
                RETURN
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
