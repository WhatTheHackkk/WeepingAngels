/**
 * Advanced Parallel Multi-Track Audio Architecture + Web Audio API Synthesizer for UMBRA:
 *
 * - Track 1 (Continuous Ambient Loop):
 *   /assets/aistudio/Omniscient_Evil_5e1063bd.mp3
 *   Plays and loops continuously in the background from initialization until exit or game over.
 *
 * - Track 2 (Parallel Threat Sight-Line Track):
 *   /assets/aistudio/Bass_Boosted_4_Disturbing_Video_Game_Music_34_You_can_t_escape__Eversion___1___1___1__274ec460.mp3
 *   Plays simultaneously alongside Track 1 ONLY when the Weeping Angel is within the camera's
 *   view frustum and clear raycast line-of-sight after initial spotting. Instantly cuts the
 *   exact microsecond line-of-sight is broken while Track 1 continues uninterrupted.
 *
 * - Track 3 (Jumpscare Scream & Game-Over Sting):
 *   /assets/aistudio/Nightmare_scream_jumpscare_SFX_8c4f4172.mp3
 *   Triggers instantly at 100% volume when the Weeping Angel collides with the player's camera.
 */

const TRACK_1_AMBIENT_URL = '/assets/aistudio/Omniscient_Evil_5e1063bd.mp3';
const TRACK_2_THREAT_LOS_URL =
  '/assets/aistudio/Bass_Boosted_4_Disturbing_Video_Game_Music_34_You_can_t_escape__Eversion___1___1___1__274ec460.mp3';
const TRACK_3_JUMPSCARE_URL = '/assets/aistudio/Nightmare_scream_jumpscare_SFX_8c4f4172.mp3';
const MENU_AMBIENT_URL = '/audio/menu_theme.mp3';

class ProceduralAudioEngine {
  private ctx: AudioContext | null = null;
  private _enabled: boolean = true;

  private track1Ambient: HTMLAudioElement | null = null;
  private track2ThreatLoS: HTMLAudioElement | null = null;
  private track3Jumpscare: HTMLAudioElement | null = null;
  private trackMenuAmbient: HTMLAudioElement | null = null;

  private isTrack2Active: boolean = false;
  private isGameOverState: boolean = false;
  private isMenuAudioActive: boolean = false;
  private initializedTracks: boolean = false;
  private heartbeatTimer: number = 0;

  // Industrial drone nodes
  private droneOsc1: OscillatorNode | null = null;
  private droneOsc2: OscillatorNode | null = null;
  private droneLFO: OscillatorNode | null = null;
  private droneGain: GainNode | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.initMultiTrackAudio();
    }
  }

  public get enabled(): boolean {
    return this._enabled;
  }

  public set enabled(val: boolean) {
    this._enabled = val;
    this.syncMultiTrackVolumes();
  }

  /**
   * Initializes the parallel HTML5 Audio elements and attaches gesture-unlock listeners.
   */
  public initMultiTrackAudio() {
    if (this.initializedTracks || typeof window === 'undefined') return;
    this.initializedTracks = true;

    // Track 1: Continuous Ambient Loop ("Omniscient Evil")
    this.track1Ambient = new Audio(TRACK_1_AMBIENT_URL);
    this.track1Ambient.loop = true;
    this.track1Ambient.preload = 'auto';
    this.track1Ambient.volume = 0.68;

    // Track 2: Parallel Threat Sight-Line Track ("Bass Boosted ... You can't escape")
    this.track2ThreatLoS = new Audio(TRACK_2_THREAT_LOS_URL);
    this.track2ThreatLoS.loop = true;
    this.track2ThreatLoS.preload = 'auto';
    this.track2ThreatLoS.volume = 0.0;
    this.track2ThreatLoS.muted = true;

    // Track 3: Jumpscare Scream & Game-Over Sting ("Nightmare scream jumpscare SFX")
    this.track3Jumpscare = new Audio(TRACK_3_JUMPSCARE_URL);
    this.track3Jumpscare.loop = false;
    this.track3Jumpscare.preload = 'auto';
    this.track3Jumpscare.volume = 1.0;

    // Menu Ambient: Eerie Cathedral Audio ("Cavernous Silence")
    this.trackMenuAmbient = new Audio(MENU_AMBIENT_URL);
    this.trackMenuAmbient.loop = true;
    this.trackMenuAmbient.preload = 'auto';
    this.trackMenuAmbient.volume = 0.62;

    // Ensure browser autoplay policy unlocks immediately on any pointer/key interaction
    const unlockAudio = () => {
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      if (this._enabled) {
        if (this.isMenuAudioActive && this.trackMenuAmbient && this.trackMenuAmbient.paused) {
          this.trackMenuAmbient.play().catch(() => {});
        }
        if (!this.isGameOverState && !this.isMenuAudioActive) {
          if (this.track1Ambient && this.track1Ambient.paused && this.track1Ambient.volume > 0) {
            this.track1Ambient.play().catch(() => {});
          }
          if (this.isTrack2Active && this.track2ThreatLoS && this.track2ThreatLoS.paused) {
            this.track2ThreatLoS.play().catch(() => {});
          }
        }
      }
    };

    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio, { passive: true });
    window.addEventListener('click', unlockAudio, { passive: true });
  }

  private syncMultiTrackVolumes() {
    if (!this.initializedTracks) return;

    if (!this._enabled) {
      if (this.track1Ambient) this.track1Ambient.muted = true;
      if (this.track2ThreatLoS) this.track2ThreatLoS.muted = true;
      if (this.track3Jumpscare) this.track3Jumpscare.muted = true;
      if (this.trackMenuAmbient) this.trackMenuAmbient.muted = true;
      if (this.droneGain) this.droneGain.gain.value = 0;
      return;
    }

    if (this.trackMenuAmbient) {
      this.trackMenuAmbient.muted = false;
      if (this.isMenuAudioActive && this.trackMenuAmbient.paused) {
        this.trackMenuAmbient.play().catch(() => {});
      }
    }
    if (this.track1Ambient) {
      this.track1Ambient.muted = false;
      if (!this.isGameOverState && !this.isMenuAudioActive && this.track1Ambient.paused) {
        this.track1Ambient.play().catch(() => {});
      }
    }
    if (this.track2ThreatLoS) {
      this.track2ThreatLoS.muted = !this.isTrack2Active || this.isGameOverState || this.isMenuAudioActive;
      this.track2ThreatLoS.volume = this.isTrack2Active && !this.isGameOverState && !this.isMenuAudioActive ? 0.92 : 0.0;
    }
    if (this.track3Jumpscare) {
      this.track3Jumpscare.muted = false;
      this.track3Jumpscare.volume = 1.0;
    }
  }

  /**
   * Starts playing the Gothic Cathedral Menu Ambient Audio ("Cavernous Silence").
   */
  public startMenuAudio() {
    this.initMultiTrackAudio();
    this.isMenuAudioActive = true;
    this.stopAmbientLoop();
    this.setThreatSightLineActive(false);

    if (this.trackMenuAmbient && this._enabled) {
      this.trackMenuAmbient.muted = false;
      this.trackMenuAmbient.volume = 0.62;
      this.trackMenuAmbient.currentTime = 0;
      this.trackMenuAmbient.play().catch(() => {});
    }
  }

  /**
   * Cuts the Menu Ambient Audio when breaching containment and launching into the 3D engine.
   */
  public stopMenuAudio() {
    this.isMenuAudioActive = false;
    if (this.trackMenuAmbient) {
      this.trackMenuAmbient.pause();
      this.trackMenuAmbient.currentTime = 0;
    }
  }

  /**
   * Starts or restarts Track 1 (Continuous Ambient Loop) for an active game session.
   */
  public startAmbientLoop() {
    this.initMultiTrackAudio();
    this.isGameOverState = false;
    this.isMenuAudioActive = false;
    this.setThreatSightLineActive(false);

    if (this.track3Jumpscare) {
      this.track3Jumpscare.pause();
      this.track3Jumpscare.currentTime = 0;
    }

    if (this.track1Ambient) {
      this.track1Ambient.muted = !this._enabled;
      this.track1Ambient.volume = 0.68;
      if (this.track1Ambient.paused && this._enabled) {
        this.track1Ambient.play().catch(() => {});
      }
    }
  }

  /**
   * Stops in-game Track 1 ambient loop.
   */
  public stopAmbientLoop() {
    if (this.track1Ambient) {
      this.track1Ambient.pause();
      this.track1Ambient.currentTime = 0;
    }
  }

  /**
   * Synthesizes a low, vibrating industrial drone sound effect for the Studio Intro.
   */
  public playIndustrialDrone() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    this.stopIndustrialDrone();

    const now = ctx.currentTime;

    // Sub-bass detuned dual oscillators (38Hz and 41.5Hz for binaural beating rumble)
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const mainGain = ctx.createGain();

    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(38, now);
    osc1.frequency.linearRampToValueAtTime(32, now + 3.5);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(41.5, now);
    osc2.frequency.linearRampToValueAtTime(35.5, now + 3.5);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(65, now);
    filter.frequency.exponentialRampToValueAtTime(140, now + 1.8);
    filter.frequency.exponentialRampToValueAtTime(50, now + 3.5);
    filter.Q.setValueAtTime(4.2, now);

    // Subtle 4Hz vibrating industrial pulsation
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(3.8, now);
    lfoGain.gain.setValueAtTime(12, now);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    mainGain.gain.setValueAtTime(0.001, now);
    mainGain.gain.linearRampToValueAtTime(0.38, now + 0.9);
    mainGain.gain.setValueAtTime(0.38, now + 2.5);
    mainGain.gain.exponentialRampToValueAtTime(0.001, now + 4.2);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(mainGain);
    mainGain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    lfo.start(now);

    this.droneOsc1 = osc1;
    this.droneOsc2 = osc2;
    this.droneLFO = lfo;
    this.droneGain = mainGain;
  }

  public stopIndustrialDrone() {
    try {
      if (this.droneOsc1) {
        this.droneOsc1.stop();
        this.droneOsc1.disconnect();
      }
      if (this.droneOsc2) {
        this.droneOsc2.stop();
        this.droneOsc2.disconnect();
      }
      if (this.droneLFO) {
        this.droneLFO.stop();
        this.droneLFO.disconnect();
      }
      if (this.droneGain) {
        this.droneGain.disconnect();
      }
    } catch {
      // Ignored
    }
    this.droneOsc1 = null;
    this.droneOsc2 = null;
    this.droneLFO = null;
    this.droneGain = null;
  }

  /**
   * Controls Track 2 (Parallel Threat Sight-Line Track):
   * - When active === true: Plays simultaneously alongside Track 1.
   * - When active === false: Instantly cuts the exact microsecond line-of-sight is broken
   *   while Track 1 continues uninterrupted.
   */
  public setThreatSightLineActive(active: boolean) {
    this.initMultiTrackAudio();
    const shouldPlay = active && !this.isGameOverState && !this.isMenuAudioActive;
    if (this.isTrack2Active === shouldPlay) return;
    this.isTrack2Active = shouldPlay;

    if (!this.track2ThreatLoS) return;

    if (shouldPlay) {
      this.track2ThreatLoS.muted = !this._enabled;
      this.track2ThreatLoS.volume = 0.92;
      if (this.track2ThreatLoS.paused) {
        this.track2ThreatLoS.play().catch(() => {});
      }
    } else {
      // Instant cut the microsecond line-of-sight is broken while Track 1 continues uninterrupted
      this.track2ThreatLoS.volume = 0.0;
      this.track2ThreatLoS.muted = true;
      this.track2ThreatLoS.pause();
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this._enabled) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public playFootstep() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(92, now);
    osc.frequency.exponentialRampToValueAtTime(34, now + 0.085);

    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.095);
  }

  public playJump() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(215, now + 0.11);

    gain.gain.setValueAtTime(0.065, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.125);
  }

  public playLanding() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(125, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.13);

    gain.gain.setValueAtTime(0.11, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.145);
  }

  public playFlashlightClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'square';
    osc.frequency.setValueAtTime(1450, now);
    osc.frequency.exponentialRampToValueAtTime(420, now + 0.035);

    gain.gain.setValueAtTime(0.05, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.045);
  }

  public playKeycardPickup() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const tones = [880, 1174.66, 1760];
    tones.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);

      gain.gain.setValueAtTime(0.001, now + i * 0.055);
      gain.gain.linearRampToValueAtTime(0.085, now + i * 0.055 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + i * 0.055 + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.3);
    });
  }

  /**
   * Heavy grinding granite stone sound when the Weeping Angel moves unseen in direct corridor LoS.
   */
  public playStoneScrape(intensity: number = 1.0) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(64, now);
    osc.frequency.linearRampToValueAtTime(42, now + 0.18);

    subOsc.type = 'triangle';
    subOsc.frequency.setValueAtTime(38, now);
    subOsc.frequency.exponentialRampToValueAtTime(22, now + 0.19);

    const vol = Math.min(0.14, 0.07 * intensity);
    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(vol, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.21);
    subOsc.stop(now + 0.21);
  }

  /**
   * Triggers Track 3 (Nightmare Scream Jumpscare SFX) at 100% volume and cuts Track 1 & Track 2.
   */
  public playAngelJumpscare() {
    this.initMultiTrackAudio();
    this.isGameOverState = true;

    // Immediately cut Track 2 and pause Track 1 on Game Over
    this.setThreatSightLineActive(false);
    if (this.track1Ambient) {
      this.track1Ambient.pause();
    }

    // Trigger Track 3 at 100% volume immediately
    if (this.track3Jumpscare && this._enabled) {
      this.track3Jumpscare.muted = false;
      this.track3Jumpscare.volume = 1.0;
      this.track3Jumpscare.currentTime = 0;
      this.track3Jumpscare.play().catch(() => {});
    }
  }

  public playExtractionUnlocked() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [440, 554.37, 659.25, 880, 1108.73];
    chord.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.07);

      gain.gain.setValueAtTime(0.001, now + idx * 0.07);
      gain.gain.linearRampToValueAtTime(0.095, now + idx * 0.07 + 0.035);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.07 + 0.85);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.9);
    });
  }

  /**
   * Triggers a warping spatial audio effect when the player enters the unlocked extraction portal,
   * immediately cutting Track 2 and sweeping stereo-panned oscillators + harmonic sub-bass.
   */
  public playTeleportWarp() {
    this.initMultiTrackAudio();
    this.setThreatSightLineActive(false);

    if (this.track1Ambient) {
      this.track1Ambient.volume = 0.22;
    }

    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // 1. Deep Sub-Bass Dimensional Tear Sweep (55 Hz -> 220 Hz -> 42 Hz)
    const subOsc = ctx.createOscillator();
    const subGain = ctx.createGain();
    subOsc.type = 'sawtooth';
    subOsc.frequency.setValueAtTime(55, now);
    subOsc.frequency.exponentialRampToValueAtTime(240, now + 0.85);
    subOsc.frequency.exponentialRampToValueAtTime(42, now + 1.65);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(180, now);
    filter.frequency.exponentialRampToValueAtTime(2600, now + 0.95);
    filter.frequency.exponentialRampToValueAtTime(320, now + 1.65);

    subGain.gain.setValueAtTime(0.001, now);
    subGain.gain.linearRampToValueAtTime(0.16, now + 0.18);
    subGain.gain.linearRampToValueAtTime(0.19, now + 0.95);
    subGain.gain.exponentialRampToValueAtTime(0.0008, now + 1.7);

    subOsc.connect(filter);
    filter.connect(subGain);
    subGain.connect(ctx.destination);
    subOsc.start(now);
    subOsc.stop(now + 1.75);

    // 2. Spatial Stereo-Warping Harmonic Shimmer Layers
    const warpFreqs = [220, 329.63, 440, 659.25, 880, 1318.51];
    warpFreqs.forEach((baseFreq, idx) => {
      const osc = ctx.createOscillator();
      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      const gain = ctx.createGain();

      osc.type = idx % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(baseFreq * 0.65, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.85, now + 1.05);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.5, now + 1.75);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(7.5 + idx * 2.4, now);
      lfoGain.gain.setValueAtTime(18 + idx * 9, now);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);

      gain.gain.setValueAtTime(0.001, now + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.055, now + 0.35 + idx * 0.04);
      gain.gain.linearRampToValueAtTime(0.08, now + 1.05);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 1.85);

      if (typeof ctx.createStereoPanner === 'function') {
        const panner = ctx.createStereoPanner();
        const startPan = idx % 2 === 0 ? -0.85 : 0.85;
        panner.pan.setValueAtTime(startPan, now);
        panner.pan.linearRampToValueAtTime(-startPan, now + 0.85);
        panner.pan.linearRampToValueAtTime(0, now + 1.65);
        osc.connect(panner);
        panner.connect(gain);
      } else {
        osc.connect(gain);
      }

      gain.connect(ctx.destination);
      osc.start(now + idx * 0.04);
      lfo.start(now + idx * 0.04);
      osc.stop(now + 1.9);
      lfo.stop(now + 1.9);
    });
  }

  /**
   * Dynamic Proximity Heartbeat System:
   * Increases heartbeat tempo (BPM) and visceral chest-thump volume as the player gets
   * closer to the nearest Weeping Angel within a 16-meter auditory detection radius.
   *
   * - At 16.0m: ~60 BPM (1.00s interval), subtle low-frequency pulse
   * - At 8.0m:  ~105 BPM (0.57s interval), tense rhythmic thumping
   * - At <=2.0m: ~168 BPM (0.357s interval), frantic, pounding panic heartbeat
   */
  public updateProximityHeartbeat(
    dt: number,
    minAngelDistance: number,
    isActive: boolean = true
  ) {
    if (
      !isActive ||
      !this._enabled ||
      this.isGameOverState ||
      !Number.isFinite(minAngelDistance) ||
      minAngelDistance > 16.0
    ) {
      // Keep timer slightly primed so entering proximity responds promptly without spamming
      this.heartbeatTimer = Math.min(this.heartbeatTimer, 0.25);
      return;
    }

    const maxRadius = 16.0;
    const minRadius = 1.4;
    const clampedDist = Math.max(minRadius, Math.min(maxRadius, minAngelDistance));

    // Normalized proximity: 0.0 at 16m -> 1.0 at <=1.4m
    const proximity = (maxRadius - clampedDist) / (maxRadius - minRadius);
    const curvedProximity = Math.pow(proximity, 1.22);

    // Tempo scales from 60 BPM (1.0s per beat) at 16m up to 170 BPM (0.353s per beat) at <=1.4m
    const bpm = 60 + curvedProximity * 110;
    const beatInterval = 60 / bpm;

    this.heartbeatTimer += dt;
    if (this.heartbeatTimer >= beatInterval) {
      this.heartbeatTimer = 0;
      const intensity = 0.22 + curvedProximity * 0.78;
      this.playHeartbeatPulse(intensity, beatInterval);
    }
  }

  /**
   * Synthesizes a realistic dual-beat ("lub-dub") low-frequency human heartbeat
   * using Web Audio API oscillators and resonant low-pass filtering.
   */
  public playHeartbeatPulse(intensity: number = 0.6, beatInterval: number = 0.65) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const clampedIntensity = Math.max(0.15, Math.min(1.0, intensity));

    // Helper to schedule a single visceral chest thump ("lub" or "dub")
    const triggerBeat = (
      startTime: number,
      startFreq: number,
      endFreq: number,
      duration: number,
      peakGain: number
    ) => {
      // Sub-bass body oscillator
      const subOsc = ctx.createOscillator();
      // Chest transient harmonic layer
      const bodyOsc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(startFreq, startTime);
      subOsc.frequency.exponentialRampToValueAtTime(endFreq, startTime + duration);

      bodyOsc.type = 'triangle';
      bodyOsc.frequency.setValueAtTime(startFreq * 1.45, startTime);
      bodyOsc.frequency.exponentialRampToValueAtTime(endFreq * 1.1, startTime + duration * 0.85);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120 + clampedIntensity * 55, startTime);
      filter.Q.setValueAtTime(2.4, startTime);

      gain.gain.setValueAtTime(0.0008, startTime);
      gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0008, startTime + duration);

      subOsc.connect(filter);
      bodyOsc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      subOsc.start(startTime);
      bodyOsc.start(startTime);
      subOsc.stop(startTime + duration + 0.015);
      bodyOsc.stop(startTime + duration + 0.015);
    };

    // 1. Primary systolic beat ("LUB")
    const lubGain = 0.065 + clampedIntensity * 0.21;
    triggerBeat(now, 62 + clampedIntensity * 14, 26, 0.115, lubGain);

    // 2. Secondary diastolic valve closure beat ("DUB") — tighter and slightly higher pitched
    const dubDelay = Math.max(0.105, Math.min(0.22, beatInterval * 0.32));
    const dubGain = (0.05 + clampedIntensity * 0.165) * 0.88;
    triggerBeat(now + dubDelay, 74 + clampedIntensity * 16, 30, 0.095, dubGain);
  }

  public playObjectiveReached() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [523.25, 659.25, 783.99, 1046.5];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.06);

      gain.gain.setValueAtTime(0.001, now + idx * 0.06);
      gain.gain.linearRampToValueAtTime(0.07, now + idx * 0.06 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.06 + 0.9);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.95);
    });
  }

  public playButtonHover() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(840, now);
    osc.frequency.exponentialRampToValueAtTime(1260, now + 0.03);
    gain.gain.setValueAtTime(0.025, now);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.035);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  public playButtonClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const subOsc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.07);
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(140, now);
    subOsc.frequency.exponentialRampToValueAtTime(35, now + 0.07);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.075);
    osc.connect(gain);
    subOsc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.08);
    subOsc.stop(now + 0.08);
  }

  public playTypewriterClick() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const randPitch = 580 + Math.random() * 240;
    osc.type = 'square';
    osc.frequency.setValueAtTime(randPitch, now);
    osc.frequency.exponentialRampToValueAtTime(randPitch * 0.4, now + 0.022);
    gain.gain.setValueAtTime(0.032, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.026);
  }

  public playBreachAlarm() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const sub = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.linearRampToValueAtTime(75, now + 0.65);

    sub.type = 'sine';
    sub.frequency.setValueAtTime(90, now);
    sub.frequency.linearRampToValueAtTime(32, now + 0.65);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.68);

    osc.connect(gain);
    sub.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    sub.start(now);
    osc.stop(now + 0.7);
    sub.stop(now + 0.7);
  }
}

export const soundEngine = new ProceduralAudioEngine();
