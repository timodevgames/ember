/** Hats in the head's coordinate system (head centre = 0,0, top of the head ≈ y −32). */
export default function Hat({ id }: { id: string }) {
  switch (id) {
    case 'hat-bow':
      return (
        <g transform="translate(17 -33) rotate(18)">
          <path d="M0 0 L-13 -9 L-12 9 Z" fill="#ff6b9a" stroke="#c9406c" strokeWidth="1.2" strokeLinejoin="round" />
          <path d="M0 0 L13 -9 L12 9 Z" fill="#ff6b9a" stroke="#c9406c" strokeWidth="1.2" strokeLinejoin="round" />
          <circle r="3.4" fill="#ffb3cf" stroke="#c9406c" strokeWidth="1" />
        </g>
      );
    case 'hat-headphones':
      return (
        <g>
          <path d="M-35 2 C -38 -52 38 -52 35 2" fill="none" stroke="#2b2840" strokeWidth="5.5" strokeLinecap="round" />
          <path d="M-35 2 C -38 -52 38 -52 35 2" fill="none" stroke="#ff8a3d" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
          <rect x="-44" y="-9" width="12" height="20" rx="5" fill="#3a3656" stroke="#1d1a2e" strokeWidth="1.2" />
          <rect x="32" y="-9" width="12" height="20" rx="5" fill="#3a3656" stroke="#1d1a2e" strokeWidth="1.2" />
          <circle cx="-38" cy="1" r="2.5" fill="#ff8a3d" />
          <circle cx="38" cy="1" r="2.5" fill="#ff8a3d" />
        </g>
      );
    case 'hat-cap':
      return (
        <g>
          <path d="M-24 -23 C -24 -50 24 -50 24 -23 Z" fill="#3b82f6" stroke="#1e4fa8" strokeWidth="1.4" />
          <path d="M8 -25 Q 34 -31 42 -22 Q 26 -18 8 -22 Z" fill="#2563eb" stroke="#1e4fa8" strokeWidth="1.2" />
          <path d="M-10 -40 L 2 -30 L 12 -40" fill="none" stroke="#bfdbfe" strokeWidth="2" strokeLinecap="round" />
          <circle cx="0" cy="-48" r="2.6" fill="#1e4fa8" />
        </g>
      );
    case 'hat-beanie':
      return (
        <g>
          <path d="M-26 -22 C -26 -54 26 -54 26 -22 Z" fill="#a78bfa" stroke="#6d4fd1" strokeWidth="1.4" />
          {[-14, -5, 4, 13].map((x) => (
            <path key={x} d={`M${x} -24 L${x + 2} -46`} stroke="#8b6cf0" strokeWidth="2" opacity="0.7" />
          ))}
          <rect x="-28" y="-27" width="56" height="9" rx="4.5" fill="#8b5cf6" stroke="#6d4fd1" strokeWidth="1.2" />
          <circle cx="0" cy="-53" r="6.5" fill="#ede9fe" stroke="#c4b5fd" strokeWidth="1.2" />
        </g>
      );
    case 'hat-flowers':
      return (
        <g>
          {[
            [-24, -27, '#ff9cc0'],
            [-12, -34, '#ffffff'],
            [0, -37, '#c4b5fd'],
            [12, -34, '#ffffff'],
            [24, -27, '#ff9cc0'],
          ].map(([x, y, c], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              <path d="M-7 3 Q -3 -1 0 3" fill="none" stroke="#5aa35a" strokeWidth="2" />
              {[0, 72, 144, 216, 288].map((a) => (
                <circle key={a} cx={3.6 * Math.cos((a * Math.PI) / 180)} cy={3.6 * Math.sin((a * Math.PI) / 180)} r="2.8" fill={c as string} stroke="#d97aa0" strokeWidth="0.5" />
              ))}
              <circle r="2" fill="#ffd36b" />
            </g>
          ))}
        </g>
      );
    case 'hat-tophat':
      return (
        <g transform="rotate(-6)">
          <rect x="-15" y="-68" width="30" height="36" rx="3" fill="#221d33" stroke="#0f0c19" strokeWidth="1.4" />
          <rect x="-15" y="-43" width="30" height="7" fill="#f04e68" />
          <ellipse cx="0" cy="-32" rx="25" ry="5.5" fill="#221d33" stroke="#0f0c19" strokeWidth="1.4" />
        </g>
      );
    case 'hat-crown':
      return (
        <g>
          <path d="M-21 -29 L-23 -56 L-11 -43 L0 -62 L11 -43 L23 -56 L21 -29 Z" fill="#ffd36b" stroke="#b88a1f" strokeWidth="1.5" strokeLinejoin="round" />
          <rect x="-21" y="-33" width="42" height="5" fill="#f0b93c" stroke="#b88a1f" strokeWidth="1" />
          <circle cx="0" cy="-41" r="3.4" fill="#f04e68" stroke="#a3283d" strokeWidth="0.8" />
          <circle cx="-12" cy="-37" r="2.3" fill="#60a5fa" />
          <circle cx="12" cy="-37" r="2.3" fill="#34d399" />
        </g>
      );
    default:
      return null;
  }
}
