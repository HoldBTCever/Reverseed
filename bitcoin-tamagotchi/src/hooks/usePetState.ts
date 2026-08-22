import { useCallback, useEffect, useMemo, useState } from 'react';
import { applyFeed, applyTick, createPetState, play as playAction, toggleSleep as toggleSleepAction } from '../lib/petEngine';
import { loadJson, removeKey, saveJson } from '../lib/storage';
import { useWalletSync } from './useWalletSync';
import type { PetState } from '../types';

interface LinkedWallet {
  address: string;
  isDemo: boolean;
}

const LINK_KEY = 'satoshipet:link:v1';
const TICK_INTERVAL_MS = 15_000;

function petKey(address: string): string {
  return `satoshipet:pet:v1:${address}`;
}

export function usePetState() {
  const [link, setLink] = useState<LinkedWallet | null>(() => loadJson<LinkedWallet>(LINK_KEY));
  const [pet, setPet] = useState<PetState | null>(() => {
    const linked = loadJson<LinkedWallet>(LINK_KEY);
    if (!linked) return null;
    return loadJson<PetState>(petKey(linked.address)) ?? createPetState(linked.address, linked.isDemo);
  });

  const wallet = useWalletSync(link?.address ?? null);

  const persist = useCallback((next: PetState) => {
    setPet(next);
    saveJson(petKey(next.address), next);
  }, []);

  // Periodic decay tick, independent of network activity.
  useEffect(() => {
    if (!pet) return;
    const interval = setInterval(() => {
      setPet((current) => {
        if (!current) return current;
        const ticked = applyTick(current);
        saveJson(petKey(ticked.address), ticked);
        return ticked;
      });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pet?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply a tick immediately whenever the pet is (re)loaded, to account for
  // time elapsed while the app was closed.
  useEffect(() => {
    if (!pet) return;
    persist(applyTick(pet));
    // Only run once per loaded pet identity (address), not on every stat change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.address]);

  // Feed the pet from any new incoming transactions detected by wallet sync.
  useEffect(() => {
    if (!pet || wallet.txs.length === 0) return;
    setPet((current) => {
      if (!current) return current;
      let next = current;
      // Oldest-first so the feed log ends up newest-first after each unshift.
      const chronological = [...wallet.txs].sort((a, b) => a.time - b.time);
      for (const tx of chronological) {
        if (tx.receivedSats > 0 && !next.seenTxids.includes(tx.txid)) {
          next = applyFeed(next, tx.txid, tx.receivedSats, tx.time);
        }
      }
      if (next !== current) saveJson(petKey(next.address), next);
      return next;
    });
  }, [wallet.txs, pet?.address]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkWallet = useCallback((address: string, isDemo: boolean) => {
    const linkedWallet: LinkedWallet = { address, isDemo };
    saveJson(LINK_KEY, linkedWallet);
    setLink(linkedWallet);
    const existing = loadJson<PetState>(petKey(address));
    const initial = existing ?? createPetState(address, isDemo);
    saveJson(petKey(address), initial);
    setPet(initial);
  }, []);

  const unlinkWallet = useCallback(() => {
    removeKey(LINK_KEY);
    setLink(null);
    setPet(null);
  }, []);

  const resetPet = useCallback(() => {
    if (!link) return;
    const fresh = createPetState(link.address, link.isDemo);
    persist(fresh);
  }, [link, persist]);

  const play = useCallback(() => {
    if (!pet) return;
    persist(playAction(pet));
  }, [pet, persist]);

  const toggleSleep = useCallback(() => {
    if (!pet) return;
    persist(toggleSleepAction(pet));
  }, [pet, persist]);

  return useMemo(
    () => ({
      pet,
      linked: link,
      wallet,
      linkWallet,
      unlinkWallet,
      resetPet,
      play,
      toggleSleep,
    }),
    [pet, link, wallet, linkWallet, unlinkWallet, resetPet, play, toggleSleep],
  );
}
