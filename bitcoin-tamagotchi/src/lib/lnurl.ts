// Lightning Address (LUD-16) + LNURL-pay: a Lightning Address like
// name@domain.com resolves to an HTTPS endpoint at domain.com that anyone
// can call to request an invoice payable to that wallet. No credentials or
// secrets are ever involved — it's a public receive endpoint, exactly like
// an email address is for mail. Some providers (LUD-21) also return a
// `verify` URL alongside the invoice, letting anyone check — without
// authentication — whether that specific invoice has been paid.

const LIGHTNING_ADDRESS_RE = /^[a-z0-9._-]+@[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

export function isValidLightningAddress(input: string): boolean {
  return LIGHTNING_ADDRESS_RE.test(input.trim());
}

interface LnurlPayMetadata {
  callback: string;
  minSendable: number;
  maxSendable: number;
  commentAllowed?: number;
  status?: string;
  reason?: string;
  tag?: string;
}

function splitAddress(address: string): { name: string; domain: string } {
  const trimmed = address.trim();
  const at = trimmed.indexOf('@');
  if (at <= 0 || at === trimmed.length - 1) {
    throw new Error('Endereço Lightning inválido.');
  }
  return { name: trimmed.slice(0, at), domain: trimmed.slice(at + 1) };
}

export async function resolveLightningAddress(address: string): Promise<LnurlPayMetadata> {
  const { name, domain } = splitAddress(address);
  let res: Response;
  try {
    res = await fetch(`https://${domain}/.well-known/lnurlp/${encodeURIComponent(name)}`);
  } catch {
    throw new Error(`Não foi possível conectar a ${domain}.`);
  }
  if (!res.ok) {
    throw new Error(`Endereço Lightning não encontrado (HTTP ${res.status}).`);
  }
  const data = (await res.json()) as LnurlPayMetadata;
  if (data.status === 'ERROR') {
    throw new Error(data.reason || 'Endereço Lightning inválido.');
  }
  if (data.tag !== 'payRequest' || !data.callback) {
    throw new Error('Esse endereço não suporta pagamentos (LNURL-pay).');
  }
  return data;
}

export interface GeneratedInvoice {
  invoice: string;
  verifyUrl: string | null;
}

export async function requestLightningInvoice(
  address: string,
  sats: number,
  comment?: string,
): Promise<GeneratedInvoice> {
  const meta = await resolveLightningAddress(address);
  const msats = sats * 1000;
  if (msats < meta.minSendable || msats > meta.maxSendable) {
    const min = Math.ceil(meta.minSendable / 1000);
    const max = Math.floor(meta.maxSendable / 1000);
    throw new Error(`Valor fora do permitido por essa carteira (entre ${min} e ${max} sats).`);
  }

  const url = new URL(meta.callback);
  url.searchParams.set('amount', String(msats));
  if (comment && meta.commentAllowed) {
    url.searchParams.set('comment', comment.slice(0, meta.commentAllowed));
  }

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`Não foi possível gerar a fatura (HTTP ${res.status}).`);
  }
  const data = await res.json();
  if (data.status === 'ERROR') {
    throw new Error(data.reason || 'Não foi possível gerar a fatura.');
  }
  if (!data.pr) {
    throw new Error('Resposta inválida do servidor Lightning.');
  }
  return { invoice: data.pr as string, verifyUrl: (data.verify as string) ?? null };
}

/** LUD-21: checks, without authentication, whether a previously generated invoice has been paid. */
export async function isInvoiceSettled(verifyUrl: string): Promise<boolean> {
  try {
    const res = await fetch(verifyUrl);
    if (!res.ok) return false;
    const data = await res.json();
    return !!data.settled;
  } catch {
    return false;
  }
}
