import { afterEach, describe, expect, it, vi } from 'vitest';
import { isValidLightningAddress, requestLightningInvoice, resolveLightningAddress } from '../lib/lnurl';

function mockFetchOnce(response: unknown, ok = true, status = 200) {
  return vi.fn().mockResolvedValueOnce({
    ok,
    status,
    json: () => Promise.resolve(response),
  } as Response);
}

describe('isValidLightningAddress', () => {
  it('accepts a well-formed address', () => {
    expect(isValidLightningAddress('thisoctave46@walletofsatoshi.com')).toBe(true);
  });

  it('rejects a plain string with no @', () => {
    expect(isValidLightningAddress('notanaddress')).toBe(false);
  });

  it('rejects a domain without a dot', () => {
    expect(isValidLightningAddress('name@localhost')).toBe(false);
  });

  it('tolerates surrounding whitespace', () => {
    expect(isValidLightningAddress('  name@domain.com  ')).toBe(true);
  });
});

describe('resolveLightningAddress', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('resolves a valid LNURL-pay metadata response', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({
        callback: 'https://walletofsatoshi.com/lnurlp/thisoctave46/callback',
        minSendable: 1000,
        maxSendable: 100_000_000_000,
        tag: 'payRequest',
      }),
    );
    const meta = await resolveLightningAddress('thisoctave46@walletofsatoshi.com');
    expect(meta.callback).toContain('walletofsatoshi.com');
  });

  it('throws with the LNURL error reason when the server reports an error', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ status: 'ERROR', reason: 'não encontrado' }));
    await expect(resolveLightningAddress('foo@bar.com')).rejects.toThrow('não encontrado');
  });

  it('throws when the endpoint does not support LNURL-pay', async () => {
    vi.stubGlobal('fetch', mockFetchOnce({ tag: 'withdrawRequest' }));
    await expect(resolveLightningAddress('foo@bar.com')).rejects.toThrow(/não suporta pagamentos/);
  });

  it('throws for a malformed address (no domain)', async () => {
    await expect(resolveLightningAddress('foo@')).rejects.toThrow();
  });
});

describe('requestLightningInvoice', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('rejects an amount below the wallet minimum', async () => {
    vi.stubGlobal(
      'fetch',
      mockFetchOnce({
        callback: 'https://x.com/cb',
        minSendable: 5000,
        maxSendable: 100_000_000,
        tag: 'payRequest',
      }),
    );
    await expect(requestLightningInvoice('a@x.com', 1)).rejects.toThrow(/entre/);
  });
});
