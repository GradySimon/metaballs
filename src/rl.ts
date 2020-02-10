import * as _ from 'lodash';

export interface Situation<StateSpace> {
  state: StateSpace;
}

export interface ActionProp<StateSpace, ActionSpace> {
  state: StateSpace;
  action: ActionSpace;
}

export interface Reaction<StateSpace, ActionSpace> {
  action?: ActionProp<StateSpace, ActionSpace>;
}

export interface Outcome<StateSpace, ActionSpace> {
  // If provided, respond with a new ActionProp and prepare for the next step.
  // Also required for the agent to learn from the Outcome.
  situation?: Situation<StateSpace>;

  // The action this is the outcome for. Required for the agent to learn from
  // the outcome.
  lastAction?: ActionProp<StateSpace, ActionSpace>;

  // If provided, learn from the reward.
  reward?: number;
}

export class Agent<StateSpace, ActionSpace> {
  // private learningRate = 0.005;
  private stepsSeen: number = 0;

  private counts: Map<ActionSpace, number> = new Map();
  private meanReward: Map<ActionSpace, number> = new Map();
  constructor(private readonly actions: ActionSpace[]) {
    for (const action of actions) {
      this.counts.set(action, 0);
      this.meanReward.set(action, 0);
    }
  }
  // Policy needs to be fast. Learning can be async and slow.
  // If policy is fast enough to be synchronous, API is simpler.
  /**
   * Reacts to the situation or outcome. Responds with a next action if
   * situation is provided. Learns from outcomes if the previous action and the
   * reward are also provided.
   * @param outcome The Outcome or Situation to react to.
   * @returns The agent's reaction to the situation or outcome.
   */
  public react(
    outcome: Situation<StateSpace> | Outcome<StateSpace, ActionSpace>
  ): Reaction<StateSpace, ActionSpace> {
    // if is a Sitaution
    if (outcome.hasOwnProperty('state')) {
      // Wrap into an Outcome
      outcome = { situation: outcome as Situation<StateSpace> };
    }
    // console.debug('Reacting to:', outcome);
    if ('reward' in outcome && 'lastAction' in outcome) {
      this.stepsSeen++;
      let countForState = this.counts.get(outcome.lastAction.action);
      countForState += 1;
      this.counts.set(outcome.lastAction.action, countForState);
      const currentEstimate = this.meanReward.get(outcome.lastAction.action);
      this.meanReward.set(
        outcome.lastAction.action,
        currentEstimate +
          (1 / countForState) * (outcome.reward - currentEstimate)
      );
      if (Math.random() < 0.001) {
        console.debug(
          'Agent meanReward est. after',
          this.stepsSeen,
          'steps:',
          this.meanReward
        );
      }
    }
    return {
      action: {
        state: (outcome as Outcome<StateSpace, ActionSpace>).situation.state,
        action: this.actions[_.random(this.actions.length)]
      }
    };
  }
}
