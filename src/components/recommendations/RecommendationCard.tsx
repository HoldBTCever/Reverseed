"use client";

import { useActionState, useState } from "react";
import { submitFeedbackAction } from "@/app/actions/recommendations";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import {
  PROPERTY_TYPE_LABELS,
  convertCurrency,
  formatMoney,
  getPhotoUrls,
  type Currency,
  type PropertyType,
} from "@/lib/constants";
import { FormError, inputClass } from "@/components/ui/form-bits";
import type { Property } from "@/generated/prisma/client";

export function RecommendationCard({
  recommendationId,
  property,
  clientCurrency,
  rates,
  pendingCountAfter,
}: {
  recommendationId: string;
  property: Property;
  clientCurrency: Currency;
  rates: { usdToPyg: number; usdToBrl: number };
  pendingCountAfter: number;
}) {
  const [state, formAction, pending] = useActionState(
    submitFeedbackAction,
    INITIAL_ACTION_STATE,
  );
  const photos = getPhotoUrls(property.photos);
  const [activePhoto, setActivePhoto] = useState(0);

  const priceInPropertyCurrency = formatMoney(
    property.price,
    property.currency as Currency,
  );
  const showConverted = property.currency !== clientCurrency;
  const convertedPrice = showConverted
    ? formatMoney(
        convertCurrency(
          property.price,
          property.currency as Currency,
          clientCurrency,
          rates,
        ),
        clientCurrency,
      )
    : null;

  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
      {photos.length > 0 ? (
        <div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photos[activePhoto]}
            alt={property.title}
            className="h-72 w-full object-cover"
          />
          {photos.length > 1 && (
            <div className="flex gap-2 overflow-x-auto p-2">
              {photos.map((url, index) => (
                <button
                  key={url + index}
                  type="button"
                  onClick={() => setActivePhoto(index)}
                  className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${
                    index === activePhoto
                      ? "border-brand"
                      : "border-transparent"
                  }`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex h-48 items-center justify-center bg-stone-100 text-sm text-stone-400">
          Sem fotos disponíveis
        </div>
      )}

      <div className="space-y-4 p-6">
        <div>
          <span className="inline-block rounded-full bg-brand-light px-2.5 py-0.5 text-xs font-medium text-brand-dark">
            {PROPERTY_TYPE_LABELS[property.type as PropertyType]}
          </span>
          <h2 className="mt-2 text-xl font-bold text-stone-900">
            {property.title}
          </h2>
          <p className="text-stone-500">{property.zone}</p>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold text-brand-dark">
            {priceInPropertyCurrency}
          </span>
          {convertedPrice && (
            <span className="text-sm text-stone-500">
              (≈ {convertedPrice})
            </span>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm text-stone-600">
          {property.bedrooms != null && <span>{property.bedrooms} quartos</span>}
          {property.bathrooms != null && (
            <span>{property.bathrooms} banheiros</span>
          )}
          {property.areaM2 != null && <span>{property.areaM2} m²</span>}
        </div>

        {property.description && (
          <p className="whitespace-pre-line text-sm text-stone-700">
            {property.description}
          </p>
        )}

        <form action={formAction} className="space-y-3 border-t border-stone-100 pt-4">
          <input type="hidden" name="recommendationId" value={recommendationId} />
          <FormError message={state?.error} />
          <p className="text-sm font-medium text-stone-700">
            O que você achou deste imóvel?
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <button
              type="submit"
              name="status"
              value="INTERESSADO"
              disabled={pending}
              className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
            >
              👍 Gostei, quero saber mais
            </button>
            <button
              type="submit"
              name="status"
              value="TALVEZ"
              disabled={pending}
              className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-60"
            >
              🤔 Talvez, ver depois
            </button>
            <button
              type="submit"
              name="status"
              value="NAO_INTERESSADO"
              disabled={pending}
              className="rounded-lg border border-stone-300 bg-stone-50 px-3 py-2 text-sm font-medium text-stone-600 hover:bg-stone-100 disabled:opacity-60"
            >
              👎 Não é para mim
            </button>
          </div>
          <div>
            <label htmlFor="feedbackNote" className="sr-only">
              Comentário (opcional)
            </label>
            <input
              id="feedbackNote"
              name="feedbackNote"
              type="text"
              placeholder="Quer contar algo mais? (opcional)"
              className={inputClass}
            />
          </div>
        </form>

        {pendingCountAfter > 0 && (
          <p className="text-center text-xs text-stone-400">
            Dê seu feedback para ver o próximo imóvel ({pendingCountAfter}{" "}
            aguardando)
          </p>
        )}
      </div>
    </div>
  );
}
