import { decode } from 'light-bolt11-decoder';

export interface DecodedInvoice {
  amountSats: number;
  description: string;
  paymentHash: string;
  expiryUnix: number;
}

function sectionValue(sections: { name: string; value?: unknown }[], name: string): unknown {
  return sections.find((s) => s.name === name)?.value;
}

export function decodeBolt11(invoice: string): DecodedInvoice {
  const trimmed = invoice.trim();
  if (!/^ln(bc|tb)[a-z0-9]+$/i.test(trimmed)) {
    throw new Error('Isso não parece uma fatura Lightning (BOLT11) válida.');
  }

  let decoded: ReturnType<typeof decode>;
  try {
    decoded = decode(trimmed);
  } catch {
    throw new Error('Não foi possível ler essa fatura Lightning.');
  }

  const amountMsat = sectionValue(decoded.sections, 'amount') as string | undefined;
  const paymentHash = sectionValue(decoded.sections, 'payment_hash') as string | undefined;
  const timestamp = sectionValue(decoded.sections, 'timestamp') as number | undefined;

  if (!amountMsat || !paymentHash) {
    throw new Error('Essa fatura não tem um valor definido — não é possível alimentar com ela.');
  }

  return {
    amountSats: Math.floor(Number(amountMsat) / 1000),
    description: (sectionValue(decoded.sections, 'description') as string | undefined) ?? '',
    paymentHash,
    expiryUnix: (timestamp ?? 0) + decoded.expiry,
  };
}

export function isValidBolt11(invoice: string): boolean {
  try {
    decodeBolt11(invoice);
    return true;
  } catch {
    return false;
  }
}
