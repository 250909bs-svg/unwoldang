import { Copy, LockKeyhole, Share2, X } from 'lucide-react';
import GuiyeondoSigil from './GuiyeondoSigil';
import { fateRoomImage } from './media';
import type { GuiyeondoInvite } from './types';

export default function GuiyeondoInviteSheet({ invite, busy, onClose, onShare, onRevoke }: {
  invite: GuiyeondoInvite;
  busy: boolean;
  onClose: () => void;
  onShare: (mode: 'native' | 'copy') => void;
  onRevoke: () => void;
}) {
  return (
    <div className="gy-invite-sheet-content">
      <button type="button" className="gy-sheet-close" onClick={onClose} aria-label="초대창 닫기"><X size={20} /></button>
      <div className="gy-invite-sigil"><GuiyeondoSigil seed={invite.sigilSeed} size={96} /></div>
      <span className="gy-eyebrow">INVITE A CONNECTION</span>
      <h2>누가 내 귀인인지<br />직접 확인해볼까요?</h2>
      <p>친구가 출생정보를 입력하면 두 사람 사이의 명리 관계 신호를 함께 살펴봅니다.</p>
      <div className="gy-story-card" aria-label={`${invite.hostName}님의 귀연도 초대 카드`}>
        <img src={fateRoomImage} alt="붉은 인연의 실이 흐르는 고요한 방" />
        <span className="gy-story-shade" />
        <div>
          <small>貴緣圖</small>
          <strong>{invite.hostName}의 귀연도</strong>
          <p>너는 나에게<br />어떤 인연일까?</p>
        </div>
      </div>
      <div className="gy-share-actions">
        <button type="button" className="gy-primary-button" disabled={busy} onClick={() => onShare('native')}><Share2 size={18} /> 공유하기</button>
        <button type="button" className="gy-secondary-button" disabled={busy} onClick={() => onShare('copy')}><Copy size={18} /> 링크 복사</button>
      </div>
      <small className="gy-preview-limit"><LockKeyhole size={14} /> 초대 링크는 14일 동안 사용할 수 있습니다. 생년월일시는 링크나 지도에 공개되지 않습니다.</small>
      <button type="button" className="gy-revoke-invite" disabled={busy} onClick={onRevoke}>{busy ? '처리 중' : '이 초대 링크 취소'}</button>
    </div>
  );
}
