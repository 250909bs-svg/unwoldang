import type { IntakeFormData } from '../api/mockData';
import { getRelationshipDurationLabel, getRelationshipStatusLabel } from './relationshipIntake';

export type RelationshipPersonalizationContext = {
  status: IntakeFormData['relationshipStatus'];
  duration: IntakeFormData['relationshipDuration'];
  stage: string;
  summary: string;
  priorities: readonly [string, string];
  likelyConcerns: readonly [string, string];
  actionGuides: readonly [string, string];
};

type RelationshipProfile = Omit<RelationshipPersonalizationContext, 'status' | 'duration' | 'summary'>;
type Duration = Exclude<IntakeFormData['relationshipDuration'], ''>;
type Status = Exclude<IntakeFormData['relationshipStatus'], ''>;

const profile = (
  stage: string,
  priorities: readonly [string, string],
  likelyConcerns: readonly [string, string],
  actionGuides: readonly [string, string]
): RelationshipProfile => ({ stage, priorities, likelyConcerns, actionGuides });

const STATUS_DURATION_PROFILES: Partial<Record<Status, Record<Duration, RelationshipProfile>>> = {
  single: {
    under1: profile(
      '최근 관계를 정리하고 다시 탐색하는 시기',
      ['이전 관계에서 반복된 패턴 정리', '새로운 인연을 만날 생활 반경 회복'],
      ['감정이 정리되기 전에 다음 관계를 서두르는 일', '익숙한 유형을 무심코 다시 선택하는 일'],
      ['최근 관계의 좋았던 기준과 불편했던 신호를 각각 적기', '새로운 사람을 만날 수 있는 일정을 주 1회 만들기']
    ),
    under3: profile(
      '혼자 지내는 리듬 속에서 관계 기준을 다시 세우는 시기',
      ['원하는 관계 방식 구체화', '관계 시작을 막는 생활 습관 점검'],
      ['이상적인 기준만 높아지고 실제 만남은 줄어드는 일', '혼자 있는 편안함 때문에 호감 표현을 미루는 일'],
      ['양보할 수 없는 기준과 조정 가능한 기준을 각각 두 가지로 나누기', '호감이 생기면 짧은 대화나 약속으로 확인할 기한 정하기']
    ),
    under5: profile(
      '독립적인 생활 방식과 관계 진입 조건을 조율할 시기',
      ['혼자 사는 리듬과 연애 시간을 함께 설계', '관계 시작 장벽을 현실적인 수준으로 조정'],
      ['상대가 내 생활에 들어오는 일을 부담으로만 보는 일', '충분히 알아보기 전에 맞지 않는다고 결론내리는 일'],
      ['지키고 싶은 개인 시간과 함께 쓰고 싶은 시간을 나누기', '첫인상보다 세 번의 만남에서 일관성을 확인하기']
    ),
    under10: profile(
      '장기적인 독립 생활과 관계의 자리를 함께 재설계할 시기',
      ['내 생활에 관계가 들어올 실제 공간 마련', '오래 유지할 수 있는 관계 시작 방식 선택'],
      ['생활 변화 자체를 관계의 위험으로 해석하는 일', '완벽한 확신이 생길 때까지 시작을 미루는 일'],
      ['시간·거리·연락에서 감당 가능한 관계 조건 정하기', '완벽한 일치보다 갈등을 조율하는 태도를 기준에 넣기']
    )
  },
  situationship: {
    under1: profile(
      '호감과 연락 흐름을 탐색하는 초기 썸',
      ['말과 행동의 호감 신호 확인', '연락 빈도와 만남 의지의 균형 확인'],
      ['빠른 확답으로 자연스러운 탐색을 막는 일', '연락량만으로 상대 의도를 확정하는 일'],
      ['다음 만남을 구체적으로 제안해 실행 의지 확인하기', '호감 표현 뒤 반응의 일관성을 두세 번 관찰하기']
    ),
    under3: profile(
      '호감을 실제 관계로 정의할지 확인하는 썸',
      ['관계 의도와 기대 수준 확인', '애매함을 끝낼 대화 시점 정하기'],
      ['좋은 분위기만 유지하며 관계 정의를 계속 미루는 일', '모호한 말보다 내 기대를 먼저 확정하는 일'],
      ['원하는 관계 방향을 부담 없는 한 문장으로 묻기', '답변보다 이후 약속과 연락이 달라지는지 확인하기']
    ),
    under5: profile(
      '장기화된 애매함의 이유와 전환 조건을 확인할 썸',
      ['관계 정의가 지연되는 실제 이유 확인', '기다림을 계속할 기준과 기한 설정'],
      ['이미 투자한 시간 때문에 불명확한 관계를 유지하는 일', '말뿐인 가능성을 실제 진전으로 착각하는 일'],
      ['관계 전환에 필요한 조건을 서로 한 가지씩 말하기', '정한 기한 안에 변화가 없으면 내 선택을 다시 결정하기']
    ),
    under10: profile(
      '고착된 애매함을 관계 또는 종료로 정리할 썸',
      ['현재 관계가 주는 것과 소모하는 것 비교', '관계 정의를 위한 최종 기준 합의'],
      ['익숙함을 관계의 안정성으로 오해하는 일', '상대의 결정을 무기한 기다리며 내 기회를 줄이는 일'],
      ['연락·만남·독점성에서 원하는 조건을 명시하기', '합의가 불가능하면 관계의 거리를 행동으로 조정하기']
    )
  },
  dating: {
    under1: profile(
      '감정과 생활 방식을 맞춰가는 연애 초기',
      ['연락·만남 리듬 합의', '갈등이 생길 때 반응 방식 관찰'],
      ['좋은 모습만 보이려다 필요한 요구를 숨기는 일', '초기 열기를 장기 적합성으로 단정하는 일'],
      ['연락과 개인 시간에 대한 기대를 먼저 합의하기', '작은 불편을 사실과 요청으로 나누어 말하기']
    ),
    under3: profile(
      '신뢰와 역할 분담을 구체화하는 연애 중기',
      ['생활 습관과 책임 분담 확인', '갈등 뒤 회복 방식 만들기'],
      ['한쪽만 관계 운영을 책임지는 구조', '반복 갈등을 성격 문제로만 넘기는 일'],
      ['시간·비용·연락에서 서로 맡는 역할 점검하기', '같은 갈등이 반복되면 원인과 다음 행동 기록하기']
    ),
    under5: profile(
      '생활과 미래 계획을 연결하는 장기 연애',
      ['재정·주거·일의 우선순위 확인', '결혼이나 동거에 대한 속도 합의'],
      ['오래 만났다는 이유만으로 미래 계획이 같다고 보는 일', '가족·돈·거주 문제를 감정으로만 해결하는 일'],
      ['1년 뒤 주거·직업·저축 계획을 숫자와 일정으로 비교하기', '결혼·동거 의향과 선행 조건을 각각 말하기']
    ),
    under10: profile(
      '공동 생활과 장기 약속의 현실 조건을 결정할 연애',
      ['결혼·동거·재정·가족 계획의 합의', '관계를 다음 단계로 옮길 일정 결정'],
      ['관성으로 관계를 유지하며 중요한 결정을 미루는 일', '재정이나 가족 갈등을 사랑의 크기로만 판단하는 일'],
      ['공동 재정·주거·가족 경계의 합의안 만들기', '다음 단계의 조건과 결정 시점을 함께 정하기']
    )
  }
};

const DEFAULT_PROFILE = profile(
  '현재 관계의 위치와 다음 선택을 함께 확인할 시기',
  ['현재 관계에서 필요한 합의 확인', '반복되는 관계 패턴 점검'],
  ['감정만으로 상대의 의도를 단정하는 일', '중요한 결정을 미루는 일'],
  ['원하는 관계 조건을 구체적인 문장으로 말하기', '상대의 말과 행동이 일치하는지 확인하기']
);

export function buildRelationshipPersonalizationContext(
  formData: Pick<Partial<IntakeFormData>, 'relationshipStatus' | 'relationshipDuration'>
): RelationshipPersonalizationContext | null {
  const status = formData.relationshipStatus;
  const duration = formData.relationshipDuration;
  if (!status || !duration) return null;

  const selected = STATUS_DURATION_PROFILES[status]?.[duration] || DEFAULT_PROFILE;
  const statusLabel = getRelationshipStatusLabel(status);
  const durationLabel = getRelationshipDurationLabel(duration);
  const summary = status === 'single'
    ? `${statusLabel} / 솔로 기간 ${durationLabel}`
    : `${statusLabel} / ${durationLabel}`;
  return { status, duration, summary, ...selected };
}

export type QuestionDomain =
  | 'career' | 'job_change' | 'business' | 'business_operation' | 'wealth' | 'spending'
  | 'investment' | 'love' | 'dating' | 'breakup' | 'reunion' | 'marriage'
  | 'relationship' | 'family' | 'general';

export type QuestionContext = {
  originalQuestion: string;
  domain: QuestionDomain;
  stage: string;
  currentSituation: string;
  target: string;
  problem: string;
  requestedDecision: string;
  explicitConstraints: readonly string[];
};

const hasAny = (value: string, patterns: readonly RegExp[]) => patterns.some((pattern) => pattern.test(value));

export function buildQuestionContext(question: string): QuestionContext {
  const originalQuestion = question.trim();
  const value = originalQuestion.replace(/\s+/g, ' ');
  const explicitConstraints = [
    /매출(?:이|은)?\s*(?:늘|증가)/.test(value) ? '매출은 증가하고 있음' : '',
    /돈(?:이|은)?.*(?:안|않).*남|돈(?:이|은)?.*남지|수익.*안.*남|이익.*안.*남/.test(value) ? '매출이 이익으로 남지 않음' : ''
  ].filter(Boolean);
  const result = (
    domain: QuestionDomain, stage: string, currentSituation: string,
    target: string, problem: string, requestedDecision: string
  ): QuestionContext => ({ originalQuestion, domain, stage, currentSituation, target, problem, requestedDecision, explicitConstraints });

  if (hasAny(value, [/사업/, /매출/, /고객/, /창업/]) && hasAny(value, [/매출/, /비용/, /지출/, /이익/, /수익성/, /운영/, /인건비/, /광고비/])) {
    return result('business_operation', 'operating-profitability', '이미 운영 중인 사업의 매출과 비용 구조를 점검하는 상황', '매출을 실제 이익과 현금으로 남기는 구조', '매출 증가가 이익 증가로 연결되지 않는 비용 구조', '우선 점검하거나 줄일 비용 항목의 판단 순서');
  }
  if (hasAny(value, [/사업.*(?:시작|창업|해도)/, /창업.*(?:할까|해도|시작)/])) {
    return result('business', 'pre-start', '사업을 시작하기 전 적합성과 진입 시점을 검토하는 상황', '감당 가능한 방식으로 사업 가능성을 검증하는 것', '사업 시작 여부와 초기 위험의 판단', '지금 사업을 시작할지와 어떤 순서로 검증할지');
  }
  if (hasAny(value, [/승진.*이직|이직.*승진/, /회사를?\s*그만.*사업/, /직장.*사업.*(?:중|vs|VS)/])) {
    const transition = /사업/.test(value);
    return result('job_change', transition ? 'career-business-transition' : 'advancement-vs-move', transition ? '현재 직장을 떠나 사업으로 전환할지 비교하는 상황' : '현재 조직에서 성장할지 외부 기회를 선택할지 비교하는 상황', '소득과 성장 가능성을 함께 지키는 경력 선택', '현재 경로를 유지할 때와 이동할 때의 조건 비교', transition ? '퇴사와 사업 전환의 순서' : '승진 대기와 이직 중 우선할 선택');
  }
  if (hasAny(value, [/결혼/, /배우자/])) {
    return result('marriage', /지금 만나는|연애|현재/.test(value) ? 'considering-commitment' : 'marriage-planning', '현재 관계를 장기적인 약속으로 이어갈지 검토하는 상황', '감정과 현실 조건이 함께 지속되는 결혼 판단', '현재 상대와 장기 계획의 적합성', '결혼을 결정하기 전에 확인할 조건과 대화 순서');
  }
  if (hasAny(value, [/썸.*오래|관계.*정의.*않|애매.*관계/])) {
    return result('dating', 'prolonged-ambiguity', '썸이 오래 이어지지만 상대가 관계를 명확히 정의하지 않는 상황', '관계 전환 의사와 기다릴 기한을 확인하는 것', '호감은 있지만 관계 정의가 지연되는 애매함', '관계를 직접 확인할지와 언제까지 기다릴지');
  }
  if (hasAny(value, [/헤어진|이별한|재회/]) && hasAny(value, [/연락|먼저|다시/])) {
    return result('reunion', 'post-breakup-contact', '이별 뒤 먼저 연락해 관계를 다시 확인할지 고민하는 상황', '감정 소모를 줄이면서 재연결 가능성을 확인하는 것', '먼저 연락했을 때의 기대와 경계 설정', '먼저 연락할지와 연락한다면 어떤 방식으로 할지');
  }
  if (hasAny(value, [/지출/, /소비/, /돈.*(?:새|남|모으)/])) {
    return result('spending', 'money-management', '현재 현금 흐름과 소비 구조를 점검하는 상황', '수입을 실제 저축과 자산으로 남기는 것', '돈이 빠져나가는 항목과 관리 기준', '먼저 줄이거나 통제할 지출의 판단 순서');
  }
  if (hasAny(value, [/투자/, /주식/, /코인/, /부동산/])) {
    return result('investment', 'risk-decision', '투자 판단과 감당 가능한 위험 수준을 검토하는 상황', '손실 가능성을 통제한 의사결정', '투자 시기와 위험 감수 범위', '실제 투자 전 확인할 조건과 중단 기준');
  }
  if (hasAny(value, [/이직/, /직장/, /회사/, /승진/, /직업/, /먹고살/, /뭐먹고살/, /벌어먹/])) {
    return result('career', /이직/.test(value) ? 'considering-change' : 'career-development', '현재 경력에서 다음 성장 방향을 검토하는 상황', '강점을 살리면서 지속 가능한 경력 선택', '현재 역할과 다음 기회의 적합성', '유지·이동·준비 중 우선할 경력 행동');
  }
  if (hasAny(value, [/연애/, /사람/, /관계/, /사랑/, /인연/])) {
    return result('relationship', 'relationship-decision', '현재 관계의 의미와 다음 행동을 확인하는 상황', '상대의 행동과 내 기준을 함께 확인하는 것', '관계에서 반복되는 불확실성', '관계를 위해 지금 먼저 확인할 행동');
  }
  return result('general', 'open-ended', '현재 고민의 핵심과 우선순위를 정리하는 상황', '현실에서 확인 가능한 다음 행동을 정하는 것', value || '구체적인 고민', '지금 먼저 확인하고 실행할 우선순위');
}
