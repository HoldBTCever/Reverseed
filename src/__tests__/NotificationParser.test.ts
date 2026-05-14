import {parseNotification} from '../NotificationParser';
import {RawNotification} from '../types';

function make(overrides: Partial<RawNotification> = {}): RawNotification {
  return {
    packageName: 'com.nu.production',
    title: 'Nubank',
    text: 'Compra no crédito de R$ 150,00 em MERCADO LIVRE',
    postTime: Date.now(),
    ...overrides,
  };
}

describe('parseNotification', () => {
  it('parses a Nubank credit notification', () => {
    const tx = parseNotification(make());
    expect(tx).not.toBeNull();
    expect(tx!.cardName).toBe('Nubank');
    expect(tx!.amount).toBe(150);
    expect(tx!.type).toBe('credit');
  });

  it('parses amount with thousand separator', () => {
    const tx = parseNotification(
      make({text: 'Compra no crédito de R$ 1.500,99 em AMAZON'}),
    );
    expect(tx!.amount).toBe(1500.99);
  });

  it('detects PIX type', () => {
    const tx = parseNotification(
      make({text: 'Transferência Pix de R$ 50,00 para João'}),
    );
    expect(tx!.type).toBe('pix');
  });

  it('detects debit type', () => {
    const tx = parseNotification(
      make({text: 'Débito em conta de R$ 80,00 no SUPERMERCADO'}),
    );
    expect(tx!.type).toBe('debit');
  });

  it('returns null for non-card notifications', () => {
    const tx = parseNotification(
      make({
        packageName: 'com.whatsapp',
        title: 'João',
        text: 'Oi, tudo bem?',
      }),
    );
    expect(tx).toBeNull();
  });

  it('returns null when no amount found', () => {
    const tx = parseNotification(make({text: 'Sua fatura fechou hoje'}));
    expect(tx).toBeNull();
  });

  it('identifies C6 Bank by package', () => {
    const tx = parseNotification(
      make({
        packageName: 'com.c6bank.app',
        title: 'C6 Bank',
        text: 'Compra aprovada de R$ 200,00 em iFood',
      }),
    );
    expect(tx!.cardName).toBe('C6 Bank');
    expect(tx!.cardColor).toBe('#242424');
  });

  it('avoids duplicates when called twice with same data', () => {
    const n = make();
    const t1 = parseNotification(n);
    const t2 = parseNotification(n);
    // Each parse creates independent IDs (random suffix) — dedup is in store
    expect(t1).not.toBeNull();
    expect(t2).not.toBeNull();
    expect(t1!.id).not.toBe(t2!.id);
  });
});
