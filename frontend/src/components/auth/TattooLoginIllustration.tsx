export function TattooLoginIllustration() {
  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2rem]"
      aria-hidden="true"
    >
      <svg
        className="tattoo-login-svg absolute -right-12 -top-10 h-[360px] w-[360px] opacity-80 sm:h-[430px] sm:w-[430px]"
        viewBox="0 0 420 420"
        fill="none"
      >
        <defs>
          <linearGradient id="tattooInk" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="#2F9285" />
            <stop offset="55%" stopColor="#F0EADD" />
            <stop offset="100%" stopColor="#C36B3F" />
          </linearGradient>

          <filter id="softGlow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <path
          className="tattoo-line tattoo-line-one"
          d="M79 274 C131 196 207 184 288 224 C326 243 343 279 329 305 C315 331 267 338 221 319 C171 299 139 302 107 339"
          stroke="url(#tattooInk)"
          strokeWidth="4"
          strokeLinecap="round"
          filter="url(#softGlow)"
        />

        <path
          className="tattoo-line tattoo-line-two"
          d="M112 238 C152 195 221 172 283 190 C324 202 351 233 355 268"
          stroke="#2F9285"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.75"
        />

        <path
          className="tattoo-line tattoo-line-three"
          d="M151 292 C187 264 239 260 284 285"
          stroke="#F0EADD"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />

        <g className="tattoo-machine">
          <path
            d="M260 70 C282 64 307 73 319 94 L336 124 C344 139 338 158 323 166 L296 181 C281 189 262 184 254 169 L236 134 C223 109 234 78 260 70Z"
            fill="#141F26"
            stroke="#34484B"
            strokeWidth="3"
          />

          <path
            d="M259 111 L219 154"
            stroke="#87938F"
            strokeWidth="10"
            strokeLinecap="round"
          />

          <path
            d="M213 160 L185 192"
            stroke="#2F9285"
            strokeWidth="5"
            strokeLinecap="round"
          />

          <circle cx="289" cy="116" r="19" fill="#2F9285" opacity="0.9" />
          <circle cx="289" cy="116" r="7" fill="#F0EADD" />

          <path
            d="M214 157 C202 149 187 150 176 158 L148 178 C132 190 112 195 93 190 L80 187"
            stroke="#5F6F70"
            strokeWidth="12"
            strokeLinecap="round"
          />

          <path
            d="M177 158 C172 181 181 204 201 216"
            stroke="#8D5B42"
            strokeWidth="18"
            strokeLinecap="round"
          />

          <path
            d="M187 189 C204 193 218 204 225 220"
            stroke="#A86E4E"
            strokeWidth="14"
            strokeLinecap="round"
          />
        </g>

        <g className="tattoo-sparks">
          <circle cx="141" cy="237" r="3" fill="#2F9285" />
          <circle cx="176" cy="217" r="2.5" fill="#F0EADD" />
          <circle cx="210" cy="207" r="2" fill="#C36B3F" />
          <circle cx="247" cy="215" r="2.5" fill="#2F9285" />
        </g>
      </svg>
    </div>
  );
}
