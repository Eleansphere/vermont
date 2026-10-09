import type { StartedBattle } from '@vermont/core';
import { SCENARIOS, autoDeployment, dispatchAll, startScenario } from '@vermont/core';

/** The Trebia scenario with both armies deployed and the battle about to begin. */
export function deployedTrebia(): StartedBattle {
  const { state: start, defs } = startScenario(SCENARIOS.trebia!, 1);
  let state = start;
  while (state.phase === 'deployment') {
    const result = dispatchAll(
      state,
      [...autoDeployment(state, defs), { type: 'EndDeployment' }],
      defs
    );
    if (!result.ok) throw new Error(result.rejection.message);
    state = result.state;
  }
  return { state, defs };
}
