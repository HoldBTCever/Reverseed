import AsyncStorage from '@react-native-async-storage/async-storage';
import {create} from 'zustand';
import {AppSettings, MobillsConfig, Transaction} from '../types';
import {getMobillsService} from '../services/MobillsService';

const STORAGE_KEY_TRANSACTIONS = '@cardparser:transactions';
const STORAGE_KEY_SETTINGS = '@cardparser:settings';

const DEFAULT_SETTINGS: AppSettings = {
  mobills: {
    apiToken: '',
    apiUrl: 'https://api.mobills.com.br/v1',
    defaultAccountId: '',
    defaultCategoryId: '',
    autoSync: false,
  },
  filterPackages: [],
  minimumAmount: 0,
  notifications: true,
};

interface TransactionStore {
  transactions: Transaction[];
  settings: AppSettings;
  isLoading: boolean;
  syncStatus: 'idle' | 'syncing' | 'error';
  lastSyncError: string | null;

  // Actions
  loadFromStorage: () => Promise<void>;
  addTransaction: (t: Transaction) => Promise<void>;
  removeTransaction: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  updateSettings: (settings: Partial<AppSettings>) => Promise<void>;
  updateMobillsConfig: (config: Partial<MobillsConfig>) => Promise<void>;
  syncTransaction: (id: string) => Promise<void>;
  syncAllPending: () => Promise<void>;
  markSynced: (id: string) => void;
}

async function saveTransactions(transactions: Transaction[]): Promise<void> {
  await AsyncStorage.setItem(
    STORAGE_KEY_TRANSACTIONS,
    JSON.stringify(transactions),
  );
}

async function saveSettings(settings: AppSettings): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}

export const useTransactionStore = create<TransactionStore>((set, get) => ({
  transactions: [],
  settings: DEFAULT_SETTINGS,
  isLoading: true,
  syncStatus: 'idle',
  lastSyncError: null,

  loadFromStorage: async () => {
    try {
      const [txRaw, settingsRaw] = await Promise.all([
        AsyncStorage.getItem(STORAGE_KEY_TRANSACTIONS),
        AsyncStorage.getItem(STORAGE_KEY_SETTINGS),
      ]);

      const transactions: Transaction[] = txRaw ? JSON.parse(txRaw) : [];
      const settings: AppSettings = settingsRaw
        ? {...DEFAULT_SETTINGS, ...JSON.parse(settingsRaw)}
        : DEFAULT_SETTINGS;

      set({transactions, settings, isLoading: false});
    } catch {
      set({isLoading: false});
    }
  },

  addTransaction: async (transaction: Transaction) => {
    const {transactions, settings} = get();

    // Skip if below minimum amount
    if (transaction.amount < settings.minimumAmount) {
      return;
    }

    // Skip filtered packages
    if (settings.filterPackages.includes(transaction.cardPackage)) {
      return;
    }

    // Avoid duplicates (same card + amount + within 30s)
    const isDuplicate = transactions.some(
      t =>
        t.cardPackage === transaction.cardPackage &&
        t.amount === transaction.amount &&
        Math.abs(t.timestamp - transaction.timestamp) < 30000,
    );
    if (isDuplicate) {
      return;
    }

    const updated = [transaction, ...transactions];
    set({transactions: updated});
    await saveTransactions(updated);

    // Auto-sync if configured
    if (settings.mobills.autoSync && settings.mobills.apiToken) {
      get().syncTransaction(transaction.id);
    }
  },

  removeTransaction: async (id: string) => {
    const updated = get().transactions.filter(t => t.id !== id);
    set({transactions: updated});
    await saveTransactions(updated);
  },

  clearAll: async () => {
    set({transactions: []});
    await AsyncStorage.removeItem(STORAGE_KEY_TRANSACTIONS);
  },

  updateSettings: async (newSettings: Partial<AppSettings>) => {
    const settings = {...get().settings, ...newSettings};
    set({settings});
    await saveSettings(settings);
  },

  updateMobillsConfig: async (config: Partial<MobillsConfig>) => {
    const settings = {
      ...get().settings,
      mobills: {...get().settings.mobills, ...config},
    };
    set({settings});
    await saveSettings(settings);
  },

  markSynced: (id: string) => {
    const updated = get().transactions.map(t =>
      t.id === id ? {...t, synced: true, syncedAt: Date.now()} : t,
    );
    set({transactions: updated});
    saveTransactions(updated);
  },

  syncTransaction: async (id: string) => {
    const {transactions, settings} = get();
    const transaction = transactions.find(t => t.id === id);
    if (!transaction || !settings.mobills.apiToken) {
      return;
    }

    set({syncStatus: 'syncing', lastSyncError: null});

    try {
      const service = getMobillsService(settings.mobills);
      await service.syncTransaction(transaction);
      get().markSynced(id);
      set({syncStatus: 'idle'});
    } catch (e: any) {
      set({
        syncStatus: 'error',
        lastSyncError: e?.message ?? 'Erro ao sincronizar',
      });
    }
  },

  syncAllPending: async () => {
    const {transactions, settings} = get();
    if (!settings.mobills.apiToken) {
      return;
    }

    const pending = transactions.filter(t => !t.synced);
    if (pending.length === 0) {
      return;
    }

    set({syncStatus: 'syncing', lastSyncError: null});
    const service = getMobillsService(settings.mobills);

    let errors = 0;
    for (const t of pending) {
      try {
        await service.syncTransaction(t);
        get().markSynced(t.id);
      } catch {
        errors++;
      }
    }

    set({
      syncStatus: errors > 0 ? 'error' : 'idle',
      lastSyncError:
        errors > 0 ? `${errors} transação(ões) falharam` : null,
    });
  },
}));
