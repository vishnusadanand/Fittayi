import type { ExerciseAnim } from "../types/fittayi";

// Ported from daily-circuit.html's figureSvg() — one reusable SVG stick
// figure driven by the .anim-* CSS classes in index.css.
export function StickFigure({ anim }: { anim: ExerciseAnim | "static" }) {
  return (
    <div className={`anim-${anim} mx-auto w-32 text-gold`}>
      <svg viewBox="0 0 120 160" fill="none" stroke="currentColor" strokeWidth="6" strokeLinecap="round">
        <circle className="head" cx="60" cy="22" r="12" fill="currentColor" stroke="none" />
        <g className="torso-g">
          <line x1="60" y1="34" x2="60" y2="88" />
        </g>
        <g className="arm-l-g" style={{ transformOrigin: "60px 42px" }}>
          <line x1="60" y1="42" x2="34" y2="66" />
        </g>
        <g className="arm-r-g" style={{ transformOrigin: "60px 42px" }}>
          <line x1="60" y1="42" x2="86" y2="66" />
        </g>
        <g className="thigh-l-g" style={{ transformOrigin: "60px 88px" }}>
          <line x1="60" y1="88" x2="46" y2="120" />
          <g className="shin-l-g" style={{ transformOrigin: "46px 120px" }}>
            <line x1="46" y1="120" x2="44" y2="152" />
          </g>
        </g>
        <g className="thigh-r-g" style={{ transformOrigin: "60px 88px" }}>
          <line x1="60" y1="88" x2="74" y2="120" />
          <g className="shin-r-g" style={{ transformOrigin: "74px 120px" }}>
            <line x1="74" y1="120" x2="76" y2="152" />
          </g>
        </g>
      </svg>
    </div>
  );
}
