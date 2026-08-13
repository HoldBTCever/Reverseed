import Link from "next/link";
import { logoutAction } from "@/app/actions/auth";
import { requireAdmin } from "@/lib/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const admin = await requireAdmin();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link href="/admin" className="text-lg font-bold text-brand-dark">
            Reverseed Imóveis · Painel
          </Link>
          <nav className="flex items-center gap-4 text-sm">
            <Link href="/admin" className="text-stone-600 hover:text-brand">
              Clientes
            </Link>
            <Link
              href="/admin/imoveis"
              className="text-stone-600 hover:text-brand"
            >
              Imóveis
            </Link>
            <Link
              href="/admin/config"
              className="text-stone-600 hover:text-brand"
            >
              Configurações
            </Link>
            <span className="hidden text-stone-400 sm:inline">
              {admin.name}
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
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
        {children}
      </main>
    </div>
  );
}
