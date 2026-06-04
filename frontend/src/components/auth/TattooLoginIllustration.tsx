/**
 * Ilustração da animação de tatuagem do login.
 *
 * Overlay posicionado sobre o card de login (lado direito). Uma mão estilizada
 * segura uma máquina de tatuagem e "tatua" o contorno do formulário: o traço de
 * tinta surge exatamente onde a agulha passa, com micro-vibração da máquina,
 * partículas de tinta e um leve halo de vermelhidão na linha recém-feita.
 *
 * Toda a coreografia de tempo vive no CSS (globals.css) para rodar na GPU e
 * manter 60fps. A duração total é de 5,2s — ver `DailyTattooLoginAnimation`.
 *
 * A paleta segue a marca SessãoInk (tinta teal/cobre sobre o card escuro) em
 * vez do "tom de pele" genérico, para não destoar do tema premium do produto.
 */
export function TattooLoginIllustration() {
  return (
    <>
      {/* Lavagem sutil que "assenta" a tinta e some no fim. */}
      <div className="tattoo-sheen" />

      {/* Traço do contorno do card. preserveAspectRatio=none faz o retângulo
          acompanhar o formato real do card em qualquer largura. pathLength=100
          normaliza o comprimento, então o reveal por dashoffset é exato. */}
      <svg
        className="tattoo-border"
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        fill="none"
        aria-hidden="true"
      >
        <path
          className="tattoo-trace tattoo-trace-glow"
          pathLength={100}
          d="M16 1.5 H84 Q98.5 1.5 98.5 16 V84 Q98.5 98.5 84 98.5 H16 Q1.5 98.5 1.5 84 V16 Q1.5 1.5 16 1.5 Z"
          stroke="#2F9285"
          strokeWidth={2.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          className="tattoo-trace tattoo-trace-ink"
          pathLength={100}
          d="M16 1.5 H84 Q98.5 1.5 98.5 16 V84 Q98.5 98.5 84 98.5 H16 Q1.5 98.5 1.5 84 V16 Q1.5 1.5 16 1.5 Z"
          stroke="#0F1A1A"
          strokeWidth={1.3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Detalhes internos tatuados entre 4.0s–4.6s. */}
        <path
          className="tattoo-detail tattoo-detail-title"
          pathLength={100}
          d="M30 31 H70"
          stroke="#C36B3F"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
        <path
          className="tattoo-detail tattoo-detail-button"
          pathLength={100}
          d="M14 86 H86"
          stroke="#2F9285"
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      </svg>

      {/* Camada da mão + máquina. Viaja ao redor do contorno via keyframes
          (left/top em % do overlay). A agulha fica perto do canto superior
          esquerdo do conteúdo, então partículas e vermelhidão acompanham. */}
      <div className="tattoo-hand-layer">
        <svg
          className="tattoo-hand"
          viewBox="0 0 240 240"
          fill="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="inkSkin" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E8B88A" />
              <stop offset="55%" stopColor="#D4A574" />
              <stop offset="100%" stopColor="#C4956A" />
            </linearGradient>
            <linearGradient id="inkSkinDark" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#D4A574" />
              <stop offset="100%" stopColor="#B07F52" />
            </linearGradient>
            <linearGradient id="inkMachine" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2A363B" />
              <stop offset="100%" stopColor="#10181C" />
            </linearGradient>
            <radialGradient id="inkRedness" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#E8866A" stopOpacity="0.55" />
              <stop offset="100%" stopColor="#E8866A" stopOpacity="0" />
            </radialGradient>
            <filter
              id="handShadow"
              x="-30%"
              y="-30%"
              width="160%"
              height="160%"
            >
              <feGaussianBlur stdDeviation="5" />
            </filter>
          </defs>

          {/* Sombra suave projetada da mão. */}
          <ellipse
            cx="150"
            cy="178"
            rx="78"
            ry="30"
            fill="#050B12"
            opacity="0.35"
            filter="url(#handShadow)"
          />

          {/* ── MÁQUINA DE TATUAGEM (vibra) ─────────────────────────────── */}
          <g className="tattoo-machine">
            {/* Cabo de força saindo pela traseira. */}
            <path
              d="M150 120 C190 132 214 150 232 176"
              stroke="#3A4A4E"
              strokeWidth="6"
              strokeLinecap="round"
            />
            {/* Corpo cilíndrico da máquina (estilo caneta). */}
            <path
              d="M150 118 L100 70 Q92 62 84 70 L74 80 Q66 88 74 96 L124 144 Z"
              fill="url(#inkMachine)"
              stroke="#46585C"
              strokeWidth="2.5"
            />
            {/* Grip tape (teal da marca). */}
            <path
              d="M150 118 L120 88 L132 76 L162 106 Z"
              fill="#2F9285"
              opacity="0.92"
            />
            <path
              d="M126 94 L138 82 M134 102 L146 90 M142 110 L154 98"
              stroke="#0B171C"
              strokeWidth="1.6"
              opacity="0.35"
            />
            {/* Tip + agulha apontando para o canto. */}
            <path
              d="M84 70 L60 46"
              stroke="#9AA7A4"
              strokeWidth="7"
              strokeLinecap="round"
            />
            <path
              d="M60 46 L44 30"
              stroke="#1A1A1A"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <circle cx="118" cy="92" r="9" fill="#2F9285" />
            <circle cx="118" cy="92" r="3.4" fill="#F0EADD" />
          </g>

          {/* Halo de vermelhidão sob a ponta da agulha. */}
          <circle
            className="tattoo-redness"
            cx="46"
            cy="32"
            r="20"
            fill="url(#inkRedness)"
          />

          {/* Partículas de tinta saltando perto da agulha. */}
          <g className="tattoo-sparks">
            <circle cx="50" cy="40" r="2.4" fill="#0F1A1A" />
            <circle cx="62" cy="34" r="1.8" fill="#2F9285" />
            <circle cx="40" cy="50" r="2" fill="#C36B3F" />
            <circle cx="56" cy="52" r="1.5" fill="#0F1A1A" />
          </g>

          {/* ── MÃO (vista do dorso, segurando a máquina) ───────────────── */}
          <g className="tattoo-hand-art">
            {/* Antebraço/pulso entrando da base. */}
            <path
              d="M168 232 C150 210 142 188 150 166 C156 150 176 144 196 152 C220 162 232 196 226 232 Z"
              fill="url(#inkSkinDark)"
            />
            {/* Dorso da mão. */}
            <path
              d="M120 150 C112 132 118 110 138 102 C160 93 188 100 200 120 C210 137 206 162 188 174 C168 187 138 182 124 166 Z"
              fill="url(#inkSkin)"
            />
            {/* Dedos enrolados sobre a máquina. */}
            <g fill="url(#inkSkin)" stroke="#B07F52" strokeWidth="1.4">
              <path d="M118 112 C108 108 100 112 99 122 C98 131 104 138 114 139 C124 140 131 134 131 124 C131 117 127 114 118 112 Z" />
              <path d="M126 128 C116 125 108 130 108 140 C108 149 115 155 125 155 C134 155 140 149 139 140 C138 132 134 130 126 128 Z" />
              <path d="M138 142 C129 140 122 145 123 154 C124 163 131 168 140 167 C149 166 154 159 152 151 C150 144 146 143 138 142 Z" />
              <path d="M152 152 C144 151 138 156 139 164 C140 172 147 176 155 175 C163 174 167 167 165 160 C163 154 159 153 152 152 Z" />
            </g>
            {/* Polegar pressionando o grip. */}
            <path
              d="M122 104 C112 96 100 96 92 104 C85 111 86 122 95 128 C104 134 116 132 122 123 C126 117 127 109 122 104 Z"
              fill="url(#inkSkinDark)"
              stroke="#A8794E"
              strokeWidth="1.4"
            />
            {/* Unhas/articulações sutis. */}
            <g stroke="#B07F52" strokeWidth="1.2" opacity="0.5" fill="none">
              <path d="M150 116 C158 124 162 136 160 148" />
              <path d="M168 120 C176 130 178 142 174 154" />
            </g>
          </g>
        </svg>
      </div>
    </>
  );
}
