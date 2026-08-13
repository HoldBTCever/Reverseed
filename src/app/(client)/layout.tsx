import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { requireClient } from "@/lib/auth";

export default async function ClientAreaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireClient();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link href="/imoveis" className="text-lg font-bold text-brand-dark">
            Reverseed Imóveis
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/imoveis" className="text-stone-600 hover:text-brand">
              Meus imóveis
            </Link>
            <Link href="/perfil" className="text-stone-600 hover:text-brand">
              Meu perfil
            </Link>
            <span className="hidden text-stone-400 sm:inline">
              {user.name}
            </span>
            <form action={logoutAction}>
              <button
                type="submit"
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-stone-600 hover:bg-stone-100"
              >
                Sair
              </button>
            </form>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
