import { ArrowLeft, ArrowRight, Check, Clock3 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { createKoreanBirthProfile, isGuiyeondoProfileAtLeastAge } from './profile';
import type { GuiyeondoBirthProfile } from './types';

const digitsOnly = (value: string, max: number) => value.replace(/\D/g, '').slice(0, max);
const displayDate = (digits: string) => digits.length <= 4 ? digits : digits.length <= 6
  ? `${digits.slice(0, 4)}.${digits.slice(4)}`
  : `${digits.slice(0, 4)}.${digits.slice(4, 6)}.${digits.slice(6)}`;
const displayTime = (digits: string) => digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
const canonicalDate = (digits: string) => digits.length === 8 ? `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6)}` : '';
const canonicalTime = (digits: string) => digits.length === 4 ? `${digits.slice(0, 2)}:${digits.slice(2)}` : '';

export default function GuiyeondoBirthFlow({
  title,
  subtitle,
  initialName = '',
  onCancel,
  finalConsents,
  onComplete
}: {
  title: string;
  subtitle: string;
  initialName?: string;
  finalConsents?: ReadonlyArray<{
    id: string;
    checked: boolean;
    label: string;
    onChange: (checked: boolean) => void;
  }>;
  onCancel: () => void;
  onComplete: (profile: GuiyeondoBirthProfile) => void;
}) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initialName);
  const [dateDigits, setDateDigits] = useState('');
  const [timeDigits, setTimeDigits] = useState('');
  const [calendar, setCalendar] = useState<'solar' | 'lunar'>('solar');
  const [isLeapMonth, setIsLeapMonth] = useState(false);
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [isUnknownTime, setIsUnknownTime] = useState(false);
  const [dayBoundaryPolicy, setDayBoundaryPolicy] = useState<'midnight' | 'late-zi' | ''>('');
  const [error, setError] = useState('');
  const needsDayBoundaryChoice = !isUnknownTime && timeDigits.length === 4 && timeDigits.startsWith('23');

  const ready = useMemo(() => {
    if (step === 0) return name.trim().length > 0;
    if (step === 1) return dateDigits.length === 8;
    return Boolean(gender && (isUnknownTime || timeDigits.length === 4) && (!needsDayBoundaryChoice || dayBoundaryPolicy) && (!finalConsents || finalConsents.every((item) => item.checked)));
  }, [dateDigits.length, dayBoundaryPolicy, finalConsents, gender, isUnknownTime, name, needsDayBoundaryChoice, step, timeDigits.length]);

  const advance = () => {
    setError('');
    if (!ready) return;
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    const profile = createKoreanBirthProfile({
      name: name.trim(),
      gender: gender as 'male' | 'female',
      calendar,
      isLeapMonth: calendar === 'lunar' && isLeapMonth,
      birthDate: canonicalDate(dateDigits),
      birthTime: isUnknownTime ? '' : canonicalTime(timeDigits),
      isUnknownTime,
      dayBoundaryPolicy: needsDayBoundaryChoice ? dayBoundaryPolicy as 'midnight' | 'late-zi' : 'midnight'
    });
    if (!profile) {
      setError('입력한 날짜와 시간을 다시 확인해 주세요. 실제 달력에 있는 값만 사용할 수 있습니다.');
      return;
    }
    if (!isGuiyeondoProfileAtLeastAge(profile, 14)) {
      setError('귀연도는 만 14세 이상만 이용할 수 있습니다. 생년월일을 다시 확인해 주세요.');
      return;
    }
    onComplete(profile);
  };

  return (
    <section className="gy-form-card" aria-labelledby="gy-form-title">
      <div className="gy-form-head">
        <button type="button" className="gy-icon-button" onClick={step === 0 ? onCancel : () => setStep((current) => current - 1)} aria-label="이전으로">
          <ArrowLeft size={20} />
        </button>
        <div className="gy-form-progress" role="progressbar" aria-label="귀연도 입력 단계" aria-valuemin={1} aria-valuemax={3} aria-valuenow={step + 1} aria-valuetext={`3단계 중 ${step + 1}단계`}>
          {[0, 1, 2].map((index) => <i key={index} className={index <= step ? 'active' : ''} />)}
        </div>
      </div>
      <header>
        <span>{step + 1} / 3</span>
        <h2 id="gy-form-title">{title}</h2>
        <p>{subtitle}</p>
      </header>

      <div className="gy-form-step" key={step}>
        {step === 0 ? (
          <label className="gy-field">
            <span>이름 또는 닉네임</span>
            <input value={name} onChange={(event) => setName(event.target.value.slice(0, 20))} placeholder="서로 알아볼 수 있는 이름" autoComplete="off" />
            <small>초대자와 내 지도에는 이 표시 이름만 보입니다. 실명 대신 닉네임을 권장합니다.</small>
          </label>
        ) : null}

        {step === 1 ? (
          <>
            <div className="gy-segmented" role="group" aria-label="달력 종류">
              <button type="button" className={calendar === 'solar' ? 'active' : ''} aria-pressed={calendar === 'solar'} onClick={() => { setCalendar('solar'); setIsLeapMonth(false); }}>양력</button>
              <button type="button" className={calendar === 'lunar' && !isLeapMonth ? 'active' : ''} aria-pressed={calendar === 'lunar' && !isLeapMonth} onClick={() => { setCalendar('lunar'); setIsLeapMonth(false); }}>음력</button>
              <button type="button" className={calendar === 'lunar' && isLeapMonth ? 'active' : ''} aria-pressed={calendar === 'lunar' && isLeapMonth} onClick={() => { setCalendar('lunar'); setIsLeapMonth(true); }}>음력 윤달</button>
            </div>
            <label className="gy-field">
              <span>생년월일</span>
              <input inputMode="numeric" value={displayDate(dateDigits)} onChange={(event) => setDateDigits(digitsOnly(event.target.value, 8))} placeholder="2000.01.01" autoComplete="bday" />
              <small>분석에만 사용하며 지도에는 공개하지 않습니다.</small>
            </label>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <div className="gy-choice-label">성별</div>
            <div className="gy-segmented gy-two" role="group" aria-label="성별">
              <button type="button" className={gender === 'male' ? 'active' : ''} aria-pressed={gender === 'male'} onClick={() => setGender('male')}>남성</button>
              <button type="button" className={gender === 'female' ? 'active' : ''} aria-pressed={gender === 'female'} onClick={() => setGender('female')}>여성</button>
            </div>
            <label className={`gy-field ${isUnknownTime ? 'disabled' : ''}`}>
              <span>출생시간</span>
              <input inputMode="numeric" disabled={isUnknownTime} value={displayTime(timeDigits)} onChange={(event) => setTimeDigits(digitsOnly(event.target.value, 4))} placeholder="예: 14:30" />
            </label>
            <button type="button" className={`gy-unknown-time ${isUnknownTime ? 'active' : ''}`} aria-pressed={isUnknownTime} onClick={() => setIsUnknownTime((current) => !current)}>
              <Clock3 size={18} />
              출생시간을 몰라요
              {isUnknownTime ? <Check size={18} /> : null}
            </button>
            {needsDayBoundaryChoice ? (
              <>
                <div className="gy-choice-label gy-boundary-label">밤 11시 일주 경계 기준</div>
                <div className="gy-segmented gy-two" role="group" aria-label="밤 11시 일주 경계 기준">
                  <button type="button" className={dayBoundaryPolicy === 'midnight' ? 'active' : ''} aria-pressed={dayBoundaryPolicy === 'midnight'} onClick={() => setDayBoundaryPolicy('midnight')}>자정부터 다음 날</button>
                  <button type="button" className={dayBoundaryPolicy === 'late-zi' ? 'active' : ''} aria-pressed={dayBoundaryPolicy === 'late-zi'} onClick={() => setDayBoundaryPolicy('late-zi')}>23시부터 다음 날</button>
                </div>
                <p className="gy-boundary-help">기존에 안내받은 만세력 기준이 있다면 같은 기준을 선택해 주세요.</p>
              </>
            ) : null}
            <p className="gy-privacy-note">대한민국 표준시 · 기본 자정 경계 기준 · 시간 미상은 시주를 제외한 공통 원국만 분석합니다.</p>
            {finalConsents?.length ? (
              <div className="gy-consent-stack">
                {finalConsents.map((item) => (
                  <label className="gy-consent-check" key={item.id}>
                    <input type="checkbox" checked={item.checked} onChange={(event) => item.onChange(event.target.checked)} />
                    <span>{item.label}</span>
                  </label>
                ))}
                <p><Link to="/privacy">개인정보처리방침</Link><span aria-hidden="true"> · </span><Link to="/terms">이용약관</Link></p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {error ? <p className="gy-form-error" role="alert">{error}</p> : null}
      <button type="button" className="gy-primary-button gy-next-button" disabled={!ready} onClick={advance}>
        {step === 2 ? '인연 연결하기' : '다음'}
        <ArrowRight size={19} />
      </button>
    </section>
  );
}
