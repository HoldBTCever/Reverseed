import Link from "next/link";
import { prisma } from "@/lib/prisma";
import {
  CURRENCY_LABELS,
  PROPERTY_TYPE_LABELS,
  PURPOSE_LABELS,
  TIMELINE_LABELS,
  type Currency,
  type Purpose,
  type PropertyType,
  type Timeline,
} from "@/lib/constants";

export default async function AdminDashboardPage({
  searchParams,
}: PageProps<"/admin">) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim() : "";

  const clients = await prisma.user.findMany({
    where: {
      role: "CLIENT",
      ...(q
        ? {
            OR: [
              { name: { contains: q } },
              { email: { contains: q } },
              { phone: { contains: q } },
            ],
          }
        : {}),
    },
    include: { clientProfile: true, recommendations: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-stone-900">Clientes</h1>
        <form className="flex gap-2">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Buscar por nome, e-mail ou telefone"
            className="w-64 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm focus:border-brand focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-lg border border-stone-300 px-3 py-2 text-sm text-stone-600 hover:bg-white"
          >
            Buscar
          </button>
        </form>
      </div>

      {clients.length === 0 ? (
        <p className="text-stone-500">Nenhum cliente encontrado.</p>
      ) : (
        <ul className="space-y-3">
          {clients.map((client) => {
            const total = client.recommendations.length;
            const pending = client.recommendations.filter(
              (r) => r.status === "PENDENTE",
            ).length;
            const interested = client.recommendations.filter(
              (r) => r.status === "INTERESSADO",
            ).length;

            return (
              <li key={client.id}>
                <Link
                  href={`/admin/clientes/${client.id}`}
                  className="block rounded-xl border border-stone-200 bg-white p-5 transition hover:border-brand hover:shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-stone-900">
                        {client.name}
                      </p>
                      <p className="text-sm text-stone-500">
                        {[client.email, client.phone]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                    </div>
                    <div className="flex gap-2 text-xs">
                      <span className="rounded-full bg-stone-100 px-2.5 py-1 text-stone-600">
                        {total} enviados
                      </span>
                      {pending > 0 && (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-700">
                          {pending} aguardando feedback
                        </span>
                      )}
                      {interested > 0 && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-emerald-700">
                          {interested} interessado
                        </span>
                      )}
                    </div>
                  </div>

                  {client.clientProfile ? (
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
                      <span>
                        {client.clientProfile.propertyTypes
                          .split(",")
                          .map((t) => PROPERTY_TYPE_LABELS[t as PropertyType])
                          .join(" ou ")}
                      </span>
                      <span>
                        {PURPOSE_LABELS[client.clientProfile.purpose as Purpose]}
                      </span>
                      <span>
                        {TIMELINE_LABELS[client.clientProfile.timeline as Timeline]}
                      </span>
                      {(client.clientProfile.budgetMin ||
                        client.clientProfile.budgetMax) && (
                        <span>
                          {client.clientProfile.budgetMin ?? "0"} –{" "}
                          {client.clientProfile.budgetMax ?? "?"}{" "}
                          {
                            CURRENCY_LABELS[
                              client.clientProfile.currency as Currency
                            ]
                          }
                        </span>
                      )}
                      {client.clientProfile.zone && (
                        <span>{client.clientProfile.zone}</span>
                      )}
                    </div>
                  ) : (
                    <p className="mt-3 text-sm italic text-stone-400">
                      Ainda não preencheu as preferências
                    </p>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
