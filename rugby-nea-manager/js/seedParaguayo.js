// Calendário real do torneio nacional paraguaio (URP): turno único de 7
// rodadas entre os 8 clubes, fielmente reproduzido da tabela oficial de
// confrontos (fotos enviadas pelo usuário) — não é gerado pelo método do
// círculo genérico (fixtures.js/generateFixture), que produziria uma ordem de
// jogos diferente da real. Sem resultados pré-carregados (ao contrário de
// NEA_SEED_MATCHES): aqui é só o calendário de uma temporada nova, simulada
// do zero conforme as rodadas avançam.
export const PARAGUAYO_FIXTURE = [
  [ // Fecha 1
    {home: 'PAR-CRI', away: 'PAR-SNJ'},
    {home: 'PAR-STC', away: 'PAR-LUQ'},
    {home: 'PAR-ASU', away: 'PAR-JAR'},
    {home: 'PAR-FDM', away: 'PAR-CUR'},
  ],
  [ // Fecha 2
    {home: 'PAR-LUQ', away: 'PAR-CRI'},
    {home: 'PAR-SNJ', away: 'PAR-STC'},
    {home: 'PAR-CUR', away: 'PAR-ASU'},
    {home: 'PAR-JAR', away: 'PAR-FDM'},
  ],
  [ // Fecha 3
    {home: 'PAR-CRI', away: 'PAR-STC'},
    {home: 'PAR-LUQ', away: 'PAR-SNJ'},
    {home: 'PAR-CUR', away: 'PAR-JAR'},
    {home: 'PAR-ASU', away: 'PAR-FDM'},
  ],
  [ // Fecha 4
    {home: 'PAR-JAR', away: 'PAR-CRI'},
    {home: 'PAR-STC', away: 'PAR-CUR'},
    {home: 'PAR-SNJ', away: 'PAR-ASU'},
    {home: 'PAR-FDM', away: 'PAR-LUQ'},
  ],
  [ // Fecha 5
    {home: 'PAR-ASU', away: 'PAR-LUQ'},
    {home: 'PAR-CUR', away: 'PAR-CRI'},
    {home: 'PAR-STC', away: 'PAR-JAR'},
    {home: 'PAR-FDM', away: 'PAR-SNJ'},
  ],
  [ // Fecha 6
    {home: 'PAR-FDM', away: 'PAR-CRI'},
    {home: 'PAR-ASU', away: 'PAR-STC'},
    {home: 'PAR-LUQ', away: 'PAR-JAR'},
    {home: 'PAR-SNJ', away: 'PAR-CUR'},
  ],
  [ // Fecha 7
    {home: 'PAR-CRI', away: 'PAR-ASU'},
    {home: 'PAR-STC', away: 'PAR-FDM'},
    {home: 'PAR-CUR', away: 'PAR-LUQ'},
    {home: 'PAR-JAR', away: 'PAR-SNJ'},
  ],
];
