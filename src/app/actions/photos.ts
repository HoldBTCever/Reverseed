"use server";

import { getSession } from "@/lib/session";
import { extractPhotoUrlsFromPage, FetchPhotosError } from "@/lib/fetchPhotos";

export type FetchPhotosState = {
  error?: string;
  photos?: string[];
  sourceUrl?: string;
} | null;

export async function fetchPhotosFromUrlAction(
  _prevState: FetchPhotosState,
  formData: FormData,
): Promise<FetchPhotosState> {
  const session = await getSession();
  if (!session || session.role !== "ADMIN") {
    return { error: "Não autorizado." };
  }

  const sourceUrl = String(formData.get("sourceUrl") ?? "").trim();
  if (!sourceUrl) {
    return { error: "Cole o link do anúncio." };
  }

  try {
    const photos = await extractPhotoUrlsFromPage(sourceUrl);
    if (photos.length === 0) {
      return {
        error: "Não encontrei fotos nesse link. Tente colar os links manualmente.",
        sourceUrl,
      };
    }
    return { photos, sourceUrl };
  } catch (err) {
    if (err instanceof FetchPhotosError) {
      return { error: err.message, sourceUrl };
    }
    return { error: "Não foi possível buscar fotos desse link.", sourceUrl };
  }
}
