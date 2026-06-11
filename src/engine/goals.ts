/**
 * Deterministic Poisson-style goal sampler shared by the match engine.
 * `expected` is the side's expected-goals figure; `roll` is a uniform [0, 1) draw.
 */
export function goalsFromExpected(expected: number, roll: number): number {
  const adjusted = Math.max(0.12, expected * 0.75 + 0.37);
  let cumulative = 0;
  let probability = Math.exp(-adjusted);

  for (let goals = 0; goals < 7; goals += 1) {
    cumulative += probability;
    if (roll <= cumulative) return goals;
    probability = (probability * adjusted) / (goals + 1);
  }

  return 7;
}
