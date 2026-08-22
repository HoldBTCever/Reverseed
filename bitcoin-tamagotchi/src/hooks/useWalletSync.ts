import { useCallback, useEffect, useRef, useState } from 'react';
import { getAddressInfo, getAddressTxs } from '../lib/mempoolApi';
import { getDemoAddressInfo, getDemoAddressTxs, isDemoAddress } from '../lib/demoWallet';
import type { AddressTx } from '../types';

const POLL_INTERVAL_MS = 45_000;

interface WalletSyncResult {
  balanceSats: number | null;
  txs: AddressTx[];
  loading: boolean;
  error: string | null;
  lastCheckedAt: number | null;
  refresh: () => void;
}

export function useWalletSync(address: string | null): WalletSyncResult {
  const [balanceSats, setBalanceSats] = useState<number | null>(null);
  const [txs, setTxs] = useState<AddressTx[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckedAt, setLastCheckedAt] = useState<number | null>(null);
  const requestSeq = useRef(0);

  const load = useCallback(async () => {
    if (!address) return;
    const seq = ++requestSeq.current;
    setLoading(true);
    try {
      const demo = isDemoAddress(address);
      const [info, addressTxs] = demo
        ? await Promise.all([getDemoAddressInfo(), getDemoAddressTxs()])
        : await Promise.all([getAddressInfo(address), getAddressTxs(address)]);

      if (seq !== requestSeq.current) return; // a newer request superseded this one
      setBalanceSats(info.balanceSats);
      setTxs(addressTxs);
      setError(null);
      setLastCheckedAt(Date.now());
    } catch (err) {
      if (seq !== requestSeq.current) return;
      setError(err instanceof Error ? err.message : 'Falha ao consultar a carteira.');
    } finally {
      if (seq === requestSeq.current) setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    if (!address) return;
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
  }, [address, load]);

  return { balanceSats, txs, loading, error, lastCheckedAt, refresh: load };
}
