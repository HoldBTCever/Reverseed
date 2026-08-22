import { describe, expect, it } from 'vitest';
import { isValidNwcUri, walletPubkeyFromUri } from '../lib/nwc';

const PUBKEY = 'a'.repeat(64);
const SECRET = 'b'.repeat(64);
const VALID_URI = `nostr+walletconnect://${PUBKEY}?relay=wss://relay.getalby.com/v1&secret=${SECRET}`;

describe('isValidNwcUri', () => {
  it('accepts a well-formed connection string with pubkey, relay and secret', () => {
    expect(isValidNwcUri(VALID_URI)).toBe(true);
  });

  it('rejects a string missing the secret (required for read access)', () => {
    const noSecret = `nostr+walletconnect://${PUBKEY}?relay=wss://relay.getalby.com/v1`;
    expect(isValidNwcUri(noSecret)).toBe(false);
  });

  it('rejects a string with no relay', () => {
    const noRelay = `nostr+walletconnect://${PUBKEY}?secret=${SECRET}`;
    expect(isValidNwcUri(noRelay)).toBe(false);
  });

  it('rejects a pubkey that is not 64 hex characters', () => {
    const badPubkey = `nostr+walletconnect://not-hex?relay=wss://relay.getalby.com/v1&secret=${SECRET}`;
    expect(isValidNwcUri(badPubkey)).toBe(false);
  });

  it('rejects garbage input', () => {
    expect(isValidNwcUri('not a connection string')).toBe(false);
    expect(isValidNwcUri('')).toBe(false);
  });

  it('tolerates surrounding whitespace from a pasted value', () => {
    expect(isValidNwcUri(`  ${VALID_URI}  `)).toBe(true);
  });
});

describe('walletPubkeyFromUri', () => {
  it('extracts the wallet pubkey from a valid URI', () => {
    expect(walletPubkeyFromUri(VALID_URI)).toBe(PUBKEY);
  });

  it('returns null for an invalid URI instead of throwing', () => {
    expect(walletPubkeyFromUri('garbage')).toBeNull();
  });
});
