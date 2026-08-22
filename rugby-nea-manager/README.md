# Rugby NEA Manager

Jogo de manager de rugby no estilo Football Manager: escolha um clube de uma
das ligas disponíveis, acompanhe a tabela e o fixture (turno e returno) e
assista às partidas rolando ao vivo em uma quadra 2D animada, com placar,
cronômetro e narração em tempo real.

## Ligas e times

- **Campeonato do Nordeste Argentino (NEA):** Taraguy, Aranduroga, Regatas,
  Curda, San José, Sixty, Capri, Curne, Aguará e San Patricio.
- **Campeonato Paraguaio:** San José, Curda, Santa Clara, Luque, Asunción,
  Área 1, Cristo Rey e Fernando de la Mora.

Ao escolher um time, o campeonato é disputado somente entre os clubes da
mesma liga/país.

## Skills dos jogadores

Além do overall, cada jogador tem 8 atributos específicos de rugby, com pesos
por posição (ex.: hooker tem lançamento lateral alto, segunda linha tem salto
alto, apertura tem chute alto): Passe, Recepção, Lançamento lateral, Salto,
Tackle, Chute, Velocidade e Força. Esses atributos influenciam diretamente o
motor da partida — disputas de line-out (lançamento x salto), erros de mão
(passe/recepção), quebras de linha (velocidade) e chutes a gol/conversões
(chute).

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
    ├── data.js       # Ligas, times e geração de elencos com skills
    ├── engine.js      # Motor de simulação da partida (minuto a minuto)
    ├── fixtures.js     # Fixture turno/returno e tabela de classificação
    ├── render.js      # Renderização da quadra 2D animada (canvas)
    └── app.js         # Telas, navegação e estado do jogo
```
