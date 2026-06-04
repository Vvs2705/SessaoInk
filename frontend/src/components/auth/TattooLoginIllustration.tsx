/**
 * Animação de login — fineline.
 *
 * Uma arte fineline em ouro que se "tatua" sozinha: a linha surge traçada por
 * uma ponta de agulha luminosa que a percorre, com um leve sangramento de tinta
 * por baixo (a tinta assentando) e grão sobre a cena. Sem mão/máquina cartoon —
 * a *ação* de tatuar é sugerida com sobriedade, no tom premium da marca.
 *
 * A coreografia de tempo vive no CSS (globals.css), exceto o deslocamento da
 * ponta de agulha, feito por `animateMotion` ao longo do próprio traço.
 */
const MOTIF =
  "M22 92 C 46 38 80 38 100 72 C 116 100 144 100 156 70 C 166 46 190 50 196 82";

export function TattooLoginIllustration() {
  return (
    <div className="ink-stage" aria-hidden="true">
      <svg className="ink-svg" viewBox="0 0 218 120" fill="none" aria-hidden="true">
        <defs>
          <linearGradient id="inkGold" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#C9A96E" />
            <stop offset="50%" stopColor="#E8C98A" />
            <stop offset="100%" stopColor="#C9A96E" />
          </linearGradient>
          <filter id="inkBleedF" x="-20%" y="-60%" width="140%" height="220%">
            <feGaussianBlur stdDeviation="1.6" />
          </filter>
          <filter id="inkGlowF" x="-400%" y="-400%" width="900%" height="900%">
            <feGaussianBlur stdDeviation="2.4" result="b" />
            <feMerge>
              <feMergeNode in="b" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="ink-settle">
          {/* Sangramento — cópia borrada e escura por baixo (tinta assentando). */}
          <path
            className="ink-bleed"
            pathLength={100}
            d={MOTIF}
            stroke="#6b5326"
            strokeWidth={3.6}
            strokeLinecap="round"
            filter="url(#inkBleedF)"
          />
          {/* Linha principal em ouro. */}
          <path
            id="inkMotif"
            className="ink-line"
            pathLength={100}
            d={MOTIF}
            stroke="url(#inkGold)"
            strokeWidth={2}
            strokeLinecap="round"
          />
          {/* Acentos — duas folhas finas, traçadas ao final. */}
          <path
            className="ink-accent"
            pathLength={100}
            d="M100 72 C 92 55 103 47 116 52"
            stroke="#C9A96E"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
          <path
            className="ink-accent"
            pathLength={100}
            d="M156 70 C 165 53 154 45 141 50"
            stroke="#C9A96E"
            strokeWidth={1.5}
            strokeLinecap="round"
          />
        </g>

        {/* Ponta de agulha luminosa percorrendo o traço (sincronizada ao desenho). */}
        <circle className="ink-needle" r={2.6} fill="#F6E8C4" filter="url(#inkGlowF)">
          <animateMotion
            dur="1.7s"
            fill="freeze"
            calcMode="spline"
            keyPoints="0;1"
            keyTimes="0;1"
            keySplines="0.4 0 0.2 1"
          >
            <mpath href="#inkMotif" />
          </animateMotion>
        </circle>
      </svg>
    </div>
  );
}
