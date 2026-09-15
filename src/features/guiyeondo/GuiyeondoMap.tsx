import { Plus, Sparkles } from 'lucide-react';
import GuiyeondoSigil from './GuiyeondoSigil';
import { GUIYEONDO_RELATIONSHIP_VISUALS } from './relationshipVisuals';
import { GUIYEONDO_RELATIONSHIP_TYPES, type GuiyeondoPerson, type GuiyeondoRelationshipType } from './types';

const POSITIONS: Record<GuiyeondoRelationshipType, { x: number; y: number; bend: number }> = {
  soulmate: { x: 50, y: 12, bend: -4 },
  'destined-love': { x: 79, y: 25, bend: 4 },
  'life-benefactor': { x: 21, y: 25, bend: -5 },
  'wealth-benefactor': { x: 14, y: 53, bend: 5 },
  'success-benefactor': { x: 86, y: 52, bend: -5 },
  'growth-relation': { x: 23, y: 79, bend: 4 },
  'passion-relation': { x: 76, y: 80, bend: -4 },
  'caution-relation': { x: 50, y: 93, bend: 3 }
};

const center = { x: 50, y: 52 };

function pathFor(type: GuiyeondoRelationshipType) {
  const target = POSITIONS[type];
  const middleX = (center.x + target.x) / 2 + target.bend;
  const middleY = (center.y + target.y) / 2 - target.bend / 2;
  return `M ${center.x} ${center.y} Q ${middleX} ${middleY} ${target.x} ${target.y}`;
}

function RelationGlyph({ type }: { type: GuiyeondoRelationshipType }) {
  const variant = GUIYEONDO_RELATIONSHIP_TYPES.indexOf(type);
  return (
    <svg viewBox="0 0 36 36" aria-hidden="true">
      <circle cx="18" cy="18" r="13" fill="none" />
      <path d={variant % 2 === 0 ? 'M18 7v22M7 18h22M10 10l16 16M26 10L10 26' : 'M18 6l4 8 8 4-8 4-4 8-4-8-8-4 8-4z'} />
      <circle cx="18" cy="18" r={variant % 3 === 0 ? 4 : 2.5} />
    </svg>
  );
}

export default function GuiyeondoMap({
  ownerName,
  ownerSigilSeed,
  people,
  selectedType,
  onSelect,
  onAdd
}: {
  ownerName: string;
  ownerSigilSeed: string;
  people: GuiyeondoPerson[];
  selectedType: GuiyeondoRelationshipType | null;
  onSelect: (type: GuiyeondoRelationshipType, personId?: string) => void;
  onAdd: () => void;
}) {
  const peopleByType = new Map<GuiyeondoRelationshipType, GuiyeondoPerson[]>();
  people.forEach((person) => {
    const type = person.analysis.classification.type;
    if (!type) return;
    peopleByType.set(type, [...(peopleByType.get(type) || []), person]);
  });

  return (
    <section className="gy-map-stage" aria-label={`${ownerName}님의 귀연도 인연 지도`}>
      <div className="gy-map-ambient" aria-hidden="true" />
      <svg className="gy-thread-map" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="gy-thread" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#5b1720" stopOpacity=".18" />
            <stop offset=".5" stopColor="#d75b67" stopOpacity=".72" />
            <stop offset="1" stopColor="#63202a" stopOpacity=".16" />
          </linearGradient>
          <linearGradient id="gy-thread-active" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#f7d2c6" />
            <stop offset=".45" stopColor="#e07179" />
            <stop offset="1" stopColor="#fff0e8" />
          </linearGradient>
        </defs>
        {GUIYEONDO_RELATIONSHIP_TYPES.map((type) => (
          <g key={type} className={`gy-thread ${selectedType === type ? 'active' : ''} ${peopleByType.has(type) ? 'matched' : ''}`}>
            <path d={pathFor(type)} pathLength="1" />
            <circle cx={POSITIONS[type].x} cy={POSITIONS[type].y} r=".8" />
          </g>
        ))}
      </svg>

      <div className="gy-owner-node" style={{ left: `${center.x}%`, top: `${center.y}%` }} aria-label={`${ownerName}, 내 인연 인장`}>
        <span className="gy-owner-halo" />
        <GuiyeondoSigil seed={ownerSigilSeed} size={86} />
        <strong>{ownerName}</strong>
        <small>나</small>
      </div>

      {GUIYEONDO_RELATIONSHIP_TYPES.map((type, index) => {
        const position = POSITIONS[type];
        const visual = GUIYEONDO_RELATIONSHIP_VISUALS[type];
        const matchedPeople = peopleByType.get(type) || [];
        const matched = matchedPeople[matchedPeople.length - 1];
        const analysisReady = type !== 'growth-relation';
        return (
          <button
            type="button"
            key={type}
            className={`gy-relation-node gy-tone-${visual.tone} ${matched ? 'matched' : 'empty'} ${analysisReady ? '' : 'pending'} ${selectedType === type ? 'active' : ''}`}
            style={{ left: `${position.x}%`, top: `${position.y}%`, '--gy-delay': `${index * 70}ms` } as React.CSSProperties}
            onClick={() => onSelect(type, matched?.id)}
            aria-pressed={selectedType === type}
            aria-label={`${visual.label}, ${matched ? `${matched.name}${matchedPeople.length > 1 ? ` 외 ${matchedPeople.length - 1}명` : ''} 연결됨` : analysisReady ? '아직 찾지 못함' : '독립 분석 기준 준비 중'}`}
          >
            <span className="gy-node-glyph"><RelationGlyph type={type} /></span>
            <span className="gy-node-copy">
              <strong>{visual.label}</strong>
              <small>{matched ? `${matched.name}${matchedPeople.length > 1 ? ` +${matchedPeople.length - 1}` : ''}` : analysisReady ? '???' : '준비 중'}</small>
            </span>
          </button>
        );
      })}

      <div className="gy-map-question">
        <Sparkles size={14} />
        <span>당신의 천생연분은 이미 곁에 있을까요?</span>
      </div>
      <button type="button" className="gy-map-add" onClick={onAdd}>
        <Plus size={18} /> 내 인연 찾기
      </button>
    </section>
  );
}
