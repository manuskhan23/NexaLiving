export function normalizePkPhone(raw: string): string {
  let s = raw.replace(/[\s\-()]/g, '');
  if (s.startsWith('0092')) s = '+92' + s.slice(4);
  else if (s.startsWith('0')) s = '+92' + s.slice(1);
  else if (s.startsWith('92')) s = '+92' + s.slice(2);
  else if (!s.startsWith('+')) s = '+' + s;
  return s;
}
export const PK_PHONE_RE = /^(\+92|0)3\d{9}$/;