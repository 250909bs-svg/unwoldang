import { hasDuplicateMzLoveScenes } from './sceneResolver';
import type { FactBombResult, MzLoveReport } from './types';

export type MzLoveSafetyIssueCode =
  | 'future-certainty'
  | 'partner-mind-certainty'
  | 'demeaning-language'
  | 'fear-pressure'
  | 'missing-evidence'
  | 'missing-action'
  | 'duplicate-scene'
  | 'chapter-count';

export interface MzLoveSafetyIssue {
  code: MzLoveSafetyIssueCode;
  path: string;
  excerpt: string;
  message: string;
}

const FUTURE_CERTAINTY_PATTERNS = [
  /(?:무조건|반드시|확실히|틀림없이|100%|백\s*퍼센트).{0,36}(?:만나|생겨|들어와|결혼|헤어져|연락|돌아와)/u,
  /(?:만날|생길|들어올|결혼할|헤어질|연락할|돌아올).{0,20}(?:것이\s*확실|게\s*확실|거야|겁니다|예정이야|확정)/u,
  /\d{1,2}월\s*\d{1,2}일.{0,24}(?:만나|연락|고백|결혼)/u,
  /(?:운명은|미래는).{0,24}(?:정해져|확정돼)/u,
];

const PARTNER_MIND_PATTERNS = [
  /(?:그\s*사람|상대|애인|전\s*연인)(?:은|는|이|가).{0,30}(?:너를|당신을).{0,18}(?:사랑한다|사랑해|좋아한다|좋아해|그리워한다|그리워해|후회한다|원한다|생각한다)/u,
  /(?:그\s*사람|상대)(?:의)?\s*속마음(?:은|이).{0,30}(?:확실|분명|사랑|미련|후회)/u,
  /(?:그|그녀)(?:는|가).{0,24}(?:연락하고\s*싶어|돌아오고\s*싶어|너만\s*생각)/u,
];

const DEMEANING_PATTERNS = [
  /남자\s*보는\s*눈이\s*없/u,
  /여자\s*보는\s*눈이\s*없/u,
  /(?:한심|멍청|찌질|못생|재수\s*없)/u,
];

const FEAR_PRESSURE_PATTERNS = [
  /(?:결제|구매).{0,16}(?:안\s*하면|하지\s*않으면).{0,24}(?:불행|놓쳐|망해)/u,
  /(?:평생|영원히).{0,20}(?:혼자|외로|사랑\s*못)/u,
];

function excerpt(text: string): string {
  return text.replace(/\s+/g, ' ').trim().slice(0, 100);
}

function matchIssue(
  text: string,
  path: string,
  code: MzLoveSafetyIssueCode,
  patterns: readonly RegExp[],
  message: string,
): MzLoveSafetyIssue[] {
  return patterns.some((pattern) => pattern.test(text))
    ? [{ code, path, excerpt: excerpt(text), message }]
    : [];
}

/** Audits copy without altering it, keeping deterministic evidence untouched. */
export function auditMzLoveText(text: string, path = 'text'): MzLoveSafetyIssue[] {
  if (!text.trim()) return [];
  return [
    ...matchIssue(text, path, 'future-certainty', FUTURE_CERTAINTY_PATTERNS, '미래 사건을 확정하는 표현입니다.'),
    ...matchIssue(text, path, 'partner-mind-certainty', PARTNER_MIND_PATTERNS, '상대의 속마음을 사실처럼 확정하는 표현입니다.'),
    ...matchIssue(text, path, 'demeaning-language', DEMEANING_PATTERNS, '사용자를 모욕하거나 비하하는 표현입니다.'),
    ...matchIssue(text, path, 'fear-pressure', FEAR_PRESSURE_PATTERNS, '공포나 불안을 구매 압박에 사용한 표현입니다.'),
  ];
}

export function auditFactBombResult(result: FactBombResult, path = 'result'): MzLoveSafetyIssue[] {
  const textFields: Array<[string, string]> = [
    ['factBomb', result.factBomb],
    ['interpretation', result.interpretation],
    ['realLifeScene', result.realLifeScene],
    ['counterpoint', result.counterpoint],
    ['checkSignal', result.checkSignal],
    ['action', result.action],
    ['characterLine.text', result.characterLine.text],
  ];
  const issues = textFields.flatMap(([field, text]) => auditMzLoveText(text, `${path}.${field}`));
  if (result.evidence.length === 0) {
    issues.push({
      code: 'missing-evidence',
      path: `${path}.evidence`,
      excerpt: '',
      message: '팩폭에는 하나 이상의 결정론적 명리 근거가 필요합니다.',
    });
  }
  if (!result.action.trim() || !result.checkSignal.trim()) {
    issues.push({
      code: 'missing-action',
      path,
      excerpt: excerpt(`${result.checkSignal} ${result.action}`),
      message: '팩폭에는 확인 기준과 실행 행동이 모두 필요합니다.',
    });
  }
  return issues;
}

export function auditMzLoveReport(report: MzLoveReport): MzLoveSafetyIssue[] {
  const issues = [
    ...auditFactBombResult(report.openingFact, 'openingFact'),
    ...report.chapters.flatMap((chapter) => auditFactBombResult(chapter.result, `chapters.${chapter.id}.result`)),
  ];
  if (report.chapters.length !== 13) {
    issues.push({
      code: 'chapter-count',
      path: 'chapters',
      excerpt: String(report.chapters.length),
      message: '전체 결과는 정확히 13개 챕터여야 합니다.',
    });
  }
  if (hasDuplicateMzLoveScenes(report.chapters.map((chapter) => chapter.sceneKey))) {
    issues.push({
      code: 'duplicate-scene',
      path: 'chapters.sceneKey',
      excerpt: '',
      message: '한 결과에서 같은 장면을 두 번 사용할 수 없습니다.',
    });
  }
  return issues;
}

export function assertSafeMzLoveReport(report: MzLoveReport): void {
  const issues = auditMzLoveReport(report);
  if (issues.length) {
    throw new Error(`MZ love content safety failed: ${issues.map((issue) => `${issue.code}@${issue.path}`).join(', ')}`);
  }
}
