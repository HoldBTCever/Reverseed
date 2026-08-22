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
}

export type Mood = 'happy' | 'neutral' | 'sad' | 'critical' | 'hibernating' | 'gone';

export interface EvolutionStage {
  id: number;
  name: string;
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
