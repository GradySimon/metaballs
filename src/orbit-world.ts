import {
  add,
  dot,
  l2,
  scale,
  subtract,
  unitVector,
  Vec2,
  Vec2
} from './common-types';
import { Metaball, MetaballKind } from './metaball';
import * as RL from './rl';

interface AgentState {
  position: Vec2;
  velocity: Vec2;
  mass: number;
}

enum ThrustActions {
  None,
  Forward,
  Reverse
}

const randomAgentState = (): AgentState => {
  return {
    position: [Math.random() * 1.8 - 0.9, Math.random() * 1.8 - 0.9],
    velocity: [Math.random() * 0.5 - 0.25, Math.random() * 0.5 - 0.25],
    mass: Math.random() * 0.07
  };
};

interface OrbitAgent {
  agent: RL.Agent<AgentState, ThrustActions>;
  state: AgentState;
  lastAction?: RL.ActionProp<AgentState, ThrustActions>;
}

const GRAVITATIONAL_CONSTANT = 0.7;

export class OrbitWorld {
  /* Need to
  - Get actions from all the agents given a state
  - Step the world forward, taking into account actions
    - Adjust agent's radial, velocity taking account of their actions.
    - Move agents according to their velocities
    - Determine any rewards
  - Generate observations and rewards for each agent individually

  Should this own the Agents? It might make sense for an Agent to be part of
  the environment. Then world can call it however it wants. Action space,
  observation space are all tightly coupled to environment. If we didn't do
  this, something else would need to facilitate moving information between the
  world and the agents, and that might hard to do generically.
  */

  private originMass: number = 0;
  private steps: number = 0;
  private agents: OrbitAgent[] = [];
  constructor() {
    //
  }

  public init(numAgents: number) {
    this.originMass = Math.random() * 0.1 + 0.1;
    for (let i = 0; i < numAgents; i++) {
      this.agents.push({
        agent: new RL.Agent<AgentState, ThrustActions>([
          ThrustActions.None,
          ThrustActions.Forward,
          ThrustActions.Reverse
        ]),
        state: randomAgentState()
      });
    }
  }

  public step(millisSinceLast: number, elapsedTime: number) {
    const secondsSinceLast: number = millisSinceLast / 1000;
    if (this.steps % 200 === 0) {
      console.debug('Elapsed time: (', elapsedTime / 1000, '):', this.agents);
      // console.debug('OrbitWorld metaballs:', this.asMetaballs();
    }
    const updatedAgents: OrbitAgent[] = [];
    for (let i = 0; i < this.agents.length; i++) {
      const agent = this.agents[i];
      const otherAgents: AgentState[] = this.agents
        .slice(0, i)
        .map((a) => a.state);
      otherAgents.push(...this.agents.slice(i + 1, this.agents.length));
      console.assert(otherAgents.length === this.agents.length - 1);
      const [nextState, reward] = this.nextAgentState(
        agent,
        secondsSinceLast,
        otherAgents
      );
      updatedAgents.push({
        ...agent,
        state: nextState
      });
    }
    this.agents = updatedAgents;
    this.steps++;
  }

  public asMetaballs(): Metaball[] {
    const metaballs: Metaball[] = [];
    metaballs.push({
      kind: MetaballKind.QUADRATIC,
      position: [0, 0],
      radius: this.originMass
    });
    for (const agent of this.agents) {
      metaballs.push({
        kind: MetaballKind.QUADRATIC,
        position: agent.state.position,
        radius: agent.state.mass
      });
    }
    return metaballs;
  }

  private gravParam(): number {
    return GRAVITATIONAL_CONSTANT * this.originMass;
  }

  /**
   * @param position Position of the point to calculate gravity for.
   * @returns Gravity accelleration vector for position.
   */
  private gravityVector(position: Vec2): Vec2 {
    const radius = l2(position);
    const gravityMagnitude = this.gravParam() / (radius * radius);
    return scale(unitVector(position), -1 * gravityMagnitude);
  }

  private eccentricity(position: Vec2, velocity: Vec2): number {
    // From here: https://en.wikipedia.org/wiki/Eccentricity_vector
    const positionScale: number =
      dot(velocity, velocity) / this.gravParam() - 1 / l2(position);
    const scaledPosition: Vec2 = scale(position, positionScale);
    const velocityScale: number = dot(position, velocity) / this.gravParam();
    const scaledVelocity: Vec2 = scale(velocity, velocityScale);
    return l2(subtract(scaledPosition, scaledVelocity));
  }

  private agentObservation(agent: AgentState, otherAgents: AgentState[]) {
    return agent;
  }

  /**
   * Shouldn't modify agent or otherAgents.
   * @param agent The agent to generate the next state for.
   * @param millisSinceLast The milliseconds since the last frame.
   * @param otherAgents All the agents besides this one.
   * @returns A tuple of the updated AgentState and the immediate reward.
   */
  private nextAgentState(
    agent: OrbitAgent,
    secondsSinceLast: number,
    otherAgents: AgentState[]
  ): [AgentState, number] {
    const eccentricity: number = this.eccentricity(
      agent.state.position,
      agent.state.velocity
    );

    let reaction: RL.Reaction;
    const situation: RL.Situation = {
      state: this.agentObservation(agent.state, otherAgents)
    };
    if ('lastAction' in agent) {
      reaction = agent.agent.react({
        situation: situation,
        lastAction: agent.lastAction,
        reward: 1 - eccentricity
      });
    } else {
      reaction = agent.agent.react(situation);
    }
    agent.lastAction = reaction.action;

    let thrustAcc: Vec2;
    if (reaction.action.action === ThrustActions.Forward) {
      thrustAcc = scale(unitVector(agent.state.velocity), 0.01);
    } else if (reaction.action.action === ThrustActions.Reverse) {
      thrustAcc = scale(unitVector(agent.state.velocity), -0.01);
    } else {
      thrustAcc = [0, 0];
    }

    const newVelocity = add(
      agent.state.velocity,
      scale(this.gravityVector(agent.state.position), secondsSinceLast),
      thrustAcc
    );
    const deltaPosition = scale(newVelocity, secondsSinceLast);
    const newPosition = add(agent.state.position, deltaPosition);

    return [
      {
        ...agent.state,
        position: newPosition,
        velocity: newVelocity
      },
      1 - eccentricity
    ];
  }
}
