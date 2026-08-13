export const PROPERTY_TYPES = [
  "APARTAMENTO",
  "CASA",
  "TERRENO",
  "COMERCIAL",
] as const;
export type PropertyType = (typeof PROPERTY_TYPES)[number];

export const PROPERTY_TYPE_LABELS: Record<PropertyType, string> = {
  APARTAMENTO: "Apartamento",
  CASA: "Casa",
  TERRENO: "Terreno",
  COMERCIAL: "Comercial",
};

export const PURPOSES = ["MORAR", "INVESTIR", "AMBOS"] as const;
export type Purpose = (typeof PURPOSES)[number];

export const PURPOSE_LABELS: Record<Purpose, string> = {
  MORAR: "Morar",
  INVESTIR: "Investir",
  AMBOS: "Tanto faz",
};

export const TIMELINES = [
  "PROXIMO_MES",
  "TRES_A_SEIS_MESES",
  "SEM_PRAZO",
] as const;
export type Timeline = (typeof TIMELINES)[number];

export const TIMELINE_LABELS: Record<Timeline, string> = {
  PROXIMO_MES: "Até o próximo mês",
  TRES_A_SEIS_MESES: "Nos próximos 3 a 6 meses",
  SEM_PRAZO: "Sem prazo definido",
};

export const CURRENCIES = ["USD", "PYG", "BRL"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const CURRENCY_LABELS: Record<Currency, string> = {
  USD: "Dólar (US$)",
  PYG: "Guarani (₲)",
  BRL: "Real (R$)",
};

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "US$",
  PYG: "₲",
  BRL: "R$",
};

export const PROPERTY_STATUSES = ["ATIVO", "INATIVO"] as const;
export type PropertyStatus = (typeof PROPERTY_STATUSES)[number];

export const RECOMMENDATION_STATUSES = [
  "PENDENTE",
  "INTERESSADO",
  "NAO_INTERESSADO",
  "TALVEZ",
] as const;
export type RecommendationStatus = (typeof RECOMMENDATION_STATUSES)[number];

export const RECOMMENDATION_STATUS_LABELS: Record<
  RecommendationStatus,
  string
> = {
  PENDENTE: "Aguardando feedback",
  INTERESSADO: "Interessado",
  NAO_INTERESSADO: "Não interessado",
  TALVEZ: "Talvez / ver depois",
};

export function getPhotoUrls(photos: string | null | undefined): string[] {
  if (!photos) return [];
  return photos
    .split(/[\n,]/)
    .map((url) => url.trim())
    .filter(Boolean);
}

export function formatMoney(value: number, currency: Currency): string {
  const symbol = CURRENCY_SYMBOLS[currency];
  const decimals = currency === "PYG" ? 0 : 2;
  const formatted = value.toLocaleString("pt-BR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return `${symbol} ${formatted}`;
}

export function convertCurrency(
  value: number,
  from: Currency,
  to: Currency,
  rates: { usdToPyg: number; usdToBrl: number },
): number {
  if (from === to) return value;
  const toUsd: Record<Currency, number> = {
    USD: 1,
    PYG: 1 / rates.usdToPyg,
    BRL: 1 / rates.usdToBrl,
  };
  const fromUsdRate: Record<Currency, number> = {
    USD: 1,
    PYG: rates.usdToPyg,
    BRL: rates.usdToBrl,
  };
  const usdValue = value * toUsd[from];
  return usdValue * fromUsdRate[to];
}
