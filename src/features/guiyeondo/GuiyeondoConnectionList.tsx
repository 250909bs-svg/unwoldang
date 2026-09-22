import { ChevronRight, Sparkles } from 'lucide-react';
import { describeGuiyeondoTally, rankGuiyeondoConnections } from './connectionRanking';
import { GUIYEONDO_RELATIONSHIP_VISUALS } from './relationshipVisuals';
import type { GuiyeondoPerson } from './types';

type GuiyeondoConnectionListProps = {
  ownerName: string;
  people: GuiyeondoPerson[];
  selectedPersonId: string | null;
  onOpen: (person: GuiyeondoPerson) => void;
};

/**
 * 지도 아래의 인연 순위.
 *
 * 지도는 별자리라 한눈에 세기 어렵다. 같은 사람들을 한 줄로 세워 누가 위인지 바로
 * 읽히게 하고, 누르면 그 사람의 해석이 열린다.
 *
 * 숫자에 대해: 0~100 궁합점수는 만들지 않는다. 궁합 엔진이 그런 값을 내지 않기
 * 때문이다(`relationshipAnalysis.ts` 는 근거가 없으면 "임의 점수를 만들지 않았습니다"
 * 라고 적어 둔다). 여기 보이는 수는 전부 **실제로 센 신호 개수**다.
 */
export default function GuiyeondoConnectionList({
  ownerName,
  people,
  selectedPersonId,
  onOpen
}: GuiyeondoConnectionListProps) {
  if (!people.length) return null;

  const ranked = rankGuiyeondoConnections(people);
  const classifiedCount = ranked.filter((row) => row.classified).length;

  return (
    <section className="gy-rank" aria-labelledby="gy-rank-title">
      <div className="gy-rank-head">
        <span className="gy-eyebrow">CONNECTIONS</span>
        <h2 id="gy-rank-title">{ownerName}님과 이어진 {people.length}명</h2>
        <p>
          보완 근거가 우세한 순서예요. 확정된 신호가 많을수록 위로 옵니다
          {classifiedCount < people.length ? ', 근거를 더 봐야 하는 인연은 아래에 둡니다' : ''}.
        </p>
      </div>

      <ol className="gy-rank-list">
        {ranked.map((row) => {
          const visual = row.type ? GUIYEONDO_RELATIONSHIP_VISUALS[row.type] : null;
          const selected = row.person.id === selectedPersonId;

          return (
            <li key={row.person.id}>
              <button
                type="button"
                className={`gy-rank-row${selected ? ' is-selected' : ''}${row.classified ? '' : ' is-pending'}`}
                onClick={() => onOpen(row.person)}
                aria-current={selected ? 'true' : undefined}
              >
                <span className="gy-rank-ordinal" aria-hidden="true">
                  {row.rank}
                </span>

                <span className="gy-rank-body">
                  <strong className="gy-rank-name">
                    {row.person.name}
                    {row.person.source === 'invite' ? (
                      <em className="gy-rank-source">초대 응답</em>
                    ) : null}
                  </strong>

                  {visual ? (
                    <span className="gy-rank-type" data-tone={visual.tone}>
                      <Sparkles size={11} aria-hidden="true" />
                      {visual.label}
                      <i aria-hidden="true">{visual.hanja}</i>
                    </span>
                  ) : (
                    <span className="gy-rank-type is-pending">근거 확인 중</span>
                  )}

                  <span className="gy-rank-tally">
                    {describeGuiyeondoTally(row.tally)}
                    {row.person.analysis.status === 'partial' ? (
                      <em> · 출생시간 미상</em>
                    ) : null}
                  </span>
                </span>

                <ChevronRight size={17} className="gy-rank-arrow" aria-hidden="true" />
              </button>
            </li>
          );
        })}
      </ol>

      <p className="gy-rank-footnote">
        운월당 관계 탐색 분류입니다. 순위는 두 사람의 명식에서 확정된 신호 수로 매기며,
        사람의 좋고 나쁨이나 확정된 예언이 아닙니다.
      </p>
    </section>
  );
}
