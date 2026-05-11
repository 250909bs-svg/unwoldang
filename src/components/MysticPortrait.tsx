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

type MysticPortraitProps = {
  accent?: string;
  compact?: boolean;
  variant?: SceneVariant;
};

const variantConfig: Record<
  SceneVariant,
  {
    hair: string;
    robe: string;
    robeDark: string;
    symbol: string;
    glow: string;
    gem: string;
    sleeve: string;
  }
> = {
  general: { hair: '#121824', robe: '#31486c', robeDark: '#1b2137', symbol: '#f6d59c', glow: '#efd8ba', gem: '#d3a16c', sleeve: '#a86f54' },
  newyear: { hair: '#102337', robe: '#2f7487', robeDark: '#17314a', symbol: '#e9f6fb', glow: '#7dc7de', gem: '#faf0bf', sleeve: '#5ca5c1' },
  love: { hair: '#24211f', robe: '#8a7258', robeDark: '#3b3128', symbol: '#efe4d2', glow: '#c9b38f', gem: '#f4eadb', sleeve: '#a89576' },
  compatibility: { hair: '#172544', robe: '#5867a7', robeDark: '#212d54', symbol: '#ffd9ef', glow: '#91a3ec', gem: '#d9e4ff', sleeve: '#7a88cb' },
  wealth: { hair: '#272111', robe: '#816427', robeDark: '#382a10', symbol: '#ffe58a', glow: '#d7be58', gem: '#fff4c6', sleeve: '#b38c3f' },
  career: { hair: '#122031', robe: '#315777', robeDark: '#172b40', symbol: '#bfdeed', glow: '#7ba6c0', gem: '#edf8ff', sleeve: '#5d87a5' },
  reunion: { hair: '#29191f', robe: '#8b4f4a', robeDark: '#3f2123', symbol: '#f6d0c7', glow: '#d6938b', gem: '#ffe1d8', sleeve: '#c57b77' },
  study: { hair: '#183023', robe: '#3d7051', robeDark: '#213728', symbol: '#d8f1c7', glow: '#88c28f', gem: '#f4ffe7', sleeve: '#6ba871' },
  pastlife: { hair: '#1f1830', robe: '#67518e', robeDark: '#2d2341', symbol: '#d4c0ff', glow: '#aa8de5', gem: '#efe7ff', sleeve: '#9171ca' },
  dream: { hair: '#10214d', robe: '#355ea5', robeDark: '#182a58', symbol: '#d7e8ff', glow: '#81aeea', gem: '#f0f6ff', sleeve: '#6e99e6' },
  psychology: { hair: '#231b29', robe: '#695577', robeDark: '#33263b', symbol: '#e7d8ff', glow: '#b198d0', gem: '#f8f0ff', sleeve: '#9379ac' },
  naming: { hair: '#271e18', robe: '#70624e', robeDark: '#382f24', symbol: '#ecd3b2', glow: '#c4a786', gem: '#fff2e3', sleeve: '#aa8761' },
  amulet: { hair: '#281517', robe: '#8a3035', robeDark: '#40191d', symbol: '#ffd6b1', glow: '#d76868', gem: '#ffe8d4', sleeve: '#c75151' },
  daily: { hair: '#2a1e16', robe: '#b35f34', robeDark: '#452517', symbol: '#ffd6a6', glow: '#f3a063', gem: '#fff3dc', sleeve: '#ed7c3a' }
};

const renderAccessory = (variant: SceneVariant, color: string) => {
  switch (variant) {
    case 'newyear':
      return (
        <>
          <circle cx="160" cy="62" r="16" fill={color} opacity="0.9" />
          <path d="M160 28L168 50L192 50L173 63L180 86L160 72L140 86L147 63L128 50L152 50Z" fill="#fff0b1" opacity="0.9" />
        </>
      );
    case 'love':
      return <path d="M160 74C171 57 194 59 198 78C201 96 181 111 160 130C139 111 119 96 122 78C126 59 149 57 160 74Z" fill={color} opacity="0.92" />;
    case 'compatibility':
      return (
        <>
          <circle cx="118" cy="72" r="10" fill={color} opacity="0.92" />
          <circle cx="202" cy="72" r="10" fill="#ffe4f3" opacity="0.92" />
          <path d="M128 72H192" stroke="rgba(255,255,255,0.55)" strokeWidth="2.5" strokeDasharray="5 6" />
        </>
      );
    case 'wealth':
      return <path d="M160 38L170 58L192 60L176 76L180 99L160 88L140 99L144 76L128 60L150 58Z" fill={color} opacity="0.95" />;
    case 'career':
      return (
        <>
          <rect x="148" y="46" width="24" height="24" rx="6" fill={color} opacity="0.9" />
          <path d="M136 76C144 69 151 66 160 66C169 66 176 69 184 76" stroke="#edf8ff" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'reunion':
      return (
        <>
          <circle cx="146" cy="72" r="12" fill={color} opacity="0.85" />
          <circle cx="174" cy="72" r="12" fill="#ffe8df" opacity="0.72" />
        </>
      );
    case 'study':
      return (
        <>
          <rect x="140" y="42" width="40" height="28" rx="6" fill={color} opacity="0.88" />
          <path d="M140 56H180" stroke="#f4ffe7" strokeWidth="3" />
        </>
      );
    case 'pastlife':
      return <path d="M160 30L172 52L196 58L178 74L182 99L160 88L138 99L142 74L124 58L148 52Z" fill={color} opacity="0.88" />;
    case 'dream':
      return <path d="M160 34C176 34 189 47 189 63C189 85 167 95 160 111C153 95 131 85 131 63C131 47 144 34 160 34Z" fill={color} opacity="0.88" />;
    case 'psychology':
      return (
        <>
          <path d="M141 58C141 47 149 40 160 40C171 40 179 47 179 58C179 69 171 77 160 77C149 77 141 69 141 58Z" fill={color} opacity="0.9" />
          <path d="M152 58H168" stroke="#fff4ff" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'naming':
      return (
        <>
          <rect x="142" y="40" width="36" height="36" rx="8" fill={color} opacity="0.9" />
          <path d="M152 51H168M152 62H164" stroke="#fff7ef" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'amulet':
      return (
        <>
          <rect x="145" y="40" width="30" height="50" rx="7" fill={color} opacity="0.9" />
          <path d="M154 55H166M154 66H166M154 77H162" stroke="#fff0df" strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case 'daily':
      return <circle cx="160" cy="60" r="18" fill={color} opacity="0.9" />;
    default:
      return <circle cx="160" cy="62" r="16" fill={color} opacity="0.9" />;
  }
};

export default function MysticPortrait({
  accent = '#d08c60',
  compact = false,
  variant = 'general'
}: MysticPortraitProps) {
  const width = compact ? 240 : 320;
  const height = compact ? 290 : 390;
  const config = variantConfig[variant];

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 390"
      width={width}
      height={height}
      className="portrait-art"
      style={{ overflow: 'visible' }}
    >
      <defs>
        <radialGradient id={`portrait-glow-${accent}`} cx="50%" cy="32%" r="52%">
          <stop offset="0%" stopColor={config.glow} stopOpacity="0.78" />
          <stop offset="100%" stopColor={config.glow} stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`portrait-robe-${accent}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={accent} />
          <stop offset="100%" stopColor={config.robeDark} />
        </linearGradient>
        <linearGradient id={`portrait-skin-${accent}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8dec8" />
          <stop offset="100%" stopColor="#e7b48a" />
        </linearGradient>
      </defs>

      <ellipse cx="160" cy="156" rx="122" ry="124" fill={`url(#portrait-glow-${accent})`} />
      <ellipse cx="160" cy="340" rx="92" ry="20" fill="rgba(0,0,0,0.18)" />
      {renderAccessory(variant, config.symbol)}

      <path
        d="M78 340C88 274 113 238 160 238C207 238 232 274 242 340L258 390H62L78 340Z"
        fill={`url(#portrait-robe-${accent})`}
      />
      <path
        d="M92 332C113 306 133 293 160 293C187 293 207 306 228 332"
        fill="none"
        stroke={config.sleeve}
        strokeWidth="20"
        strokeLinecap="round"
        opacity="0.8"
      />
      <path d="M130 234H190V275C190 292 177 305 160 305C143 305 130 292 130 275V234Z" fill={`url(#portrait-skin-${accent})`} />
      <path
        d="M98 142C98 90 127 57 160 57C193 57 222 90 222 142V176C222 218 194 243 160 243C126 243 98 218 98 176V142Z"
        fill={`url(#portrait-skin-${accent})`}
      />
      <path
        d="M96 152C97 92 130 44 169 44C215 44 239 89 232 150C213 135 197 128 166 126C132 123 114 133 96 152Z"
        fill={config.hair}
      />
      <path d="M112 118C103 170 91 208 72 252" fill="none" stroke={config.hair} strokeWidth="28" strokeLinecap="round" />
      <path d="M208 118C217 170 229 208 248 252" fill="none" stroke={config.hair} strokeWidth="28" strokeLinecap="round" />
      <path d="M136 89C142 79 150 73 160 73C170 73 178 79 184 89" fill="none" stroke={config.hair} strokeWidth="20" strokeLinecap="round" />
      <ellipse cx="132" cy="170" rx="12" ry="8" fill="#231b1a" />
      <ellipse cx="188" cy="170" rx="12" ry="8" fill="#231b1a" />
      <ellipse cx="132" cy="171" rx="5" ry="3" fill="#ffffff" opacity="0.72" />
      <ellipse cx="188" cy="171" rx="5" ry="3" fill="#ffffff" opacity="0.72" />
      <path d="M118 151C125 145 135 143 144 146" fill="none" stroke="#2a1f1d" strokeWidth="4" strokeLinecap="round" />
      <path d="M176 146C185 143 195 145 202 151" fill="none" stroke="#2a1f1d" strokeWidth="4" strokeLinecap="round" />
      <path d="M149 194C153 201 167 201 171 194" fill="none" stroke="#b06f58" strokeWidth="4" strokeLinecap="round" />
      <path d="M146 213C152 220 168 220 174 213" fill="none" stroke="#aa6554" strokeWidth="4" strokeLinecap="round" />
      <circle cx="112" cy="191" r="10" fill="#eead92" opacity="0.36" />
      <circle cx="208" cy="191" r="10" fill="#eead92" opacity="0.36" />
      <path d="M104 330C122 307 140 296 160 296C180 296 198 307 216 330" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="2.5" />
      <path d="M149 304L160 317L171 304" fill="none" stroke={config.gem} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="160" cy="314" r="8" fill={config.gem} />
      <circle cx="80" cy="108" r="4" fill="#fff" opacity="0.75" />
      <circle cx="244" cy="96" r="4" fill="#fff" opacity="0.7" />
      <circle cx="252" cy="150" r="3" fill="#fff" opacity="0.55" />
      <circle cx="65" cy="164" r="3" fill="#fff" opacity="0.5" />
    </svg>
  );
}

