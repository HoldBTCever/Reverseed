# Rugby NEA Manager

Jogo de manager de rugby do Campeonato do Nordeste Argentino (NEA), no estilo
Football Manager: escolha um clube, acompanhe a tabela e o fixture (turno e
returno) e assista às partidas rolando ao vivo em uma quadra 2D animada, com
placar, cronômetro e narração em tempo real.

## Times

Taraguy, Aranduroga, Regatas, Curda, San José, Sixty, Capri, Curne, Aguará e
San Patricio.

## Como jogar

App estático (HTML/CSS/JS puro, sem build), basta servir a pasta por HTTP:

```bash
cd rugby-nea-manager
python3 -m http.server 8080
```

Abra `http://localhost:8080` no navegador.

## Fluxo

1. Escolha o time que você vai gerenciar.
2. No painel, veja sua posição na tabela e o próximo confronto da rodada.
3. Em "Preparar partida", escolha uma tática (Agresivo, Equilibrado ou
   Defensivo) e comece o jogo.
4. Acompanhe a partida ao vivo: bola e jogadores se movendo na quadra,
   placar, cronômetro e ticker de narração. Controles de play/pause,
   velocidade (1x/2x/4x) e "adiantar até o final".
5. Ao final, veja o resumo (tries, cartões, craque da partida) e continue —
   os demais jogos da rodada são simulados automaticamente e a tabela é
   atualizada.
6. Consulte Tabela, Fixture (turno e returno) e Elenco a qualquer momento.

O progresso da temporada fica salvo no `localStorage` do navegador.

## Arquitetura

```
rugby-nea-manager/
├── index.html
├── style.css
└── js/
    ├── data.js       # Times NEA e geração de elencos
    ├── engine.js      # Motor de simulação da partida (minuto a minuto)
    ├── fixtures.js     # Fixture turno/returno e tabela de classificação
    ├── render.js      # Renderização da quadra 2D animada (canvas)
    └── app.js         # Telas, navegação e estado do jogo
```
