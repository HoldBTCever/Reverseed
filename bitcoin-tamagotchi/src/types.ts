export type PetStatus = 'alive' | 'hibernating' | 'gone';

export interface FeedEvent {
  txid: string;
  sats: number;
  at: number;
}

export interface PetState {
  address: string;
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

export interface AddressTx {
  txid: string;
  receivedSats: number;
  confirmed: boolean;
  time: number;
}
