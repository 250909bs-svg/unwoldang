import { useId } from 'react';

function seedNumber(seed: string) {
  return [...seed].reduce((sum, character, index) => sum + character.charCodeAt(0) * (index + 11), 0);
}

export default function GuiyeondoSigil({ seed, size = 72, label }: {
  seed: string;
  size?: number;
  label?: string;
}) {
  const uid = useId().replace(/:/g, '');
  const seedValue = seedNumber(seed);
  const spokes = 5 + (seedValue % 4);
  const rotation = seedValue % 36;
  const points = Array.from({ length: spokes }, (_, index) => {
    const angle = (Math.PI * 2 * index) / spokes - Math.PI / 2;
    const radius = index % 2 === 0 ? 29 : 24;
    return `${50 + Math.cos(angle) * radius},${50 + Math.sin(angle) * radius}`;
  }).join(' ');

  return (
    <svg className="gy-sigil" width={size} height={size} viewBox="0 0 100 100" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <defs>
        <radialGradient id={`${uid}-fill`} cx="50%" cy="45%" r="58%">
          <stop offset="0" stopColor="#f5d3c5" stopOpacity=".8" />
          <stop offset=".55" stopColor="#a92b35" stopOpacity=".28" />
          <stop offset="1" stopColor="#19090c" stopOpacity=".08" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="43" fill={`url(#${uid}-fill)`} stroke="currentColor" strokeOpacity=".25" />
      <circle cx="50" cy="50" r="34" fill="none" stroke="currentColor" strokeOpacity=".6" strokeDasharray={`${3 + seedValue % 4} ${5 + seedValue % 5}`} transform={`rotate(${rotation} 50 50)`} />
      <polygon points={points} fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" opacity=".8" transform={`rotate(${rotation / 2} 50 50)`} />
      <circle cx="50" cy="50" r="9" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M50 18v18M50 64v18M18 50h18M64 50h18" stroke="currentColor" strokeWidth=".75" opacity=".45" />
      <circle cx="50" cy="50" r="2.6" fill="currentColor" />
    </svg>
  );
}
