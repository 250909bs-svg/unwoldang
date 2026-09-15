import { ArrowLeft, ChevronRight, LockKeyhole, Share2, Sparkles } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createSecureRandomPart } from '../../shared/security/secureRandom';
import { fetchGuiyeondoInvite, submitGuiyeondoInviteResponse } from './api';
import GuiyeondoBirthFlow from './GuiyeondoBirthFlow';
import GuiyeondoCharacterHero from './GuiyeondoCharacterHero';
import GuiyeondoRecommendations from './GuiyeondoRecommendations';
import GuiyeondoSigil from './GuiyeondoSigil';
import { trackGuiyeondoEvent } from './events';
import { fateRoomImage } from './media';
import { GUIYEONDO_RELATIONSHIP_VISUALS } from './relationshipVisuals';
import { shareGuiyeondoResult } from './share';
import type {
  GuiyeondoBirthProfile,
  GuiyeondoInvite,
  GuiyeondoPerson,
  GuiyeondoRelationshipType,
  GuiyeondoVectorId
} from './types';
import '../../styles/guiyeondo.css';

const RELATION_SIGNAL_IDS: Record<GuiyeondoRelationshipType, GuiyeondoVectorId[]> = {
  soulmate: ['attraction', 'romance', 'stability', 'long-term', 'challenge'],
  'destined-love': ['attraction', 'romance', 'stability', 'challenge'],
  'life-benefactor': ['comfort', 'stability', 'long-term'],
  'wealth-benefactor': ['wealth-synergy', 'career-synergy', 'comfort'],
  'success-benefactor': ['career-synergy', 'wealth-synergy', 'stability'],
  'growth-relation': ['support', 'growth'],
  'passion-relation': ['attraction', 'romance', 'challenge', 'stability'],
  'caution-relation': ['challenge', 'stability', 'comfort', 'attraction']
};

const GUEST_OWN_PROFILE_KEY = 'unwoldang.guiyeondo.guest-own-profile';
const GUEST_PURPOSES = [
  { id: 'dating', label: '연애의 온도' },
  { id: 'marriage', label: '함께 사는 리듬' },
  { id: 'business', label: '일과 돈의 호흡' },
  { id: 'family', label: '가족 안의 역할' }
] as const;

function personalizeGuestStatement(statement: string, hostName: string, guestName: string) {
  return statement.split('personA').join(hostName).split('personB').join(guestName);
}

export default function GuiyeondoGuestPage() {
  const { publicId = '' } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [invite, setInvite] = useState<GuiyeondoInvite | null>(null);
  const [stage, setStage] = useState<'loading' | 'missing' | 'landing' | 'input' | 'revealing' | 'result'>('loading');
  const [person, setPerson] = useState<GuiyeondoPerson | null>(null);
  const [guestProfile, setGuestProfile] = useState<GuiyeondoBirthProfile | null>(null);
  const [collectionConsent, setCollectionConsent] = useState(false);
  const [sharingConsent, setSharingConsent] = useState(false);
  const [error, setError] = useState('');
  const requestKeyRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    setStage('loading');
    setError('');
    fetchGuiyeondoInvite(publicId)
      .then(({ invite: fetchedInvite }) => {
        if (cancelled) return;
        setInvite(fetchedInvite);
        setStage('landing');
        trackGuiyeondoEvent('guiyeondo_invite_open', { found: true });
      })
      .catch(() => {
        if (cancelled) return;
        setStage('missing');
        trackGuiyeondoEvent('guiyeondo_invite_open', { found: false });
      });
    return () => { cancelled = true; };
  }, [publicId]);

  const completeGuest = async (profile: GuiyeondoBirthProfile) => {
    if (!invite || !collectionConsent || !sharingConsent) return;
    setStage('revealing');
    setError('');
    const idempotencyKey = requestKeyRef.current || createSecureRandomPart();
    requestKeyRef.current = idempotencyKey;
    try {
      const [payload] = await Promise.all([
        submitGuiyeondoInviteResponse({ publicId: invite.publicId, guestProfile: profile, idempotencyKey }),
        new Promise((resolve) => window.setTimeout(resolve, 1_250))
      ]);
      setGuestProfile(profile);
      setPerson(payload.person);
      setStage('result');
      requestKeyRef.current = '';
      trackGuiyeondoEvent('guiyeondo_guest_complete', { status: payload.person.analysis.status });
      trackGuiyeondoEvent('guiyeondo_reveal', { classified: Boolean(payload.person.analysis.classification.type) });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '두 사람의 명리 구조를 계산하지 못했습니다.');
      setStage('input');
    }
  };

  const createOwn = () => {
    if (!guestProfile) {
      setError('내 귀연도를 시작할 출생정보를 다시 입력해 주세요.');
      return;
    }
    try {
      window.sessionStorage.setItem(GUEST_OWN_PROFILE_KEY, JSON.stringify({ profile: guestProfile }));
      trackGuiyeondoEvent('guiyeondo_create_own');
      const returnTo = '/guiyeondo?start=1';
      if (isAuthenticated) {
        navigate(returnTo);
        return;
      }
      navigate('/login', {
        state: { returnTo, tabOrigin: invite ? `/g/${invite.publicId}` : '/guiyeondo' }
      });
    } catch {
      setError('이 브라우저에 출생정보를 임시 저장하지 못했습니다. 개인정보 보호 설정을 확인해 주세요.');
    }
  };

  const shareResult = async () => {
    if (!invite || !person) return;
    const type = person.analysis.classification.type;
    const relationshipLabel = type ? GUIYEONDO_RELATIONSHIP_VISUALS[type].label : '여러 신호를 함께 보는 인연';
    try {
      const result = await shareGuiyeondoResult({
        hostName: invite.hostName,
        guestName: person.name,
        relationshipLabel
      });
      setError(result === 'copied' ? '공유 문구와 귀연도 링크를 복사했어요.' : '공유창을 열었어요.');
      trackGuiyeondoEvent('guiyeondo_share', { mode: 'result', result });
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError('결과를 공유하지 못했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  if (stage === 'loading') {
    return (
      <main className="guiyeondo-page gy-reveal-page" aria-busy="true">
        <div className="gy-reveal-constellation" role="status" aria-live="polite">
          <div className="gy-reveal-orb"><Sparkles size={24} /></div>
          <p>인연의 초대장을 확인하고 있어요.</p>
        </div>
      </main>
    );
  }

  if (stage === 'missing' || !invite) {
    return (
      <main className="guiyeondo-page gy-guest-page gy-invite-missing">
        <div><span className="gy-eyebrow">INVITATION UNAVAILABLE</span><h1>사용할 수 없는 초대장이에요</h1><p>초대가 만료되었거나 취소되었을 수 있어요. 보낸 사람에게 새 링크를 요청해 주세요.</p><Link to="/guiyeondo" className="gy-primary-button">내 귀연도 만들기</Link></div>
      </main>
    );
  }

  if (stage === 'input') {
    return (
      <main className="guiyeondo-page gy-guest-page">
        <GuiyeondoBirthFlow
          title={`나는 ${invite.hostName}님에게 어떤 인연일까?`}
          subtitle="약 30초면 두 사람 사이의 명리 신호를 확인할 수 있어요."
          onCancel={() => setStage('landing')}
          onComplete={completeGuest}
          finalConsents={[
            {
              id: 'collection',
              checked: collectionConsent,
              onChange: setCollectionConsent,
              label: '수집·이용 동의 (필수): 이름/닉네임, 성별, 양·음력, 생년월일시와 날짜 경계 기준을 두 명식의 관계 계산에 사용합니다. 원시 출생정보는 서버 초대·응답 문서에 저장하지 않고, 닉네임과 계산 결과는 서버에 초대 만료일(최대 14일)까지 보관합니다. 거부할 수 있으나 초대 응답을 진행할 수 없습니다.'
            },
            {
              id: 'sharing',
              checked: sharingConsent,
              onChange: setSharingConsent,
              label: `초대자 제공 동의 (필수): ${invite.hostName}님에게 내 닉네임과 두 사람의 관계 분석 결과를 귀연도 확인 목적으로 전달합니다. 생년월일시는 전달하지 않습니다. 서버와 초대자 브라우저에 동기화된 응답은 초대 만료일(최대 14일)까지만 표시되며, 초대자가 먼저 삭제할 수 있습니다. 거부할 수 있으나 이 초대에 응답할 수 없습니다.`
            }
          ]}
        />
        {error ? <p className="gy-form-error" role="alert">{error}</p> : null}
      </main>
    );
  }

  if (stage === 'revealing') {
    return (
      <main className="guiyeondo-page gy-reveal-page" aria-busy="true">
        <div className="gy-reveal-constellation" role="status" aria-live="polite">
          <GuiyeondoSigil seed={invite.sigilSeed} size={112} label={`${invite.hostName}님의 인연 인장`} />
          <svg viewBox="0 0 220 80" aria-hidden="true"><path d="M8 42 C72 4 142 76 212 38" pathLength="1" /></svg>
          <div className="gy-reveal-orb"><Sparkles size={24} /></div>
          <p>두 사람의 사주를 맞춰보고 있어요.</p>
          <small>출생시간이 미상이면 시주를 제외하고 공통 원국만 확인합니다</small>
        </div>
      </main>
    );
  }

  if (stage === 'result' && person) {
    const type = person.analysis.classification.type;
    const signalIds = type ? RELATION_SIGNAL_IDS[type] : ['romance', 'attraction', 'comfort', 'stability', 'challenge'] as GuiyeondoVectorId[];
    const selectedSignals = signalIds.map((id) => person.analysis.vectors.find((vector) => vector.id === id))
      .filter((vector): vector is NonNullable<typeof vector> => Boolean(vector));
    return (
      <main className="guiyeondo-page gy-guest-result">
        <header className="gy-topbar"><button type="button" onClick={() => setStage('landing')} aria-label="초대 화면으로"><ArrowLeft size={20} /></button><strong>귀연도 <span>貴緣圖</span></strong><span /></header>
        {type ? <GuiyeondoCharacterHero type={type} priority /> : <div className="gy-result-no-classification"><GuiyeondoSigil seed={person.analysis.calculationFingerprint} size={130} /></div>}
        <section className="gy-result-card">
          <span className="gy-eyebrow">THE THREAD REVEALS</span>
          <p>{type ? '두 사람 사이에서 가장 두드러진 인연 신호를 찾았어요.' : '한 유형으로 단정하기보다 여러 신호를 함께 확인해야 해요.'}</p>
          <h1>{type ? GUIYEONDO_RELATIONSHIP_VISUALS[type].label : '대표 관계 판단 유보'}</h1>
          <strong>{invite.hostName} × {person.name}</strong>
          {person.analysis.status === 'partial' ? <p className="gy-partial-note">출생시간 미상 · 시주를 제외한 안정적인 공통 원국만 사용했습니다.</p> : null}
          <div className="gy-result-vectors">
            {selectedSignals.map((vector) => <span key={vector.id}><small>{vector.label}</small><b>{!vector.supported ? '근거 확인 중' : vector.tendency === 'supportive' ? '힘이 됨' : vector.tendency === 'tension' ? '조정 필요' : vector.tendency === 'insufficient' ? '근거 확인 중' : '조건 확인'}</b></span>)}
          </div>
          <details className="gy-guest-deep-reading">
            <summary><span><b>두 사람의 관계 더 자세히 보기</b><small>연애·생활·일·가족의 결을 나누어 확인해요</small></span><ChevronRight size={18} aria-hidden="true" /></summary>
            <div className="gy-guest-purpose-grid">
              {GUEST_PURPOSES.map(({ id, label }) => {
                const purpose = person.analysis.purposes[id];
                return <article key={id}><span>{label}</span><p>{personalizeGuestStatement(purpose.overview.statement, invite.hostName, person.name)}</p><ul>{purpose.dimensions.slice(0, 2).map((dimension) => <li key={dimension.id}>{personalizeGuestStatement(dimension.statement, invite.hostName, person.name)}</li>)}</ul></article>;
              })}
            </div>
          </details>
          <p className="gy-result-disclaimer">관계 결과는 확률이나 미래 예언이 아니라 두 명식 사이에서 확인된 정성적 구조입니다.</p>
          <p className="gy-legal-links"><Link to="/privacy">개인정보처리방침</Link><span> · </span><Link to="/terms">이용약관</Link></p>
          {error ? <p className="gy-result-status" role="status" aria-live="polite">{error}</p> : null}
          <div className="gy-result-actions">
            <button type="button" className="gy-secondary-button" onClick={shareResult}><Share2 size={18} /> 결과 공유하기</button>
            <button type="button" className="gy-primary-button" onClick={createOwn}>다른 사람과도 궁합 보기</button>
          </div>
          <GuiyeondoRecommendations compact relationType={type} />
        </section>
      </main>
    );
  }

  return (
    <main className="guiyeondo-page gy-guest-page">
      <div className="gy-guest-bg"><img src={fateRoomImage} alt="" /><span /></div>
      <Link to="/" className="gy-guest-back" aria-label="홈으로"><ArrowLeft size={20} /></Link>
      <section className="gy-guest-landing">
        <GuiyeondoSigil seed={invite.sigilSeed} size={112} label={`${invite.hostName}님의 인연 인장`} />
        <span className="gy-eyebrow">A RED THREAD ARRIVED</span>
        <p>{invite.hostName}님이 당신을 귀연도에 초대했어요.</p>
        <h1>나는 {invite.hostName}님에게<br />어떤 인연일까?</h1>
        <button type="button" className="gy-primary-button" onClick={() => { setStage('input'); trackGuiyeondoEvent('guiyeondo_guest_start'); }}>내 자리 확인하기</button>
        <small><LockKeyhole size={14} /> 회원가입 없이 확인 · 원시 생년월일시는 서버 응답에 저장되지 않음</small>
        <p className="gy-legal-links"><Link to="/privacy">개인정보처리방침</Link><span> · </span><Link to="/terms">이용약관</Link></p>
      </section>
    </main>
  );
}
