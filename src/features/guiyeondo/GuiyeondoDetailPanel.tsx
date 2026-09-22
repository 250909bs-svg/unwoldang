import { ArrowRight, LockKeyhole, Plus, Trash2, X } from 'lucide-react';
import GuiyeondoCharacterHero from './GuiyeondoCharacterHero';
import GuiyeondoRecommendations from './GuiyeondoRecommendations';
import { GUIYEONDO_RELATIONSHIP_VISUALS } from './relationshipVisuals';
import type { GuiyeondoPerson, GuiyeondoRelationshipType } from './types';

const TENDENCY_LABEL = {
  supportive: '힘이 되는 신호',
  conditional: '조건을 살필 신호',
  tension: '조정이 필요한 신호',
  insufficient: '근거 확인 중'
} as const;

const PURPOSE_LABELS = {
  dating: '감정과 끌림',
  marriage: '생활과 장기 조율',
  business: '일과 현실 협력',
  family: '정서적 안전'
} as const;

/**
 * 문장의 `personA` · `personB` 를 두 사람의 이름으로 바꾼다.
 *
 * 보통 `personA` 는 지도 주인이다. 그런데 **남의 초대에 응답해서 가져온 인연**은 초대한
 * 쪽을 앞에 놓고 계산됐다. 그대로 풀면 "personA 가 personB 를 이끈다" 같은 문장에서 두
 * 사람이 뒤바뀌어, 방향이 있는 관계 서술이 정반대가 된다. `reversed` 가 그 경우다.
 */
function personalizeStatement(
  statement: string,
  ownerName: string,
  personName: string,
  reversed = false
) {
  const [first, second] = reversed ? [personName, ownerName] : [ownerName, personName];
  return statement
    .replace(/personA/g, first)
    .replace(/personB/g, second);
}

export default function GuiyeondoDetailPanel({
  ownerName,
  type,
  person,
  people,
  selectedPersonId,
  onSelectPerson,
  onClose,
  onAdd,
  onInvite,
  onRemove
}: {
  ownerName: string;
  type: GuiyeondoRelationshipType | null;
  person: GuiyeondoPerson | null;
  people: GuiyeondoPerson[];
  selectedPersonId: string | null;
  onSelectPerson: (personId: string) => void;
  onClose: () => void;
  onAdd: () => void;
  onInvite: () => void;
  onRemove: (personId: string) => void;
}) {
  if (!type) {
    return (
      <aside className="gy-detail-panel gy-detail-idle" aria-label="귀연도 안내">
        <div className="gy-idle-orbit"><span /><span /><span /></div>
        <span className="gy-eyebrow">YOUR CONNECTIONS</span>
        <h2>한 사람을 눌러<br />인연의 결을 살펴보세요</h2>
        <p>지도에서 관계 영역을 선택하면 연결된 사람과 실제 명리 근거가 이곳에 펼쳐집니다.</p>
      </aside>
    );
  }

  const visual = GUIYEONDO_RELATIONSHIP_VISUALS[type];
  const classifiedSignals = person
    ? person.analysis.vectors.filter((vector) =>
        vector.supported && vector.evidenceIds.some((id) => person.analysis.classification.evidenceIds.includes(id)))
    : [];
  const focusSignals = classifiedSignals.length > 0
    ? classifiedSignals
    : person
      ? visual.focusVectors
        .map((id) => person.analysis.vectors.find((vector) => vector.id === id))
        .filter((vector): vector is NonNullable<typeof vector> => Boolean(vector))
      : [];
  const purposeEntries = person
    ? (Object.entries(person.analysis.purposes) as Array<[
        keyof typeof PURPOSE_LABELS,
        (typeof person.analysis.purposes)[keyof typeof person.analysis.purposes]
      ]>)
    : [];
  const seenFacts = new Set<string>();
  const evidenceFacts = purposeEntries.flatMap(([, result]) => result.facts).filter((fact) => {
    const key = personalizeStatement(fact.statement, ownerName, person?.name || '상대', person?.reversed);
    if (seenFacts.has(key)) return false;
    seenFacts.add(key);
    return true;
  });
  const uncertainties = [...new Set(person?.analysis.uncertainty || [])];

  return (
    <aside className={`gy-detail-panel ${person ? 'has-person' : 'is-empty'}`} aria-label={`${visual.label} 상세`}>
      <button type="button" className="gy-detail-close" onClick={onClose} aria-label="상세 닫기"><X size={19} /></button>
      <GuiyeondoCharacterHero key={`${type}-${person?.id || 'empty'}`} type={type} />
      <div className="gy-detail-body">
        {person ? (
          <>
            <div className="gy-pair-heading">
              <span>{ownerName} × {person.name}</span>
              <h2>{visual.label}</h2>
              <p>{visual.description}</p>
            </div>
            {people.length > 1 ? (
              <div className="gy-people-switcher" role="group" aria-label={`${visual.label} 인연 목록`}>
                {people.map((item) => (
                  <button type="button" aria-pressed={item.id === (selectedPersonId || person.id)} key={item.id} onClick={() => onSelectPerson(item.id)}>
                    {item.name}
                  </button>
                ))}
              </div>
            ) : null}
            <div className="gy-policy-badge">{person.source === 'direct' ? '내가 추가' : '초대 참여'} · 운월당 관계 탐색 분류 · 확정 예언 아님</div>
            {person.analysis.status === 'partial' ? <p className="gy-partial-note">출생시간 미상 · 시주를 제외한 안정적인 공통 원국으로 읽었습니다.</p> : null}

            <section className="gy-reading-section" aria-labelledby="gy-reading-title">
              <div className="gy-section-title">
                <span>RELATION READING</span>
                <h3 id="gy-reading-title">왜 이 대표 신호로 읽혔을까요?</h3>
              </div>
              <p className="gy-reading-intro">{visual.interpretation}</p>
              <div className="gy-focus-signal-list">
                {focusSignals.map((vector) => (
                  <article className={`gy-focus-signal gy-focus-${vector.tendency}`} key={vector.id}>
                    <div><strong>{vector.label}</strong><span>{TENDENCY_LABEL[vector.tendency]}</span></div>
                    <p>{personalizeStatement(vector.statement || '이 신호의 세부 문장은 관계를 다시 계산하면 확인할 수 있습니다.', ownerName, person.name, person.reversed)}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="gy-observation-section" aria-labelledby="gy-observation-title">
              <div className="gy-section-title">
                <span>REALITY CHECK</span>
                <h3 id="gy-observation-title">현실에서 확인할 세 가지</h3>
              </div>
              <ol className="gy-observation-list">
                {visual.observations.map((observation, index) => (
                  <li key={observation}><span>{String(index + 1).padStart(2, '0')}</span><p>{observation}</p></li>
                ))}
              </ol>
            </section>

            <section className="gy-purpose-section" aria-labelledby="gy-purpose-title">
              <div className="gy-section-title">
                <span>FOUR LENSES</span>
                <h3 id="gy-purpose-title">네 가지 관계 장면으로 보기</h3>
                <p>같은 두 사람도 연애, 생활, 일, 가족의 장면에서는 다른 결을 보일 수 있습니다.</p>
              </div>
              <div className="gy-purpose-grid">
                {purposeEntries.map(([purpose, result]) => (
                  <article key={purpose} className={`gy-purpose-card gy-purpose-${result.overview.tendency}`}>
                    <span>{PURPOSE_LABELS[purpose]}</span>
                    <strong>{TENDENCY_LABEL[result.overview.tendency]}</strong>
                    <p>{personalizeStatement(result.overview.statement, ownerName, person.name, person.reversed)}</p>
                  </article>
                ))}
              </div>
            </section>

            <section className="gy-vector-section" aria-labelledby="gy-vector-title">
              <div className="gy-section-title">
                <span>RELATION SIGNALS</span>
                <h3 id="gy-vector-title">두 사람 사이의 신호</h3>
              </div>
              <div className="gy-vector-list">
                {person.analysis.vectors.map((vector) => (
                  <div className={`gy-vector gy-vector-${vector.tendency}`} key={vector.id}>
                    <div><strong>{vector.label}</strong><span>{TENDENCY_LABEL[vector.tendency]}</span></div>
                    <span className={`gy-vector-status gy-status-${vector.tendency}`}>{TENDENCY_LABEL[vector.tendency]}</span>
                  </div>
                ))}
              </div>
              <p className="gy-vector-note">숫자 확률 대신 검증된 정성 경향을 표시합니다. ‘근거 확인 중’은 임의 값을 만들지 않은 항목입니다.</p>
            </section>

            <details className="gy-evidence">
              <summary>계산 근거 더 자세히 보기<ArrowRight size={17} /></summary>
              <div>
                {purposeEntries.map(([purpose, result]) => (
                  <section className="gy-evidence-group" key={purpose}>
                    <h4>{PURPOSE_LABELS[purpose]} 세부 판정</h4>
                    {result.dimensions.map((dimension) => (
                      <article key={`${purpose}-${dimension.id}`}>
                        <strong>{dimension.label}</strong>
                        <p>{personalizeStatement(dimension.statement, ownerName, person.name, person.reversed)}</p>
                      </article>
                    ))}
                  </section>
                ))}
                <section className="gy-evidence-group">
                  <h4>두 명식의 공통 계산 근거</h4>
                  {evidenceFacts.map((fact) => (
                    <article key={fact.id}>
                      <strong>{fact.category === 'day-master' ? '일간 관계' : fact.category === 'spouse-palace' ? '배우자궁 관계' : fact.category === 'element-exchange' ? '오행 상호 보완' : '합·충·형·파·해 관계'}</strong>
                      <p>{personalizeStatement(fact.statement, ownerName, person.name, person.reversed)}</p>
                    </article>
                  ))}
                </section>
                {uncertainties.length > 0 ? (
                  <section className="gy-evidence-group gy-evidence-limits">
                    <h4>해석 범위와 확인이 필요한 부분</h4>
                    <ul>{uncertainties.map((item) => <li key={item}>{item}</li>)}</ul>
                  </section>
                ) : null}
                <p className="gy-evidence-version">달력 {person.analysis.calendarVersions.owner} · 궁합 엔진 {person.analysis.compatibilityEngineVersion}</p>
              </div>
            </details>

            <GuiyeondoRecommendations relationType={type} onConnect={onAdd} />
            <button type="button" className="gy-secondary-button" onClick={onInvite}>다른 인연도 초대하기</button>
            <button type="button" className="gy-remove-person" onClick={() => onRemove(person.id)}><Trash2 size={15} /> 이 인연 삭제</button>
          </>
        ) : (
          <div className="gy-empty-detail">
            <span className="gy-eyebrow">EMPTY CONSTELLATION</span>
            <h2>아직 이 자리의<br />주인을 찾지 못했어요</h2>
            <p>{visual.interpretation}</p>
            <ol className="gy-observation-list gy-empty-observations">
              {visual.observations.map((observation, index) => (
                <li key={observation}><span>{String(index + 1).padStart(2, '0')}</span><p>{observation}</p></li>
              ))}
            </ol>
            <button type="button" className="gy-primary-button" onClick={onAdd}><Plus size={18} /> 직접 인연 연결하기</button>
            <button type="button" className="gy-text-button" onClick={onInvite}>친구에게 초대 보내기</button>
            <small><LockKeyhole size={14} /> 정확한 생년월일과 출생시간은 상대에게 보이지 않습니다.</small>
          </div>
        )}
      </div>
    </aside>
  );
}
