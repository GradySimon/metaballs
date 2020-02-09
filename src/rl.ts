export interface Situation {
  state: any;
}

export interface ActionProp {
  state: any;
  action: boolean;
}

export interface Reaction {
  action?: ActionProp;
}

export interface Outcome {
  // If provided, respond with a new ActionProp and prepare for the next step.
  // Also required for the agent to learn from the Outcome.
  situation?: Situation;

  // The action this is the outcome for. Required for the agent to learn from
  // the outcome.
  lastAction?: ActionProp;

  // If provided, learn from the reward.
  reward?: number;
}

export class Agent {
  // private learningRate = 0.005;
  private stepsSeen: number = 0;
  private counts: Map<boolean, number> = new Map([
    [true, 0],
    [false, 0]
  ]);
  private meanReward: Map<boolean, number> = new Map([
    [true, 0],
    [false, 0]
  ]);
  constructor() {
    this.meanReward.set(true, 0.0);
    this.meanReward.set(false, 0.0);
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
  public react(outcome: Situation | Outcome): Reaction {
    // if is a Sitaution
    if (outcome.hasOwnProperty('state')) {
      // Wrap into an Outcome
      outcome = { situation: outcome as Situation };
    }
    console.debug('Reacting to:', outcome);
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
      if (Math.random() < 0.02) {
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
        state: (outcome as Outcome).situation.state,
        action: Math.random() < 0.5
      }
    };
  }
}
