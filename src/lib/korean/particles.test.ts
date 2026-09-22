import { describe, expect, it } from 'vitest';
import {
  hasFinalConsonant,
  withConjunctionParticle,
  withDirectionParticle,
  withObjectParticle,
  withSubjectParticle,
  withTopicParticle
} from './particles';

describe('한국어 조사', () => {
  it('받침 유무를 마지막 글자로 판단한다', () => {
    expect(hasFinalConsonant('인')).toBe(true);
    expect(hasFinalConsonant('사')).toBe(false);
    expect(hasFinalConsonant('회복력')).toBe(true);
    expect(hasFinalConsonant('결과')).toBe(false);
  });

  it('한글이 아니면 알 수 없다고 답한다', () => {
    expect(hasFinalConsonant('亥')).toBeNull();
    expect(hasFinalConsonant('report')).toBeNull();
    expect(hasFinalConsonant('2026')).toBeNull();
    expect(hasFinalConsonant('')).toBeNull();
  });

  it('이/가 를 받침으로 고른다', () => {
    expect(withSubjectParticle('회복력')).toBe('회복력이');
    expect(withSubjectParticle('결과')).toBe('결과가');
  });

  it('을/를 을 받침으로 고른다', () => {
    // 화면에서 실제로 틀렸던 자리다: '인해파을' → '인해파를'.
    expect(withObjectParticle('인해파')).toBe('인해파를');
    expect(withObjectParticle('인해합')).toBe('인해합을');
  });

  it('과/와 를 받침으로 고른다', () => {
    // 여기서도 틀렸었다: '인와' → '인과'.
    expect(withConjunctionParticle('인')).toBe('인과');
    expect(withConjunctionParticle('사')).toBe('사와');
  });

  it('은/는 을 받침으로 고른다', () => {
    expect(withTopicParticle('오늘')).toBe('오늘은');
    expect(withTopicParticle('나')).toBe('나는');
  });

  it('ㄹ 받침은 으로가 아니라 로를 받는다', () => {
    expect(withDirectionParticle('물')).toBe('물로');
    expect(withDirectionParticle('앞')).toBe('앞으로');
    expect(withDirectionParticle('뒤')).toBe('뒤로');
  });

  it('받침을 알 수 없으면 없는 쪽으로 붙인다', () => {
    expect(withSubjectParticle('亥')).toBe('亥가');
    expect(withObjectParticle('亥')).toBe('亥를');
  });
});
