import { redirect } from "next/navigation";
import { requireClient } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function OnboardingPage() {
  const user = await requireClient();
  if (user.clientProfile) {
    redirect("/imoveis");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900">
        Vamos te conhecer melhor
      </h1>
      <p className="mt-2 text-stone-600">
        Responda algumas perguntas rápidas para que seu corretor possa
        selecionar imóveis compatíveis com o que você procura em Assunção.
      </p>
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <ProfileForm profile={null} redirectTo="/imoveis" submitLabel="Ver imóveis compatíveis" />
      </div>
    </div>
  );
}
