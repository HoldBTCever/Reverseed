"use client";

import { useActionState } from "react";
import { saveProfileAction } from "@/app/actions/profile";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import {
  CURRENCIES,
  CURRENCY_LABELS,
  PROPERTY_TYPES,
  PROPERTY_TYPE_LABELS,
  PURPOSES,
  PURPOSE_LABELS,
  TIMELINES,
  TIMELINE_LABELS,
} from "@/lib/constants";
import type { ClientProfile } from "@/generated/prisma/client";
import {
  FieldError,
  FormError,
  FormSuccess,
  SubmitButton,
  inputClass,
  labelClass,
} from "@/components/ui/form-bits";

export function ProfileForm({
  profile,
  redirectTo,
  submitLabel,
}: {
  profile: ClientProfile | null;
  redirectTo: "/imoveis" | "/perfil";
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(
    saveProfileAction,
    INITIAL_ACTION_STATE,
  );

  const selectedTypes = profile?.propertyTypes.split(",") ?? [];

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="redirectTo" value={redirectTo} />
      <FormError message={state?.error} />
      <FormSuccess message={state?.success} />

      <fieldset>
        <legend className={labelClass}>O que você procura?</legend>
        <div className="flex flex-wrap gap-3">
          {PROPERTY_TYPES.map((type) => (
            <label
              key={type}
              className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand-light"
            >
              <input
                type="checkbox"
                name="propertyTypes"
                value={type}
                defaultChecked={selectedTypes.includes(type)}
                className="accent-brand"
              />
              {PROPERTY_TYPE_LABELS[type]}
            </label>
          ))}
        </div>
        <FieldError messages={state?.fieldErrors?.propertyTypes} />
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Finalidade</legend>
        <div className="flex flex-wrap gap-3">
          {PURPOSES.map((purpose) => (
            <label
              key={purpose}
              className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand-light"
            >
              <input
                type="radio"
                name="purpose"
                value={purpose}
                defaultChecked={
                  profile ? profile.purpose === purpose : purpose === "MORAR"
                }
                className="accent-brand"
              />
              {PURPOSE_LABELS[purpose]}
            </label>
          ))}
        </div>
        <FieldError messages={state?.fieldErrors?.purpose} />
      </fieldset>

      <fieldset>
        <legend className={labelClass}>Prazo</legend>
        <div className="flex flex-wrap gap-3">
          {TIMELINES.map((timeline) => (
            <label
              key={timeline}
              className="flex items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm has-checked:border-brand has-checked:bg-brand-light"
            >
              <input
                type="radio"
                name="timeline"
                value={timeline}
                defaultChecked={
                  profile
                    ? profile.timeline === timeline
                    : timeline === "SEM_PRAZO"
                }
                className="accent-brand"
              />
              {TIMELINE_LABELS[timeline]}
            </label>
          ))}
        </div>
        <FieldError messages={state?.fieldErrors?.timeline} />
      </fieldset>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="budgetMin" className={labelClass}>
            Orçamento mínimo
          </label>
          <input
            id="budgetMin"
            name="budgetMin"
            type="number"
            min={0}
            step="any"
            defaultValue={profile?.budgetMin ?? undefined}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.budgetMin} />
        </div>
        <div>
          <label htmlFor="budgetMax" className={labelClass}>
            Orçamento máximo
          </label>
          <input
            id="budgetMax"
            name="budgetMax"
            type="number"
            min={0}
            step="any"
            defaultValue={profile?.budgetMax ?? undefined}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.budgetMax} />
        </div>
        <div>
          <label htmlFor="currency" className={labelClass}>
            Moeda
          </label>
          <select
            id="currency"
            name="currency"
            defaultValue={profile?.currency ?? "USD"}
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
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="bedroomsMin" className={labelClass}>
            Nº mínimo de quartos (opcional)
          </label>
          <input
            id="bedroomsMin"
            name="bedroomsMin"
            type="number"
            min={0}
            defaultValue={profile?.bedroomsMin ?? undefined}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.bedroomsMin} />
        </div>
        <div>
          <label htmlFor="zone" className={labelClass}>
            Bairro/zona de preferência (opcional)
          </label>
          <input
            id="zone"
            name="zone"
            type="text"
            placeholder="Ex: Villa Morra, Carmelitas, Recoleta..."
            defaultValue={profile?.zone ?? undefined}
            className={inputClass}
          />
          <FieldError messages={state?.fieldErrors?.zone} />
        </div>
      </div>

      <div>
        <label htmlFor="notes" className={labelClass}>
          Observações (opcional)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Alguma outra preferência que devemos saber?"
          defaultValue={profile?.notes ?? undefined}
          className={inputClass}
        />
        <FieldError messages={state?.fieldErrors?.notes} />
      </div>

      <SubmitButton pending={pending} className="w-full sm:w-auto">
        {submitLabel}
      </SubmitButton>
    </form>
  );
}
