interface UnisatProvider {
  requestAccounts: () => Promise<string[]>;
  getAccounts: () => Promise<string[]>;
}

declare global {
  interface Window {
    unisat?: UnisatProvider;
  }
}

export function isUnisatAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.unisat;
}

/**
 * Asks the Unisat browser extension for a receiving address. This only ever
 * reads a public address the extension's own permission prompt exposes —
 * no keys, no signing, no spending capability is requested.
 */
export async function connectUnisat(): Promise<string> {
  if (!window.unisat) {
    throw new Error('Unisat não está instalado neste navegador.');
  }
  const accounts = await window.unisat.requestAccounts();
  if (!accounts || accounts.length === 0) {
    throw new Error('Nenhuma conta retornada pela carteira.');
  }
  return accounts[0];
}
