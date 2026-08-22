import type { AddressInfo, AddressTx } from '../types';

// Both APIs are public, CORS-enabled, watch-only endpoints for Bitcoin
// mainnet — no authentication and no private key material ever involved.
const API_BASES = ['https://mempool.space/api', 'https://blockstream.info/api'];

interface ChainStats {
  funded_txo_sum: number;
  spent_txo_sum: number;
  tx_count: number;
}

interface RawAddressInfo {
  chain_stats: ChainStats;
  mempool_stats: ChainStats;
}

interface RawVout {
  scriptpubkey_address?: string;
  value: number;
}

interface RawTx {
  txid: string;
  vout: RawVout[];
  status: { confirmed: boolean; block_time?: number };
}

async function fetchFromAnyBase<T>(path: string): Promise<T> {
  let lastError: unknown;
  for (const base of API_BASES) {
    try {
      const res = await fetch(`${base}${path}`);
      if (!res.ok) {
        throw new Error(`${base}${path} -> HTTP ${res.status}`);
      }
      return (await res.json()) as T;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Falha ao consultar a rede Bitcoin.');
}

export async function getAddressInfo(address: string): Promise<AddressInfo> {
  const raw = await fetchFromAnyBase<RawAddressInfo>(`/address/${address}`);
  const fundedSats = raw.chain_stats.funded_txo_sum + raw.mempool_stats.funded_txo_sum;
  const spentSats = raw.chain_stats.spent_txo_sum + raw.mempool_stats.spent_txo_sum;
  return {
    fundedSats,
    spentSats,
    balanceSats: fundedSats - spentSats,
    txCount: raw.chain_stats.tx_count + raw.mempool_stats.tx_count,
  };
}

export async function getAddressTxs(address: string): Promise<AddressTx[]> {
  const raw = await fetchFromAnyBase<RawTx[]>(`/address/${address}/txs`);
  return raw.map((tx) => {
    const receivedSats = tx.vout
      .filter((vout) => vout.scriptpubkey_address === address)
      .reduce((sum, vout) => sum + vout.value, 0);
    return {
      txid: tx.txid,
      receivedSats,
      confirmed: tx.status.confirmed,
      time: tx.status.block_time ? tx.status.block_time * 1000 : Date.now(),
    };
  });
}
