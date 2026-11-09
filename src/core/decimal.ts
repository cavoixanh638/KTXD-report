import Decimal from 'decimal.js';

Decimal.set({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
});

export { Decimal };

export function toDecimal(value: string | number | Decimal): Decimal {
  return new Decimal(value);
}

/**
 * Pure TypeScript synchronous SHA-256 implementation so `file://` offline
 * mode works reliably even when `window.isSecureContext === false`.
 */
const K_SHA256 = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

function rotr(n: number, x: number): number {
  return (x >>> n) | (x << (32 - n));
}

export function sha256Hex(input: Uint8Array | string): string {
  const bytes =
    typeof input === 'string' ? new TextEncoder().encode(input) : input;
  const bitLenHi = Math.floor((bytes.length * 8) / 0x100000000);
  const bitLenLo = (bytes.length * 8) >>> 0;

  const padLen = ((bytes.length + 9 + 63) & ~63);
  const padded = new Uint8Array(padLen);
  padded.set(bytes, 0);
  padded[bytes.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padLen - 8, bitLenHi, false);
  view.setUint32(padLen - 4, bitLenLo, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < padLen; offset += 64) {
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(7, w[i - 15]) ^ rotr(18, w[i - 15]) ^ (w[i - 15] >>> 3);
      const s1 = rotr(17, w[i - 2]) ^ rotr(19, w[i - 2]) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(6, e) ^ rotr(11, e) ^ rotr(25, e);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K_SHA256[i] + w[i]) >>> 0;
      const S0 = rotr(2, a) ^ rotr(13, a) ^ rotr(22, a);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  return [h0, h1, h2, h3, h4, h5, h6, h7]
    .map((x) => x.toString(16).padStart(8, '0'))
    .join('');
}

export function formatVnNumber(
  value: Decimal | string | number,
  decimals = 2,
  trimTrailingZeros = false
): string {
  const dec = new Decimal(value);
  const rounded = dec.toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP);
  const fixed = rounded.toFixed(decimals);
  const [intPartRaw, fracPartRaw] = fixed.split('.');
  const isNeg = intPartRaw.startsWith('-');
  const absInt = isNeg ? intPartRaw.slice(1) : intPartRaw;
  const formattedInt = absInt.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  const sign = isNeg ? '-' : '';
  if (!fracPartRaw || decimals === 0) {
    return `${sign}${formattedInt}`;
  }
  const frac = trimTrailingZeros ? fracPartRaw.replace(/0+$/, '') : fracPartRaw;
  return frac.length > 0 ? `${sign}${formattedInt},${frac}` : `${sign}${formattedInt}`;
}

export function formatVnPercent(
  percentValue: Decimal | string | number,
  decimals = 2
): string {
  return `${formatVnNumber(percentValue, decimals)}%`;
}

export function millionToBillion(valMillion: Decimal | string | number): Decimal {
  return new Decimal(valMillion).div(1000);
}

export function vndToBillion(valVnd: Decimal | string | number): Decimal {
  return new Decimal(valVnd).div('1000000000');
}

export function vndToMillion(valVnd: Decimal | string | number): Decimal {
  return new Decimal(valVnd).div('1000000');
}

export function m2ToHa(valM2: Decimal | string | number): Decimal {
  return new Decimal(valM2).div(10000);
}

export interface ParsedContextualNumber {
  status: 'VALID' | 'AMBIGUOUS_REQUIRES_CONFIRMATION' | 'INVALID';
  exactDecimal: string | null;
  detectedUnit?: 'm2' | 'ha' | 'billion' | 'million' | 'vnd' | 'percent' | 'unitless';
  explanation: string;
}

/**
 * Context-aware parser for T12:
 * Handles strings like `119.280 m2` (VN thousand separator -> 119280),
 * `32,8 tỷ` (VN decimal comma -> 32.8), `119.71` (2 decimal places -> 119.71),
 * `3.125385 tỷ` (>3 digits after dot -> decimal 3.125385),
 * and flags truly ambiguous 3-digit dot inputs without context (e.g., `12.345` when unit/column doesn't disambiguate).
 */
export function parseContextualNumber(
  rawInput: string | number,
  expectedColumnType: 'AREA_M2' | 'MONEY_BILLION' | 'MONEY_MILLION' | 'MONEY_VND' | 'PERCENT' | 'GENERIC' = 'GENERIC'
): ParsedContextualNumber {
  if (typeof rawInput === 'number') {
    if (!Number.isFinite(rawInput)) {
      return { status: 'INVALID', exactDecimal: null, explanation: 'Non-finite number' };
    }
    return {
      status: 'VALID',
      exactDecimal: new Decimal(rawInput.toString()).toString(),
      explanation: 'Numeric primitive from source',
    };
  }

  const trimmed = rawInput.trim();
  if (!trimmed) {
    return { status: 'INVALID', exactDecimal: null, explanation: 'Empty string' };
  }

  let detectedUnit: ParsedContextualNumber['detectedUnit'] = 'unitless';
  const lower = trimmed.toLowerCase();
  if (lower.includes('m2') || lower.includes('m²')) detectedUnit = 'm2';
  else if (lower.includes('ha')) detectedUnit = 'ha';
  else if (lower.includes('tỷ')) detectedUnit = 'billion';
  else if (lower.includes('triệu') || lower.includes('tr')) detectedUnit = 'million';
  else if (lower.includes('đồng') || lower.includes('vnd')) detectedUnit = 'vnd';
  else if (lower.includes('%')) detectedUnit = 'percent';

  // Extract numeric token
  const match = trimmed.match(/^[-+]?\d[\d.,]*/);
  if (!match) {
    return { status: 'INVALID', exactDecimal: null, detectedUnit, explanation: 'No numeric token found' };
  }
  const token = match[0];

  const hasComma = token.includes(',');
  const hasDot = token.includes('.');

  if (hasComma && !hasDot) {
    // Vietnamese decimal comma (e.g., "32,8")
    const parts = token.split(',');
    if (parts.length === 2) {
      const normalized = `${parts[0]}.${parts[1]}`;
      return {
        status: 'VALID',
        exactDecimal: new Decimal(normalized).toString(),
        detectedUnit,
        explanation: 'Vietnamese decimal comma',
      };
    }
  }

  if (hasComma && hasDot) {
    // E.g. 1.234,56 (VN) or 1,234.56 (EN)
    const lastComma = token.lastIndexOf(',');
    const lastDot = token.lastIndexOf('.');
    if (lastComma > lastDot) {
      const normalized = token.replace(/\./g, '').replace(',', '.');
      return {
        status: 'VALID',
        exactDecimal: new Decimal(normalized).toString(),
        detectedUnit,
        explanation: 'VN thousands dot and decimal comma',
      };
    } else {
      const normalized = token.replace(/,/g, '');
      return {
        status: 'VALID',
        exactDecimal: new Decimal(normalized).toString(),
        detectedUnit,
        explanation: 'EN thousands comma and decimal dot',
      };
    }
  }

  if (hasDot && !hasComma) {
    const parts = token.split('.');
    if (parts.length > 2) {
      // Multiple dots e.g. 56.141.672.000 -> definitely thousand separators
      const allThree = parts.slice(1).every((p) => p.length === 3);
      if (allThree) {
        const normalized = parts.join('');
        return {
          status: 'VALID',
          exactDecimal: new Decimal(normalized).toString(),
          detectedUnit,
          explanation: 'Multi-group thousand separators',
        };
      }
      return { status: 'INVALID', exactDecimal: null, detectedUnit, explanation: 'Malformed multi-dot number' };
    }

    // Single dot: e.g. "119.280 m2", "119.71", "3.125385 tỷ"
    const fracLen = parts[1].length;
    if (fracLen !== 3) {
      // Definitely decimal point (e.g. "119.71" has 2 digits, "3.125385" has 6 digits)
      return {
        status: 'VALID',
        exactDecimal: new Decimal(token).toString(),
        detectedUnit,
        explanation: `Decimal dot (${fracLen} fractional digits)`,
      };
    }

    // Exactly 3 digits after single dot (e.g., "119.280")
    if (detectedUnit === 'm2' || expectedColumnType === 'AREA_M2' || detectedUnit === 'vnd' || expectedColumnType === 'MONEY_VND') {
      const normalized = parts.join('');
      return {
        status: 'VALID',
        exactDecimal: new Decimal(normalized).toString(),
        detectedUnit,
        explanation: 'Vietnamese thousand separator inferred from m2/VND integer context',
      };
    }

    // Otherwise ambiguous! Must ask user rather than guessing (T12)
    return {
      status: 'AMBIGUOUS_REQUIRES_CONFIRMATION',
      exactDecimal: null,
      detectedUnit,
      explanation: `Ambiguous 3-digit separator in "${rawInput}" without integer unit context; requires user confirmation`,
    };
  }

  // Pure integer
  return {
    status: 'VALID',
    exactDecimal: new Decimal(token).toString(),
    detectedUnit,
    explanation: 'Integer string',
  };
}
