import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  applyFeed,
  applyTick,
  createPetState,
  migratePetState,
  play as playAction,
  practiceHabit as practiceHabitAction,
} from '../lib/petEngine';
import { loadJson, removeKey, saveJson } from '../lib/storage';
import { useWalletSync } from './useWalletSync';
import type { HabitKind, LinkedWallet, PetState } from '../types';

function loadPet(storageKey: string): PetState | null {
  const stored = loadJson<PetState>(petKey(storageKey));
  return stored ? migratePetState(stored) : null;
}

const LINK_KEY = 'satoshipet:link:v1';
const TICK_INTERVAL_MS = 15_000;

/** A storage key and display label for a linked wallet — both are always public-safe. */
function walletIdentity(link: LinkedWallet): { storageKey: string; label: string } {
  if (link.kind === 'onchain') {
    return link.isDemo
      ? { storageKey: 'demo-onchain', label: 'Modo demonstração' }
      : { storageKey: `onchain:${link.address}`, label: link.address };
  }
  return link.isDemo
    ? { storageKey: 'demo-lightning', label: 'Modo demonstração' }
    : { storageKey: `lightning:${link.lightningAddress}`, label: link.lightningAddress };
}

function petKey(storageKey: string): string {
  return `satoshipet:pet:v1:${storageKey}`;
}

export function usePetState() {
  const [link, setLink] = useState<LinkedWallet | null>(() => loadJson<LinkedWallet>(LINK_KEY));
  const [pet, setPet] = useState<PetState | null>(() => {
    const linked = loadJson<LinkedWallet>(LINK_KEY);
    if (!linked) return null;
    const identity = walletIdentity(linked);
    return loadPet(identity.storageKey) ?? createPetState(linked.kind, identity.label, linked.isDemo);
  });

  const wallet = useWalletSync(link);

  const persist = useCallback(
    (next: PetState) => {
      if (!link) return;
      setPet(next);
      saveJson(petKey(walletIdentity(link).storageKey), next);
    },
    [link],
  );

  // Periodic decay tick, independent of network activity.
  useEffect(() => {
    if (!pet || !link) return;
    const storageKey = walletIdentity(link).storageKey;
    const interval = setInterval(() => {
      setPet((current) => {
        if (!current) return current;
        const ticked = applyTick(current);
        saveJson(petKey(storageKey), ticked);
        return ticked;
      });
    }, TICK_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [pet?.walletLabel, link]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply a tick immediately whenever the pet is (re)loaded, to account for
  // time elapsed while the app was closed.
  useEffect(() => {
    if (!pet) return;
    persist(applyTick(pet));
    // Only run once per loaded pet identity, not on every stat change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pet?.walletLabel]);

  // Feed the pet from any new incoming transactions detected by wallet sync.
  useEffect(() => {
    if (!pet || wallet.txs.length === 0) return;
    setPet((current) => {
      if (!current || !link) return current;
      let next = current;
      // Oldest-first so the feed log ends up newest-first after each unshift.
      const chronological = [...wallet.txs].sort((a, b) => a.time - b.time);
      for (const tx of chronological) {
        if (tx.receivedSats > 0 && !next.seenTxids.includes(tx.id)) {
          next = applyFeed(next, tx.id, tx.receivedSats, tx.time);
        }
      }
      if (next !== current) saveJson(petKey(walletIdentity(link).storageKey), next);
      return next;
    });
  }, [wallet.txs, pet?.walletLabel, link]); // eslint-disable-line react-hooks/exhaustive-deps

  const linkWallet = useCallback((next: LinkedWallet) => {
    saveJson(LINK_KEY, next);
    setLink(next);
    const identity = walletIdentity(next);
    const existing = loadPet(identity.storageKey);
    const initial = existing ?? createPetState(next.kind, identity.label, next.isDemo);
    saveJson(petKey(identity.storageKey), initial);
    setPet(initial);
  }, []);

  const unlinkWallet = useCallback(() => {
    removeKey(LINK_KEY);
    setLink(null);
    setPet(null);
  }, []);

  const resetPet = useCallback(() => {
    if (!link) return;
    const identity = walletIdentity(link);
    persist(createPetState(link.kind, identity.label, link.isDemo));
  }, [link, persist]);

  const play = useCallback(() => {
    if (!pet) return;
    persist(playAction(pet));
  }, [pet, persist]);

  /** Feeds the pet from a confirmed Lightning payment discovered outside the polling loop (an invoice generated or paid in-app). */
  const feedManually = useCallback(
    (id: string, sats: number, at = Date.now()) => {
      if (!pet) return;
      persist(applyFeed(pet, id, sats, at));
    },
    [pet, persist],
  );

  const practiceHabit = useCallback(
    (kind: HabitKind) => {
      if (!pet) return;
      persist(practiceHabitAction(pet, kind));
    },
    [pet, persist],
  );

  return useMemo(
    () => ({
      pet,
      linked: link,
      wallet,
      linkWallet,
      unlinkWallet,
      resetPet,
      play,
      feedManually,
      practiceHabit,
    }),
    [pet, link, wallet, linkWallet, unlinkWallet, resetPet, play, feedManually, practiceHabit],
  );
}
