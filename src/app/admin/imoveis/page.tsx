import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { togglePropertyStatusAction } from "@/app/actions/properties";
import {
  PROPERTY_TYPE_LABELS,
  formatMoney,
  type Currency,
  type PropertyType,
} from "@/lib/constants";

export default async function AdminPropertiesPage() {
  const properties = await prisma.property.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-stone-900">Imóveis</h1>
        <Link
          href="/admin/imoveis/novo"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          + Novo imóvel
        </Link>
      </div>

      {properties.length === 0 ? (
        <p className="text-stone-500">Nenhum imóvel cadastrado ainda.</p>
      ) : (
        <ul className="space-y-3">
          {properties.map((property) => (
            <li
              key={property.id}
              className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5"
            >
              <div>
                <div className="flex items-center gap-2">
                  <Link
                    href={`/admin/imoveis/${property.id}`}
                    className="font-semibold text-stone-900 hover:text-brand"
                  >
                    {property.title}
                  </Link>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      property.status === "ATIVO"
                        ? "bg-emerald-100 text-emerald-700"
                        : "bg-stone-200 text-stone-500"
                    }`}
                  >
                    {property.status === "ATIVO" ? "Ativo" : "Inativo"}
                  </span>
                </div>
                <p className="text-sm text-stone-500">
                  {PROPERTY_TYPE_LABELS[property.type as PropertyType]} ·{" "}
                  {property.zone} ·{" "}
                  {formatMoney(property.price, property.currency as Currency)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/admin/imoveis/${property.id}`}
                  className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                >
                  Editar
                </Link>
                <form action={togglePropertyStatusAction}>
                  <input type="hidden" name="propertyId" value={property.id} />
                  <button
                    type="submit"
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-600 hover:bg-stone-50"
                  >
                    {property.status === "ATIVO" ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
