import Link from "next/link";
import { LoginForm } from "@/components/auth/LoginForm";

export default async function EntrarPage({
  searchParams,
}: PageProps<"/entrar">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-xl font-bold text-brand-dark">
          Reverseed Imóveis
        </Link>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-lg font-semibold text-stone-900">
          Entrar na sua conta
        </h1>
        <LoginForm next={next} />
      </div>
    </div>
  );
}
