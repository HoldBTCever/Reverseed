"use client";

import { useActionState } from "react";
import Link from "next/link";
import { signUpAction } from "@/app/actions/auth";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import {
  FieldError,
  FormError,
  SubmitButton,
  inputClass,
  labelClass,
} from "@/components/ui/form-bits";

export function SignUpForm() {
  const [state, formAction, pending] = useActionState(
    signUpAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state?.error} />
      <div>
        <label htmlFor="name" className={labelClass}>
          Nome completo
        </label>
        <input id="name" name="name" type="text" className={inputClass} />
        <FieldError messages={state?.fieldErrors?.name} />
      </div>
      <div>
        <label htmlFor="email" className={labelClass}>
          E-mail
        </label>
        <input id="email" name="email" type="email" className={inputClass} />
        <FieldError messages={state?.fieldErrors?.email} />
      </div>
      <div>
        <label htmlFor="phone" className={labelClass}>
          Telefone / WhatsApp
        </label>
        <input
          id="phone"
          name="phone"
          type="tel"
          placeholder="+595 981 234567"
          className={inputClass}
        />
        <FieldError messages={state?.fieldErrors?.phone} />
      </div>
      <p className="text-xs text-stone-500">
        Preencha ao menos um dos dois campos acima (e-mail ou telefone).
      </p>
      <div>
        <label htmlFor="password" className={labelClass}>
          Crie uma senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          className={inputClass}
        />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>
      <SubmitButton pending={pending} className="w-full">
        Criar conta
      </SubmitButton>
      <p className="text-center text-sm text-stone-500">
        Já tem conta?{" "}
        <Link href="/entrar" className="font-medium text-brand hover:underline">
          Entrar
        </Link>
      </p>
    </form>
  );
}
