import type { AddressInfo, WalletTx } from '../types';

// Simulated Lightning wallet for Demo Mode — Lightning payments trend
// smaller and more frequent than on-chain ones, so the cadence here is
// faster than the on-chain demo to feel authentic.
let demoTxs: WalletTx[] = [];
let nextDemoTick = 0;

function maybeMintDemoTx(now: number): void {
  if (now < nextDemoTick) return;
  const sats = Math.round(100 + Math.random() * 5_000);
  demoTxs = [
    {
      id: `demo-ln-${now}-${Math.random().toString(36).slice(2, 8)}`,
      receivedSats: sats,
      confirmed: true,
      time: now,
    },
    ...demoTxs,
  ].slice(0, 50);
  nextDemoTick = now + (8_000 + Math.random() * 20_000);
}

export function resetDemoLightning(): void {
  demoTxs = [];
  nextDemoTick = Date.now() + 8_000;
}

export async function getDemoLightningInfo(): Promise<AddressInfo> {
  maybeMintDemoTx(Date.now());
  const fundedSats = demoTxs.reduce((sum, tx) => sum + tx.receivedSats, 0);
  return { fundedSats, spentSats: 0, balanceSats: fundedSats, txCount: demoTxs.length };
}

export async function getDemoLightningTxs(): Promise<WalletTx[]> {
  maybeMintDemoTx(Date.now());
  return demoTxs;
}
