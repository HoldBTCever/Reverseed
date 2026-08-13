import { requireClient } from "@/lib/auth";
import { ProfileForm } from "@/components/profile/ProfileForm";

export default async function PerfilPage() {
  const user = await requireClient();

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-900">Meu perfil</h1>
      <p className="mt-2 text-stone-600">
        Atualize suas preferências a qualquer momento. Seu corretor usa essas
        informações para selecionar os próximos imóveis.
      </p>
      <div className="mt-8 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <ProfileForm
          profile={user.clientProfile}
          redirectTo="/perfil"
          submitLabel="Salvar alterações"
        />
      </div>
    </div>
  );
}
