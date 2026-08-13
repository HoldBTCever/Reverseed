import { getExchangeRates } from "@/lib/settings";
import { RatesForm } from "@/components/admin/RatesForm";

export default async function AdminConfigPage() {
  const rates = await getExchangeRates();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Configurações</h1>
        <p className="mt-1 text-stone-600">
          Usadas para converter e comparar preços entre dólar, guarani e real
          nas telas dos clientes.
        </p>
      </div>
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <RatesForm usdToPyg={rates.usdToPyg} usdToBrl={rates.usdToBrl} />
      </div>
    </div>
  );
}
