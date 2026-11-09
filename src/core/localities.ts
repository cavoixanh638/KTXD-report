import { Locality, LocalityType } from './types';

/**
 * Normalize locality name in Unicode NFC, trimming leading/trailing spaces
 * and collapsing multiple internal spaces into a single space.
 * Strictly preserves Vietnamese diacritics and administrative unit prefix!
 */
export function canonicalizeLocalityName(raw: string): string {
  const nfc = String(raw ?? '').normalize('NFC').trim();
  return nfc.replace(/\s+/g, ' ');
}

export function detectLocalityType(canonicalName: string): LocalityType {
  const lower = canonicalName.toLowerCase();
  if (lower.startsWith('phường ')) return 'PHUONG';
  if (lower.startsWith('đặc khu ')) return 'DAC_KHU';
  return 'XA';
}

export function extractShortLocalityName(canonicalName: string): string {
  return canonicalName
    .replace(/^(Xã|Phường|Đặc khu)\s+/i, '')
    .trim();
}

/**
 * Generates a deterministic localityId from the canonical NFC name with diacritics.
 * Example:
 *  - "Xã Cẩm Giang" -> "XA_Xã_Cẩm_Giang"
 *  - "Xã Cẩm Giàng" -> "XA_Xã_Cẩm_Giàng"
 * Never strips diacritics for ID or auto-join!
 */
export function makeLocalityId(rawName: string): string {
  const canonical = canonicalizeLocalityName(rawName);
  const type = detectLocalityType(canonical);
  return `${type}_${canonical.replace(/\s+/g, '_')}`;
}

/**
 * Unaccented search key ONLY for UI search/filter.
 * MUST NEVER be used for auto-joining records across datasets (R01 #2, T28).
 */
export function toUnaccentedSearchKey(text: string): string {
  const canonical = canonicalizeLocalityName(text).toLowerCase();
  return canonical
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd');
}

export function createLocalityFromName(rawName: string, evidenceSource = 'DISB_20261015'): Locality {
  const canonicalNameNFC = canonicalizeLocalityName(rawName);
  const type = detectLocalityType(canonicalNameNFC);
  const shortName = extractShortLocalityName(canonicalNameNFC);
  const id = makeLocalityId(canonicalNameNFC);

  return {
    id,
    displayName: canonicalNameNFC,
    canonicalName: canonicalNameNFC,
    canonicalNameNFC,
    shortName,
    type,
    aliases: rawName !== canonicalNameNFC ? [rawName] : [],
    matchStatus: 'CONFIRMED',
    matchEvidence: evidenceSource,
    matchConfidence: 1.0,
  };
}

/**
 * Strict auto-join matching between a target locality name and a catalog of Localities.
 * Matches ONLY when (type, canonicalNameNFC) are identical or an explicitly confirmed alias matches.
 * Never uses substring (`includes`) or unaccented matching.
 */
export function matchLocalityStrict(
  rawName: string,
  catalog: Locality[]
): Locality | null {
  const canonical = canonicalizeLocalityName(rawName);
  const type = detectLocalityType(canonical);

  for (const loc of catalog) {
    if (loc.type === type && loc.canonicalNameNFC === canonical) {
      return loc;
    }
    if (loc.aliases.some((a) => canonicalizeLocalityName(a) === canonical)) {
      return loc;
    }
  }
  return null;
}

/**
 * UI Search helper: supports both accented and unaccented search queries,
 * plus optional LocalityType filtering.
 */
export function searchLocalities(
  catalog: Locality[],
  query: string,
  typeFilter: 'ALL' | LocalityType = 'ALL'
): Locality[] {
  const qNorm = canonicalizeLocalityName(query).toLowerCase();
  const qUnaccented = toUnaccentedSearchKey(query);

  return catalog.filter((loc) => {
    if (typeFilter !== 'ALL' && loc.type !== typeFilter) {
      return false;
    }
    if (!qNorm) return true;
    const nameLower = loc.canonicalNameNFC.toLowerCase();
    if (nameLower.includes(qNorm)) return true;
    const nameUnaccented = toUnaccentedSearchKey(loc.canonicalNameNFC);
    return nameUnaccented.includes(qUnaccented);
  });
}
