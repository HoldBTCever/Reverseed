"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { propertySchema } from "@/lib/validation";
import type { ActionState } from "@/lib/action-state";

function emptyToUndefined(value: FormDataEntryValue | null) {
  if (value === null) return undefined;
  const str = String(value).trim();
  return str === "" ? undefined : str;
}

function parsePropertyForm(formData: FormData) {
  return propertySchema.safeParse({
    title: formData.get("title"),
    description: emptyToUndefined(formData.get("description")),
    type: formData.get("type"),
    suitableFor: formData.get("suitableFor"),
    price: formData.get("price"),
    currency: formData.get("currency"),
    zone: formData.get("zone"),
    bedrooms: emptyToUndefined(formData.get("bedrooms")),
    bathrooms: emptyToUndefined(formData.get("bathrooms")),
    areaM2: emptyToUndefined(formData.get("areaM2")),
    photos: emptyToUndefined(formData.get("photos")),
  });
}

export async function createPropertyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Não autorizado." };
  }

  const parsed = parsePropertyForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const property = await prisma.property.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      suitableFor: parsed.data.suitableFor,
      price: parsed.data.price,
      currency: parsed.data.currency,
      zone: parsed.data.zone,
      bedrooms: parsed.data.bedrooms ?? null,
      bathrooms: parsed.data.bathrooms ?? null,
      areaM2: parsed.data.areaM2 ?? null,
      photos: parsed.data.photos ?? null,
    },
  });

  revalidatePath("/admin/imoveis");
  redirect(`/admin/imoveis/${property.id}`);
}

export async function updatePropertyAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Não autorizado." };
  }

  const propertyId = String(formData.get("propertyId") ?? "");
  const existing = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!existing) {
    return { error: "Imóvel não encontrado." };
  }

  const parsed = parsePropertyForm(formData);
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  await prisma.property.update({
    where: { id: propertyId },
    data: {
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      type: parsed.data.type,
      suitableFor: parsed.data.suitableFor,
      price: parsed.data.price,
      currency: parsed.data.currency,
      zone: parsed.data.zone,
      bedrooms: parsed.data.bedrooms ?? null,
      bathrooms: parsed.data.bathrooms ?? null,
      areaM2: parsed.data.areaM2 ?? null,
      photos: parsed.data.photos ?? null,
    },
  });

  revalidatePath("/admin/imoveis");
  revalidatePath(`/admin/imoveis/${propertyId}`);
  return { success: "Imóvel atualizado." };
}

export async function togglePropertyStatusAction(formData: FormData) {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") return;

  const propertyId = String(formData.get("propertyId") ?? "");
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
  });
  if (!property) return;

  await prisma.property.update({
    where: { id: propertyId },
    data: { status: property.status === "ATIVO" ? "INATIVO" : "ATIVO" },
  });

  revalidatePath("/admin/imoveis");
  revalidatePath(`/admin/imoveis/${propertyId}`);
}
