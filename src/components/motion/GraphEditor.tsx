import { EASINGS, cubicBezier, type EasingName } from "@/lib/motion";

interface Props {
  easing: EasingName;
  onChange: (easing: EasingName) => void;
}

export function GraphEditor({ easing, onChange }: Props) {
  const bezier = EASINGS[easing].bezier;
  const pts: string[] = [];
  for (let i = 0; i <= 40; i++) {
    const t = i / 40;
    const y = easing === "hold" ? 0 : cubicBezier(bezier, t);
    pts.push(`${(t * 100).toFixed(2)},${(100 - y * 100).toFixed(2)}`);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          Curva de suavização
        </span>
        <select
          value={easing}
          onChange={(e) => onChange(e.target.value as EasingName)}
          className="num-field w-auto"
        >
          {Object.entries(EASINGS).map(([key, val]) => (
            <option key={key} value={key}>
              {val.label}
            </option>
          ))}
        </select>
      </div>
      <div className="rounded-md border border-border bg-panel-raised p-2">
        <svg viewBox="-6 -6 112 112" className="h-28 w-full">
          <defs>
            <pattern id="g" width="25" height="25" patternUnits="userSpaceOnUse">
              <path
                d="M25 0 L0 0 0 25"
                fill="none"
                stroke="var(--color-grid)"
                strokeWidth="0.5"
              />
            </pattern>
          </defs>
          <rect x="0" y="0" width="100" height="100" fill="url(#g)" />
          <polyline
            points={pts.join(" ")}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
          <circle cx="0" cy="100" r="3" fill="var(--color-accent)" />
          <circle cx="100" cy="0" r="3" fill="var(--color-accent)" />
        </svg>
      </div>
    </div>
  );
}
