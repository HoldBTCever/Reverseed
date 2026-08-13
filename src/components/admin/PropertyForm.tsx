"use client";

import { useActionState } from "react";
import {
  createPropertyAction,
  updatePropertyAction,
} from "@/app/actions/properties";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PURPOSES,
  PURPOSE_LABELS,
} from "@/lib/constants";
import type { Property } from "@/generated/prisma/client";
import {
  FieldError,
  FormError,
  FormSuccess,
  SubmitButton,
  inputClass,
  labelClass,
} from "@/components/ui/form-bits";

export function PropertyForm({ property }: { property?: Property }) {
  const action = property ? updatePropertyAction : createPropertyAction;
  const [state, formAction, pending] = useActionState(
    action,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="space-y-5">
      {property && (
        <input type="hidden" name="propertyId" value={property.id} />
      )}
      <FormError message={state?.error} />
      <FormSuccess message={state?.success} />

      <div>
        <label htmlFor="title" className={labelClass}>
          Título
        </label>
        <input
          id="title"
          name="title"
          type="text"
          defaultValue={property?.title}
          placeholder="Ex: Apartamento 3 quartos com vista, Villa Morra"
          className={inputClass}
        />
        <FieldError messages={state?.fieldErrors?.title} />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="type" className={labelClass}>
            Tipo
          </label>
          <select
            id="type"
            name="type"
            defaultValue={property?.type ?? PROPERTY_TYPES[0]}
            className={inputClass}
          >
            {PROPERTY_TYPES.map((type) => (
              <option key={type} value={type}>
                {PROPERTY_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
          <FieldError messages={state?.fieldErrors?.type} />
        </div>
        <div>
          <label htmlFor="suitableFor" className={labelClass}>
            Indicado para
          </label>
          <select
            id="suitableFor"
            name="suitableFor"
            defaultValue={property?.suitableFor ?? "AMBOS"}
            className={inputClass}
          >
            {PURPOSES.map((purpose) => (
              <option key={purpose} value={purpose}>
                {PURPOSE_LABELS[purpose]}
              </option>
            ))}
          </select>
          <FieldError messages={state?.fieldErrors?.suitableFor} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="price" className={labelClass}>
            Preço
          </label>
          <input
            id="price"
            name="price"
            type="number"
            min={0}
            step="any"
            defaultValue={property?.price}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.price} />
        </div>
        <div>
          <label htmlFor="currency" className={labelClass}>
            Moeda
          </label>
          <select
            id="currency"
            name="currency"
            defaultValue={property?.currency ?? "USD"}
            className={inputClass}
          >
            {CURRENCIES.map((currency) => (
              <option key={currency} value={currency}>
                {CURRENCY_LABELS[currency]}
              </option>
            ))}
          </select>
          <FieldError messages={state?.fieldErrors?.currency} />
        </div>
        <div>
          <label htmlFor="zone" className={labelClass}>
            Bairro/zona
          </label>
          <input
            id="zone"
            name="zone"
            type="text"
            defaultValue={property?.zone}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.zone} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="bedrooms" className={labelClass}>
            Quartos
          </label>
          <input
            id="bedrooms"
            name="bedrooms"
            type="number"
            min={0}
            defaultValue={property?.bedrooms ?? undefined}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.bedrooms} />
        </div>
        <div>
          <label htmlFor="bathrooms" className={labelClass}>
            Banheiros
          </label>
          <input
            id="bathrooms"
            name="bathrooms"
            type="number"
            min={0}
            defaultValue={property?.bathrooms ?? undefined}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.bathrooms} />
        </div>
        <div>
          <label htmlFor="areaM2" className={labelClass}>
            Área (m²)
          </label>
          <input
            id="areaM2"
            name="areaM2"
            type="number"
            min={0}
            step="any"
            defaultValue={property?.areaM2 ?? undefined}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.areaM2} />
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          Descrição
        </label>
        <textarea
          id="description"
          name="description"
          rows={4}
          defaultValue={property?.description ?? undefined}
          className={inputClass}
        />
        <FieldError messages={state?.fieldErrors?.description} />
      </div>

      <div>
        <label htmlFor="photos" className={labelClass}>
          Fotos (uma URL por linha)
        </label>
        <textarea
          id="photos"
          name="photos"
          rows={4}
          placeholder={"https://...\nhttps://..."}
          defaultValue={property?.photos ?? undefined}
          className={inputClass}
        />
        <p className="mt-1 text-xs text-stone-500">
          Cole links de fotos já hospedadas (Google Fotos, Drive público,
          Imgur, etc). A primeira URL vira a foto principal.
        </p>
        <FieldError messages={state?.fieldErrors?.photos} />
      </div>

      <SubmitButton pending={pending}>
        {property ? "Salvar alterações" : "Cadastrar imóvel"}
      </SubmitButton>
    </form>
  );
}
