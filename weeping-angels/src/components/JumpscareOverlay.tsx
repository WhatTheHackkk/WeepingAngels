import React, { useEffect, useRef, useState } from 'react';

interface JumpscareOverlayProps {
  isBlinking: boolean;
  isGameOver: boolean;
  elapsedSeconds: number;
  collectedKeycardsCount: number;
  totalKeycardsCount: number;
  onRetryCurrentMaze: () => void;
  onGenerateNewMaze: () => void;
  onReturnToMainMenu?: () => void;
}

const HORROR_DEATH_DIALOGUE_POOL: readonly string[] = [
  "Don't blink. Don't even look away.",
  'The stone consumed your shadow.',
  'It was standing right behind you the whole time.',
  "Blink and you're dust.",
  'The labyrinth remembers your panic.',
  'You heard the granite grinding only when it was already over.',
  'Every time your light wavered, its claws crept closer.',
  'Cold masonry has no mercy for the unwatchful.',
  'Your eyelids betrayed you to the dark.',
  'Another weeping statue now stands where you fell.',
];

const BLOOD_VERTEX_SHADER = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`;

const BLOOD_FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform float uTime;
  uniform float uSeed;
  uniform vec2 uResolution;

  float hash(vec2 p) {
    p = fract(p * vec2(123.34 + uSeed * 0.01, 456.21 + uSeed * 0.02));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float amp = 0.5;
    mat2 rot = mat2(0.80, -0.60, 0.60, 0.80);
    for (int i = 0; i < 5; i++) {
      v += amp * noise(p);
      p = rot * p * 2.03 + vec2(17.1, 31.7);
      amp *= 0.5;
    }
    return v;
  }

  // Computes the organic 3D viscous blood thickness field H(uv) with zero circular shapes:
  // - Jagged, irregular downward streaks of varying widths
  // - Diagonal claw-ripped arterial smears
  // - Dark coagulated pooling at the bottom and corners of the screen
  float computeBloodThickness(vec2 uv, float t) {
    // Convert to top-down y coordinate (yTop = 0 at top of screen, 1 at bottom of screen)
    float yTop = 1.0 - uv.y;
    float x = uv.x;

    // Multi-scale domain warping so streaks pinch, widen, and meander jaggedly
    vec2 warp1 = vec2(
      fbm(vec2(x * 5.5 + uSeed, yTop * 3.2)),
      fbm(vec2(x * 4.2, yTop * 6.0 + uSeed))
    );
    vec2 warp2 = vec2(
      fbm(vec2(x * 16.0 + warp1.x * 2.4, yTop * 9.5)),
      fbm(vec2(x * 12.0, yTop * 14.0 + warp1.y * 2.4))
    );

    float xWarped = x + (warp1.x - 0.5) * 0.095 + (warp2.x - 0.5) * 0.032;

    // 1. Jagged, Irregular Downward Viscous Streaks of Varying Widths
    // Broad heavy clots + medium rivulets + fine jagged capillary streaks
    float colBroad = fbm(vec2(xWarped * 6.5 + uSeed, 0.35));
    float colMed = fbm(vec2(xWarped * 18.0 - uSeed * 0.7, 1.15));
    float colFine = fbm(vec2(xWarped * 44.0 + warp1.y * 1.8, 2.75));

    float streakRidge = pow(clamp(colBroad * 0.58 + colMed * 0.34 + colFine * 0.28 - 0.22, 0.0, 1.0), 1.35);

    // Viscous gravity advancement: thicker columns advance with irregular speed,
    // and the leading front is torn and jagged (never a rounded bead!)
    float flowRate = 0.35 + colBroad * 0.85 + colMed * 0.55;
    float gravityAdvance = (1.0 - exp(-t * (0.95 + flowRate * 1.15))) * (0.28 + streakRidge * 0.98);
    float jaggedFrontNoise = (warp2.y - 0.5) * 0.14 + (colFine - 0.5) * 0.09;
    float streakReach = gravityAdvance + jaggedFrontNoise;

    // Taper to a sharp, jagged point at the leading front and vary thickness along the streak
    float frontDist = streakReach - yTop;
    float streakMask = smoothstep(-0.015, 0.09, frontDist) * smoothstep(0.18, 0.52, streakRidge);
    float clotModulation = 0.55 + 0.65 * fbm(vec2(xWarped * 14.0, yTop * 11.0 - t * 0.45));
    float downwardStreaks = streakMask * streakRidge * clotModulation * 1.45;

    // 2. Jagged Diagonal Arterial Claw-Ripped Smears Across the Lens (Triggered at t > 0.12s)
    float slashProgress = clamp((t - 0.12) * 4.5, 0.0, 1.0);
    float rotCoord = (x - 0.5) * 0.68 + (yTop - 0.46) * 0.73 + (warp1.x - 0.5) * 0.12;
    float alongSlash = -(x - 0.5) * 0.73 + (yTop - 0.46) * 0.68;
    float slashPattern = abs( fract(rotCoord * 5.8 + 0.15) - 0.5 );
    float slashWidth = 0.095 * (1.0 - smoothstep(0.0, 0.52, abs(alongSlash))) * warp2.x;
    float clawSmear = smoothstep(slashWidth, 0.0, slashPattern - 0.03) *
                      smoothstep(0.55, 0.12, abs(alongSlash)) *
                      slashProgress * (0.65 + 0.6 * warp2.y);

    // 3. Dark Coagulated Pooling at the Bottom of the Screen & Peripheral Frame
    float bottomRise = 0.09 + 0.16 * (1.0 - exp(-t * 0.85));
    float bottomMeniscus = bottomRise + (warp1.x - 0.5) * 0.085 + (warp2.x - 0.5) * 0.035;
    float bottomPool = smoothstep(1.0 - bottomMeniscus - 0.09, 1.0 - bottomMeniscus * 0.25, yTop) *
                       (0.95 + 0.45 * warp1.y);

    // Top & corner arterial seepage frame (leaving the center window open for the 3D Angel)
    vec2 centerOffset = (uv - vec2(0.5, 0.54)) * vec2(1.0, 1.25);
    float radialDist = length(centerOffset) + (warp1.x - 0.5) * 0.18 + (warp2.y - 0.5) * 0.09;
    float framePool = smoothstep(0.36, 0.76, radialDist) * (0.65 + 0.55 * warp1.y);

    // Combine all organic fluid layers
    float totalThickness = downwardStreaks + clawSmear * 0.85 + bottomPool * 1.45 + framePool * 0.92;
    return max(0.0, totalThickness);
  }

  void main() {
    float t = uTime;
    float shock = max(0.0, 1.0 - t * 1.25);

    // VHS horizontal tracking tear displacement smeared across CRT scanlines
    float scanlineY = floor(vUv.y * uResolution.y * 0.5);
    float tearNoise = hash(vec2(scanlineY * 0.13, floor(t * 24.0)));
    float tearShift = (tearNoise > 0.92)
      ? (tearNoise - 0.92) * 12.5 * (0.25 + shock * 0.95) * (hash(vec2(scanlineY, t)) - 0.5)
      : 0.0;

    vec2 uv = vec2(clamp(vUv.x + tearShift, 0.0, 1.0), vUv.y);

    // Sample 3D viscous blood thickness & finite-difference gradients for surface normal
    vec2 eps = vec2(1.5 / max(uResolution.x, 1.0), 1.5 / max(uResolution.y, 1.0));
    float hCenter = computeBloodThickness(uv, t);
    float hRight = computeBloodThickness(uv + vec2(eps.x, 0.0), t);
    float hUp = computeBloodThickness(uv + vec2(0.0, eps.y), t);

    float dHx = (hRight - hCenter) / eps.x;
    float dHy = (hUp - hCenter) / eps.y;

    // 3D Surface Normal of the viscous blood film on the camera lens
    vec3 normal = normalize(vec3(-dHx * 0.045, -dHy * 0.045, 1.0));
    vec3 viewDir = vec3(0.0, 0.0, 1.0);

    // Dual light sources for wet glossy specular highlights (flashlight bounce + overhead rim)
    vec3 lightDir1 = normalize(vec3(-0.32, 0.58, 0.75));
    vec3 halfVec1 = normalize(lightDir1 + viewDir);
    float spec1 = pow(max(dot(normal, halfVec1), 0.0), 64.0);

    vec3 lightDir2 = normalize(vec3(0.45, 0.35, 0.82));
    vec3 halfVec2 = normalize(lightDir2 + viewDir);
    float spec2 = pow(max(dot(normal, halfVec2), 0.0), 36.0);

    // Fresnel rim glint on curved meniscus edges of the blood streaks
    float edgeSlope = clamp(length(vec2(dHx, dHy)) * 0.055, 0.0, 1.0);
    float wetMask = smoothstep(0.08, 0.28, hCenter);
    float glossyHighlight = (spec1 * 0.85 + spec2 * 0.45 + pow(edgeSlope, 2.2) * 0.38) * wetMask;

    // Beer-Lambert Subsurface Crimson Absorption:
    // Thin smears = bright semi-translucent arterial crimson
    // Thick ridges & bottom coagulated pool = deep, nearly black venous oxblood
    vec3 absorption = exp(-hCenter * vec3(1.65, 14.5, 17.5));
    vec3 arterialTint = vec3(0.72, 0.025, 0.035);
    vec3 coagulatedCore = vec3(0.07, 0.003, 0.005);
    vec3 bloodColor = mix(coagulatedCore, arterialTint * absorption, clamp(absorption.r, 0.0, 1.0));

    // Add wet specular reflection (warm pinkish-white glint on wet blood ridges)
    bloodColor += vec3(1.0, 0.72, 0.74) * glossyHighlight * 0.68;

    // CRT Scanline modulation smeared unevenly by the blood thickness
    float scanlineWave = 0.86 + 0.14 * sin(vUv.y * uResolution.y * 3.14159);
    float scanlineSmear = mix(scanlineWave, 1.0, clamp(hCenter * 0.65, 0.0, 0.85));
    bloodColor *= scanlineSmear;

    // Semi-translucent crimson alpha gradient + dark peripheral vignette
    float fluidAlpha = smoothstep(0.03, 0.22, hCenter) * clamp(0.38 + hCenter * 0.58, 0.0, 0.97);
    float vignette = smoothstep(0.28, 0.82, length((vUv - vec2(0.5, 0.52)) * vec2(1.05, 1.25)));
    float finalAlpha = clamp(max(fluidAlpha, vignette * 0.92), 0.0, 0.98);

    vec3 finalRgb = mix(vec3(0.03, 0.002, 0.004), bloodColor, smoothstep(0.02, 0.16, hCenter));
    gl_FragColor = vec4(finalRgb, finalAlpha);
  }
`;

export const JumpscareOverlay: React.FC<JumpscareOverlayProps> = ({
  isBlinking,
  isGameOver,
  onRetryCurrentMaze,
  onGenerateNewMaze,
  onReturnToMainMenu,
}) => {
  const shaderCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const lastQuoteIndexRef = useRef<number>(-1);
  const [deathQuote, setDeathQuote] = useState<string>(HORROR_DEATH_DIALOGUE_POOL[0]);
  const [textFlicker, setTextFlicker] = useState<{
    opacity: number;
    skewX: number;
    offsetY: number;
  }>({
    opacity: 1,
    skewX: 0,
    offsetY: 0,
  });

  // Select a random psychological horror quote from the pool every time the player dies
  useEffect(() => {
    if (!isGameOver) return;
    let idx = Math.floor(Math.random() * HORROR_DEATH_DIALOGUE_POOL.length);
    if (idx === lastQuoteIndexRef.current && HORROR_DEATH_DIALOGUE_POOL.length > 1) {
      idx =
        (idx + 1 + Math.floor(Math.random() * (HORROR_DEATH_DIALOGUE_POOL.length - 1))) %
        HORROR_DEATH_DIALOGUE_POOL.length;
    }
    lastQuoteIndexRef.current = idx;
    setDeathQuote(HORROR_DEATH_DIALOGUE_POOL[idx]);
  }, [isGameOver]);

  // WebGL Post-Processing Blood & Analog Horror Fragment Shader Execution
  useEffect(() => {
    if (!isGameOver) return;
    const canvas = shaderCanvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext('webgl', { alpha: true, premultipliedAlpha: false }) as WebGLRenderingContext | null) ||
      (canvas.getContext('experimental-webgl', { alpha: true, premultipliedAlpha: false }) as WebGLRenderingContext | null);

    let animId = 0;
    const startTime = performance.now();
    const randomSeed = 11.7 + Math.random() * 83.4;

    if (gl) {
      const compileShader = (type: number, source: string) => {
        const shader = gl.createShader(type);
        if (!shader) return null;
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
          gl.deleteShader(shader);
          return null;
        }
        return shader;
      };

      const vs = compileShader(gl.VERTEX_SHADER, BLOOD_VERTEX_SHADER);
      const fs = compileShader(gl.FRAGMENT_SHADER, BLOOD_FRAGMENT_SHADER);
      const program = gl.createProgram();

      if (vs && fs && program) {
        gl.attachShader(program, vs);
        gl.attachShader(program, fs);
        gl.linkProgram(program);

        const quadBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
        gl.bufferData(
          gl.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
          gl.STATIC_DRAW
        );

        const aPosLoc = gl.getAttribLocation(program, 'aPosition');
        const uTimeLoc = gl.getUniformLocation(program, 'uTime');
        const uSeedLoc = gl.getUniformLocation(program, 'uSeed');
        const uResLoc = gl.getUniformLocation(program, 'uResolution');

        const renderShaderFrame = () => {
          const now = performance.now();
          const elapsed = (now - startTime) / 1000;

          gl.viewport(0, 0, canvas.width, canvas.height);
          gl.clearColor(0, 0, 0, 0);
          gl.clear(gl.COLOR_BUFFER_BIT);

          gl.useProgram(program);
          gl.bindBuffer(gl.ARRAY_BUFFER, quadBuffer);
          gl.enableVertexAttribArray(aPosLoc);
          gl.vertexAttribPointer(aPosLoc, 2, gl.FLOAT, false, 0, 0);

          gl.uniform1f(uTimeLoc, elapsed);
          gl.uniform1f(uSeedLoc, randomSeed);
          gl.uniform2f(uResLoc, canvas.width, canvas.height);

          gl.drawArrays(gl.TRIANGLES, 0, 6);

          if (Math.random() > 0.72) {
            setTextFlicker({
              opacity: 0.55 + Math.random() * 0.45,
              skewX: (Math.random() - 0.5) * 4.5,
              offsetY: (Math.random() - 0.5) * 3.0,
            });
          } else {
            setTextFlicker({ opacity: 0.96, skewX: 0, offsetY: 0 });
          }

          animId = requestAnimationFrame(renderShaderFrame);
        };

        animId = requestAnimationFrame(renderShaderFrame);

        return () => {
          cancelAnimationFrame(animId);
          gl.deleteBuffer(quadBuffer);
          gl.deleteProgram(program);
          gl.deleteShader(vs);
          gl.deleteShader(fs);
        };
      }
    }

    // Per-pixel organic FBM fluid fallback if a secondary WebGL context is unavailable
    const ctx2d = canvas.getContext('2d');
    if (!ctx2d) return;
    const w = canvas.width;
    const h = canvas.height;
    const imgData = ctx2d.createImageData(w, h);
    const data = imgData.data;

    const hash2 = (x: number, y: number) => {
      const s = Math.sin(x * 127.1 + y * 311.7 + randomSeed) * 43758.5453;
      return s - Math.floor(s);
    };

    const renderFallback = () => {
      const elapsed = (performance.now() - startTime) / 1000;
      const grow = 1.0 - Math.exp(-elapsed * 1.4);
      for (let py = 0; py < h; py++) {
        const yTop = py / h;
        const scan = py % 2 === 0 ? 0.85 : 1.0;
        for (let px = 0; px < w; px++) {
          const x = px / w;
          const n = hash2(Math.floor(x * 45), Math.floor(yTop * 12));
          const streak = Math.max(0, Math.sin(x * 28 + Math.sin(yTop * 8) * 1.8) * 0.5 + 0.5);
          const reach = grow * (0.25 + streak * 0.85);
          const inStreak = yTop < reach ? (reach - yTop) * streak : 0;
          const bottomPool = yTop > 0.78 ? (yTop - 0.78) * 4.2 : 0;
          const thickness = inStreak + bottomPool + n * 0.08;
          const idx = (py * w + px) * 4;
          data[idx] = Math.min(255, Math.round((45 + thickness * 115) * scan));
          data[idx + 1] = Math.round(4 * scan);
          data[idx + 2] = Math.round(6 * scan);
          data[idx + 3] = Math.min(248, Math.round(Math.min(1, thickness * 1.6) * 245));
        }
      }
      ctx2d.putImageData(imgData, 0, 0);
      animId = requestAnimationFrame(renderFallback);
    };

    animId = requestAnimationFrame(renderFallback);
    return () => cancelAnimationFrame(animId);
  }, [isGameOver]);

  return (
    <>
      {/* Manual Eyelid Blink Vignette */}
      <div
        className="fixed inset-0 z-30 pointer-events-none bg-black transition-opacity duration-75"
        style={{
          opacity: isBlinking && !isGameOver ? 0.97 : 0,
        }}
        aria-hidden="true"
      />

      {/* Dismal Analog-Horror & Photorealistic WebGL Blood Shader Death Screen */}
      {isGameOver && (
        <div
          className="fixed inset-0 z-50 flex flex-col items-center justify-end pb-14 md:pb-20 px-6 pointer-events-auto select-none"
          role="alertdialog"
          aria-label="You were claimed by the Weeping Angel"
        >
          {/* Full-Bleed WebGL Post-Processing Blood Fragment Shader Canvas */}
          <canvas
            ref={shaderCanvasRef}
            width={640}
            height={360}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* Haunting Minimalist Horror Typography & Actions */}
          <div className="relative z-10 max-w-xl w-full text-center flex flex-col items-center">
            {/* Flickering Crimson Horror Epitaph */}
            <h2
              className="font-serif text-3xl md:text-5xl font-bold tracking-[0.28em] uppercase text-[#dc2626]"
              style={{
                opacity: textFlicker.opacity,
                transform: `translateY(${textFlicker.offsetY}px) skewX(${textFlicker.skewX}deg)`,
                textShadow:
                  '0 0 22px rgba(220, 38, 38, 0.9), 3px 0 1px rgba(110, 6, 10, 0.95), -2px 0 1px rgba(45, 0, 0, 0.95)',
              }}
            >
              CONSUMED BY STONE
            </h2>

            {/* Thin Blood-Stained Hairline Divider */}
            <div
              className="w-48 h-px my-5"
              style={{
                background:
                  'linear-gradient(90deg, rgba(127,29,29,0) 0%, rgba(220,38,38,0.85) 50%, rgba(127,29,29,0) 100%)',
              }}
            />

            {/* Randomized Psychological Horror Death Quote */}
            <p
              className="font-serif italic text-lg md:text-2xl text-[#e2d6c5] tracking-wide leading-relaxed max-w-lg"
              style={{
                textShadow: '0 2px 14px rgba(0, 0, 0, 0.98), 0 0 10px rgba(153, 27, 27, 0.65)',
              }}
            >
              &ldquo;{deathQuote}&rdquo;
            </p>

            {/* Raw Minimalist Analog-Horror Action Inscriptions */}
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-6 sm:gap-10">
              <button
                onClick={onRetryCurrentMaze}
                className="group relative px-5 py-2 text-xs md:text-sm font-serif tracking-[0.24em] uppercase text-[#d6c7b2] hover:text-[#ef4444] transition-colors cursor-pointer bg-transparent border-b border-[#7f1d1d]/70 hover:border-[#dc2626]"
                style={{
                  textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)',
                }}
              >
                [ Awaken in the Dark ]
              </button>

              <button
                onClick={onGenerateNewMaze}
                className="group relative px-5 py-2 text-xs md:text-sm font-serif tracking-[0.24em] uppercase text-[#ef4444] hover:text-[#f87171] transition-colors cursor-pointer bg-transparent border-b border-[#991b1b]/90 hover:border-[#ef4444]"
                style={{
                  textShadow: '0 0 14px rgba(220, 38, 38, 0.75)',
                }}
              >
                [ Descend Into Another Labyrinth ]
              </button>

              {onReturnToMainMenu && (
                <button
                  onClick={onReturnToMainMenu}
                  className="group relative px-5 py-2 text-xs md:text-sm font-serif tracking-[0.24em] uppercase text-slate-400 hover:text-white transition-colors cursor-pointer bg-transparent border-b border-slate-700 hover:border-slate-300"
                  style={{
                    textShadow: '0 2px 8px rgba(0, 0, 0, 0.95)',
                  }}
                >
                  [ Return to Main Menu ]
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
