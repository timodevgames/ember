import { useId, useMemo } from 'react';
import { PALETTES, type Mood, type PetColor } from '../../core/game/pet';
import { RULES } from '../../core/game/rules';

/**
 * The fox spirit, drawn in SVG. Stage decides size, tail count and extras
 * (foxfire wisps from the Five-Tail on, aura + crest for the Legend). Mood
 * changes eyes, mouth, ears and animation speed. SMIL is used for motion —
 * it keeps SVG coordinate semantics in Safari, unlike CSS transforms.
 */

interface Props {
  stage: number;
  mood: Mood;
  color?: PetColor;
  /** 0..1 progress towards hatching (egg cracks). */
  eggProgress?: number;
  size?: number;
  animate?: boolean;
}

const TAIL_PATH =
  'M -6 0 C -22 -16 -27 -46 -15 -68 C -9 -79 -2 -86 1 -90 C 4 -83 12 -77 15 -66 C 23 -44 18 -16 6 0 Z';

function tailAngles(n: number): number[] {
  if (n <= 0) return [];
  if (n === 1) return [58];
  const spread = n >= 9 ? 82 : n >= 5 ? 72 : 52;
  const offset = n >= 5 ? 0 : 14;
  return Array.from({ length: n }, (_, i) => -spread + offset + (2 * spread * i) / (n - 1));
}

export default function PetView({ stage, mood, color = 'ember', eggProgress = 0, size = 200, animate = true }: Props) {
  const uid = useId().replace(/:/g, '');
  const p = PALETTES[color];
  const def = RULES.stages[Math.min(stage, RULES.stages.length - 1)];
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches,
    [],
  );
  const anim = animate && !reduced;

  if (mood === 'away') return <AwayScene size={size} />;

  if (stage === 0) {
    return (
      <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="An egg">
        <ellipse cx="100" cy="182" rx="40" ry="7" fill="black" opacity="0.35" />
        <g>
          {anim && (
            <animateTransform
              attributeName="transform"
              type="rotate"
              values={eggProgress > 0.6 ? '0 100 180;-7 100 180;7 100 180;0 100 180;0 100 180' : '0 100 180;-3 100 180;3 100 180;0 100 180;0 100 180'}
              keyTimes="0;0.1;0.2;0.3;1"
              dur={eggProgress > 0.6 ? '1.8s' : '3.5s'}
              repeatCount="indefinite"
            />
          )}
          <defs>
            <radialGradient id={`egg${uid}`} cx="40%" cy="35%" r="70%">
              <stop offset="0" stopColor="#fff8ee" />
              <stop offset="1" stopColor={p.belly} />
            </radialGradient>
          </defs>
          <path d="M100 52 C 132 52 150 104 150 132 C 150 162 128 182 100 182 C 72 182 50 162 50 132 C 50 104 68 52 100 52 Z" fill={`url(#egg${uid})`} stroke={p.furDark} strokeWidth="2" />
          <circle cx="82" cy="108" r="9" fill={p.fur} opacity="0.75" />
          <circle cx="118" cy="128" r="12" fill={p.fur} opacity="0.75" />
          <circle cx="92" cy="152" r="7" fill={p.tip} opacity="0.85" />
          <circle cx="122" cy="94" r="5" fill={p.tip} opacity="0.85" />
          {eggProgress > 0.3 && <path d="M76 90 l8 8 l-5 7 l9 6" fill="none" stroke={p.eye} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {eggProgress > 0.6 && <path d="M124 116 l-7 6 l6 6 l-8 7 l5 5" fill="none" stroke={p.eye} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
          {eggProgress > 0.85 && <path d="M98 60 l-4 9 l7 5 l-5 9" fill="none" stroke={p.eye} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}
        </g>
      </svg>
    );
  }

  const sleeping = mood === 'sleeping';
  const sad = mood === 'sad' || mood === 'sick';
  const happy = mood === 'happy' || mood === 'ecstatic';
  const sick = mood === 'sick';
  const bobDur = mood === 'ecstatic' ? '0.7s' : happy ? '1.6s' : sad ? '4.5s' : sleeping ? '5s' : '2.6s';
  const bobAmp = mood === 'ecstatic' ? -9 : happy ? -4 : sleeping ? -1.5 : -2.5;
  const swayDeg = mood === 'ecstatic' ? 10 : happy ? 6 : sad ? 2 : 3.5;
  const earDroop = sad ? 16 : sleeping ? 8 : 0;
  const tails = tailAngles(def.tails);
  const stubTail = stage === 1;
  const fur = sick ? mix(p.fur, '#8a9a7a', 0.45) : p.fur;
  const furDark = sick ? mix(p.furDark, '#6d7a5f', 0.45) : p.furDark;

  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label={`${def.name}, ${mood}`} style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id={`tail${uid}`} x1="0.5" y1="1" x2="0.5" y2="0">
          <stop offset="0" stopColor={fur} />
          <stop offset="0.62" stopColor={fur} />
          <stop offset="0.8" stopColor={p.belly} />
          <stop offset="1" stopColor={p.tip} />
        </linearGradient>
        <radialGradient id={`aura${uid}`} cx="50%" cy="55%" r="50%">
          <stop offset="0" stopColor={p.glow} stopOpacity="0.55" />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
        <radialGradient id={`fire${uid}`} cx="50%" cy="60%" r="60%">
          <stop offset="0" stopColor="#fff" />
          <stop offset="0.4" stopColor={p.tip} />
          <stop offset="1" stopColor={p.glow} stopOpacity="0" />
        </radialGradient>
      </defs>

      {stage >= 4 && (
        <circle cx="100" cy="115" r={stage >= 5 ? 98 : 84} fill={`url(#aura${uid})`}>
          {anim && <animate attributeName="opacity" values="0.6;1;0.6" dur="3s" repeatCount="indefinite" />}
        </circle>
      )}
      <ellipse cx="100" cy="182" rx={44 * def.scale} ry="7" fill="black" opacity="0.35" />

      <g transform={`translate(100 182) scale(${def.scale}) translate(-100 -182)`}>
        <g>
          {anim && (
            <animateTransform attributeName="transform" type="translate" values={`0 0;0 ${bobAmp};0 0`} dur={bobDur} repeatCount="indefinite" calcMode="spline" keySplines="0.4 0 0.6 1;0.4 0 0.6 1" />
          )}

          {/* tails (behind the body) */}
          {tails.map((a, i) => (
            <g key={i} transform={`translate(100 150) rotate(${a})`}>
              <g>
                {anim && (
                  <animateTransform
                    attributeName="transform"
                    type="rotate"
                    values={`${-swayDeg};${swayDeg};${-swayDeg}`}
                    dur={`${2.4 + (i % 3) * 0.35}s`}
                    begin={`${-i * 0.3}s`}
                    repeatCount="indefinite"
                    calcMode="spline"
                    keySplines="0.4 0 0.6 1;0.4 0 0.6 1"
                  />
                )}
                <path d={TAIL_PATH} fill={`url(#tail${uid})`} stroke={furDark} strokeWidth="1.5" strokeLinejoin="round" />
              </g>
            </g>
          ))}
          {stubTail && (
            <g transform="translate(122 160) rotate(70)">
              <path d="M -5 0 C -12 -10 -12 -24 -4 -32 C 0 -36 4 -34 6 -30 C 12 -20 10 -8 5 0 Z" fill={`url(#tail${uid})`} stroke={furDark} strokeWidth="1.5" />
            </g>
          )}

          {/* egg shell remnant for the hatchling */}
          {stage === 1 && (
            <path d="M58 160 L66 150 L74 160 L84 148 L94 160 L104 149 L114 160 L124 148 L134 160 L142 151 C 146 170 128 186 100 186 C 72 186 54 172 58 160 Z" fill="#fff8ee" stroke={p.furDark} strokeWidth="1.5" />
          )}

          {/* body */}
          <ellipse cx="100" cy="142" rx="36" ry="35" fill={fur} stroke={furDark} strokeWidth="1.5" />
          <ellipse cx="100" cy="150" rx="22" ry="25" fill={p.belly} />
          {stage > 1 && (
            <>
              <ellipse cx="85" cy="175" rx="10" ry="6.5" fill={p.belly} stroke={furDark} strokeWidth="1.2" />
              <ellipse cx="115" cy="175" rx="10" ry="6.5" fill={p.belly} stroke={furDark} strokeWidth="1.2" />
            </>
          )}

          {/* head */}
          <g transform="translate(100 94)">
            {/* ears */}
            <g transform={`rotate(${-earDroop} -20 -18)`}>
              <path d="M -33 -10 L -34 -54 L -6 -28 Z" fill={fur} stroke={furDark} strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M -28 -16 L -30 -44 L -13 -28 Z" fill={furDark} opacity="0.8" />
            </g>
            <g transform={`rotate(${earDroop} 20 -18)`}>
              <path d="M 33 -10 L 34 -54 L 6 -28 Z" fill={fur} stroke={furDark} strokeWidth="1.5" strokeLinejoin="round" />
              <path d="M 28 -16 L 30 -44 L 13 -28 Z" fill={furDark} opacity="0.8" />
            </g>
            {/* face */}
            <path d="M -38 2 C -38 -22 -20 -32 0 -32 C 20 -32 38 -22 38 2 C 38 14 30 24 22 27 L 0 33 L -22 27 C -30 24 -38 14 -38 2 Z" fill={fur} stroke={furDark} strokeWidth="1.5" />
            <path d="M -30 8 C -22 6 -12 10 0 14 C 12 10 22 6 30 8 C 26 20 14 30 0 32 C -14 30 -26 20 -30 8 Z" fill={p.belly} />
            {stage >= 4 && <path d="M 0 -27 C -5 -20 -4 -14 0 -10 C 4 -14 5 -20 0 -27 Z" fill={p.tip} opacity="0.95" />}
            {stage >= 5 && (
              <>
                <path d="M -8 -24 C -12 -20 -11 -16 -8 -14" fill="none" stroke={p.tip} strokeWidth="2" strokeLinecap="round" />
                <path d="M 8 -24 C 12 -20 11 -16 8 -14" fill="none" stroke={p.tip} strokeWidth="2" strokeLinecap="round" />
              </>
            )}

            <Eyes mood={mood} eye={p.eye} anim={anim} />

            {/* nose + mouth */}
            <ellipse cx="0" cy="13" rx="4" ry="3" fill={p.eye} />
            <Mouth mood={mood} color={p.eye} />
            {(happy || mood === 'content') && (
              <>
                <ellipse cx="-24" cy="12" rx="6" ry="3.5" fill="#ff7a9a" opacity={mood === 'content' ? 0.25 : 0.45} />
                <ellipse cx="24" cy="12" rx="6" ry="3.5" fill="#ff7a9a" opacity={mood === 'content' ? 0.25 : 0.45} />
              </>
            )}
            {sick && <path d="M 26 -14 C 23 -9 23 -5 26 -3 C 29 -5 29 -9 26 -14 Z" fill="#7cc8ff" opacity="0.9" />}
          </g>
        </g>

        {/* foxfire wisps */}
        {stage >= 4 &&
          [
            [44, 92, 0],
            [158, 80, 1.1],
            [150, 140, 2.2],
            ...(stage >= 5 ? [[50, 140, 0.6], [100, 30, 1.7]] : []),
          ].map(([x, y, delay], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <circle r="6" fill={`url(#fire${uid})`}>
                {anim && <animate attributeName="r" values="5;8;5" dur="2.2s" begin={`${-delay}s`} repeatCount="indefinite" />}
              </circle>
              {anim && <animateTransform attributeName="transform" type="translate" additive="sum" values="0 0;0 -6;0 0" dur="3s" begin={`${-delay}s`} repeatCount="indefinite" />}
            </g>
          ))}
      </g>

      {sleeping && (
        <g fill="#c4b5fd" fontWeight="700" fontFamily="ui-rounded, system-ui">
          <text x="138" y="62" fontSize="16" className="animate-zzz">z</text>
          <text x="150" y="48" fontSize="12" className="animate-zzz" style={{ animationDelay: '1.3s' }}>z</text>
        </g>
      )}
      {mood === 'ecstatic' && (
        <g fontSize="16">
          <text x="34" y="60" className="animate-zzz">✨</text>
          <text x="150" y="70" className="animate-zzz" style={{ animationDelay: '0.9s' }}>✨</text>
        </g>
      )}
    </svg>
  );
}

function Eyes({ mood, eye, anim }: { mood: Mood; eye: string; anim: boolean }) {
  if (mood === 'sleeping') {
    return (
      <g fill="none" stroke={eye} strokeWidth="2.6" strokeLinecap="round">
        <path d="M -19 0 Q -13 4 -7 0" />
        <path d="M 7 0 Q 13 4 19 0" />
      </g>
    );
  }
  if (mood === 'happy' || mood === 'ecstatic') {
    return (
      <g fill="none" stroke={eye} strokeWidth="3" strokeLinecap="round">
        <path d="M -19 1 Q -13 -7 -7 1" />
        <path d="M 7 1 Q 13 -7 19 1" />
      </g>
    );
  }
  const half = mood === 'sick';
  return (
    <g>
      {[-13, 13].map((x) => (
        <g key={x} transform={`translate(${x} -1)`}>
          <g>
            {anim && (
              <animateTransform attributeName="transform" type="scale" values="1 1;1 1;1 0.1;1 1" keyTimes="0;0.93;0.96;1" dur="4.2s" begin={`${x > 0 ? 0.05 : 0}s`} repeatCount="indefinite" />
            )}
            <ellipse rx="4.6" ry={half ? 3 : 6} fill={eye} />
            <circle cx="1.6" cy={half ? -0.8 : -2.2} r="1.6" fill="white" />
          </g>
        </g>
      ))}
      {mood === 'sad' && (
        <g stroke={eye} strokeWidth="2" strokeLinecap="round">
          <path d="M -20 -11 L -8 -8" />
          <path d="M 20 -11 L 8 -8" />
        </g>
      )}
    </g>
  );
}

function Mouth({ mood, color }: { mood: Mood; color: string }) {
  const common = { fill: 'none', stroke: color, strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  if (mood === 'ecstatic') return <path d="M -7 18 Q 0 28 7 18 Z" fill="#7a2a3a" stroke={color} strokeWidth="1.5" />;
  if (mood === 'happy') return <path d="M -7 18 Q -3.5 22 0 18 Q 3.5 22 7 18" {...common} />;
  if (mood === 'sad' || mood === 'sick') return <path d="M -5 22 Q 0 18 5 22" {...common} />;
  if (mood === 'sleeping') return <path d="M -3 20 Q 0 21 3 20" {...common} />;
  return <path d="M -5 19 Q -2.5 21.5 0 19 Q 2.5 21.5 5 19" {...common} />;
}

function AwayScene({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 200 200" width={size} height={size} role="img" aria-label="The pet ran away to the forest">
      <ellipse cx="100" cy="182" rx="70" ry="8" fill="black" opacity="0.3" />
      {[
        [40, 170, 1],
        [160, 168, 0.9],
        [128, 176, 0.7],
      ].map(([x, y, s], i) => (
        <g key={i} transform={`translate(${x} ${y}) scale(${s})`}>
          <rect x="-4" y="-18" width="8" height="18" fill="#5b3b25" />
          <path d="M 0 -78 L -26 -30 L -14 -30 L -32 -12 L 32 -12 L 14 -30 L 26 -30 Z" fill="#1f5a3a" stroke="#174429" strokeWidth="2" />
        </g>
      ))}
      {[
        [70, 168],
        [86, 160],
        [102, 166],
        [118, 158],
      ].map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} fill="#a1887f" opacity={0.35 + i * 0.15}>
          <ellipse rx="3.5" ry="4.5" />
          <circle cx="-4" cy="-6" r="1.6" />
          <circle cx="0" cy="-8" r="1.6" />
          <circle cx="4" cy="-6" r="1.6" />
        </g>
      ))}
      <text x="100" y="105" textAnchor="middle" fontSize="44" fontWeight="800" fill="#a78bfa" opacity="0.9" fontFamily="ui-rounded, system-ui">
        ?
      </text>
    </svg>
  );
}

/** Blend two hex colours (t = share of b). */
function mix(a: string, b: string, t: number): string {
  const pa = parseInt(a.slice(1), 16);
  const pb = parseInt(b.slice(1), 16);
  const ch = (s: number) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t);
  return `#${((ch(16) << 16) | (ch(8) << 8) | ch(0)).toString(16).padStart(6, '0')}`;
}
