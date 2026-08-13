# Reverseed Imóveis

App web para corretores de imóveis atenderem clientes de forma individualizada:
o cliente conta o que procura (tipo de imóvel, finalidade, prazo e faixa de
preço em dólar, guarani ou real) e o corretor vai enviando imóveis
compatíveis, um de cada vez. O cliente precisa dar feedback (gostei / não é
para mim / talvez depois) em cada imóvel para liberar o próximo.

## Stack

- [Next.js 16](https://nextjs.org) (App Router, Server Actions)
- TypeScript + Tailwind CSS 4
- [Prisma 7](https://www.prisma.io) + PostgreSQL (via `@prisma/adapter-pg`)
- Autenticação própria (cookies assinados com JWT via `jose`, senhas com `bcryptjs`)
- `cheerio` para extrair fotos automaticamente de um link de anúncio

Nenhuma dependência paga é obrigatória: um banco Postgres gratuito (ex:
[Neon](https://neon.tech)) e a [Vercel](https://vercel.com) (também com plano
gratuito) são suficientes para colocar o app no ar.

## Como rodar localmente

```bash
npm install
cp .env.example .env
# edite .env: DATABASE_URL (veja abaixo), SESSION_SECRET e senha do admin

npm run db:migrate   # aplica as migrations no banco
npm run dev
```

Acesse `http://localhost:3000`.

- Área do cliente: cadastro em `/cadastro`, preferências em `/onboarding`,
  imóveis recebidos em `/imoveis`.
- Área do corretor (admin): login em `/entrar` com o e-mail/senha definidos em
  `ADMIN_EMAIL`/`ADMIN_PASSWORD` no `.env` (o usuário admin é criado/atualizado
  automaticamente a cada `npm run build`, ou manualmente com `npm run db:seed`).

### Banco de dados local

Você precisa de um Postgres para rodar até localmente. O caminho mais rápido
sem instalar nada na sua máquina:

1. Crie uma conta gratuita em [neon.tech](https://neon.tech) (ou
   [supabase.com](https://supabase.com)).
2. Crie um banco/projeto novo e copie a "connection string".
3. Cole em `DATABASE_URL` no seu `.env`.

Se preferir, também funciona com um Postgres instalado localmente ou via
Docker (`docker run -p 5432:5432 -e POSTGRES_PASSWORD=postgres postgres:16`).

## Como publicar na Vercel (deploy)

O código já está pronto para isso — faltam só passos que só você pode fazer
(criar contas, conectar o repositório). Passo a passo:

### 1. Criar o banco Postgres de produção

1. Acesse [neon.tech](https://neon.tech) e crie uma conta gratuita.
2. Crie um novo projeto/banco (ex: `reverseed-imoveis`).
3. Copie a connection string (formato
   `postgresql://usuario:senha@host/banco?sslmode=require`).

### 2. Importar o repositório na Vercel

1. Acesse [vercel.com](https://vercel.com) e entre com sua conta GitHub.
2. Clique em **Add New → Project**.
3. Selecione o repositório `HoldBTCever/Reverseed` e a branch
   `claude/real-estate-recommendation-app-xo84o0` (ou a branch principal,
   depois de você mesclar o Pull Request).
4. A Vercel detecta automaticamente que é um projeto Next.js — não precisa
   mudar o "Framework Preset" nem o "Build Command".

### 3. Configurar as variáveis de ambiente

Na tela de configuração do projeto (ou depois, em **Settings → Environment
Variables**), adicione:

| Variável | Valor |
|---|---|
| `DATABASE_URL` | A connection string do Neon (passo 1) |
| `SESSION_SECRET` | Um valor aleatório longo — gere com `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |
| `ADMIN_EMAIL` | O e-mail que você vai usar para logar como corretor |
| `ADMIN_PASSWORD` | Uma senha forte para o admin |
| `ADMIN_NAME` | Seu nome |

### 4. Deploy

Clique em **Deploy**. A Vercel instala as dependências e roda `npm run build`,
que já inclui `prisma migrate deploy` (cria as tabelas no banco) e
`prisma db seed` (cria/atualiza o usuário admin) automaticamente — não é
preciso rodar nada manualmente. Ao terminar, você recebe uma URL pública
(ex: `reverseed-imoveis.vercel.app`) para compartilhar com os clientes e usar
você mesmo.

Deploys seguintes (novos `git push` na branch conectada) repetem esse
processo automaticamente, então futuras mudanças no schema do banco também
são aplicadas sozinhas.

## Variáveis de ambiente

Veja `.env.example`. Resumo:

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | Connection string do Postgres |
| `SESSION_SECRET` | Segredo para assinar os cookies de sessão |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Credenciais do corretor, usadas pelo `prisma/seed.ts` |

## Estrutura

```
prisma/schema.prisma        Modelos: User, ClientProfile, Property, Recommendation, Settings
prisma/seed.ts               Cria o usuário admin e as cotações padrão
src/lib/                     Prisma client, sessão/JWT, validação (zod), matching de imóveis,
                              extração de fotos a partir de um link (fetchPhotos.ts)
src/app/actions/             Server Actions (auth, perfil, imóveis, recomendações, config, fotos)
src/app/(client)/            Área do cliente: onboarding, imóveis, perfil
src/app/admin/                Área do corretor: clientes, imóveis, configurações
src/proxy.ts                 Proteção de rotas (Next.js 16 renomeou middleware -> proxy)
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

Ao cadastrar um imóvel, o corretor pode colar o link da página onde ele já
está anunciado (portal imobiliário, por exemplo) e clicar em "Buscar fotos" —
o app abre essa página no servidor e extrai as fotos automaticamente
(usando a tag `og:image` e as tags `<img>` da página), mostrando miniaturas
para o corretor escolher quais usar. Links de páginas comuns funcionam bem;
Facebook e Instagram costumam bloquear esse tipo de busca automática por
página não ter acesso liberado a quem não está logado. Nesses casos, ou como
alternativa, também é possível colar os links das fotos manualmente (uma URL
por linha).

Não há upload de arquivo do dispositivo — isso evita depender de
armazenamento de arquivos (S3, etc.), que não é o foco do MVP.
