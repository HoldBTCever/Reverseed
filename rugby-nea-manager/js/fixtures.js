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
