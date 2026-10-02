export function WaveMark({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M4 32c9 2 13-2 14-10C19 10 33 8 40 16c-11-3-15 10-7 13 5 2 10 0 12-3-2 15-27 22-41 6Z"
        fill="currentColor"
      />
    </svg>
  );
}
export default function WaveScene() {
  return (
    <svg
      className="wave-scene"
      viewBox="0 0 730 300"
      preserveAspectRatio="xMidYMax slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <pattern
          id="sea-dots"
          width="12"
          height="12"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r=".7" fill="#263e31" opacity=".17" />
        </pattern>
      </defs>
      <path
        d="M0 240C84 190 161 278 226 230S325 168 367 207c-28-58-13-129 59-159 79-33 156 15 146 81-9-28-34-43-63-31-27 12-32 48-9 65 26 20 64 17 89-5 43-37 100-13 141 0v142H0Z"
        fill="#a9d6bb"
      />
      <path
        d="M0 240C84 190 161 278 226 230S325 168 367 207c-28-58-13-129 59-159 79-33 156 15 146 81-9-28-34-43-63-31-27 12-32 48-9 65 26 20 64 17 89-5 43-37 100-13 141 0"
        stroke="#263e31"
        strokeWidth="2"
      />
      <path
        d="M0 269c101-39 165 39 250-4 48-24 104-49 146-26-30-48-23-113 24-145 29-20 74-24 105-8-41-7-75 15-76 53-2 68 79 95 150 64 50-23 95-11 131 4v93H0Z"
        fill="#82b496"
      />
      <path
        d="M0 269c101-39 165 39 250-4 48-24 104-49 146-26-30-48-23-113 24-145 29-20 74-24 105-8-41-7-75 15-76 53-2 68 79 95 150 64 50-23 95-11 131 4"
        stroke="#263e31"
        strokeWidth="1.5"
      />
      <path
        d="M0 291c85-20 184 29 268 0 67-23 100-21 161-9-9-11-25-29-31-48 39 34 80 30 115 27 78-7 135-31 217-3v42H0Z"
        fill="#4e8568"
      />
      <path
        d="M0 240C84 190 161 278 226 230S325 168 367 207c-28-58-13-129 59-159 79-33 156 15 146 81-9-28-34-43-63-31-27 12-32 48-9 65 26 20 64 17 89-5 43-37 100-13 141 0v142H0Z"
        fill="url(#sea-dots)"
      />
      <g transform="translate(185 105) rotate(-12)">
        <path
          d="m0-53 1-15m26 23 7-13m12 34 14-7m-85-15-7-13m-11 34-14-7"
          stroke="#273c2e"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
        <circle r="42" fill="#f4ce67" stroke="#273c2e" strokeWidth="2" />
        <path d="M-18-7h13m11 0h13m-24 0h11" stroke="#273c2e" strokeWidth="3" />
        <path
          d="M-20-10h16v7a8 8 0 0 1-16 0Zm24 0h16v7a8 8 0 0 1-16 0Z"
          fill="#273c2e"
        />
        <path
          d="M-8 13c7 7 13 6 19-2"
          stroke="#273c2e"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M-24 35-8 58l-13 14m43-37 16 17 14-3"
          stroke="#273c2e"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <path
          d="M-43 25-20 18m60-3 18-19"
          stroke="#273c2e"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <ellipse
          cx="10"
          cy="78"
          rx="64"
          ry="7"
          fill="#f6f5ef"
          stroke="#273c2e"
          strokeWidth="2"
        />
        <path d="m-4 85 13 8 8-8" stroke="#273c2e" strokeWidth="2" />
      </g>
      <g stroke="#273c2e" strokeWidth="1.5" strokeLinecap="round">
        <path d="m83 141 8-4 7 4m203-69 9-4 8 4m-32 94 10-4 9 4m323-95 10-4 10 4" />
        <path
          d="m586 120 9 3m-213 38 3-11m7-19 5-8m-97 108 19-4m216-16 18-1m88 53 21 1"
          opacity=".6"
        />
      </g>
    </svg>
  );
}
