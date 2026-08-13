import Link from "next/link";
import { SignUpForm } from "@/components/auth/SignUpForm";

export default function CadastroPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-stone-50 px-4 py-12">
      <div className="mb-8 text-center">
        <Link href="/" className="text-xl font-bold text-brand-dark">
          Reverseed Imóveis
        </Link>
        <p className="mt-1 text-sm text-stone-500">
          Conte o que você procura e receba opções de imóveis em Assunção.
        </p>
      </div>
      <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-lg font-semibold text-stone-900">
          Criar minha conta
        </h1>
        <SignUpForm />
      </div>
    </div>
  );
}
