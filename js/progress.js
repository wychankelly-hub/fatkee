// 進度碼：版本 (1 byte) + 班號 (2 bytes) + 每關星數 (2 bits × 64 = 16 bytes) + CRC-8 (1 byte)
// 以 Crockford Base32（不用 I L O U）寫出，每 4 個字一組。
export const CODE_VERSION = 1;
const ALPHA = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

function crc8(bytes) {
  let c = 0;
  for (const b of bytes) {
    c ^= b;
    for (let i = 0; i < 8; i++) c = c & 0x80 ? ((c << 1) ^ 0x07) & 0xff : (c << 1) & 0xff;
  }
  return c;
}

function toBase32(bytes) {
  let bits = 0, val = 0, out = '';
  for (const b of bytes) {
    val = (val << 8) | b; bits += 8;
    while (bits >= 5) { out += ALPHA[(val >>> (bits - 5)) & 31]; bits -= 5; }
  }
  if (bits > 0) out += ALPHA[(val << (5 - bits)) & 31];
  return out;
}

function fromBase32(str) {
  let bits = 0, val = 0;
  const out = [];
  for (const ch of str) {
    const i = ALPHA.indexOf(ch);
    if (i < 0) return null;
    val = ((val << 5) | i) & 0xffff; bits += 5;
    if (bits >= 8) { out.push((val >>> (bits - 8)) & 0xff); bits -= 8; }
  }
  return out;
}

// stars: 依 levels.json 次序的陣列，每項 0–3；classNo：0–65535（0 = 沒有）
export function encode(stars, classNo = 0) {
  const n = Math.max(0, Math.min(65535, parseInt(classNo, 10) || 0));
  const bytes = [CODE_VERSION, n >> 8, n & 255];
  const packed = new Array(16).fill(0);
  stars.slice(0, 64).forEach((s, i) => { packed[i >> 2] |= (Math.max(0, Math.min(3, s | 0)) << ((3 - (i & 3)) * 2)); });
  bytes.push(...packed);
  bytes.push(crc8(bytes));
  return toBase32(bytes).match(/.{1,4}/g).join('-');
}

// 回傳 { classNo, stars } 或 null（格式錯誤）
export function decode(code) {
  const clean = String(code).toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
  if (clean.length !== 32) return null;
  const bytes = fromBase32(clean);
  if (!bytes || bytes.length !== 20) return null;
  if (bytes[0] !== CODE_VERSION) return null;
  if (crc8(bytes.slice(0, 19)) !== bytes[19]) return null;
  const stars = [];
  for (let i = 0; i < 64; i++) stars.push((bytes[3 + (i >> 2)] >> ((3 - (i & 3)) * 2)) & 3);
  return { classNo: (bytes[1] << 8) | bytes[2], stars };
}
