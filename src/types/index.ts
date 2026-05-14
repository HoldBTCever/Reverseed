export type TransactionType = 'credit' | 'debit' | 'pix' | 'unknown';

export interface RawNotification {
  packageName: string;
  title: string;
  text: string;
  postTime: number;
}

export interface CardInfo {
  name: string;
  packageName: string;
  color: string;
  icon: string;
}

export interface Transaction {
  id: string;
  cardName: string;
  cardPackage: string;
  cardColor: string;
  amount: number;
  description: string;
  type: TransactionType;
  timestamp: number;
  rawTitle: string;
  rawText: string;
  synced: boolean;
  syncedAt?: number;
}

export interface MobillsConfig {
  apiToken: string;
  apiUrl: string;
  defaultAccountId: string;
  defaultCategoryId: string;
  autoSync: boolean;
}

export interface AppSettings {
  mobills: MobillsConfig;
  filterPackages: string[];
  minimumAmount: number;
  notifications: boolean;
}

export type RootStackParamList = {
  Home: undefined;
  Transactions: undefined;
  Settings: undefined;
  TransactionDetail: {transactionId: string};
};
