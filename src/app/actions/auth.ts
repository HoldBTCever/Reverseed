"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { createSession, destroySession } from "@/lib/session";
import { clientSignUpSchema, loginSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function signUpAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    password: formData.get("password"),
  };
  const parsed = clientSignUpSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { name, password } = parsed.data;
  const email = parsed.data.email || undefined;
  const phone = parsed.data.phone || undefined;

  const existing = await prisma.user.findFirst({
    where: {
      OR: [
        ...(email ? [{ email }] : []),
        ...(phone ? [{ phone }] : []),
      ],
    },
  });
  if (existing) {
    return { error: "Já existe uma conta com esse e-mail ou telefone." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: { role: "CLIENT", name, email, phone, passwordHash },
  });

  await createSession({ userId: user.id, role: "CLIENT" });
  redirect("/onboarding");
}

export async function loginAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const raw = {
    identifier: formData.get("identifier"),
    password: formData.get("password"),
  };
  const parsed = loginSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { identifier, password } = parsed.data;
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { phone: identifier }] },
    include: { clientProfile: true },
  });
  if (!user) {
    return { error: "E-mail/telefone ou senha incorretos." };
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    return { error: "E-mail/telefone ou senha incorretos." };
  }

  await createSession({
    userId: user.id,
    role: user.role as "ADMIN" | "CLIENT",
  });

  const next = formData.get("next");
  if (typeof next === "string" && next.startsWith("/")) {
    if (user.role === "ADMIN" && next.startsWith("/admin")) redirect(next);
    if (
      user.role === "CLIENT" &&
      (next.startsWith("/imoveis") ||
        next.startsWith("/perfil") ||
        next.startsWith("/onboarding"))
    ) {
      redirect(next);
    }
  }

  if (user.role === "ADMIN") redirect("/admin");
  redirect(user.clientProfile ? "/imoveis" : "/onboarding");
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
