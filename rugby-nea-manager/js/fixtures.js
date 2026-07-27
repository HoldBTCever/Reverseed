// Geração de fixture (turno e returno) via método do círculo, e tabela de posições.

export function generateFixture(teamIds) {
  const ids = [...teamIds];
  if (ids.length % 2 !== 0) ids.push(null); // bye
  const n = ids.length;
  const rounds = [];
  const half = n / 2;
  let arr = [...ids];

  for (let r = 0; r < n - 1; r++) {
    const roundMatches = [];
    for (let i = 0; i < half; i++) {
      const home = arr[i];
      const away = arr[n - 1 - i];
      if (home !== null && away !== null) {
        roundMatches.push(r % 2 === 0 ? {home, away} : {home: away, away: home});
      }
    }
    rounds.push(roundMatches);
    const fixed = arr[0];
    const rest = arr.slice(1);
    rest.unshift(rest.pop());
    arr = [fixed, ...rest];
  }

  const secondLeg = rounds.map(round => round.map(m => ({home: m.away, away: m.home})));
  const allRounds = [...rounds, ...secondLeg];

  return allRounds.map((matches, idx) => ({
    round: idx + 1,
    matches: matches.map(m => ({...m, played: false, scoreHome: null, scoreAway: null})),
  }));
}

export function initialStandings(teamIds) {
  const table = {};
  teamIds.forEach(id => {
    table[id] = {
      teamId: id, pj: 0, pg: 0, pe: 0, pp: 0, pf: 0, pc: 0, pts: 0,
    };
  });
  return table;
}

export function applyResult(standings, homeId, awayId, scoreHome, scoreAway) {
  const h = standings[homeId];
  const a = standings[awayId];
  h.pj++; a.pj++;
  h.pf += scoreHome; h.pc += scoreAway;
  a.pf += scoreAway; a.pc += scoreHome;
  if (scoreHome > scoreAway) {
    h.pg++; h.pts += 4;
    a.pp++;
  } else if (scoreHome < scoreAway) {
    a.pg++; a.pts += 4;
    h.pp++;
  } else {
    h.pe++; a.pe++;
    h.pts += 2; a.pts += 2;
  }
  // punto bonus simplificado: diferencia de +15 o más suma 1 punto extra
  if (scoreHome - scoreAway >= 15) h.pts += 1;
  if (scoreAway - scoreHome >= 15) a.pts += 1;
}

export function sortedStandings(standings) {
  return Object.values(standings).sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    const diffX = x.pf - x.pc;
    const diffY = y.pf - y.pc;
    if (diffY !== diffX) return diffY - diffX;
    return y.pf - x.pf;
  });
}

// Cria os confrontos de uma rodada de mata-mata a partir de uma lista de ids
// ordenada do melhor (índice 0) ao pior colocado. Usa a semeadura padrão
// (1x8, 4x5, 3x6, 2x7) para 8 times, garantindo que 1º e 2º só se encontrem
// na final; para 4 e 2 times, casa os extremos (1x4, 2x3) e (1x2).
export function firstKnockoutRound(rankedIds) {
  const n = rankedIds.length;
  let order;
  if (n === 8) order = [0, 7, 3, 4, 2, 5, 1, 6];
  else if (n === 4) order = [0, 3, 1, 2];
  else if (n === 2) order = [0, 1];
  else throw new Error(`Tamanho de chave não suportado: ${n}`);

  const pairs = [];
  for (let i = 0; i < order.length; i += 2) {
    pairs.push({home: rankedIds[order[i]], away: rankedIds[order[i + 1]]});
  }
  return pairs.map(m => ({...m, played: false, scoreHome: null, scoreAway: null}));
}

// Próxima rodada de mata-mata a partir dos vencedores da rodada anterior,
// respeitando a ordem do chaveamento (vencedor do confronto 1 x vencedor do
// confronto 2, e assim por diante).
export function nextKnockoutRound(previousMatches) {
  const winners = previousMatches.map(m => (m.scoreHome > m.scoreAway ? m.home : m.away));
  const pairs = [];
  for (let i = 0; i < winners.length; i += 2) {
    pairs.push({home: winners[i], away: winners[i + 1]});
  }
  return pairs.map(m => ({...m, played: false, scoreHome: null, scoreAway: null}));
}

export function knockoutStageName(numMatches, lang) {
  if (numMatches === 4) return lang === 'es' ? 'Cuartos de Final' : 'Quartas de Final';
  if (numMatches === 2) return 'Semifinal';
  if (numMatches === 1) return 'Final';
  return lang === 'es' ? `Playoffs (${numMatches * 2} equipos)` : `Mata-mata (${numMatches * 2} times)`;
}
