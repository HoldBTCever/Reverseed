import axios, {AxiosInstance} from 'axios';
import {MobillsConfig, Transaction, TransactionType} from '../types';

interface MobillsTransaction {
  title: string;
  amount: number;
  date: string;
  type: 'expense' | 'income' | 'transfer';
  account_id: string;
  category_id: string;
  description?: string;
  paid: boolean;
}

interface MobillsAccount {
  id: string;
  name: string;
  type: string;
}

interface MobillsCategory {
  id: string;
  name: string;
  type: string;
}

function toMobillsType(type: TransactionType): 'expense' | 'income' | 'transfer' {
  switch (type) {
    case 'pix':
      return 'transfer';
    case 'income':
      return 'income';
    default:
      return 'expense';
  }
}

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export class MobillsService {
  private client: AxiosInstance;
  private config: MobillsConfig;

  constructor(config: MobillsConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.apiUrl || 'https://api.mobills.com.br/v1',
      headers: {
        Authorization: `Bearer ${config.apiToken}`,
        'Content-Type': 'application/json',
      },
      timeout: 10000,
    });
  }

  async syncTransaction(transaction: Transaction): Promise<boolean> {
    if (!this.config.apiToken) {
      throw new Error('Mobills API token não configurado');
    }

    const payload: MobillsTransaction = {
      title: transaction.description || transaction.cardName,
      amount: transaction.amount,
      date: formatDate(transaction.timestamp),
      type: toMobillsType(transaction.type),
      account_id: this.config.defaultAccountId,
      category_id: this.config.defaultCategoryId,
      description: `[${transaction.cardName}] ${transaction.rawText}`.substring(0, 255),
      paid: true,
    };

    await this.client.post('/transactions', payload);
    return true;
  }

  async getAccounts(): Promise<MobillsAccount[]> {
    const response = await this.client.get('/accounts');
    return response.data?.data ?? response.data ?? [];
  }

  async getCategories(): Promise<MobillsCategory[]> {
    const response = await this.client.get('/categories');
    return response.data?.data ?? response.data ?? [];
  }

  async testConnection(): Promise<boolean> {
    try {
      await this.client.get('/accounts');
      return true;
    } catch {
      return false;
    }
  }
}

let _instance: MobillsService | null = null;

export function getMobillsService(config: MobillsConfig): MobillsService {
  _instance = new MobillsService(config);
  return _instance;
}
