import "server-only";
import { prisma } from "@/lib/prisma";

export async function getExchangeRates() {
  const settings = await prisma.settings.findUnique({ where: { id: 1 } });
  return {
    usdToPyg: settings?.usdToPyg ?? 7300,
    usdToBrl: settings?.usdToBrl ?? 5.4,
  };
}
