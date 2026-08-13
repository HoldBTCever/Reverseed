import { PropertyForm } from "@/components/admin/PropertyForm";

export default function NovoImovelPage() {
  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold text-stone-900">Novo imóvel</h1>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <PropertyForm />
      </div>
    </div>
  );
}
