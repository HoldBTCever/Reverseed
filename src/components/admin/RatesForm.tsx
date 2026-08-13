"use client";

import { useActionState } from "react";
import { updateRatesAction } from "@/app/actions/settings";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import {
  FieldError,
  FormError,
  FormSuccess,
  SubmitButton,
  inputClass,
  labelClass,
} from "@/components/ui/form-bits";

export function RatesForm({
  usdToPyg,
  usdToBrl,
}: {
  usdToPyg: number;
  usdToBrl: number;
}) {
  const [state, formAction, pending] = useActionState(
    updateRatesAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="max-w-sm space-y-4">
      <FormError message={state?.error} />
      <FormSuccess message={state?.success} />
      <div>
        <label htmlFor="usdToPyg" className={labelClass}>
          1 US$ equivale a quantos ₲ (Guaranis)?
        </label>
        <input
          id="usdToPyg"
          name="usdToPyg"
          type="number"
          min={0}
          step="any"
          defaultValue={usdToPyg}
          className={inputClass}
        />
        <FieldError messages={state?.fieldErrors?.usdToPyg} />
      </div>
      <div>
        <label htmlFor="usdToBrl" className={labelClass}>
          1 US$ equivale a quantos R$ (Reais)?
        </label>
        <input
          id="usdToBrl"
          name="usdToBrl"
          type="number"
          min={0}
          step="any"
          defaultValue={usdToBrl}
          className={inputClass}
        />
        <FieldError messages={state?.fieldErrors?.usdToBrl} />
      </div>
      <SubmitButton pending={pending}>Salvar cotações</SubmitButton>
    </form>
  );
}
