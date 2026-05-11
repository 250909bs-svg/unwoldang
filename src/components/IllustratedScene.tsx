import MysticPortrait from './MysticPortrait';

type SceneVariant =
  | 'general'
  | 'newyear'
  | 'love'
  | 'compatibility'
  | 'wealth'
  | 'career'
  | 'reunion'
  | 'study'
  | 'pastlife'
  | 'dream'
  | 'psychology'
  | 'naming'
  | 'amulet'
  | 'daily';

type IllustratedSceneProps = {
  accent?: string;
  title?: string;
  subtitle?: string;
  variant?: SceneVariant;
};

const renderDecoration = (variant: SceneVariant) => {
  switch (variant) {
    case 'newyear':
      return <path d="M486 86L497 52L508 86L542 94L516 114L523 149L497 130L471 149L478 114L452 94L486 86Z" fill="#f6e8a9" opacity="0.95" />;
    case 'love':
      return <path d="M498 112C515 88 547 92 552 118C558 147 525 165 498 192C471 165 438 147 444 118C449 92 481 88 498 112Z" fill="#d8bfa2" opacity="0.88" />;
    case 'compatibility':
      return (
        <>
          <circle cx="462" cy="86" r="38" fill="#dbe5ff" opacity="0.76" />
          <circle cx="526" cy="86" r="38" fill="#ffe1f0" opacity="0.68" />
          <path d="M488 86H500" stroke="rgba(255,255,255,0.6)" strokeWidth="3" strokeDasharray="5 5" />
        </>
      );
    case 'wealth':
      return <circle cx="500" cy="84" r="44" fill="#f7dd80" opacity="0.84" />;
    case 'dream':
      return <ellipse cx="498" cy="82" rx="56" ry="34" fill="#cfe4ff" opacity="0.84" />;
    case 'amulet':
      return <rect x="474" y="48" width="48" height="74" rx="12" fill="#ffd1a3" opacity="0.84" />;
    default:
      return <circle cx="500" cy="86" r="42" fill="#fff5d9" opacity="0.85" />;
  }
};

export default function IllustratedScene({
  accent = '#7d89cb',
  title = '운월당',
  subtitle = 'premium saju illustration',
  variant = 'general'
}: IllustratedSceneProps) {
  const foreground =
    variant === 'love'
      ? '#2d2a26'
      : variant === 'newyear'
        ? '#17394b'
        : variant === 'compatibility'
          ? '#18264a'
          : variant === 'wealth'
            ? '#2d2613'
            : variant === 'dream'
              ? '#172652'
              : '#202b46';

  return (
    <svg viewBox="0 0 640 420" width="100%" height="100%" aria-hidden="true" className="scene-art">
      <defs>
        <linearGradient id={`scene-bg-${accent}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#12182a" />
          <stop offset="100%" stopColor="#2d3558" />
        </linearGradient>
        <radialGradient id={`scene-glow-${accent}`} cx="48%" cy="28%" r="46%">
          <stop offset="0%" stopColor={`${accent}bb`} />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      <rect width="640" height="420" rx="36" fill={`url(#scene-bg-${accent})`} />
      <ellipse cx="458" cy="102" rx="132" ry="110" fill={`url(#scene-glow-${accent})`} />
      {renderDecoration(variant)}

      <path d="M0 340C60 320 119 306 186 304C257 301 308 324 376 326C454 328 520 287 640 300V420H0V340Z" fill="#1a223b" />
      <path d="M0 372C80 349 139 333 210 336C277 338 334 365 410 366C494 367 556 331 640 336V420H0V372Z" fill={foreground} />

      <g opacity="0.9">
        <circle cx="68" cy="74" r="4" fill="#fff" />
        <circle cx="102" cy="112" r="3" fill="#fff" />
        <circle cx="156" cy="56" r="2.5" fill="#fff" />
        <circle cx="214" cy="90" r="3" fill="#fff" />
        <circle cx="584" cy="54" r="3" fill="#fff" />
      </g>

      <foreignObject x="196" y="48" width="260" height="308">
        <div style={{ width: '260px', height: '308px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <MysticPortrait accent={accent} compact variant={variant} />
        </div>
      </foreignObject>

      <text x="44" y="78" fill="white" fontSize="24" fontWeight="700" fontFamily="'Times New Roman', serif">
        {title}
      </text>
      <text x="44" y="112" fill="rgba(255,255,255,0.76)" fontSize="14" fontFamily="'Segoe UI', sans-serif">
        {subtitle}
      </text>
    </svg>
  );
}
