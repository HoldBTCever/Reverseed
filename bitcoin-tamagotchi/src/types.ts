export type PetStatus = 'alive' | 'hibernating' | 'gone';

export type WalletKind = 'onchain' | 'lightning';

export type LinkedWallet =
  | { kind: 'onchain'; address: string; isDemo: boolean }
  | { kind: 'lightning'; lightningAddress: string; isDemo: boolean };

export interface FeedEvent {
  txid: string;
  sats: number;
  at: number;
}

/** Bitcoiner-lifestyle actions the avatar can practice between real sat deposits. Purely cosmetic/mood — never affects evolution stage. */
export type HabitKind = 'carnivore' | 'austrianSchool' | 'gym';

export type HabitCounts = Record<HabitKind, number>;
export type HabitTimestamps = Record<HabitKind, number | null>;

export interface PetState {
  walletKind: WalletKind;
  /** Public-safe label for the linked wallet (address, or a shortened Lightning wallet pubkey). Never a secret. */
  walletLabel: string;
  isDemo: boolean;
  createdAt: number;
  lastTickAt: number;
  seenTxids: string[];
  hunger: number;
  happiness: number;
  energy: number;
  health: number;
  totalSatsFed: number;
  status: PetStatus;
  isSleeping: boolean;
  lastPlayedAt: number | null;
  feedLog: FeedEvent[];
  hibernatingSince: number | null;
  name: string;
  habits: HabitCounts;
  lastHabitAt: HabitTimestamps;
}

export type Mood = 'happy' | 'neutral' | 'sad' | 'critical' | 'hibernating' | 'gone';

export interface EvolutionStage {
  id: number;
  name: string;
  description: string;
  minTotalSats: number;
}

export interface AddressInfo {
  balanceSats: number;
  fundedSats: number;
  spentSats: number;
  txCount: number;
}

/** A single incoming payment, normalized across on-chain txs and Lightning payments. */
export interface WalletTx {
  id: string;
  receivedSats: number;
  confirmed: boolean;
  time: number;
}
