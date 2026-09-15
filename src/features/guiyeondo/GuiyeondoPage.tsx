import { ArrowLeft, Info, Plus, RefreshCw, Share2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { createSecureRandomPart } from '../../shared/security/secureRandom';
import { createGuiyeondoInviteRemote, fetchGuiyeondoInviteResponses, revokeGuiyeondoInvite } from './api';
import GuiyeondoBirthFlow from './GuiyeondoBirthFlow';
import GuiyeondoDetailPanel from './GuiyeondoDetailPanel';
import GuiyeondoIntro from './GuiyeondoIntro';
import GuiyeondoInviteSheet from './GuiyeondoInviteSheet';
import GuiyeondoMap from './GuiyeondoMap';
import GuiyeondoSheet from './GuiyeondoSheet';
import { trackGuiyeondoEvent } from './events';
import { fateRoomImage } from './media';
import { recoverGuiyeondoOwnerProfile } from './profile';
import {
  analyzeGuiyeondoRelationship,
  assessGuiyeondoProfileStability,
  guiyeondoSigilSeed
} from './relationshipAnalysis';
import { shareGuiyeondoInvite } from './share';
import {
  addGuiyeondoPerson,
  addGuiyeondoOwnedInvite,
  clearGuiyeondoMap,
  mergeGuiyeondoInvitePeople,
  createGuiyeondoMap,
  normalizeGuiyeondoPreviewOwnerId,
  readGuiyeondoMap,
  removeGuiyeondoPerson,
  removeGuiyeondoOwnedInvite,
  saveGuiyeondoMap
} from './storage';
import type {
  GuiyeondoBirthProfile,
  GuiyeondoMapState,
  GuiyeondoOwnedInvite,
  GuiyeondoRelationshipType
} from './types';
import '../../styles/guiyeondo.css';

const GUEST_OWN_PROFILE_KEY = 'unwoldang.guiyeondo.guest-own-profile';

export default function GuiyeondoPage() {
  const { user } = useAuth();
  const location = useLocation();
  const previewOwnerId = useMemo(() => normalizeGuiyeondoPreviewOwnerId(
    new URLSearchParams(location.search).get('owner')
  ), [location.search]);
  const ownerId = previewOwnerId || user?.id;
  const [introOpen, setIntroOpen] = useState(() => !previewOwnerId);
  const [mapState, setMapState] = useState<GuiyeondoMapState | null>(() => readGuiyeondoMap(ownerId));
  const [recovered] = useState(() => recoverGuiyeondoOwnerProfile(ownerId));
  const [setupOpen, setSetupOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [directPermission, setDirectPermission] = useState(false);
  const [invite, setInvite] = useState<GuiyeondoOwnedInvite | null>(null);
  const [selectedType, setSelectedType] = useState<GuiyeondoRelationshipType | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
  const [toast, setToast] = useState('');
  const [working, setWorking] = useState(false);
  const addTimerRef = useRef<number | null>(null);
  const [isCompactViewport, setIsCompactViewport] = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 959px)').matches
  );
  const [inviteBusy, setInviteBusy] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const mapStateRef = useRef<GuiyeondoMapState | null>(mapState);

  useEffect(() => {
    trackGuiyeondoEvent('guiyeondo_tab_open');
  }, []);

  useEffect(() => {
    setMapState(readGuiyeondoMap(ownerId));
  }, [ownerId]);

  useEffect(() => {
    mapStateRef.current = mapState;
  }, [mapState]);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 959px)');
    const update = () => setIsCompactViewport(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => () => {
    if (addTimerRef.current !== null) window.clearTimeout(addTimerRef.current);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (mapState || typeof window === 'undefined') return;
    try {
      const raw = window.sessionStorage.getItem(GUEST_OWN_PROFILE_KEY);
      if (!raw) return;
      const handoff = JSON.parse(raw) as { ownerStorageId?: string; profile?: GuiyeondoBirthProfile };
      const handoffOwnerId = normalizeGuiyeondoPreviewOwnerId(handoff.ownerStorageId || null);
      if (!handoff.profile || !handoffOwnerId || handoffOwnerId !== ownerId) return;
      const stability = assessGuiyeondoProfileStability(handoff.profile);
      if (stability.status === 'blocked') {
        window.sessionStorage.removeItem(GUEST_OWN_PROFILE_KEY);
        setToast(`귀연도를 만들려면 출생시간 확인이 필요합니다. ${stability.reason}`);
        return;
      }
      const next = saveGuiyeondoMap(createGuiyeondoMap(handoff.profile), handoffOwnerId);
      setMapState(next);
      window.sessionStorage.removeItem(GUEST_OWN_PROFILE_KEY);
      trackGuiyeondoEvent('guiyeondo_map_created', { source: 'guest-handoff' });
    } catch {
      try { window.sessionStorage.removeItem(GUEST_OWN_PROFILE_KEY); } catch { /* unavailable session storage */ }
      setToast('이 브라우저의 임시 출생정보를 불러오지 못했습니다. 직접 입력해 주세요.');
    }
  }, [mapState, ownerId]);

  const selectedPeople = useMemo(() => mapState?.people.filter(
    (person) => person.analysis.classification.type === selectedType
  ) || [], [mapState?.people, selectedType]);
  const selectedPerson = useMemo(() =>
    selectedPeople.find((person) => person.id === selectedPersonId)
      || selectedPeople[selectedPeople.length - 1]
      || null, [selectedPeople, selectedPersonId]);
  const unclassifiedPeople = useMemo(() => mapState?.people.filter(
    (person) => person.analysis.classification.type === null
  ) || [], [mapState?.people]);
  const ownerSigilSeed = useMemo(() => mapState ? guiyeondoSigilSeed(mapState.owner) : '', [mapState?.owner]);
  const inviteSyncKey = useMemo(() => mapState?.invites
    .map((item) => `${item.publicId}:${item.expiresAt}`)
    .sort()
    .join('|') || '', [mapState?.invites]);

  const syncInviteResponses = useCallback(async (silent = true) => {
    const current = mapStateRef.current;
    if (!current?.invites.length) return;
    setSyncing(true);
    try {
      const settled = await Promise.allSettled(current.invites.map(fetchGuiyeondoInviteResponses));
      const people = settled.flatMap((result) => result.status === 'fulfilled' ? result.value.people : []);
      const latest = mapStateRef.current;
      if (latest && people.length > 0) {
        const next = mergeGuiyeondoInvitePeople(latest, people, ownerId);
        mapStateRef.current = next;
        setMapState(next);
      }
      if (!silent) {
        const failed = settled.filter((result) => result.status === 'rejected').length;
        setToast(failed === settled.length ? '초대 응답을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.' : people.length ? '새로 도착한 인연을 확인했어요.' : '아직 새로 도착한 인연이 없어요.');
      }
    } finally {
      setSyncing(false);
    }
  }, [ownerId]);

  useEffect(() => {
    if (!inviteSyncKey) return;
    void syncInviteResponses(true);
  }, [inviteSyncKey, syncInviteResponses]);

  useEffect(() => {
    const handleFocus = () => {
      if (mapStateRef.current?.invites.length) void syncInviteResponses(true);
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [syncInviteResponses]);


  const closeDetail = () => {
    setSelectedType(null);
    setSelectedPersonId(null);
  };

  const completeOwner = (profile: GuiyeondoBirthProfile) => {
    try {
      const stability = assessGuiyeondoProfileStability(profile);
      if (stability.status === 'blocked') {
        setToast(`귀연도를 만들려면 출생시간 확인이 필요합니다. ${stability.reason}`);
        return;
      }
      const next = saveGuiyeondoMap(createGuiyeondoMap(profile), ownerId);
      setMapState(next);
      setSetupOpen(false);
      trackGuiyeondoEvent('guiyeondo_map_created');
      setToast('첫 인연의 자리가 열렸어요.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '귀연도 정보를 저장하지 못했습니다.');
    }
  };

  const useRecoveredOwner = () => {
    if (recovered) completeOwner(recovered.profile);
  };

  const addPerson = (profile: GuiyeondoBirthProfile) => {
    if (!mapState || working) return;
    setWorking(true);
    addTimerRef.current = window.setTimeout(() => {
      addTimerRef.current = null;
      try {
        const analysis = analyzeGuiyeondoRelationship(mapState.owner, profile);
      const person = {
        id: createSecureRandomPart(),
        name: profile.name,
        source: 'direct' as const,
        createdAt: new Date().toISOString(),
        privateBirthProfile: profile,
        analysis
      };
      const next = addGuiyeondoPerson(mapState, person, ownerId);
      setMapState(next);
      setAddOpen(false);
      setDirectPermission(false);
      setSelectedType(analysis.classification.type);
      setSelectedPersonId(person.id);
      trackGuiyeondoEvent('guiyeondo_reveal', { status: analysis.status, classified: Boolean(analysis.classification.type) });
        setToast(analysis.classification.type ? `${profile.name}님과 인연의 실이 이어졌어요.` : '근거가 충분한 대표 관계는 유보했어요.');
      } catch (error) {
        setToast(error instanceof Error ? error.message : '두 사람의 명리 구조를 계산하지 못했습니다.');
      } finally {
        setWorking(false);
      }
    }, 420);
  };

  const closeAdd = () => {
    if (addTimerRef.current !== null) {
      window.clearTimeout(addTimerRef.current);
      addTimerRef.current = null;
      setWorking(false);
    }
    setAddOpen(false);
    setDirectPermission(false);
  };

  const removePerson = (personId: string) => {
    if (!mapState) return;
    const person = mapState.people.find((item) => item.id === personId);
    if (!person || !window.confirm(`${person.name}님과의 인연을 귀연도에서 삭제할까요? 이 브라우저에서는 되돌릴 수 없습니다.`)) return;
    try {
      setMapState(removeGuiyeondoPerson(mapState, personId, ownerId));
      closeDetail();
      setToast('선택한 인연을 삭제했어요.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '인연을 삭제하지 못했습니다.');
    }
  };

  const openAdd = () => {
    closeDetail();
    setInvite(null);
    setDirectPermission(false);
    setAddOpen(true);
  };

  const openInvite = async () => {
    const current = mapStateRef.current;
    if (!current || inviteBusy) return;
    closeDetail();
    setAddOpen(false);
    const reusable = [...current.invites]
      .reverse()
      .find((item) => Date.parse(item.expiresAt) > Date.now());
    if (reusable) {
      setInvite(reusable);
      trackGuiyeondoEvent('guiyeondo_invite_clicked', { reused: true });
      return;
    }
    setInviteBusy(true);
    try {
      const created = await createGuiyeondoInviteRemote(current.owner);
      const latest = mapStateRef.current;
      if (!latest) return;
      const next = addGuiyeondoOwnedInvite(latest, created, ownerId);
      mapStateRef.current = next;
      setMapState(next);
      setInvite(created);
      trackGuiyeondoEvent('guiyeondo_invite_clicked', { reused: false });
    } catch (error) {
      setToast(error instanceof Error ? error.message : '초대 링크를 만들지 못했습니다.');
    } finally {
      setInviteBusy(false);
    }
  };

  const shareInvite = async (mode: 'native' | 'copy') => {
    if (!invite) return;
    try {
      const result = await shareGuiyeondoInvite({ publicId: invite.publicId, hostName: invite.hostName, mode });
      trackGuiyeondoEvent('guiyeondo_share', { mode, result });
      setToast(result === 'copied' ? '초대 링크를 복사했어요.' : '공유창을 열었어요.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      setToast('공유하지 못했습니다. 링크 복사를 이용해 주세요.');
    }
  };



  const revokeInvite = async () => {
    if (!invite || inviteBusy) return;
    if (!window.confirm('이 초대 링크를 취소할까요? 취소하면 더 이상 새 응답을 받을 수 없습니다.')) return;
    setInviteBusy(true);
    try {
      await revokeGuiyeondoInvite(invite);
      const current = mapStateRef.current;
      if (current) {
        const next = removeGuiyeondoOwnedInvite(current, invite.publicId, ownerId);
        mapStateRef.current = next;
        setMapState(next);
      }
      setInvite(null);
      setToast('초대 링크를 취소했어요.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '초대 링크를 취소하지 못했습니다.');
    } finally {
      setInviteBusy(false);
    }
  };

  const clearMap = async () => {
    const current = mapStateRef.current;
    if (!current || inviteBusy) return;
    if (!window.confirm('내 귀연도와 이 브라우저에 저장된 출생정보·인연 결과를 삭제할까요? 활성 초대 링크도 함께 취소됩니다.')) return;
    setInviteBusy(true);
    try {
      for (const ownedInvite of current.invites.filter((item) => Date.parse(item.expiresAt) > Date.now())) {
        await revokeGuiyeondoInvite(ownedInvite);
      }
      clearGuiyeondoMap(ownerId);
      mapStateRef.current = null;
      setMapState(null);
      setInvite(null);
      closeDetail();
      setSetupOpen(true);
      setToast('귀연도와 이 브라우저의 인연 정보를 삭제했어요.');
    } catch (error) {
      setToast(error instanceof Error ? error.message : '활성 초대 링크를 취소하지 못해 지도를 삭제하지 않았습니다. 다시 시도해 주세요.');
    } finally {
      setInviteBusy(false);
    }
  };

  if (introOpen) return <main className="guiyeondo-page"><GuiyeondoIntro onEnter={() => setIntroOpen(false)} /></main>;
  if (!mapState) {
    return (
      <main className="guiyeondo-page gy-setup-page">
        <header className="gy-topbar"><Link to="/" aria-label="홈으로"><ArrowLeft size={20} /></Link><strong>귀연도 <span>貴緣圖</span></strong><span /></header>
        <div className="gy-setup-backdrop"><img src={fateRoomImage} alt="" /><span /></div>
        {setupOpen || !recovered ? (
          <GuiyeondoBirthFlow title="나의 인연점 만들기" subtitle="먼저 나를 중심에 놓을게요. 세 단계면 충분합니다." initialName={user?.nickname || ''} onCancel={() => recovered ? setSetupOpen(false) : setIntroOpen(true)} onComplete={completeOwner} />
        ) : (
          <section className="gy-owner-recovery">
            <span className="gy-eyebrow">YOUR DESTINY POINT</span>
            <h1>{recovered.profile.name}님의 사주로<br />귀연도를 열어볼까요?</h1>
            <p>{recovered.source === 'archive' ? '완료된 종합사주의 출생정보를 찾았습니다.' : '이 브라우저에 남은 최근 출생정보를 찾았습니다.'}<br />내용을 공개하지 않고 인연 계산에만 사용합니다.</p>
            <button type="button" className="gy-primary-button" onClick={useRecoveredOwner}>내 귀연도 열기</button>
            <button type="button" className="gy-text-button" onClick={() => setSetupOpen(true)}>다른 정보로 시작하기</button>
          </section>
        )}
        <p className="gy-legal-links gy-owner-legal"><Link to="/privacy">개인정보처리방침</Link><span> · </span><Link to="/terms">이용약관</Link></p>
      </main>
    );
  }

  return (
    <main className="guiyeondo-page gy-map-page">
      <header className="gy-topbar gy-map-topbar">
        <Link to="/" aria-label="홈으로"><ArrowLeft size={20} /></Link>
        <div><strong>귀연도</strong><span>貴緣圖</span></div>
        <button type="button" aria-label="귀연도 안내" onClick={() => setToast('관계 카테고리는 명리 근거를 탐색하는 운월당의 시각 분류이며 확정 예언이 아닙니다.')}><Info size={19} /></button>
      </header>
      <div className="gy-desktop-layout">
        <div className="gy-map-column">
          <div className="gy-map-lead"><span>{mapState.people.length}개의 인연점</span><h1>{mapState.owner.name}의 귀연도</h1><p>사람이 들어올수록 인연의 별자리가 완성됩니다.</p></div>
          <GuiyeondoMap ownerName={mapState.owner.name} ownerSigilSeed={ownerSigilSeed} people={mapState.people} selectedType={selectedType} onSelect={(type, personId) => { setAddOpen(false); setInvite(null); setSelectedType(type); setSelectedPersonId(personId || null); trackGuiyeondoEvent('guiyeondo_node_open', { type }); trackGuiyeondoEvent('guiyeondo_detail_open', { type, occupied: Boolean(personId) }); if (type === 'soulmate' || type === 'destined-love') trackGuiyeondoEvent('guiyeondo_find_partner', { type }); if (type === 'life-benefactor' || type === 'wealth-benefactor' || type === 'success-benefactor') trackGuiyeondoEvent('guiyeondo_find_benefactor', { type }); }} onAdd={openAdd} />
          <div className="gy-map-actions">
            <button type="button" className="gy-primary-button" onClick={openAdd}><Plus size={18} /> 인연 직접 연결</button>
            <button type="button" className="gy-secondary-button" disabled={inviteBusy} onClick={openInvite}><Share2 size={18} /> {inviteBusy ? '초대장 만드는 중' : '인연 초대하기'}</button>
            {mapState.invites.length ? <button type="button" className="gy-sync-button" disabled={syncing} onClick={() => void syncInviteResponses(false)}><RefreshCw size={16} className={syncing ? 'is-spinning' : ''} /> {syncing ? '새 인연 확인 중' : '받은 인연 새로고침'}</button> : null}
            <p className="gy-invite-note">초대 링크에는 표시 이름만 보이며, 초대자 원국 스냅샷은 서버에 최대 14일 보관됩니다.</p>
          </div>
          {unclassifiedPeople.length ? (
            <section className="gy-unclassified" aria-labelledby="gy-unclassified-title">
              <div>
                <span>검증 가능한 대표 관계를 고르는 중</span>
                <strong id="gy-unclassified-title">근거 확인 중 {unclassifiedPeople.length}명</strong>
                <p>억지로 8개 관계에 넣지 않고, 현재 엔진 근거가 충분해질 때까지 별도로 보관합니다.</p>
              </div>
              <div className="gy-unclassified-list">
                {unclassifiedPeople.map((person) => (
                  <span key={person.id}>
                    <b>{person.name}</b>
                    <button type="button" onClick={() => removePerson(person.id)} aria-label={`${person.name} 인연 삭제`}>삭제</button>
                  </span>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        {!isCompactViewport ? <GuiyeondoDetailPanel ownerName={mapState.owner.name} type={selectedType} person={selectedPerson} people={selectedPeople} selectedPersonId={selectedPersonId} onSelectPerson={setSelectedPersonId} onClose={closeDetail} onAdd={openAdd} onInvite={openInvite} onRemove={removePerson} /> : null}
      </div>

      <GuiyeondoSheet open={isCompactViewport && selectedType !== null} label="인연 관계 상세" onClose={closeDetail}>
        <GuiyeondoDetailPanel ownerName={mapState.owner.name} type={selectedType} person={selectedPerson} people={selectedPeople} selectedPersonId={selectedPersonId} onSelectPerson={setSelectedPersonId} onClose={closeDetail} onAdd={openAdd} onInvite={openInvite} onRemove={removePerson} />
      </GuiyeondoSheet>
      <GuiyeondoSheet open={addOpen} label="인연 출생정보 입력" onClose={closeAdd}>
        <GuiyeondoBirthFlow
          title="누구와 이어볼까요?"
          subtitle="상대의 출생정보로 두 사람 사이의 명리 신호를 확인합니다."
          onCancel={closeAdd}
          onComplete={addPerson}
          finalConsents={[{
            id: 'direct-permission',
            checked: directPermission,
            onChange: setDirectPermission,
            label: '상대방이 출생정보를 이 궁합 계산에 사용하는 데 동의했거나, 내가 사용할 정당한 권한이 있음을 확인합니다. 직접 입력한 상대방의 원시 출생정보는 지도에 저장하지 않습니다.'
          }]}
        />
        {working ? <div className="gy-working" role="status">두 사람의 사주를 맞춰보고 있어요.</div> : null}
      </GuiyeondoSheet>
      <GuiyeondoSheet open={Boolean(invite)} label="인연 초대 공유" onClose={() => setInvite(null)}>
        {invite ? <GuiyeondoInviteSheet invite={invite} busy={inviteBusy} onClose={() => setInvite(null)} onShare={shareInvite} onRevoke={revokeInvite} /> : null}
      </GuiyeondoSheet>
      <div className="gy-owner-footer">
        <p className="gy-legal-links"><Link to="/privacy">개인정보처리방침</Link><span> · </span><Link to="/terms">이용약관</Link></p>
        <button type="button" className="gy-clear-map" disabled={inviteBusy} onClick={clearMap}>내 귀연도 정보 삭제</button>
      </div>
      {toast ? <div className="gy-toast" role="status" aria-live="polite">{toast}</div> : null}
    </main>
  );
}
