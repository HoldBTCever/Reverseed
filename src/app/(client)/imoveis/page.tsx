import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getExchangeRates } from "@/lib/settings";
import { RecommendationCard } from "@/components/recommendations/RecommendationCard";
import {
  RECOMMENDATION_STATUS_LABELS,
  formatMoney,
  type Currency,
  type RecommendationStatus,
} from "@/lib/constants";

const STATUS_BADGE_CLASSES: Record<RecommendationStatus, string> = {
  PENDENTE: "bg-stone-100 text-stone-600",
  INTERESSADO: "bg-emerald-100 text-emerald-700",
  NAO_INTERESSADO: "bg-stone-200 text-stone-600",
  TALVEZ: "bg-amber-100 text-amber-700",
};

export default async function ImoveisPage() {
  const user = await requireClient();
  if (!user.clientProfile) {
    redirect("/onboarding");
  }

  const [pendingList, history, rates] = await Promise.all([
    prisma.recommendation.findMany({
      where: { clientId: user.id, status: "PENDENTE" },
      orderBy: { sentAt: "asc" },
      include: { property: true },
    }),
    prisma.recommendation.findMany({
      where: { clientId: user.id, NOT: { status: "PENDENTE" } },
      orderBy: { respondedAt: "desc" },
      include: { property: true },
    }),
    getExchangeRates(),
  ]);

  const current = pendingList[0];
  const clientCurrency = user.clientProfile.currency as Currency;

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Meus imóveis</h1>
        <p className="mt-1 text-stone-600">
          Veja as opções selecionadas pelo seu corretor, uma de cada vez.
        </p>
      </div>

      {current ? (
        <RecommendationCard
          recommendationId={current.id}
          property={current.property}
          clientCurrency={clientCurrency}
          rates={rates}
          pendingCountAfter={pendingList.length - 1}
        />
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white p-8 text-center">
          <p className="text-stone-600">
            Nenhum imóvel novo por enquanto. Assim que seu corretor enviar uma
            opção, ela aparece aqui.
          </p>
        </div>
      )}

      {history.length > 0 && (
        <div>
          <h2 className="mb-4 text-lg font-semibold text-stone-900">
            Histórico
          </h2>
          <ul className="space-y-3">
            {history.map((rec) => (
              <li
                key={rec.id}
                className="flex items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4"
              >
                <div>
                  <p className="font-medium text-stone-900">
                    {rec.property.title}
                  </p>
                  <p className="text-sm text-stone-500">
                    {rec.property.zone} ·{" "}
                    {formatMoney(
                      rec.property.price,
                      rec.property.currency as Currency,
                    )}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                    STATUS_BADGE_CLASSES[rec.status as RecommendationStatus]
                  }`}
                >
                  {RECOMMENDATION_STATUS_LABELS[rec.status as RecommendationStatus]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
