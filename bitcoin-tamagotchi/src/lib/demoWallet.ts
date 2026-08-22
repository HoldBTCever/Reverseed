import type { AddressInfo, AddressTx } from '../types';

// Deterministic-ish fake "chain" used by Demo Mode so the game is fully
// playable without a real wallet or network access. State lives only in
// memory for the current tab.
const DEMO_ADDRESS = 'demo-carteira-simulada';

let demoTxs: AddressTx[] = [];
let nextDemoTick = 0;

function maybeMintDemoTx(now: number): void {
  if (now < nextDemoTick) return;
  const sats = Math.round(500 + Math.random() * 60_000);
  demoTxs = [
    {
      txid: `demo-${now}-${Math.random().toString(36).slice(2, 8)}`,
      receivedSats: sats,
      confirmed: true,
      time: now,
    },
    ...demoTxs,
  ].slice(0, 50);
  nextDemoTick = now + (20_000 + Math.random() * 40_000);
}

export function resetDemoWallet(): void {
  demoTxs = [];
  nextDemoTick = Date.now() + 15_000;
}

export function isDemoAddress(address: string): boolean {
  return address === DEMO_ADDRESS;
}

export function getDemoAddress(): string {
  return DEMO_ADDRESS;
}

export async function getDemoAddressInfo(): Promise<AddressInfo> {
  maybeMintDemoTx(Date.now());
  const fundedSats = demoTxs.reduce((sum, tx) => sum + tx.receivedSats, 0);
  return { fundedSats, spentSats: 0, balanceSats: fundedSats, txCount: demoTxs.length };
}

export async function getDemoAddressTxs(): Promise<AddressTx[]> {
  maybeMintDemoTx(Date.now());
  return demoTxs;
}
