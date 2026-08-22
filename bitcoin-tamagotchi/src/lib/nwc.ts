import { NWCClient } from '@getalby/sdk/nwc';
import type { WalletTx } from '../types';

// Nostr Wallet Connect (NIP-47): a wallet-agnostic standard supported by
// Alby Hub, Mutiny, Zeus and others for granting a third-party app scoped
// access to a Lightning wallet — no custody, no seed phrase. The user
// creates the connection in their own wallet app, choosing exactly which
// permissions (read balance, list transactions, make invoices, ...) to
// grant, and can revoke it at any time from there.

interface CachedClient {
  uri: string;
  client: NWCClient;
}

let cached: CachedClient | null = null;

function getClient(nwcUri: string): NWCClient {
  if (cached && cached.uri === nwcUri) return cached.client;
  cached?.client.close();
  const client = new NWCClient({ nostrWalletConnectUrl: nwcUri });
  cached = { uri: nwcUri, client };
  return client;
}

export function disconnectLightningWallet(): void {
  cached?.client.close();
  cached = null;
}

export function isValidNwcUri(uri: string): boolean {
  try {
    NWCClient.parseWalletConnectUrl(uri.trim(), true);
    return true;
  } catch {
    return false;
  }
}

/** Extracts the wallet's public key from an NWC URI — safe to display, unlike the connection secret. */
export function walletPubkeyFromUri(uri: string): string | null {
  try {
    return NWCClient.parseWalletConnectUrl(uri.trim()).walletPubkey;
  } catch {
    return null;
  }
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'Falha ao consultar a carteira Lightning.';
}

export interface LightningWalletData {
  balanceSats: number;
  txs: WalletTx[];
}

export async function getLightningWalletData(nwcUri: string): Promise<LightningWalletData> {
  const client = getClient(nwcUri);
  try {
    const [balanceRes, txsRes] = await Promise.all([
      client.getBalance(),
      client.listTransactions({ type: 'incoming', limit: 50 }),
    ]);
    const txs: WalletTx[] = txsRes.transactions
      .filter((tx) => tx.state === 'settled')
      .map((tx) => ({
        id: tx.payment_hash,
        receivedSats: Math.floor(tx.amount / 1000),
        confirmed: true,
        time: (tx.settled_at || tx.created_at) * 1000,
      }));
    return { balanceSats: Math.floor(balanceRes.balance / 1000), txs };
  } catch (err) {
    throw new Error(errorMessage(err));
  }
}

/**
 * Asks the connected wallet to create a real BOLT11 invoice for `sats`,
 * payable by anyone. Requires the connection to have been granted the
 * `make_invoice` permission — throws a friendly error otherwise.
 */
export async function makeLightningInvoice(nwcUri: string, sats: number, description: string): Promise<string> {
  const client = getClient(nwcUri);
  try {
    const result = await client.makeInvoice({ amount: sats * 1000, description });
    return result.invoice;
  } catch (err) {
    throw new Error(errorMessage(err));
  }
}
