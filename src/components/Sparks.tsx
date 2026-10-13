import { useMemo } from 'react';

const COLORS = ['#ffd36b', '#ff8a3d', '#a78bfa', '#34d399', '#ff6b81'];

/** A one-shot burst of little sparks around the parent (parent must be `relative`). */
export default function Sparks({ count = 12, spread = 46 }: { count?: number; spread?: number }) {
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const a = (i / count) * Math.PI * 2 + Math.random() * 0.5;
        const d = spread * (0.6 + Math.random() * 0.5);
        return { dx: Math.cos(a) * d, dy: Math.sin(a) * d, color: COLORS[i % COLORS.length], delay: Math.random() * 0.08 };
      }),
    [count, spread],
  );
  return (
    <span className="pointer-events-none absolute left-1/2 top-1/2" aria-hidden>
      {sparks.map((s, i) => (
        <span
          key={i}
          className="spark"
          style={{ background: s.color, ['--dx' as string]: `${s.dx}px`, ['--dy' as string]: `${s.dy}px`, animationDelay: `${s.delay}s` }}
        />
      ))}
    </span>
  );
}
