interface StatBarProps {
  label: string;
  icon: string;
  value: number;
}

export default function StatBar({ label, icon, value }: StatBarProps) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  const color = pct >= 60 ? '#2fb8a6' : pct >= 30 ? '#f7931a' : '#e5484d';

  return (
    <div className="stat-bar">
      <div className="stat-bar__label">
        <span>{icon} {label}</span>
        <span className="stat-bar__value">{pct}</span>
      </div>
      <div className="stat-bar__track">
        <div
          className="stat-bar__fill"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}
