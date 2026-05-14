# Card Notifier — Leitor de Notificações de Cartão

App Android que captura notificações de cartão de crédito/débito automaticamente e sincroniza com o Mobills.

## Funcionalidades

- **Captura automática** de notificações de +15 bancos brasileiros (Nubank, Itaú, Bradesco, Inter, C6, Santander, BB, Caixa, PicPay, PagBank, Neon, Méliuz…)
- **Parser inteligente** que extrai: banco, valor (R$), descrição/estabelecimento, tipo (crédito/débito/Pix)
- **Sincronização com Mobills** via API com suporte a auto-sync
- **Histórico local** com busca e filtros por tipo
- **Deduplicação** automática de notificações repetidas

## Como usar

### 1. Permissão de notificações

O Android exige que o usuário conceda acesso manualmente:

> **Configurações → Notificações → Acesso a notificações → Card Notifier → Ativar**

O app mostra um banner de alerta enquanto a permissão não estiver ativa.

### 2. Configurar Mobills (opcional)

1. Acesse `app.mobills.com.br` no navegador
2. Vá em **Configurações → Integrações → API**
3. Gere um token e cole na aba **Configurações** do app
4. Informe o ID da conta e da categoria padrão
5. Ative **Sincronizar automaticamente** para sync imediato

### 3. Sincronização manual

Na tela inicial, toque em **"Sincronizar com Mobills"** para enviar todas as transações pendentes.

## Arquitetura

```
src/
├── NotificationParser.ts     # Regex parser: extrai valor, descrição, tipo
├── services/
│   └── MobillsService.ts     # Cliente Axios para a API do Mobills
├── store/
│   └── useTransactionStore.ts # Zustand + AsyncStorage (persistência local)
├── screens/
│   ├── HomeScreen.tsx         # Dashboard: status, totais, recentes
│   ├── TransactionListScreen.tsx # Lista completa com busca/filtros
│   └── SettingsScreen.tsx     # Config Mobills, filtros, limpar dados
└── components/
    ├── TransactionCard.tsx    # Card de transação
    └── StatusBanner.tsx       # Banner de status da permissão

android/app/src/main/java/com/cardnotificationparser/
├── CardNotificationService.java  # NotificationListenerService
├── NotificationListenerModule.java # Bridge React Native ↔ Java
├── NotificationListenerPackage.java # Registro do módulo nativo
├── MainActivity.java
└── MainApplication.java
```

## Instalação e build

```bash
npm install
npx react-native run-android
```

## Bancos suportados

| Banco | Package |
|---|---|
| Nubank | com.nu.production |
| Itaú | br.com.itau.internet |
| Bradesco | com.bradesco |
| Next | br.com.bradesco.next |
| Banco Inter | br.com.intermedium |
| C6 Bank | com.c6bank.app |
| Santander | com.santander.app |
| Banco do Brasil | br.com.bb.android |
| Caixa | br.gov.caixa.internet |
| PicPay | com.picpay |
| PagBank | br.com.uol.ps.myaccount |
| Neon | com.neon.bank.android.prd |
| Méliuz | br.com.meliuz |
| Sicoob | br.com.sicoob.mobile |
| Sicredi | br.com.sicredi |
| XP | com.xpi.app |
| Ame Digital | com.Ame |
| Mercado Pago | com.mercadopago.wallet |

Bancos não listados são detectados pelo conteúdo da notificação (presença de "R$" + palavras-chave de transação).
