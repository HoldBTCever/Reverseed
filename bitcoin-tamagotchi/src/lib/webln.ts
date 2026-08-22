interface WebLNProvider {
  enable: () => Promise<void>;
  sendPayment: (invoice: string) => Promise<{ preimage: string }>;
}

declare global {
  interface Window {
    webln?: WebLNProvider;
  }
}

export function isWebLNAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.webln;
}

/** Pays a BOLT11 invoice from the browser's connected Lightning wallet (e.g. the Alby extension). */
export async function payWithWebLN(invoice: string): Promise<string> {
  if (!window.webln) {
    throw new Error('Nenhuma carteira Lightning conectada ao navegador (ex: extensão Alby).');
  }
  await window.webln.enable();
  const result = await window.webln.sendPayment(invoice);
  return result.preimage;
}
