import { publicInvitePath } from './storage';

async function copyShareText(value: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // Some in-app browsers expose Clipboard API but reject it at runtime.
    }
  }
  const textarea = document.createElement('textarea');
  textarea.value = value;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('링크를 복사하지 못했습니다.');
}

export function buildGuiyeondoInviteUrl(publicId: string, origin = window.location.origin) {
  return new URL(publicInvitePath(publicId), origin).toString();
}

async function shareOrCopy(options: {
  title: string;
  text: string;
  url: string;
  mode: 'native' | 'copy';
}) {
  if (options.mode === 'native' && navigator.share) {
    await navigator.share({ title: options.title, text: options.text, url: options.url });
    return 'shared' as const;
  }
  await copyShareText(`${options.text}\n${options.url}`);
  return 'copied' as const;
}

export function shareGuiyeondoInvite(options: {
  publicId: string;
  hostName: string;
  mode: 'native' | 'copy';
}) {
  return shareOrCopy({
    title: `${options.hostName}의 귀연도`,
    text: `너는 나한테 어떤 인연일까? ${options.hostName}의 귀연도에서 확인해 봐.`,
    url: buildGuiyeondoInviteUrl(options.publicId),
    mode: options.mode
  });
}

export function shareGuiyeondoResult(options: {
  hostName: string;
  guestName: string;
  relationshipLabel: string;
  mode?: 'native' | 'copy';
}) {
  return shareOrCopy({
    title: '귀연도 인연 결과',
    text: `두 사람의 대표 인연 신호는 ‘${options.relationshipLabel}’이었어요. 내 인연도 귀연도에서 확인해 보세요.`,
    url: new URL('/guiyeondo', window.location.origin).toString(),
    mode: options.mode || 'native'
  });
}
