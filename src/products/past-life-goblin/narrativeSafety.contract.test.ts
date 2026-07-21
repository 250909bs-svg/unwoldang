import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { PAST_LIFE_NARRATIVE_POLICY } from './contract';

const ownedNarrativeSources = [
  './contract.ts',
  './index.ts',
  './reportBuilder.ts',
  '../../content/pastLifeExperience.ts',
  '../../pages/PastLifeEntry.tsx',
  '../../pages/PastLifeImmersion.tsx',
  '../../pages/PastLifeLanding.tsx',
  '../../components/HeroFilm.tsx',
  '../../components/PastLifeStoryReport.tsx'
].map((path) => ({
  path,
  source: readFileSync(new URL(path, import.meta.url), 'utf8')
}));

describe('past-life-goblin narrative safety contract', () => {
  it('frames the experience as symbolic self-understanding, not verified history', () => {
    expect(PAST_LIFE_NARRATIVE_POLICY.mode).toBe('symbolic-saju-narrative');
    expect(PAST_LIFE_NARRATIVE_POLICY.notice).toContain('반복 기질');
    expect(PAST_LIFE_NARRATIVE_POLICY.notice).toContain('상징 서사');
    expect(PAST_LIFE_NARRATIVE_POLICY.notice).toContain('증명하지 않습니다');
  });

  it('does not use explicit factual-certainty claims in owned narrative sources', () => {
    const forbiddenClaims = [
      /전생은\s*바꿀\s*수\s*없/gu,
      /당신의\s*전생은/gu,
      /당신은\s*전생에/gu,
      /확정된\s*전생/gu,
      /전생(?:은|이)\s*(?:역사적\s*)?사실(?:이다|입니다)/gu,
      /전생의\s*실재를\s*(?:확인|증명)(?!하지)/gu,
      /title:\s*'전생의\s*(?:정체|업)'/gu,
      /당신은[^.]{0,80}사람입니다/gu
    ];

    ownedNarrativeSources.forEach(({ path, source }) => {
      forbiddenClaims.forEach((pattern) => {
        pattern.lastIndex = 0;
        expect(source, `${path} contains a factual-certainty claim`).not.toMatch(pattern);
      });
    });
  });

  it('renders the disclaimer and clearly labels demo copy as a sample', () => {
    const landing = ownedNarrativeSources.find(({ path }) =>
      path.endsWith('PastLifeLanding.tsx')
    )?.source;
    const entry = ownedNarrativeSources.find(({ path }) => path.endsWith('PastLifeEntry.tsx'))
      ?.source;
    const report = ownedNarrativeSources.find(({ path }) =>
      path.endsWith('PastLifeStoryReport.tsx')
    )?.source;

    expect(landing).toContain('{PAST_LIFE_NARRATIVE_POLICY.notice}');
    expect(landing).toContain('실제 고객 결과가 아닌');
    expect(landing).toContain('<small>샘플</small>');
    expect(entry).toContain('전생을 확인된 역사로 단정하지 않습니다.');
    expect(report).toContain('이건 과거를 증명하는 기록이 아니야.');
  });
});
