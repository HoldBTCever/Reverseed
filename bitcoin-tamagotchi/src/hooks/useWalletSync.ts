import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddressInfo, getAddressTxs } from '../lib/mempoolApi';
import { getDemoAddressInfo, getDemoAddressTxs } from '../lib/demoWallet';
import { getDemoLightningInfo, getDemoLightningTxs } from '../lib/demoLightning';
import type { LinkedWallet, WalletTx } from '../types';

const POLL_INTERVAL_MS = 45_000;

interface WalletSyncResult {
  balanceSats: number | null;
  txs: WalletTx[];
  loading: boolean;
  error: string | null;
  lastCheckedAt: number | null;
  refresh: () => void;
}

/**
 * Whether a linked wallet can be passively polled for new incoming payments.
 * On-chain addresses (real or demo) can — there's a public tx history API.
 * A real Lightning Address cannot: LNURL-pay only lets you request and watch
 * a specific invoice you generated, not list arbitrary incoming payments.
 * Demo Lightning simulates payments locally, so it's pollable too.
 */
function isPollable(link: LinkedWallet): boolean {
  return link.kind === 'onchain' || link.isDemo;
}

async function fetchWalletData(link: LinkedWallet): Promise<{ balanceSats: number; txs: WalletTx[] }> {
  if (link.kind === 'onchain') {
    if (link.isDemo) {
      const [info, txs] = await Promise.all([getDemoAddressInfo(), getDemoAddressTxs()]);
      return { balanceSats: info.balanceSats, txs };
    }
    const [info, txs] = await Promise.all([getAddressInfo(link.address), getAddressTxs(link.address)]);
    return { balanceSats: info.balanceSats, txs };
  }

  const [info, txs] = await Promise.all([getDemoLightningInfo(), getDemoLightningTxs()]);
  return { balanceSats: info.balanceSats, txs };
}

export function useWalletSync(link: LinkedWallet | null): WalletSyncResult {
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [txs, setTxs] = useState<WalletTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!link || !isPollable(link)) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const data = await fetchWalletData(link);
      if (seq !== requestSeq.current) return; // a newer request superseded this one
      setBalanceSats(data.balanceSats);
      setTxs(data.txs);
      setError(null);
      setLastCheckedAt(Date.now());
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'Falha ao consultar a carteira.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [link]);

  useEffect(() => {
    if (!link || !isPollable(link)) return;
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [link, load]);

  return { balanceSats, txs, loading, error, lastCheckedAt, refresh: load };
}
