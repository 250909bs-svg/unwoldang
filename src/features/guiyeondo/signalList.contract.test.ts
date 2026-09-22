import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { withTopicParticle } from '../../lib/korean/particles';

/**
 * 결과 화면이 고객에게 무엇을 보여 주는지에 대한 계약.
 *
 * 두 가지가 동시에 잘못돼 있었다.
 *
 *   1) 신호 한 줄에 경향 문구를 **두 번** 적었다. 왼쪽 라벨 아래에 한 번, 오른쪽 알약에
 *      한 번. 화면에서는 크기가 달라 덜 보였지만 읽어 보면 "조건을 살필 신호 / 조건을
 *      살필 신호" 였고, 화면 낭독기는 그대로 두 번 읽었다.
 *
 *   2) `지원`·`성장` 이 **모든 사람의 결과에서 늘** "근거 확인 중" 이었다. 이 관계에서만
 *      근거가 부족한 것이 아니라 엔진에 독립 계산 기준 자체가 없기 때문이다
 *      (`relationshipAnalysis.ts` 의 `unsupportedVector`). 값이 생길 일이 없는 줄을
 *      목록에 세워 두면 투명함이 아니라 고장 난 표로 읽힌다.
 *
 * 임의 값을 만들지 않는다는 원칙은 그대로다. 그 사실을 **줄이 아니라 한 문장으로** 말한다.
 */
const read = (name: string) => readFileSync(new URL(`./${name}`, import.meta.url), 'utf8');

const panel = read('GuiyeondoDetailPanel.tsx');
const guest = read('GuiyeondoGuestPage.tsx');
const analysis = read('relationshipAnalysis.ts');

describe('귀연도 신호 목록 계약', () => {
  it('엔진이 아직 계산하지 못하는 신호가 실제로 존재한다', () => {
    /*
     * 이 테스트가 깨지는 날 = 지원·성장에 계산 기준이 생긴 날이다. 그때는 아래의
     * 걸러내기와 안내 문장을 걷어내고 두 신호를 목록에 되돌려야 한다. 먼저 지우지
     * 말라는 뜻이 아니라, 지울 시점을 알려 주는 표식이다.
     */
    expect(analysis).toContain("type SupportedVectorId = Exclude<GuiyeondoVectorId, 'support' | 'growth'>");
    expect(analysis).toContain("function unsupportedVector(id: 'support' | 'growth'");
  });

  it('신호 한 줄에 경향은 한 번만 적는다', () => {
    const list = panel.slice(panel.indexOf('<div className="gy-vector-list">'), panel.indexOf('gy-vector-note'));
    const printed = list.match(/TENDENCY_LABEL\[vector\.tendency\]/g) || [];

    expect(printed, `한 줄에 ${printed.length}번 적혀 있다`).toHaveLength(1);
  });

  it('목록은 읽힌 신호만 세운다', () => {
    expect(panel).toContain('const readSignals = person ? person.analysis.vectors.filter((vector) => vector.supported)');
    expect(panel).toContain('{readSignals.map((vector) => (');
    /* 전체 벡터를 그대로 돌리면 죽은 줄이 다시 생긴다. */
    expect(panel).not.toContain('{person.analysis.vectors.map((vector) => (');
  });

  it('읽지 못한 신호는 이름을 대고 이유를 적는다', () => {
    expect(panel).toContain('unreadSignals.length ?');
    expect(panel).toContain('gy-vector-unread');
    /* 그냥 감추면 "왜 8개뿐이냐" 가 된다. 무엇을, 왜 빼놓았는지 말해야 한다. */
    expect(panel).toContain('unreadSignals.map((vector) => vector.label)');
    expect(panel).toContain('withTopicParticle(');
  });

  it('안내 문장의 조사가 받침을 따라간다', () => {
    /* 목록의 마지막 이름이 무엇이든 "성장은" · "지원은" 처럼 붙어야 한다. */
    expect(withTopicParticle('지원 · 성장')).toBe('지원 · 성장은');
    expect(withTopicParticle('끌림 · 지원')).toBe('끌림 · 지원은');
    expect(withTopicParticle('감정 교류')).toBe('감정 교류는');
  });

  it('대표 신호 카드도 읽힌 것 중에서 고른다', () => {
    /* 대비책이 `visual.focusVectors` 를 그대로 쓰면, 그 목록이 못 읽는 신호를 가리키는
       유형에서 카드가 전부 "근거 확인 중" 으로 채워진다. */
    expect(panel).toContain('readSignals.filter((vector) => visual.focusVectors.includes(vector.id))');
  });

  it('손님 결과 화면도 읽힌 신호만 내보낸다', () => {
    expect(guest).toContain('Boolean(vector?.supported)');
    /* 걸러낸 뒤 빈 목록이 되는 유형이 있다. 그때는 읽힌 것으로 채운다. */
    expect(guest).toContain('person.analysis.vectors.filter((vector) => vector.supported).slice(0, 4)');
  });

  it('상세 패널의 대표 이미지는 열자마자 불러온다', () => {
    /*
     * 패널은 열릴 때 이미지가 맨 위에 있다. `loading="lazy"` 로 두면 패널이 미끄러져
     * 들어오는 동안 화면 밖으로 판정돼, 열었는데 그림 자리가 빈 채로 남는다.
     * 스크롤을 건드려야 그제서야 불러왔다.
     */
    expect(panel).toContain('type={type} priority />');
  });
});
