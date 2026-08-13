# Reverseed Imóveis

App web para corretores de imóveis atenderem clientes de forma individualizada:
o cliente conta o que procura (tipo de imóvel, finalidade, prazo e faixa de
preço em dólar, guarani ou real) e o corretor vai enviando imóveis
compatíveis, um de cada vez. O cliente precisa dar feedback (gostei / não é
para mim / talvez depois) em cada imóvel para liberar o próximo.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions)
- TypeScript + Tailwind CSS 4
- [Prisma 7](https://www.prisma.io) + SQLite (via `@prisma/adapter-better-sqlite3`)
- Autenticação própria (cookies assinados com JWT via `jose`, senhas com `bcryptjs`)

Não há dependências de serviços externos pagos — o projeto roda inteiramente
local com um banco SQLite em arquivo. Isso é ideal para rodar em uma única
máquina/VPS; para deploy serverless (ex: Vercel) troque o `datasource` do
Prisma para Postgres (basta mudar `provider` no `prisma/schema.prisma` e a
`DATABASE_URL`, o resto do código não muda).

## Como rodar localmente

```bash
npm install
cp .env.example .env
# edite .env: gere um SESSION_SECRET e defina a senha do admin

npm run db:migrate   # cria o banco SQLite e as tabelas
npm run db:seed      # cria o usuário administrador (corretor)

npm run dev
```

Acesse `http://localhost:3000`.

- Área do cliente: cadastro em `/cadastro`, preferências em `/onboarding`,
  imóveis recebidos em `/imoveis`.
- Área do corretor (admin): login em `/entrar` com o e-mail/senha definidos em
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` (padrão: `corretor@reverseed.com.py` /
  `mudeesta123` — troque isso no `.env` antes de usar em produção).

## Variáveis de ambiente

Veja `.env.example`. Resumo:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Caminho do banco SQLite (`file:./dev.db` por padrão) |
| `SESSION_SECRET` | Segredo para assinar os cookies de sessão. Gere com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Credenciais do corretor, usadas pelo `prisma/seed.ts` |

## Estrutura

```
prisma/schema.prisma        Modelos: User, ClientProfile, Property, Recommendation, Settings
prisma/seed.ts              Cria o usuário admin e as cotações padrão
src/lib/                    Prisma client, sessão/JWT, validação (zod), matching de imóveis
src/app/actions/            Server Actions (auth, perfil, imóveis, recomendações, config)
src/app/(client)/           Área do cliente: onboarding, imóveis, perfil
src/app/admin/              Área do corretor: clientes, imóveis, configurações
src/proxy.ts                Proteção de rotas (Next.js 16 renomeou middleware -> proxy)
```

## Como funciona o fluxo principal

1. O cliente se cadastra e preenche as preferências (tipo de imóvel, se é
   para morar/investir, prazo, faixa de preço + moeda, bairro, quartos).
2. O corretor vê a lista de clientes com essas preferências em `/admin`, abre
   o cliente e escolhe imóveis do catálogo para enviar (imóveis compatíveis
   com o perfil aparecem marcados como "Compatível").
3. O cliente vê os imóveis enviados **um de cada vez** em `/imoveis` — só
   depois de responder com um feedback (interessado / não interessado /
   talvez) o próximo imóvel da fila aparece. O histórico de respostas fica
   visível para o cliente e para o corretor.
4. Preços podem ser cadastrados em USD, PYG (guarani) ou BRL; a cotação usada
   para converter e comparar valores é configurada pelo corretor em
   `/admin/config`.

## Fotos dos imóveis

Não há upload de arquivo — cole links de fotos já hospedadas (Google Fotos,
Drive público, Imgur etc.), um por linha, ao cadastrar o imóvel. Isso evita
depender de armazenamento de arquivos, que não é o foco do MVP.
