"use client";

import { useActionState } from "react";
import Link from "next/link";
import { loginAction } from "@/app/actions/auth";
import { INITIAL_ACTION_STATE } from "@/lib/action-state";
import {
  FieldError,
  FormError,
  SubmitButton,
  inputClass,
  labelClass,
} from "@/components/ui/form-bits";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(
    loginAction,
    INITIAL_ACTION_STATE,
  );

  return (
    <form action={formAction} className="space-y-4">
      {next && <input type="hidden" name="next" value={next} />}
      <FormError message={state?.error} />
      <div>
        <label htmlFor="identifier" className={labelClass}>
          E-mail ou telefone
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          autoComplete="username"
          className={inputClass}
          placeholder="voce@email.com ou +595 981 234567"
        />
        <FieldError messages={state?.fieldErrors?.identifier} />
      </div>
      <div>
        <label htmlFor="password" className={labelClass}>
          Senha
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className={inputClass}
        />
        <FieldError messages={state?.fieldErrors?.password} />
      </div>
      <SubmitButton pending={pending} className="w-full">
        Entrar
      </SubmitButton>
      <p className="text-center text-sm text-stone-500">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-brand hover:underline">
          Cadastre-se
        </Link>
      </p>
    </form>
  );
}
