# Satoshi Pet 🟠

Um avatar que evolui conforme suas **decisões financeiras de longo prazo**.
Vincule uma carteira Bitcoin — on-chain ou Lightning, apenas leitura, nunca
custódia — e cada satoshi acumulado o aproxima de uma vida construída com
baixa preferência temporal: estabilidade, família, saúde, liberdade.

## Como funciona

1. **Vincule uma carteira.** Duas opções:
   - **On-chain**: cole qualquer endereço Bitcoin (legacy `1...`, P2SH `3...`
     ou SegWit/Taproot `bc1...`) que você controle, ou clique em "Conectar
     carteira" se tiver a extensão [Unisat](https://unisat.io) instalada.
   - **Lightning**: cole seu **Lightning Address** (`nome@carteira.com`, ex:
     `thisoctave46@walletofsatoshi.com`) — um identificador público, como um
     e-mail, que qualquer pessoa pode usar para te pagar. Não é preciso
     compartilhar senha nem chave alguma.

   Em ambos os casos, só usamos dados públicos — nunca pedimos nem armazenamos
   chave privada, seed phrase, ou qualquer segredo de custódia.
2. **Alimente com sats.**
   - **On-chain**: envie qualquer valor para o endereço vinculado. O app
     consulta periodicamente um explorador de blocos público
     ([mempool.space](https://mempool.space), com
     [blockstream.info](https://blockstream.info) como alternativa) e detecta
     pagamentos novos automaticamente.
   - **Lightning**: como endereços Lightning não têm histórico público (não
     existe um "mempool.space" para Lightning), alimentar funciona por ação
     explícita — duas formas:
     - **Gerar fatura**: o app pede uma fatura de X sats à sua carteira via
       [LNURL-pay](https://github.com/lnurl/luds/blob/luds/06.md) e mostra o
       QR code — com atalhos para valores comuns (1.000 / 5.000 / 21.000 /
       100.000 sats) além do campo livre. Se a carteira suportar
       [verificação sem autenticação (LUD-21)](https://github.com/lnurl/luds/blob/luds/21.md),
       o app detecta o pagamento sozinho assim que ele é liquidado; senão, um
       botão "Já paguei" confirma manualmente.
     - **Colar uma fatura**: cole qualquer fatura `lnbc...` que você já tenha.
       O app decodifica o valor localmente e, se detectar uma extensão WebLN
       no navegador (ex: [Alby](https://getalby.com)), oferece pagar
       diretamente; senão, também dá pra confirmar manualmente.
3. **Cuide do avatar.** Seis status acompanham a vida dele — Fome,
   Felicidade, Energia, Saúde Física, Saúde Mental e Inteligência — e todos
   diminuem aos poucos com o tempo (Saúde Física ou Mental chegando a zero
   hiberna o avatar). Alimentá-lo (recebendo sats reais) restaura a maior
   parte dos status; além disso, cada **ação temática bitcoiner** melhora
   um jeito diferente e visível do avatar:
   - **Treinar 💪** — Saúde Física (deixa o avatar mais musculoso) e um
     pouco de Saúde Mental, mas custa Energia.
   - **Escola Austríaca 📖** — Inteligência (a partir de um certo nível o
     avatar ganha óculos) e Saúde Mental, também custando um pouco de
     Energia.
   - **Dieta Carnívora 🥩** — Fome e Saúde Física, com um bônus de Energia.

   **Cada ação só é considerada concluída depois que o app recebe uma
   quantidade de sats equivalente a ela** (1.000 / 1.500 / 2.000 sats,
   respectivamente) — não é um clique grátis. Ao escolher uma ação, o app
   mostra quanto falta receber:
   - **Lightning**: gera uma fatura de valor fixo para aquela ação
     específica (mesmo fluxo de verificação da alimentação: LUD-21, WebLN,
     ou confirmação manual).
   - **On-chain**: mostra o endereço/QR vinculado e aguarda uma transação
     única de pelo menos aquele valor — detectada automaticamente pelo
     mesmo polling que já alimenta o avatar.
   - **Modo demonstração**: um aporte simulado subsequente cobre o valor
     sozinho, sem ação manual.

   O pagamento que completa a ação conta normalmente como alimentação
   (soma ao total acumulado e restaura os status básicos) e, além disso,
   aplica o efeito específico daquela ação. Cada uma desbloqueia um selo
   cosmético no avatar após 5 conclusões — nenhuma afeta a evolução
   diretamente, que segue dependendo do total de sats recebidos. O sono
   também é automático: o avatar dorme sozinho durante a madrugada no
   horário de Brasília (regenerando Energia) e acorda de dia, sem nenhum
   botão manual. Se ficar muito tempo sem aportes, o avatar recai no curto
   prazo — e se isso durar mais de 7 dias, ele volta pro sistema fiduciário
   de vez (dá pra recomeçar quando quiser).
4. **Evolua.** A cada satoshi recebido, o total acumulado avança o avatar por
   estágios: Plebe Adormecido → Recém Orange-Pilled → Poupador Disciplinado →
   Provedor Estável (casa) → Pai de Família Próspero (família) → Maximalista
   Lendário (1 BTC acumulado).

Não quer usar uma carteira real ainda? Cada aba (on-chain e Lightning) tem seu
próprio **modo demonstração**: gera pagamentos simulados periodicamente, sem
tocar em nenhuma rede, só para testar o app.

## Privacidade e segurança

- Nunca pedimos, armazenamos ou transmitimos chaves privadas, seed phrases
  ou qualquer segredo de custódia.
- **On-chain**: o único dado salvo é o endereço público vinculado.
- **Lightning**: o único dado salvo é o Lightning Address — um identificador
  público, sem nenhum segredo associado. Ninguém consegue gastar seus sats a
  partir dele; ele só permite que outros te paguem, como um endereço de
  e-mail permite que te enviem mensagens.
- Tudo fica apenas no `localStorage` do seu navegador — nunca enviado a
  nenhum servidor nosso, pois não existe backend. O app fala diretamente com
  APIs públicas de block explorers (on-chain) ou com o servidor LNURL-pay da
  sua carteira (Lightning).
- Toda a lógica do jogo roda no seu navegador.

## Rodando localmente

```bash
npm install
npm run dev       # ambiente de desenvolvimento
npm run build     # build de produção em dist/
npm run preview   # servir o build de produção
npm test          # testes unitários (vitest)
npm run typecheck # checagem de tipos
```

## Arquitetura

```
src/
├── types.ts                 # Tipos compartilhados (PetState, WalletKind, LinkedWallet, ...)
├── lib/
│   ├── petEngine.ts          # Lógica pura: decaimento, alimentação, evolução, humor, hábitos bitcoiner
│   ├── mempoolApi.ts         # Cliente para mempool.space/blockstream.info (saldo + txs on-chain)
│   ├── lnurl.ts               # Cliente LNURL-pay (resolve Lightning Address, gera e verifica faturas)
│   ├── bolt11.ts              # Decodificador de faturas Lightning coladas manualmente
│   ├── webln.ts               # Integração opcional com extensão WebLN (ex: Alby) para pagar faturas
│   ├── demoWallet.ts         # Carteira on-chain simulada para o modo demonstração
│   ├── demoLightning.ts      # Carteira Lightning simulada para o modo demonstração
│   ├── bitcoinAddress.ts     # Validação de formato de endereço
│   ├── unisat.ts             # Integração opcional com a extensão Unisat
│   └── storage.ts            # Helpers de localStorage
├── hooks/
│   ├── useWalletSync.ts      # Poll periódico da carteira vinculada (on-chain e Lightning demo)
│   └── usePetState.ts        # Liga o estado do pet ao ciclo de vida da carteira
└── components/
    ├── OnboardingScreen.tsx  # Tela de vínculo de carteira (abas on-chain / Lightning)
    ├── GameScreen.tsx        # Tela principal do jogo
    ├── PetSprite.tsx         # Avatar SVG (bust humano; varia por estágio/humor + selos de casa/família/hábitos)
    ├── AddressCard.tsx       # Card de saldo + QR para carteiras on-chain
    ├── LightningCard.tsx     # Card de saldo + geração/colagem de fatura para carteiras Lightning
    ├── HabitPaymentCard.tsx  # Fluxo de pagamento (fatura Lightning de valor fixo, alvo on-chain, ou espera em demo) para concluir uma ação
    ├── StatBar.tsx, FeedLog.tsx, ActionBar.tsx, TopHeader.tsx
```

Nenhum backend é necessário — é um app estático (Vite + React + TypeScript)
que pode ser hospedado em qualquer serviço de arquivos estáticos.
