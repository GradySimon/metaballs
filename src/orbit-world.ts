import {
  add,
  dot,
  l2,
  scale,
  subtract,
  unitVector,
  Vec2,
} from './common-types';
import { Metaball, MetaballKind } from './metaball';
import * as RL from './rl';
import { Agent } from 'http';
import _ = require('lodash');

interface OrbitState {
  position: Vec2;
  velocity: Vec2;
  mass: number;
}

enum ThrustAction {
  None,
  Forward,
  Reverse,
}

const randomAgentState = (): OrbitState => {
  return {
    position: [Math.random() * 1.8 - 0.9, Math.random() * 1.8 - 0.9],
    velocity: [Math.random() * 0.5 - 0.25, Math.random() * 0.5 - 0.25],
    mass: Math.random() * 0.07,
  };
};

interface OrbitAgent {
  state: OrbitState;
  lastAction?: RL.ActionProp<ThrustAction>;
}

interface DemoAgent extends OrbitAgent {
  pendingInput?: ThrustAction;
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

  // private time: number = 0;
  private timeStepSize: number = 1 / 30;
  private originMass: number = 0;
  private steps: number = 0;
  private agent?: RL.Agent<ThrustAction>;
  private orbiters: OrbitAgent[] = [];
  private demoOrbiter: DemoAgent;
  constructor() {
    //
  }

  public async init(numAgents: number) {
    this.originMass = Math.random() * 0.1 + 0.1;
    this.agent = new RL.Agent<ThrustAction>(1, 5, [
      ThrustAction.None,
      ThrustAction.Forward,
      ThrustAction.Reverse,
    ]);
    await this.agent.init();
    for (let i = 0; i < numAgents; i++) {
      const orbiter: OrbitAgent = {
        state: randomAgentState(),
      };
      this.orbiters.push(orbiter);
    }
    this.demoOrbiter = {
      state: randomAgentState(),
    };
    window.addEventListener('keydown', (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': {
          console.log('Demo orbiter thrusting forward');
          this.demoOrbiter.pendingInput = ThrustAction.Forward;
          break;
        }
        case 'KeyS': {
          console.log('Demo orbiter thrusting in reverse');
          this.demoOrbiter.pendingInput = ThrustAction.Reverse;
          break;
        }
      }
    });
  }

  public async step() {
    if (this.steps % 200 === 0) {
      // console.debug('Elapsed time: (', elapsedTime / 1000, '):', this.orbiters);
      // console.debug('OrbitWorld metaballs:', this.asMetaballs();
    }
    await this.updateOrbiters();
    this.steps++;
  }

  public asMetaballs(): Metaball[] {
    const metaballs: Metaball[] = [];
    metaballs.push({
      kind: MetaballKind.QUADRATIC,
      position: [0, 0],
      radius: this.originMass,
    });
    for (const agent of this.orbiters) {
      metaballs.push({
        kind: MetaballKind.QUADRATIC,
        position: agent.state.position,
        radius: agent.state.mass,
      });
    }
    metaballs.push({
      kind: MetaballKind.LINEAR,
      position: this.demoOrbiter.state.position,
      radius: this.demoOrbiter.state.mass,
    });
    return metaballs;
  }

  private getOutcome(orbiter: OrbitAgent): RL.Outcome<ThrustAction> {
    const agentInput: RL.Outcome<ThrustAction> = {
      situation: { state: this.agentObservation(orbiter.state) },
    };
    if ('lastAction' in orbiter) {
      agentInput.lastAction = orbiter.lastAction;
      // agentInput.reward = -l2(orbiter.state.velocity);
      agentInput.reward =
        // 1 -
        -this.eccentricity(orbiter.state.position, orbiter.state.velocity);
      // Math.abs(l2(orbiter.state.velocity) - 0.1) / 0.05 -
      // -Math.abs(l2(orbiter.state.position) - 0.4) / 0.15;
    }
    return agentInput;
  }

  private async updateOrbiters() {
    const agentInputs = this.orbiters.map((a) => this.getOutcome(a));
    const demoInput = this.getOutcome(this.demoOrbiter);
    agentInputs.push(demoInput);
    const reactions = await this.agent.reactAll(agentInputs);
    const agentReactions = _.dropRight(reactions);
    for (let i = 0; i < this.orbiters.length; i++) {
      const orbiter = this.orbiters[i];
      const reaction = agentReactions[i];
      orbiter.lastAction = reaction.action;

      orbiter.state = this.updateOrbiterState(
        orbiter.state,
        reaction.action.action
      );
    }
    const demoAction = this.demoOrbiter.pendingInput || ThrustAction.None;
    this.demoOrbiter.pendingInput = null;
    this.demoOrbiter.lastAction = {
      action: demoAction,
      state: demoInput.situation.state,
    };
    this.demoOrbiter.state = this.updateOrbiterState(
      this.demoOrbiter.state,
      demoAction
    );
  }

  private updateOrbiterState(
    orbitState: OrbitState,
    action: ThrustAction
  ): OrbitState {
    const maxVelocity = this.escapeVelocity(orbitState.position) - 0.05;
    let thrustAcc: Vec2;
    if (
      action === ThrustAction.Forward &&
      l2(orbitState.velocity) < maxVelocity
    ) {
      thrustAcc = scale(unitVector(orbitState.velocity), 0.05);
    } else if (action === ThrustAction.Reverse) {
      thrustAcc = scale(unitVector(orbitState.velocity), -0.05);
    } else {
      thrustAcc = [0, 0];
    }

    const newVelocity = add(
      orbitState.velocity,
      scale(this.gravityVector(orbitState.position), this.timeStepSize),
      thrustAcc
    );
    const deltaPosition = scale(newVelocity, this.timeStepSize);
    const newPosition = add(orbitState.position, deltaPosition);
    return {
      mass: orbitState.mass,
      position: newPosition,
      velocity: newVelocity,
    };
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

  private escapeVelocity(position: Vec2): number {
    return Math.sqrt(
      (2 * GRAVITATIONAL_CONSTANT * this.originMass) / l2(position)
    );
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

  private agentObservation(agent: OrbitState) {
    const observation = [];
    observation.push(
      agent.velocity[0],
      agent.velocity[1],
      agent.position[0],
      agent.position[1],
      agent.mass
    );
    return observation;
  }

  /**
   * Shouldn't modify agent or otherAgents.
   * @param agent The agent to generate the next state for.
   * @param millisSinceLast The milliseconds since the last frame.
   * @param otherAgents All the agents besides this one.
   * @returns A tuple of the updated AgentState and the immediate reward.
   */
  // private async nextAgentState(
  //   agent: OrbitAgent,
  //   secondsSinceLast: number,
  //   // otherAgents: AgentState[]
  // ): Promise<AgentState> {
  //   const eccentricity: number = this.eccentricity(
  //     agent.state.position,
  //     agent.state.velocity
  //   );

  //   let reaction: RL.Reaction<ThrustAction>;
  //   const situation: RL.Situation = {
  //     state: this.agentObservation(agent.state)
  //   };
  //   if ('lastAction' in agent) {
  //     reaction = await agent.agent.react({
  //       situation: situation,
  //       lastAction: agent.lastAction,
  //       // reward: -l2(agent.state.velocity)
  //       reward: 1 - eccentricity
  //     });
  //   } else {
  //     reaction = await agent.agent.react(situation);
  //   }
  //   agent.lastAction = reaction.action;

  //   let thrustAcc: Vec2;
  //   if (reaction.action.action === ThrustAction.Forward) {
  //     thrustAcc = scale(unitVector(agent.state.velocity), 0.05);
  //   } else if (reaction.action.action === ThrustAction.Reverse) {
  //     thrustAcc = scale(unitVector(agent.state.velocity), -0.05);
  //   } else {
  //     thrustAcc = [0, 0];
  //   }

  //   const newVelocity = add(
  //     agent.state.velocity,
  //     scale(this.gravityVector(agent.state.position), secondsSinceLast),
  //     thrustAcc
  //   );
  //   const deltaPosition = scale(newVelocity, secondsSinceLast);
  //   const newPosition = add(agent.state.position, deltaPosition);

  //   return {
  //     ...agent.state,
  //     position: newPosition,
  //     velocity: newVelocity
  //   };
  // }
}
