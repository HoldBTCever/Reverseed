"use client";

import { useActionState } from "react";
import { sendRecommendationAction } from "@/app/actions/recommendations";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import { FormError, FormSuccess } from "@/components/ui/form-bits";
import {
  PROPERTY_TYPE_LABELS,
  formatMoney,
  type Currency,
  type PropertyType,
} from "@/lib/constants";
import type { Property } from "@/generated/prisma/client";

export function SendPropertyList({
  clientId,
  properties,
  matches,
}: {
  clientId: string;
  properties: Property[];
  matches: Set<string>;
}) {
  const [state, formAction, pending] = useActionState(
    sendRecommendationAction,
    INITIAL_ACTION_STATE,
  );

  if (properties.length === 0) {
    return (
      <p className="text-sm text-stone-500">
        Todos os imóveis ativos já foram enviados para este cliente.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <FormError message={state?.error} />
      <FormSuccess message={state?.success} />
      <ul className="space-y-2">
        {properties.map((property) => (
          <li
            key={property.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-stone-200 bg-white p-4"
          >
            <div>
              <div className="flex items-center gap-2">
                <p className="font-medium text-stone-900">{property.title}</p>
                {matches.has(property.id) && (
                  <span className="rounded-full bg-brand-light px-2 py-0.5 text-xs font-medium text-brand-dark">
                    Compatível
                  </span>
                )}
              </div>
              <p className="text-sm text-stone-500">
                {PROPERTY_TYPE_LABELS[property.type as PropertyType]} ·{" "}
                {property.zone} ·{" "}
                {formatMoney(property.price, property.currency as Currency)}
              </p>
            </div>
            <form action={formAction}>
              <input type="hidden" name="clientId" value={clientId} />
              <input type="hidden" name="propertyId" value={property.id} />
              <button
                type="submit"
                disabled={pending}
                className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
              >
                Enviar
              </button>
            </form>
          </li>
        ))}
      </ul>
    </div>
  );
}
