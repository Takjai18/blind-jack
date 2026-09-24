import type { Stars as StarValue } from "../../shared/types";

export function Stars({ value }: { value: StarValue }) {
  return (
    <p className="stars" aria-label={`${value}星`}>
      <span>{"★".repeat(value)}</span>
      <span className="stars-off">{"☆".repeat(3 - value)}</span>
    </p>
  );
}
