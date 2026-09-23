import { useState } from "react";

const KEYS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 10];

export function NumPad({ disabled, onSubmit }: { disabled?: boolean; onSubmit: (value: number) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  return (
    <div>
      <p className="prompt">你哋估呢題幾多分？（0–10）</p>
      <div className="pad" style={{ marginTop: 10 }}>
        {KEYS.map((num) => (
          <button
            key={num}
            type="button"
            data-testid={`num-${num}`}
            className={picked === num ? "picked" : ""}
            onClick={() => setPicked(num)}
            disabled={disabled}
            style={num === 10 ? { gridColumn: "span 2" } : undefined}
          >
            {num}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn gold wide"
        style={{ marginTop: 10, minHeight: 64, fontSize: "1.3rem" }}
        data-testid="confirm-estimate"
        disabled={disabled || picked === null}
        onClick={() => {
          if (picked !== null) onSubmit(picked);
        }}
      >
        確認估計
      </button>
      <p className="hint">傾掂未？面對面討論完先入數</p>
    </div>
  );
}
