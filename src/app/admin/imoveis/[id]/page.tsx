import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PropertyForm } from "@/components/admin/PropertyForm";

export default async function EditarImovelPage(
  props: PageProps<"/admin/imoveis/[id]">,
) {
  const { id } = await props.params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Editar imóvel</h1>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <PropertyForm property={property} />
      </div>
    </div>
  );
}
