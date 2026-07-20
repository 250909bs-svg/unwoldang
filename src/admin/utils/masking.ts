export function maskName(name: string) {
  if (!name) {
    return '고객';
  }

  if (name.length <= 2) {
    return `${name[0]}*`;
  }

  return `${name[0]}*${name[name.length - 1]}`;
}

export function maskEmail(email?: string) {
  if (!email || !email.includes('@')) {
    return '카카오 이메일 미제공';
  }

  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
}
