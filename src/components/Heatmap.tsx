import { addDays, parseDay, weekStart, type Day } from '../core/date';

export interface HeatCell {
  /** 0..1, or null = nothing due / not tracked. */
  value: number | null;
  vacation?: boolean;
}

interface Props {
  today: Day;
  weeks?: number;
  cell: (day: Day) => HeatCell;
  /** Hue of the filled cells. */
  color?: string;
}

/** GitHub-style calendar: one column per week (Mon at the top), newest on the right. */
export default function Heatmap({ today, weeks = 17, cell, color = '255, 138, 61' }: Props) {
  const first = addDays(weekStart(today), -7 * (weeks - 1));
  const cols: Day[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(Array.from({ length: 7 }, (_, i) => addDays(first, w * 7 + i)));
  const months: { col: number; label: string }[] = [];
  cols.forEach((c, i) => {
    const d = parseDay(c[0]);
    if (d.getDate() <= 7) months.push({ col: i, label: d.toLocaleDateString('en-GB', { month: 'short' }) });
  });

  return (
    <div className="w-full overflow-hidden">
      <div className="relative mb-1 h-4 text-[10px] text-zinc-500">
        {months.map((m) => (
          <span key={m.col} className="absolute" style={{ left: `${(m.col / weeks) * 100}%` }}>
            {m.label}
          </span>
        ))}
      </div>
      <div className="grid gap-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
        {cols.map((col, ci) => (
          <div key={ci} className="grid gap-[3px]">
            {col.map((day) => {
              if (day > today) return <div key={day} className="aspect-square rounded-[3px]" />;
              const c = cell(day);
              let bg = 'var(--color-night-800)';
              if (c.vacation) bg = 'rgba(124, 200, 255, 0.35)';
              else if (c.value !== null) bg = c.value <= 0 ? 'var(--color-night-700)' : `rgba(${color}, ${0.25 + 0.75 * c.value})`;
              return (
                <div
                  key={day}
                  title={`${day}${c.value !== null ? ` · ${Math.round(c.value * 100)}%` : ''}`}
                  className={`aspect-square rounded-[3px] ${day === today ? 'ring-1 ring-zinc-300' : ''}`}
                  style={{ background: bg }}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
