"use client";

import { startTransition, useActionState, useState } from "react";
import { fetchPhotosFromUrlAction } from "@/app/actions/photos";
import { FormError, inputClass, labelClass } from "@/components/ui/form-bits";

function PhotoResults({
  photos,
  onAddPhotos,
}: {
  photos: string[];
  onAddPhotos: (urls: string[]) => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(photos));

  function toggle(url: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  }

  return (
    <div className="mt-4">
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
        {photos.map((url) => (
          <label
            key={url}
            className={`relative block cursor-pointer overflow-hidden rounded-lg border-2 ${
              selected.has(url) ? "border-brand" : "border-transparent"
            }`}
          >
            <input
              type="checkbox"
              className="absolute right-1 top-1 z-10 accent-brand"
              checked={selected.has(url)}
              onChange={() => toggle(url)}
            />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={url}
              alt=""
              className="h-20 w-full bg-stone-200 object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </label>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onAddPhotos([...selected])}
        disabled={selected.size === 0}
        className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        Adicionar {selected.size} foto{selected.size === 1 ? "" : "s"}{" "}
        selecionada{selected.size === 1 ? "" : "s"}
      </button>
    </div>
  );
}

export function PhotoFetcher({
  onAddPhotos,
}: {
  onAddPhotos: (urls: string[]) => void;
}) {
  const [state, formAction, pending] = useActionState(
    fetchPhotosFromUrlAction,
    null,
  );
  const [sourceUrl, setSourceUrl] = useState("");

  function handleSearch() {
    const fd = new FormData();
    fd.set("sourceUrl", sourceUrl);
    startTransition(() => formAction(fd));
  }

  return (
    <div className="rounded-xl border border-dashed border-stone-300 bg-stone-50 p-4">
      <p className={labelClass}>Puxar fotos de um link de anúncio</p>
      <p className="mb-3 text-xs text-stone-500">
        Cole o link da página onde o imóvel já está anunciado (portal
        imobiliário, por exemplo) e eu busco as fotos automaticamente. Funciona
        melhor com páginas públicas comuns — sites como Facebook/Instagram
        costumam bloquear esse tipo de busca.
      </p>
      {/* Not a <form>: this component is rendered inside PropertyForm's own
          <form>, and HTML does not allow nested forms. */}
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="https://..."
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleSearch();
            }
          }}
          className={`${inputClass} flex-1 min-w-[200px]`}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={pending}
          className="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100 disabled:opacity-60"
        >
          {pending ? "Buscando..." : "Buscar fotos"}
        </button>
      </div>
      <div className="mt-3">
        <FormError message={state?.error} />
      </div>

      {state?.photos && state.photos.length > 0 && (
        <PhotoResults
          key={state.photos.join("|")}
          photos={state.photos}
          onAddPhotos={onAddPhotos}
        />
      )}
    </div>
  );
}
