# Satoshi Pet 🐣

Um tamagochi que só cresce quando você o alimenta com **satoshis de verdade**.
Vincule um endereço Bitcoin — apenas leitura, nunca chave privada — e cada
pagamento recebido nesse endereço vira uma refeição para o seu bichinho.

## Como funciona

1. **Vincule uma carteira.** Cole qualquer endereço Bitcoin (legacy `1...`,
   P2SH `3...` ou SegWit/Taproot `bc1...`) que você controle, ou clique em
   "Conectar carteira" se tiver a extensão [Unisat](https://unisat.io)
   instalada. Só o endereço público é lido — nunca pedimos chave privada
   nem frase de recuperação.
2. **Alimente com sats.** Envie qualquer valor em satoshis para o endereço
   vinculado (de outra carteira, exchange, ou peça para alguém te pagar). O
   app consulta periodicamente um explorador de blocos público
   ([mempool.space](https://mempool.space), com
   [blockstream.info](https://blockstream.info) como alternativa) e detecta
   pagamentos novos automaticamente.
3. **Cuide do seu pet.** Fome, felicidade e energia diminuem com o tempo,
   como em qualquer tamagochi. Alimentá-lo (recebendo sats) restaura os
   status; brincar e dormir ajudam entre uma alimentação e outra. Se ficar
   muito tempo sem sats, o pet hiberna — e se a hibernação durar mais de 7
   dias sem alimento, ele parte (dá pra recomeçar a qualquer momento).
4. **Evolua.** A cada satoshi recebido, o total acumulado avança o pet por
   estágios: Ovo → Sat-Bebê → Sat-Cub → HODLer Jr. → Bitcoin Whale →
   Satoshi Lendário (em 1 BTC acumulado).

Não quer usar uma carteira real ainda? Use o **modo demonstração**: gera
pagamentos simulados periodicamente, sem tocar na rede Bitcoin, só para
testar o jogo.

## Privacidade e segurança

- Nunca pedimos, armazenamos ou transmitimos chaves privadas, seed phrases
  ou qualquer segredo de carteira.
- O único dado sensível é o **endereço público** vinculado, salvo apenas no
  `localStorage` do seu navegador (nunca enviado a nenhum servidor nosso —
  não existe backend; o app fala diretamente com APIs públicas de
  block explorers).
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
├── types.ts                 # Tipos compartilhados (PetState, FeedEvent, ...)
├── lib/
│   ├── petEngine.ts          # Lógica pura: decaimento, alimentação, evolução, humor
│   ├── mempoolApi.ts         # Cliente para mempool.space/blockstream.info (saldo + txs)
│   ├── demoWallet.ts         # Carteira simulada para o modo demonstração
│   ├── bitcoinAddress.ts     # Validação de formato de endereço
│   ├── unisat.ts             # Integração opcional com a extensão Unisat
│   └── storage.ts            # Helpers de localStorage
├── hooks/
│   ├── useWalletSync.ts      # Poll periódico do endereço vinculado
│   └── usePetState.ts        # Liga o estado do pet ao ciclo de vida da carteira
└── components/
    ├── OnboardingScreen.tsx  # Tela de vínculo de carteira
    ├── GameScreen.tsx        # Tela principal do jogo
    ├── PetSprite.tsx         # Sprite SVG do pet (varia por estágio/humor)
    ├── StatBar.tsx, FeedLog.tsx, AddressCard.tsx, ActionBar.tsx, TopHeader.tsx
```

Nenhum backend é necessário — é um app estático (Vite + React + TypeScript)
que pode ser hospedado em qualquer serviço de arquivos estáticos.
