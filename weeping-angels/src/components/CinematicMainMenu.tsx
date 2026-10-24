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
      className="fixed inset-0 z-40 bg-black text-slate-100 flex flex-col justify-between p-6 sm:p-12 select-none pointer-events-auto overflow-hidden"
      role="region"
      aria-label="Project 27 Gothic Main Menu"
    >
      {/* Background Looping Gothic Cathedral Video */}
      <video
        ref={videoRef}
        autoPlay
        loop
        muted
        playsInline
        onLoadedData={() => setVideoLoaded(true)}
        className="fixed inset-0 w-full h-full object-cover pointer-events-none brightness-75 contrast-125"
      >
        <source src="/IntroPage.mp4" type="video/mp4" />
        <source src="/Music/IntroPage.mp4" type="video/mp4" />
      </video>

      {/* Dark Radial Vignette & Blood-Tinted Edge Glow */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(circle at 50% 50%, rgba(5, 2, 7, 0.45) 0%, rgba(3, 1, 4, 0.82) 65%, rgba(0, 0, 0, 0.98) 100%)',
        }}
      />
      <div
        className="fixed inset-0 pointer-events-none opacity-20"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(220, 38, 38, 0.12) 0px, rgba(220, 38, 38, 0.12) 1px, transparent 1px, transparent 3px)',
        }}
      />

      {/* Top Bar: Project 27 Classification Badge + Audio Toggle */}
      <header className="relative z-10 flex items-center justify-between w-full">
        <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-red-900/60 font-mono-tabular text-xs text-red-400 font-semibold tracking-[0.22em] uppercase shadow-[0_0_20px_rgba(220,38,38,0.25)]">
          <ShieldAlert className="w-3.5 h-3.5 text-red-500" />
          <span>PROJECT 27 // CONTAINMENT DIVISION</span>
        </div>

        <button
          onClick={onToggleAudio}
          onMouseEnter={() => soundEngine.playButtonHover()}
          className="p-2.5 rounded-xl bg-black/60 backdrop-blur-md border border-red-900/60 text-slate-300 hover:text-white hover:border-red-500/70 transition-all cursor-pointer shadow-[0_0_15px_rgba(220,38,38,0.2)]"
          title={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
          aria-label={audioEnabled ? 'Mute Audio' : 'Unmute Audio'}
        >
          {audioEnabled ? <Volume2 className="w-5 h-5 text-red-400" /> : <VolumeX className="w-5 h-5 text-slate-500" />}
        </button>
      </header>

      {/* Center Hero: Mouse-Parallax Title Tracking */}
      <main className="relative z-10 my-auto text-center flex flex-col items-center">
        <div
          style={{
            transform: `perspective(1000px) rotateX(${-parallax.y * 6}deg) rotateY(${
              parallax.x * 8
            }deg) translate3d(${parallax.x * 14}px, ${parallax.y * 10}px, 0)`,
            transition: 'transform 0.08s ease-out',
          }}
          className="flex flex-col items-center"
        >
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded bg-red-950/70 border border-red-800/60 font-mono-tabular text-[11px] sm:text-xs tracking-[0.3em] text-red-300 font-bold uppercase mb-4 shadow-[0_0_20px_rgba(239,68,68,0.35)]">
            <span>PROJECT 27 PRESENTS</span>
          </div>

          <h1
            className="font-display text-4xl sm:text-6xl md:text-8xl font-black tracking-[0.16em] text-white uppercase"
            style={{
              textShadow:
                '0 0 45px rgba(220, 38, 38, 0.85), 0 0 90px rgba(185, 28, 28, 0.45), 0 4px 18px rgba(0, 0, 0, 0.95)',
            }}
          >
            WEEPING ANGELS
          </h1>

          <div
            className="mt-2 font-mono-tabular text-sm sm:text-xl md:text-2xl tracking-[0.45em] text-red-400 uppercase font-bold"
            style={{ textShadow: '0 0 20px rgba(239, 68, 68, 0.65)' }}
          >
            THE FINAL GAZE
          </div>

          <p className="mt-5 max-w-lg font-mono-tabular text-xs sm:text-sm text-slate-300/80 tracking-wider leading-relaxed px-4">
            Procedural 10×10 Labyrinth · 4 Stone Entities · 12-Meter Quantum-Lock Protocol
          </p>
        </div>

        {/* 4 Interactive Menu Buttons with Hover Glow Effects */}
        <nav aria-label="Main Menu Navigation" className="mt-10 flex flex-col items-center gap-3.5 w-full max-w-md px-4 font-mono-tabular">
          {/* 1. ENTER THE LABYRINTH */}
          <button
            onClick={() => {
              soundEngine.playButtonClick();
              onEnterLabyrinth();
            }}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-4 px-6 rounded-xl bg-gradient-to-r from-red-800 via-red-700 to-red-900 hover:from-red-600 hover:via-red-500 hover:to-red-700 text-white font-bold text-sm sm:text-base tracking-[0.22em] uppercase border border-red-400/80 shadow-[0_0_35px_rgba(220,38,38,0.65)] hover:shadow-[0_0_55px_rgba(239,68,68,0.95)] transition-all cursor-pointer flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <Play className="w-5 h-5 fill-current" />
            <span>[ ENTER THE LABYRINTH ]</span>
          </button>

          {/* 2. SETTINGS */}
          <button
            onClick={() => openModal('settings')}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3.5 px-6 rounded-xl bg-black/60 hover:bg-red-950/40 text-slate-200 hover:text-white font-bold text-xs sm:text-sm tracking-[0.2em] uppercase border border-red-900/50 hover:border-red-500/80 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_30px_rgba(220,38,38,0.45)] transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <SettingsIcon className="w-4 h-4 text-red-400" />
            <span>[ SETTINGS ]</span>
          </button>

          {/* 3. CONTAINMENT LOGS */}
          <button
            onClick={() => openModal('logs')}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3.5 px-6 rounded-xl bg-black/60 hover:bg-red-950/40 text-slate-200 hover:text-white font-bold text-xs sm:text-sm tracking-[0.2em] uppercase border border-red-900/50 hover:border-red-500/80 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_30px_rgba(220,38,38,0.45)] transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <BookOpen className="w-4 h-4 text-violet-400" />
            <span>[ CONTAINMENT LOGS ]</span>
          </button>

          {/* 4. CREDITS */}
          <button
            onClick={() => openModal('credits')}
            onMouseEnter={() => soundEngine.playButtonHover()}
            className="w-full py-3.5 px-6 rounded-xl bg-black/60 hover:bg-red-950/40 text-slate-200 hover:text-white font-bold text-xs sm:text-sm tracking-[0.2em] uppercase border border-red-900/50 hover:border-red-500/80 backdrop-blur-md shadow-[0_0_20px_rgba(0,0,0,0.6)] hover:shadow-[0_0_30px_rgba(220,38,38,0.45)] transition-all cursor-pointer flex items-center justify-center gap-2.5 active:scale-[0.98]"
          >
            <Award className="w-4 h-4 text-amber-400" />
            <span>[ CREDITS ]</span>
          </button>
        </nav>
      </main>

      {/* Bottom Footer */}
      <footer className="relative z-10 text-center font-mono-tabular text-[10px] text-slate-500 tracking-[0.25em] uppercase">
        PROJECT 27 // ALL COGNITIVE RIGHTS RESERVED // DON'T BLINK
      </footer>

      {/* ========================================================================= */}
      {/* MODAL 1: SETTINGS */}
      {/* ========================================================================= */}
      {activeModal === 'settings' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="relative w-full max-w-lg rounded-2xl p-6 sm:p-8 bg-[#09050d] border border-red-900/80 shadow-[0_0_60px_rgba(220,38,38,0.35)] font-mono-tabular text-slate-100">
            <div className="flex items-center justify-between pb-4 border-b border-red-900/60">
              <div className="flex items-center gap-2 text-red-400 text-sm font-bold tracking-widest uppercase">
                <Sliders className="w-4 h-4" />
                <span>TACTICAL SETTINGS</span>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 space-y-5 text-xs sm:text-sm">
              {/* Flashlight Beam Profile */}
              <div>
                <label className="text-slate-400 block mb-2 uppercase tracking-wider text-xs">
                  FLASHLIGHT BEAM EMITTER PROFILE
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {(['tactical', 'overdrive', 'amber'] as const).map((profile) => (
                    <button
                      key={profile}
                      onClick={() => onBeamProfileChange(profile)}
                      className={`py-2 px-3 rounded-lg border text-xs font-bold uppercase tracking-wider transition-all cursor-pointer ${
                        beamProfile === profile
                          ? 'border-violet-400 bg-violet-950/70 text-violet-200 shadow-[0_0_15px_rgba(168,85,247,0.4)]'
                          : 'border-slate-800 bg-black/40 text-slate-400 hover:border-slate-600'
                      }`}
                    >
                      {profile}
                    </button>
                  ))}
                </div>
              </div>

              {/* Edge-Turn Assistance */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200 uppercase tracking-wider text-xs">
                    EDGE-SCREEN LOOK ASSIST
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Auto-rotate yaw when cursor approaches display bounds
                  </div>
                </div>
                <button
                  onClick={onToggleEdgeTurn}
                  className={`py-1.5 px-3 rounded-md border text-xs font-bold uppercase transition-colors ${
                    edgeTurnEnabled
                      ? 'bg-violet-950 border-violet-500 text-violet-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {edgeTurnEnabled ? 'ENABLED' : 'DISABLED'}
                </button>
              </div>

              {/* Audio Master */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-black/40 border border-slate-800">
                <div>
                  <div className="font-semibold text-slate-200 uppercase tracking-wider text-xs">
                    SPATIAL AUDIO SYNTHESIZER
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Proximity heartbeat, multi-track threats, granite scrapes
                  </div>
                </div>
                <button
                  onClick={onToggleAudio}
                  className={`py-1.5 px-3 rounded-md border text-xs font-bold uppercase transition-colors ${
                    audioEnabled
                      ? 'bg-red-950 border-red-500 text-red-200'
                      : 'bg-slate-900 border-slate-700 text-slate-400'
                  }`}
                >
                  {audioEnabled ? 'ONLINE' : 'MUTED'}
                </button>
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-red-900/60 flex justify-end">
              <button
                onClick={closeModal}
                className="py-2.5 px-5 rounded-xl bg-red-700 hover:bg-red-600 text-white font-bold text-xs uppercase tracking-widest cursor-pointer shadow-[0_0_20px_rgba(220,38,38,0.5)]"
              >
                APPLY &amp; CLOSE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: CONTAINMENT LOGS */}
      {/* ========================================================================= */}
      {activeModal === 'logs' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="relative w-full max-w-2xl rounded-2xl p-6 sm:p-8 bg-[#09050d] border border-red-900/80 shadow-[0_0_60px_rgba(220,38,38,0.35)] font-mono-tabular text-slate-100 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-red-900/60">
              <div className="flex items-center gap-2 text-violet-400 text-sm font-bold tracking-widest uppercase">
                <BookOpen className="w-4 h-4" />
                <span>PROJECT 27 // CONTAINMENT LOG ARCHIVE</span>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4 text-xs sm:text-sm">
              <div className="p-4 rounded-xl bg-black/50 border border-violet-900/40">
                <div className="text-violet-300 font-bold tracking-wider text-xs">
                  ARCHIVE ENTRY #27-01 // ANOMALY TAXONOMY
                </div>
                <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
                  Subject classified as "Weeping Angel" — an ancient quantum-locked entity that exists in a state of harmless stone sculpture whenever observed by any sentient creature. In dark corridors or behind eyes, velocity exceeds 7.2 meters/second.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/50 border border-red-900/40">
                <div className="text-red-300 font-bold tracking-wider text-xs">
                  ARCHIVE ENTRY #27-02 // 12-METER PROXIMITY TELEMETRY
                </div>
                <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
                  Sensors confirm entities observe a 12.0m aggro perimeter. Beyond 12m, neural activity is completely inert. Within 12m, breaking direct line of sight causes instant predatory pursuit.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/50 border border-amber-900/40">
                <div className="text-amber-300 font-bold tracking-wider text-xs">
                  ARCHIVE ENTRY #27-03 // CORNER-OCCLUSION DEFENSE
                </div>
                <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
                  Corridor right-angles naturally occlude entity perception. Rounding a corner breaks direct tracking and forces the Angel to freeze at its last verified coordinate until sight is re-established.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-black/50 border border-purple-900/40">
                <div className="text-purple-300 font-bold tracking-wider text-xs">
                  ARCHIVE ENTRY #27-04 // TRIPLE KEYCARD PROTOCOL
                </div>
                <p className="mt-1.5 text-slate-300 leading-relaxed text-xs">
                  To prevent unauthorized breach, Sector 10×10 extraction portals require 3 separate Violet Keycards scattered in opposite labyrinth dead-ends. Secure all three before reaching the beacon.
                </p>
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-red-900/60 flex justify-end">
              <button
                onClick={closeModal}
                className="py-2.5 px-5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs uppercase tracking-widest cursor-pointer"
              >
                CLOSE ARCHIVE
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: CREDITS */}
      {/* ========================================================================= */}
      {activeModal === 'credits' && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-2xl p-6 sm:p-8 bg-[#09050d] border border-red-900/80 shadow-[0_0_60px_rgba(220,38,38,0.35)] font-mono-tabular text-slate-100 text-center">
            <div className="flex items-center justify-between pb-4 border-b border-red-900/60">
              <div className="flex items-center gap-2 text-amber-400 text-sm font-bold tracking-widest uppercase">
                <Award className="w-4 h-4" />
                <span>PROJECT 27 // PRODUCTION CREDITS</span>
              </div>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-6 space-y-4 text-xs">
              <div>
                <div className="text-slate-400 text-[10px] tracking-widest uppercase">DEVELOPMENT &amp; ARCHITECTURE</div>
                <div className="text-base font-bold text-white mt-0.5">PROJECT 27 TEAM</div>
                <div className="text-slate-400 text-[11px] mt-0.5">Weeping Angels: The Final Gaze</div>
              </div>

              <div className="pt-3 border-t border-red-950/60">
                <div className="text-slate-400 text-[10px] tracking-widest uppercase">3D GRAPHICS &amp; ENGINE</div>
                <div className="text-slate-200 font-semibold mt-0.5">Three.js PBR Engine · Procedural 10×10 Labyrinth</div>
              </div>

              <div className="pt-3 border-t border-red-950/60">
                <div className="text-slate-400 text-[10px] tracking-widest uppercase">AUDIO &amp; SOUND DESIGN</div>
                <div className="text-slate-200 font-semibold mt-0.5">Web Audio Synthesizer · Multi-Track Adaptive System</div>
              </div>

              <div className="pt-3 border-t border-red-950/60 text-[10px] text-slate-500 leading-relaxed">
                Inspired by the iconic "Weeping Angels" created by Steven Moffat for Doctor Who (BBC).
              </div>
            </div>

            <div className="mt-7 pt-4 border-t border-red-900/60 flex justify-center">
              <button
                onClick={closeModal}
                className="py-2.5 px-6 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 font-bold text-xs uppercase tracking-widest cursor-pointer"
              >
                CLOSE
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
