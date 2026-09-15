import { GUIYEONDO_RELATIONSHIP_VISUALS } from './relationshipVisuals';
import type { GuiyeondoRelationshipType } from './types';

export default function GuiyeondoCharacterHero({ type, priority = false }: {
  type: GuiyeondoRelationshipType;
  priority?: boolean;
}) {
  const visual = GUIYEONDO_RELATIONSHIP_VISUALS[type];
  return (
    <figure className={`gy-character-hero gy-tone-${visual.tone}`}>
      <img
        src={visual.image}
        alt={visual.imageAlt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        style={{ objectPosition: visual.focalPoint }}
      />
      <span className="gy-character-overlay" aria-hidden="true" />
      <figcaption>
        <span>{visual.hanja}</span>
        <strong>{visual.label}</strong>
        <p>{visual.hero}</p>
      </figcaption>
    </figure>
  );
}
