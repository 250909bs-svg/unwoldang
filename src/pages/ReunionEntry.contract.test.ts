import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const componentSource = readFileSync(new URL('../components/CinematicProductIntro.tsx', import.meta.url), 'utf8');
const appSource = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
const entrySource = readFileSync(new URL('./ReunionEntry.tsx', import.meta.url), 'utf8');
const styles = readFileSync(new URL('../styles/cinematic-product-intro.css', import.meta.url), 'utf8');
const intakeSource = readFileSync(new URL('./ReunionIntake.tsx', import.meta.url), 'utf8');
const intakeStyles = readFileSync(new URL('../styles/reunion-micro-intake.css', import.meta.url), 'utf8');

describe('MZ큐피트 재회운 영상 진입 화면 계약', () => {
  it('임시 실제 영상과 포스터를 사용해 재회 입력 화면으로 이어진다', () => {
    expect(entrySource).toContain("const PROVISIONAL_REUNION_VIDEO = '/signature-intake-hero.mp4'");
    expect(appSource).toContain('path="/detail/love-reunion"');
    expect(appSource).toContain('productId="love-reunion"');
    expect(appSource).toContain('<ReunionEntry />');
    expect(entrySource).toContain("const REUNION_POSTER = '/home-love-reunion-card.png'");
    expect(entrySource).toContain('ctaLabel="재회 보러가기"');
    expect(entrySource).toContain('ctaTo="/form/love-reunion"');
    expect(entrySource).toContain("ctaState={{ tabOrigin: '/detail/love-reunion' }}");
  });

  it('자동 재생과 모바일 음성 활성화, 후기와 모션 감소 대체 화면을 유지한다', () => {
    expect(componentSource).toContain('muted={isMuted}');
    expect(componentSource).toContain('autoPlay');
    expect(componentSource).toContain('loop');
    expect(componentSource).toContain('playsInline');
    expect(componentSource).toContain('video.muted = false');
    expect(componentSource).toContain('화면을 터치하면 소리가 나옵니다');
    expect(componentSource).toContain("window.matchMedia('(prefers-reduced-motion: reduce)')");
    expect(componentSource).toContain('reviewMoments[reviewIndex]');
    expect(styles).toContain('bottom: 0;');
    expect(styles).toContain('env(safe-area-inset-bottom)');
  });

  it('keeps reunion intake atomic and removes the generic next-step flow', () => {
    expect(intakeSource).toContain("| 'self-date' | 'self-time' | 'self-gender' | 'self-name'");
    expect(intakeSource).toContain("case 'partner-known':");
    expect(intakeSource).toContain("case 'safety':");
    expect(intakeSource).toContain("case 'questions':");
    expect(intakeSource).toContain("navigate('/preview/love-reunion'");
    expect(intakeSource).not.toContain('\ub2e4\uc74c \ub2e8\uacc4');
    expect(intakeStyles).toContain('.reunion-micro-time-period');
  });
});
