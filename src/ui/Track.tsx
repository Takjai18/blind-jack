export function Track({ name, value, tone }: { name: string; value: number; tone: "red" | "blue" }) {
  const pct = (Math.min(value, 24) / 24) * 100;
  return (
    <div className={`track-wrap tone-${tone}`}>
      <div className="track-label">
        <span>{name}估計總分</span>
        <strong>{value}</strong>
      </div>
      <div className="track" aria-hidden="true">
        <div className="track-fill" style={{ width: `${pct}%` }} />
        <div className="track-danger" />
        <div className="track-21" />
      </div>
      <div className="track-scale">
        <span>0</span>
        <span>21</span>
        <span>21+</span>
      </div>
    </div>
  );
}
