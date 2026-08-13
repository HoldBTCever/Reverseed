import { convertCurrency, type Currency } from "@/lib/constants";
import type { ClientProfile, Property } from "@/generated/prisma/client";

export function scoreMatch(
  property: Property,
  profile: ClientProfile,
  rates: { usdToPyg: number; usdToBrl: number },
): number {
  let score = 0;

  const propertyTypes = profile.propertyTypes.split(",");
  if (propertyTypes.includes(property.type)) score += 2;

  if (
    profile.purpose === "AMBOS" ||
    property.suitableFor === "AMBOS" ||
    profile.purpose === property.suitableFor
  ) {
    score += 1;
  }

  if (profile.budgetMin != null || profile.budgetMax != null) {
    const priceInClientCurrency = convertCurrency(
      property.price,
      property.currency as Currency,
      profile.currency as Currency,
      rates,
    );
    const min = profile.budgetMin ?? 0;
    const max = profile.budgetMax ?? Infinity;
    if (priceInClientCurrency >= min && priceInClientCurrency <= max) {
      score += 2;
    } else {
      const margin = max === Infinity ? min * 0.2 : (max - min) * 0.2 || max * 0.2;
      if (
        priceInClientCurrency >= min - margin &&
        priceInClientCurrency <= max + margin
      ) {
        score += 1;
      }
    }
  }

  if (profile.zone) {
    const zoneNeedle = profile.zone.trim().toLowerCase();
    if (
      zoneNeedle.length > 0 &&
      property.zone.toLowerCase().includes(zoneNeedle)
    ) {
      score += 1;
    }
  }

  if (
    profile.bedroomsMin != null &&
    property.bedrooms != null &&
    property.bedrooms >= profile.bedroomsMin
  ) {
    score += 1;
  }

  return score;
}
