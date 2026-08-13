import Link from "next/link";

const STEPS = [
  {
    title: "Conte o que você procura",
    description:
      "Apartamento ou casa? Para morar ou investir? Com prazo definido ou sem pressa? Sua faixa de preço em dólar, guarani ou real.",
  },
  {
    title: "Receba opções selecionadas",
    description:
      "Seu corretor analisa o que você respondeu e vai enviando imóveis compatíveis, um de cada vez, direto para você.",
  },
  {
    title: "Dê seu feedback",
    description:
      "Gostou, não é bem isso ou quer ver depois? Seu feedback libera as próximas opções e ajuda a refinar a busca.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold text-brand-dark">
            Reverseed Imóveis
          </span>
          <nav className="flex items-center gap-3 text-sm">
            <Link
              href="/entrar"
              className="text-stone-600 hover:text-brand"
            >
              Entrar
            </Link>
            <Link
              href="/cadastro"
              className="rounded-lg bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-dark"
            >
              Quero encontrar um imóvel
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-20 text-center">
          <h1 className="text-4xl font-bold tracking-tight text-stone-900 sm:text-5xl">
            Seu imóvel ideal em Assunção,
            <span className="text-brand-dark"> sem enxurrada de opções</span>
          </h1>
          <p className="mt-5 text-lg text-stone-600">
            Conte o que você procura e seu corretor vai te enviando imóveis
            compatíveis, um de cada vez. Dólar, guarani ou real — do jeito
            que for mais fácil para você.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/cadastro"
              className="rounded-lg bg-brand px-6 py-3 font-semibold text-white hover:bg-brand-dark"
            >
              Começar agora
            </Link>
            <Link
              href="/entrar"
              className="rounded-lg border border-stone-300 px-6 py-3 font-semibold text-stone-700 hover:bg-white"
            >
              Já tenho conta
            </Link>
          </div>
        </section>

        <section className="border-t border-stone-200 bg-white py-16">
          <div className="mx-auto grid max-w-5xl gap-10 px-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <div key={step.title}>
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-light text-sm font-bold text-brand-dark">
                  {index + 1}
                </span>
                <h2 className="mt-4 font-semibold text-stone-900">
                  {step.title}
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </section>
      </main>

      <footer className="border-t border-stone-200 py-6 text-center text-sm text-stone-400">
        Reverseed Imóveis · Assunção, Paraguai
      </footer>
    </div>
  );
}
