import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getExchangeRates } from "@/lib/settings";
import { scoreMatch } from "@/lib/matching";
import { SendPropertyList } from "@/components/admin/SendPropertyList";
import {
  CURRENCY_LABELS,
  PROPERTY_TYPE_LABELS,
  PURPOSE_LABELS,
  RECOMMENDATION_STATUS_LABELS,
  TIMELINE_LABELS,
  formatMoney,
  type Currency,
  type Purpose,
  type PropertyType,
  type RecommendationStatus,
  type Timeline,
} from "@/lib/constants";

const STATUS_BADGE_CLASSES: Record<RecommendationStatus, string> = {
  PENDENTE: "bg-stone-100 text-stone-600",
  INTERESSADO: "bg-emerald-100 text-emerald-700",
  NAO_INTERESSADO: "bg-stone-200 text-stone-600",
  TALVEZ: "bg-amber-100 text-amber-700",
};

export default async function ClienteDetalhePage(
  props: PageProps<"/admin/clientes/[id]">,
) {
  const { id } = await props.params;

  const client = await prisma.user.findFirst({
    where: { id, role: "CLIENT" },
    include: { clientProfile: true },
  });
  if (!client) notFound();

  const [recommendations, activeProperties, rates] = await Promise.all([
    prisma.recommendation.findMany({
      where: { clientId: client.id },
      orderBy: { sentAt: "desc" },
      include: { property: true },
    }),
    prisma.property.findMany({
      where: { status: "ATIVO" },
      orderBy: { createdAt: "desc" },
    }),
    getExchangeRates(),
  ]);

  const sentPropertyIds = new Set(recommendations.map((r) => r.propertyId));
  const availableProperties = activeProperties.filter(
    (p) => !sentPropertyIds.has(p.id),
  );

  const matches = new Set<string>();
  if (client.clientProfile) {
    for (const property of availableProperties) {
      if (scoreMatch(property, client.clientProfile, rates) >= 3) {
        matches.add(property.id);
      }
    }
  }
  const sortedAvailable = [...availableProperties].sort((a, b) => {
    const aMatch = matches.has(a.id) ? 1 : 0;
    const bMatch = matches.has(b.id) ? 1 : 0;
    return bMatch - aMatch;
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">{client.name}</h1>
        <p className="text-stone-500">
          {[client.email, client.phone].filter(Boolean).join(" · ")}
        </p>
      </div>

      <section className="rounded-xl border border-stone-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-stone-900">Preferências</h2>
        {client.clientProfile ? (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-stone-500">Tipo de imóvel</dt>
              <dd className="text-stone-900">
                {client.clientProfile.propertyTypes
                  .split(",")
                  .map((t) => PROPERTY_TYPE_LABELS[t as PropertyType])
                  .join(", ")}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Finalidade</dt>
              <dd className="text-stone-900">
                {PURPOSE_LABELS[client.clientProfile.purpose as Purpose]}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Prazo</dt>
              <dd className="text-stone-900">
                {TIMELINE_LABELS[client.clientProfile.timeline as Timeline]}
              </dd>
            </div>
            <div>
              <dt className="text-stone-500">Orçamento</dt>
              <dd className="text-stone-900">
                {client.clientProfile.budgetMin != null
                  ? formatMoney(
                      client.clientProfile.budgetMin,
                      client.clientProfile.currency as Currency,
                    )
                  : "?"}{" "}
                –{" "}
                {client.clientProfile.budgetMax != null
                  ? formatMoney(
                      client.clientProfile.budgetMax,
                      client.clientProfile.currency as Currency,
                    )
                  : "?"}{" "}
                (
                {CURRENCY_LABELS[client.clientProfile.currency as Currency]})
              </dd>
            </div>
            {client.clientProfile.bedroomsMin != null && (
              <div>
                <dt className="text-stone-500">Quartos (mínimo)</dt>
                <dd className="text-stone-900">
                  {client.clientProfile.bedroomsMin}
                </dd>
              </div>
            )}
            {client.clientProfile.zone && (
              <div>
                <dt className="text-stone-500">Zona de preferência</dt>
                <dd className="text-stone-900">{client.clientProfile.zone}</dd>
              </div>
            )}
            {client.clientProfile.notes && (
              <div className="sm:col-span-2">
                <dt className="text-stone-500">Observações</dt>
                <dd className="whitespace-pre-line text-stone-900">
                  {client.clientProfile.notes}
                </dd>
              </div>
            )}
          </dl>
        ) : (
          <p className="text-sm italic text-stone-400">
            Este cliente ainda não preencheu o formulário de preferências.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-stone-900">
          Enviar novo imóvel
        </h2>
        <SendPropertyList
          clientId={client.id}
          properties={sortedAvailable}
          matches={matches}
        />
      </section>

      <section>
        <h2 className="mb-3 font-semibold text-stone-900">
          Imóveis enviados ({recommendations.length})
        </h2>
        {recommendations.length === 0 ? (
          <p className="text-sm text-stone-500">Nenhum imóvel enviado ainda.</p>
        ) : (
          <ul className="space-y-2">
            {recommendations.map((rec) => (
              <li
                key={rec.id}
                className="rounded-lg border border-stone-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
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
                    className={`rounded-full px-3 py-1 text-xs font-medium ${
                      STATUS_BADGE_CLASSES[rec.status as RecommendationStatus]
                    }`}
                  >
                    {
                      RECOMMENDATION_STATUS_LABELS[
                        rec.status as RecommendationStatus
                      ]
                    }
                  </span>
                </div>
                {rec.feedbackNote && (
                  <p className="mt-2 text-sm italic text-stone-600">
                    “{rec.feedbackNote}”
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
