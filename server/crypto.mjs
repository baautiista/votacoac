const encoder = new TextEncoder();
const iterations = 100000;
export const token = (bytes = 32) => {
  const data = crypto.getRandomValues(new Uint8Array(bytes));
  let binary = ''; for (const value of data) binary += String.fromCharCode(value);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
};
export const sha256 = async value => {
  const data = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));
  return [...data].map(v => v.toString(16).padStart(2, '0')).join('');
};
export function equal(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < Math.max(a.length, b.length); i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}
async function derive(password, salt) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const result = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(salt), iterations }, key, 256));
  return [...result].map(v => v.toString(16).padStart(2, '0')).join('');
}
export async function hashPassword(password) {
  const salt = token(16);
  return `pbkdf2-sha256$${iterations}$${salt}$${await derive(password, salt)}`;
}
export async function verifyPassword(password, stored) {
  const [algorithm, rounds, salt, expected] = String(stored || '').split('$');
  if (algorithm !== 'pbkdf2-sha256' || Number(rounds) !== iterations || !salt || !expected) {
    await derive(password, 'invalid-account-dummy-salt'); return false;
  }
  return equal(await derive(password, salt), expected);
}
