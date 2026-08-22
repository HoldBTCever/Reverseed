# Satoshi Pet 🐣

Um tamagochi que só cresce quando você o alimenta com **satoshis de verdade**.
Vincule uma carteira Bitcoin — on-chain ou Lightning, apenas leitura, nunca
custódia — e cada pagamento recebido nela vira uma refeição para o seu
bichinho.

## Como funciona

1. **Vincule uma carteira.** Duas opções:
   - **On-chain**: cole qualquer endereço Bitcoin (legacy `1...`, P2SH `3...`
     ou SegWit/Taproot `bc1...`) que você controle, ou clique em "Conectar
     carteira" se tiver a extensão [Unisat](https://unisat.io) instalada.
   - **Lightning**: cole uma string de conexão
     [Nostr Wallet Connect (NWC)](https://nwc.dev), gerada no app da sua
     carteira (Alby, Mutiny, Zeus, etc.), concedendo apenas permissões de
     leitura (saldo e transações).

   Em ambos os casos, só lemos dados públicos — nunca pedimos nem armazenamos
   chave privada, seed phrase, ou qualquer segredo de custódia.
2. **Alimente com sats.**
   - **On-chain**: envie qualquer valor para o endereço vinculado. O app
     consulta periodicamente um explorador de blocos público
     ([mempool.space](https://mempool.space), com
     [blockstream.info](https://blockstream.info) como alternativa) e detecta
     pagamentos novos automaticamente.
   - **Lightning**: qualquer pagamento recebido na carteira conectada via NWC
     é detectado no próximo poll. Se a conexão tiver a permissão
     `make_invoice`, dá pra gerar uma fatura Lightning direto no app para
     facilitar o envio.
3. **Cuide do seu pet.** Fome, felicidade e energia diminuem com o tempo,
   como em qualquer tamagochi. Alimentá-lo (recebendo sats) restaura os
   status; brincar e dormir ajudam entre uma alimentação e outra. Se ficar
   muito tempo sem sats, o pet hiberna — e se a hibernação durar mais de 7
   dias sem alimento, ele parte (dá pra recomeçar a qualquer momento).
4. **Evolua.** A cada satoshi recebido, o total acumulado avança o pet por
   estágios: Ovo → Sat-Bebê → Sat-Cub → HODLer Jr. → Bitcoin Whale →
   Satoshi Lendário (em 1 BTC acumulado).

Não quer usar uma carteira real ainda? Cada aba (on-chain e Lightning) tem seu
próprio **modo demonstração**: gera pagamentos simulados periodicamente, sem
tocar em nenhuma rede, só para testar o jogo.

## Privacidade e segurança

- Nunca pedimos, armazenamos ou transmitimos chaves privadas, seed phrases
  ou qualquer segredo de custódia.
- **On-chain**: o único dado salvo é o endereço público vinculado.
- **Lightning**: a string de conexão NWC concede exatamente as permissões que
  você autorizar ao criá-la na sua carteira (recomendamos conceder só leitura:
  `get_balance` + `list_transactions`, e opcionalmente `make_invoice`) — ela
  nunca dá controle total da carteira, e pode ser revogada a qualquer momento
  no app da sua carteira. Trate-a como uma senha.
- Tudo fica apenas no `localStorage` do seu navegador — nunca enviado a
  nenhum servidor nosso, pois não existe backend. O app fala diretamente com
  APIs públicas de block explorers (on-chain) ou com o relay Nostr da sua
  carteira (Lightning, via NWC).
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
│   ├── petEngine.ts          # Lógica pura: decaimento, alimentação, evolução, humor
│   ├── mempoolApi.ts         # Cliente para mempool.space/blockstream.info (saldo + txs on-chain)
│   ├── nwc.ts                 # Cliente Nostr Wallet Connect (saldo + transações + faturas Lightning)
│   ├── demoWallet.ts         # Carteira on-chain simulada para o modo demonstração
│   ├── demoLightning.ts      # Carteira Lightning simulada para o modo demonstração
│   ├── bitcoinAddress.ts     # Validação de formato de endereço
│   ├── unisat.ts             # Integração opcional com a extensão Unisat
│   └── storage.ts            # Helpers de localStorage
├── hooks/
│   ├── useWalletSync.ts      # Poll periódico da carteira vinculada (on-chain ou Lightning)
│   └── usePetState.ts        # Liga o estado do pet ao ciclo de vida da carteira
└── components/
    ├── OnboardingScreen.tsx  # Tela de vínculo de carteira (abas on-chain / Lightning)
    ├── GameScreen.tsx        # Tela principal do jogo
    ├── PetSprite.tsx         # Sprite SVG do pet (varia por estágio/humor)
    ├── AddressCard.tsx       # Card de saldo + QR para carteiras on-chain
    ├── LightningCard.tsx     # Card de saldo + geração de fatura para carteiras Lightning
    ├── StatBar.tsx, FeedLog.tsx, ActionBar.tsx, TopHeader.tsx
```

Nenhum backend é necessário — é um app estático (Vite + React + TypeScript)
que pode ser hospedado em qualquer serviço de arquivos estáticos.
