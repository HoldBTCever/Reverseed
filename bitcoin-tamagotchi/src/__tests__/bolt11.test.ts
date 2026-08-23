import { describe, expect, it } from 'vitest';
import { decodeBolt11, isValidBolt11 } from '../lib/bolt11';

// Official BOLT11 spec test vector: "Please send $3 for a cup of coffee to
// the same peer, within one minute" — 2500 micro-BTC = 250,000 sats.
const COFFEE_INVOICE =
  'lnbc2500u1pvjluezpp5qqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqqqsyqcyq5rqwzqfqypqdq5xysxxatsyp3k7enxv4jsxqzpuaztrnwngzn3kdzw5hydlzf03qdgm2hdq27cqv3agm2awhz5se903vruatfhq77w3ls4evs3ch9zw97j25emudupq63nyw24cg27h2rspfj9srp';

describe('decodeBolt11', () => {
  it('decodes amount, description and payment hash from a valid invoice', () => {
    const decoded = decodeBolt11(COFFEE_INVOICE);
    expect(decoded.amountSats).toBe(250_000);
    expect(decoded.description).toBe('1 cup coffee');
    expect(decoded.paymentHash).toBe('0001020304050607080900010203040506070809000102030405060708090102');
  });

  it('tolerates surrounding whitespace and mixed case prefix', () => {
    const decoded = decodeBolt11(`  ${COFFEE_INVOICE.toUpperCase()}  `);
    expect(decoded.amountSats).toBe(250_000);
  });

  it('throws for garbage input', () => {
    expect(() => decodeBolt11('not an invoice')).toThrow();
    expect(() => decodeBolt11('')).toThrow();
  });

  it('throws for a syntactically-invoice-shaped but undecodeable string', () => {
    expect(() => decodeBolt11('lnbc1garbage')).toThrow();
  });
});

describe('isValidBolt11', () => {
  it('accepts a real invoice and rejects garbage without throwing', () => {
    expect(isValidBolt11(COFFEE_INVOICE)).toBe(true);
    expect(isValidBolt11('garbage')).toBe(false);
  });
});
