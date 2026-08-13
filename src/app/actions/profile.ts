"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { profileSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (value === null) return undefined;
  const str = String(value).trim();
  return str === "" ? undefined : str;
}

export async function saveProfileAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "CLIENT") {
    return { error: "Sessão expirada. Entre novamente." };
  }

  const raw = {
    propertyTypes: formData.getAll("propertyTypes"),
    purpose: formData.get("purpose"),
    timeline: formData.get("timeline"),
    budgetMin: emptyToUndefined(formData.get("budgetMin")),
    budgetMax: emptyToUndefined(formData.get("budgetMax")),
    currency: formData.get("currency"),
    bedroomsMin: emptyToUndefined(formData.get("bedroomsMin")),
    zone: emptyToUndefined(formData.get("zone")),
    notes: emptyToUndefined(formData.get("notes")),
  };

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const data = {
    propertyTypes: parsed.data.propertyTypes.join(","),
    purpose: parsed.data.purpose,
    timeline: parsed.data.timeline,
    budgetMin: parsed.data.budgetMin ?? null,
    budgetMax: parsed.data.budgetMax ?? null,
    currency: parsed.data.currency,
    bedroomsMin: parsed.data.bedroomsMin ?? null,
    zone: parsed.data.zone ?? null,
    notes: parsed.data.notes ?? null,
  };

  await prisma.clientProfile.upsert({
    where: { userId: session.userId },
    update: data,
    create: { userId: session.userId, ...data },
  });

  const redirectTo = formData.get("redirectTo");
  revalidatePath("/perfil");
  revalidatePath("/imoveis");
  revalidatePath("/admin");

  if (redirectTo === "/imoveis") {
    redirect("/imoveis");
  }

  return { success: "Preferências atualizadas com sucesso." };
}
