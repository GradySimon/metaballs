export interface Situation {
  state: any;
}

export interface ActionProp {
  state: any;
  action: any;
}

export interface Outcome {
  // The action this is the outccome for.
  action: ActionProp;
  // If provided, learn from the reward.
  reward?: number;
  // If provided, respond with a new ActionProp and prepare for the next step.
  situation?: Situation;
}

export class Agent {
  public async act(situation: Situation): Promise<ActionProp> {
    console.debug(`Acting in response to: ${situation}.`);
    return { state: 0, action: 1 };
  }

  public async react(outcome: Outcome): Promise<ActionProp> {
    console.debug(`Reacting to: ${outcome}.`);
    return { state: 0, action: 1 };
  }
}