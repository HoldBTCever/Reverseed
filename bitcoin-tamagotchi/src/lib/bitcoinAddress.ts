const LEGACY_RE = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/;
const BECH32_RE = /^(bc1|tb1)[ac-hj-np-z02-9]{11,87}$/i;

/**
 * Shape-level validation only (prefix + charset/length), not full BIP173/350
 * checksum verification. Good enough to catch typos before hitting the API,
 * which rejects anything actually invalid.
 */
export function isValidBitcoinAddress(address: string): boolean {
  const trimmed = address.trim();
  if (!trimmed) return false;
  return LEGACY_RE.test(trimmed) || BECH32_RE.test(trimmed);
}

export function shortenAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}
