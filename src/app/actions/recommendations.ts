"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { feedbackSchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

export async function submitFeedbackAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "CLIENT") {
    return { error: "Sessão expirada. Entre novamente." };
  }

  const raw = {
    recommendationId: formData.get("recommendationId"),
    status: formData.get("status"),
    feedbackNote: formData.get("feedbackNote") || undefined,
  };
  const parsed = feedbackSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: "Selecione uma opção de feedback." };
  }

  const recommendation = await prisma.recommendation.findFirst({
    where: { id: parsed.data.recommendationId, clientId: session.userId },
  });
  if (!recommendation) {
    return { error: "Imóvel não encontrado." };
  }

  await prisma.recommendation.update({
    where: { id: recommendation.id },
    data: {
      status: parsed.data.status,
      feedbackNote: parsed.data.feedbackNote || null,
      respondedAt: new Date(),
    },
  });

  revalidatePath("/imoveis");
  revalidatePath(`/admin/clientes/${session.userId}`);
  return { success: "Feedback enviado." };
}

export async function sendRecommendationAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Não autorizado." };
  }

  const clientId = String(formData.get("clientId") ?? "");
  const propertyId = String(formData.get("propertyId") ?? "");
  if (!clientId || !propertyId) {
    return { error: "Selecione um imóvel para enviar." };
  }

  const client = await prisma.user.findFirst({
    where: { id: clientId, role: "CLIENT" },
  });
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!client || !property) {
    return { error: "Cliente ou imóvel inválido." };
  }

  const existing = await prisma.recommendation.findUnique({
    where: { clientId_propertyId: { clientId, propertyId } },
  });
  if (existing) {
    return { error: "Esse imóvel já foi enviado para este cliente." };
  }

  await prisma.recommendation.create({ data: { clientId, propertyId } });

  revalidatePath(`/admin/clientes/${clientId}`);
  revalidatePath("/imoveis");
  return { success: "Imóvel enviado ao cliente." };
}
