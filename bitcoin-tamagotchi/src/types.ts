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

/** Bitcoiner-lifestyle actions the avatar can practice. Each only completes once its cost in sats is actually received — never affects evolution stage directly, but the sats received to complete one still count toward it. */
export type HabitKind = 'carnivore' | 'austrianSchool' | 'gym';

export type HabitCounts = Record<HabitKind, number>;
export type HabitTimestamps = Record<HabitKind, number | null>;

/** A habit awaiting its required payment before it completes. Only one can be pending at a time. */
export interface PendingHabit {
  kind: HabitKind;
  costSats: number;
  requestedAt: number;
}

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
  /** Strength/fitness — mostly driven by Treinar/Dieta Carnívora. Reaching 0 hibernates the avatar. */
  physicalHealth: number;
  /** Psychological wellbeing — mostly driven by Escola Austríaca/Treinar and financial stability. Reaching 0 hibernates the avatar. */
  mentalHealth: number;
  /** Knowledge — driven by Escola Austríaca. Purely cosmetic (unlocks glasses); never gates evolution or survival. */
  intelligence: number;
  totalSatsFed: number;
  status: PetStatus;
  lastPlayedAt: number | null;
  feedLog: FeedEvent[];
  hibernatingSince: number | null;
  name: string;
  habits: HabitCounts;
  lastHabitAt: HabitTimestamps;
  pendingHabit: PendingHabit | null;
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
