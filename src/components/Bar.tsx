interface Props {
  value: number;
  max: number;
  color?: string;
  height?: string;
  label?: string;
  className?: string;
}

export default function Bar({ value, max, color = 'var(--color-ember-500)', height = 'h-2.5', label, className = '' }: Props) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div className={`w-full ${height} rounded-full bg-night-700 overflow-hidden ${className}`} role="progressbar" aria-valuenow={value} aria-valuemax={max} aria-label={label}>
      <div className="h-full rounded-full transition-[width] duration-500 ease-out" style={{ width: `${pct}%`, background: color }} />
    </div>
  );
}
