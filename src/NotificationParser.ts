import {CardInfo, RawNotification, Transaction, TransactionType} from './types';

// Known Brazilian bank package names mapped to card info
export const KNOWN_CARDS: Record<string, CardInfo> = {
  'com.nu.production': {
    name: 'Nubank',
    packageName: 'com.nu.production',
    color: '#8A05BE',
    icon: 'credit-card',
  },
  'com.itau.creditcard.activity': {
    name: 'Itaú',
    packageName: 'com.itau.creditcard.activity',
    color: '#FF6600',
    icon: 'credit-card',
  },
  'br.com.itau.internet': {
    name: 'Itaú',
    packageName: 'br.com.itau.internet',
    color: '#FF6600',
    icon: 'credit-card',
  },
  'com.bradesco': {
    name: 'Bradesco',
    packageName: 'com.bradesco',
    color: '#CC0000',
    icon: 'credit-card',
  },
  'br.com.bradesco.next': {
    name: 'Next',
    packageName: 'br.com.bradesco.next',
    color: '#00B900',
    icon: 'credit-card',
  },
  'br.com.intermedium': {
    name: 'Banco Inter',
    packageName: 'br.com.intermedium',
    color: '#FF6500',
    icon: 'credit-card',
  },
  'com.c6bank.app': {
    name: 'C6 Bank',
    packageName: 'com.c6bank.app',
    color: '#242424',
    icon: 'credit-card',
  },
  'com.santander.app': {
    name: 'Santander',
    packageName: 'com.santander.app',
    color: '#EC0000',
    icon: 'credit-card',
  },
  'br.com.bb.android': {
    name: 'Banco do Brasil',
    packageName: 'br.com.bb.android',
    color: '#FFD100',
    icon: 'credit-card',
  },
  'br.gov.caixa.internet': {
    name: 'Caixa',
    packageName: 'br.gov.caixa.internet',
    color: '#005CA9',
    icon: 'credit-card',
  },
  'com.picpay': {
    name: 'PicPay',
    packageName: 'com.picpay',
    color: '#11C76F',
    icon: 'credit-card',
  },
  'br.com.uol.ps.myaccount': {
    name: 'PagBank',
    packageName: 'br.com.uol.ps.myaccount',
    color: '#03C24A',
    icon: 'credit-card',
  },
  'com.xpi.app': {
    name: 'XP',
    packageName: 'com.xpi.app',
    color: '#000000',
    icon: 'credit-card',
  },
  'br.com.meliuz': {
    name: 'Méliuz',
    packageName: 'br.com.meliuz',
    color: '#FF5000',
    icon: 'credit-card',
  },
  'com.neon.bank.android.prd': {
    name: 'Neon',
    packageName: 'com.neon.bank.android.prd',
    color: '#00D4FF',
    icon: 'credit-card',
  },
  'br.com.sicoob.mobile': {
    name: 'Sicoob',
    packageName: 'br.com.sicoob.mobile',
    color: '#007A3E',
    icon: 'credit-card',
  },
  'br.com.sicredi': {
    name: 'Sicredi',
    packageName: 'br.com.sicredi',
    color: '#009C3B',
    icon: 'credit-card',
  },
  'com.Ame': {
    name: 'Ame Digital',
    packageName: 'com.Ame',
    color: '#E60014',
    icon: 'credit-card',
  },
  'com.mercadopago.wallet': {
    name: 'Mercado Pago',
    packageName: 'com.mercadopago.wallet',
    color: '#009EE3',
    icon: 'credit-card',
  },
};

// Regex to extract BRL amount from notification text
const AMOUNT_REGEXES = [
  /R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
  /R\$\s*(\d+,\d{2})/i,
  /R\$\s*(\d+)/i,
  /valor[:\s]+R\$\s*(\d{1,3}(?:\.\d{3})*,\d{2})/i,
];

// Regex to extract merchant/description from notification text
const DESCRIPTION_REGEXES = [
  /(?:em|no|na|para|loja[:\s]+)\s+([A-Z][A-Z0-9\s\*\.\-\_\/]{2,40}?)(?:\s+(?:em|no|na|\d|R\$)|$)/i,
  /compra\s+(?:de\s+R\$[^em]+em|no crédito\s+de\s+R\$[^em]+em)\s+(.+?)(?:\s*\.|$)/i,
  /(?:aprovad[oa]|realiz[ao]d[oa])\s+(?:em|na|no)\s+(.+?)(?:\s*\.|$)/i,
  /:\s*(.{3,50}?)\s*[-–]\s*R\$/i,
];

const TRANSACTION_KEYWORDS = [
  'compra',
  'pagamento',
  'débito',
  'crédito',
  'transação',
  'transferência',
  'pix',
  'purchase',
  'aprovad',
  'realiz',
  'lançamento',
  'R$',
];

const PIX_KEYWORDS = ['pix', 'transferência pix', 'transferencia pix'];
const DEBIT_KEYWORDS = ['débito', 'debito', 'conta corrente', 'débito em conta'];
const CREDIT_KEYWORDS = ['crédito', 'credito', 'cartão de crédito'];

function parseAmount(text: string): number | null {
  for (const regex of AMOUNT_REGEXES) {
    const match = text.match(regex);
    if (match) {
      const raw = match[1]
        .replace(/\./g, '')  // remove thousand separators
        .replace(',', '.');   // decimal point
      const value = parseFloat(raw);
      if (!isNaN(value) && value > 0) {
        return value;
      }
    }
  }
  return null;
}

function parseDescription(text: string, title: string): string {
  const fullText = `${title} ${text}`;

  for (const regex of DESCRIPTION_REGEXES) {
    const match = fullText.match(regex);
    if (match && match[1]) {
      return match[1].trim().replace(/\s+/g, ' ');
    }
  }

  // Fallback: clean up the text
  return text
    .replace(/R\$\s*[\d.,]+/g, '')
    .replace(/compra\s+(?:no\s+crédito|no\s+débito|aprovada)/gi, '')
    .trim()
    .substring(0, 60) || title;
}

function detectTransactionType(text: string, title: string): TransactionType {
  const combined = `${title} ${text}`.toLowerCase();

  if (PIX_KEYWORDS.some(k => combined.includes(k))) {
    return 'pix';
  }
  if (DEBIT_KEYWORDS.some(k => combined.includes(k))) {
    return 'debit';
  }
  if (CREDIT_KEYWORDS.some(k => combined.includes(k))) {
    return 'credit';
  }
  return 'unknown';
}

function isCardNotification(notification: RawNotification): boolean {
  // Check if package is a known bank
  if (KNOWN_CARDS[notification.packageName]) {
    return true;
  }

  // Check if package name looks like a bank/fintech
  const bankPatterns = [
    /bank/i, /pay/i, /wallet/i, /credit/i, /finance/i,
    /nubank/i, /itau/i, /bradesco/i, /santander/i,
  ];
  if (bankPatterns.some(p => p.test(notification.packageName))) {
    return true;
  }

  // Check notification content for transaction keywords
  const combined = `${notification.title} ${notification.text}`.toLowerCase();
  const keywordMatches = TRANSACTION_KEYWORDS.filter(k =>
    combined.includes(k.toLowerCase()),
  ).length;

  return keywordMatches >= 2 && combined.includes('r$');
}

export function parseNotification(
  notification: RawNotification,
): Transaction | null {
  if (!isCardNotification(notification)) {
    return null;
  }

  const amount = parseAmount(`${notification.title} ${notification.text}`);
  if (amount === null) {
    return null;
  }

  const cardInfo = KNOWN_CARDS[notification.packageName] ?? {
    name: notification.title.split(':')[0]?.trim() ?? notification.packageName,
    packageName: notification.packageName,
    color: '#607D8B',
    icon: 'credit-card',
  };

  const description = parseDescription(notification.text, notification.title);
  const type = detectTransactionType(notification.text, notification.title);

  return {
    id: `${notification.packageName}-${notification.postTime}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    cardName: cardInfo.name,
    cardPackage: notification.packageName,
    cardColor: cardInfo.color,
    amount,
    description,
    type,
    timestamp: notification.postTime,
    rawTitle: notification.title,
    rawText: notification.text,
    synced: false,
  };
}
