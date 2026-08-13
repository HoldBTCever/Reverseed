"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { ratesSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function updateRatesAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Não autorizado." };
  }

  const parsed = ratesSchema.safeParse({
    usdToPyg: formData.get("usdToPyg"),
    usdToBrl: formData.get("usdToBrl"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.settings.upsert({
    where: { id: 1 },
    update: parsed.data,
    create: { id: 1, ...parsed.data },
  });

  revalidatePath("/admin/config");
  revalidatePath("/imoveis");
  return { success: "Cotações atualizadas." };
}
