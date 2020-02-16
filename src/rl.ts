import * as tf from '@tensorflow/tfjs';
import { ENGINE } from '@tensorflow/tfjs-core/dist/engine';
import * as _ from 'lodash';

function gatherND(x: tf.Tensor, indices: tf.Tensor): tf.Tensor {
  const grad = (dy: tf.Tensor, saved: tf.Tensor[]) => {
    // dy = tf.reshape(dy, [-1]);
    // console.log('x:', x, '\ndy:', dy, '\nsaved:', saved, '\nindices:', indices);
    return { x: () => tf.scatterND(saved[0], dy, x.shape) };
  };
  return ENGINE.runKernelFunc(
    (backend, save) => {
      save([indices]);
      return backend.gatherND(x, indices);
    },
    { x },
    grad
  ) as
    tf.Tensor;
}

const stopGradient = tf.customGrad((x: tf.Tensor, _save) => {
  return {
    value: x,
    gradFunc: (dy, _saved) => [tf.zerosLike(dy)]
  };
});

export interface Situation {
  state: number[];
}

export interface ActionProp<ActionSpace> {
  state: number[];
  action: ActionSpace;
}

export interface Reaction<ActionSpace> {
  action?: ActionProp<ActionSpace>;
}

export interface Outcome<ActionSpace> {
  // If provided, respond with a new ActionProp and prepare for the next step.
  // Also required for the agent to learn from the Outcome.
  situation?: Situation;

  // The action this is the outcome for. Required for the agent to learn from
  // the outcome.
  lastAction?: ActionProp<ActionSpace>;

  // If provided, learn from the reward.
  reward?: number;
}

export class Agent<ActionSpace> {
  // private learningRate = 0.005;
  private stepsOfLearning: number = 0;
  private model: {
    valueFn?: tf.LayersModel;
    oldValueFn?: tf.LayersModel;
    optimizer?: tf.Optimizer;
  } = {};

  private actionMap: Map<ActionSpace, number> = new Map();
  constructor(
    public readonly batchSize: number,
    public readonly featureDims: number,
    public readonly actions: ActionSpace[]
  ) {
    for (let i = 0; i < actions.length; i++) {
      this.actionMap.set(actions[i], i);
    }
  }

  public async init() {
    this.model.valueFn = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [this.featureDims],
          units: this.actions.length
        })
      ]
    });
    await this.model.valueFn.save('localstorage://value-fn');
    this.model.oldValueFn = await tf.loadLayersModel('localstorage://value-fn');
    this.model.optimizer = tf.train.adam(0.1);
    console.log(
      `Initialized Agent with ${this.featureDims} feature dimensions, with action`,
      `space: ${this.actions},`
    );
    console.log('and with model:');
    this.model.valueFn.summary();
    console.log('which has weights:');
    this.model.valueFn?.weights.forEach((w) => {
      console.log(w.name, w.shape);
    });
    console.log('Optimizer:', this.model.optimizer);
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
  public async react(
    outcome: Situation | Outcome<ActionSpace>
  ): Promise<Reaction<ActionSpace>> {
    // if is a Sitaution
    if (outcome.hasOwnProperty('state')) {
      // Wrap into an Outcome
      outcome = { situation: outcome as Situation };
    }
    // console.debug('Reacting to:', outcome);
    if ('reward' in outcome && 'lastAction' in outcome) {

      await this.updateValueFn(outcome);
      this.stepsOfLearning++;
    }
    return {
      action: {
        state: (outcome as Outcome<ActionSpace>).situation.state,
        action: this.actions[
          this.sampleAction(
            (outcome as Outcome<ActionSpace>).situation.state, 0.9
          )
        ]
      }
    };
  }

  private async updateValueFn(outcome: Outcome<ActionSpace>) {
    if (this.stepsOfLearning % 10000 === 0) {
      console.log('Swapping valueFns...');
      await this.model.valueFn.save('localstorage://value-fn');
      this.model.oldValueFn = await tf.loadLayersModel('localstorage://value-fn');
      console.log('... Swapping valueFns complete.');
    }
    // tslint:disable-next-line:no-unused-expression
    await this.model.optimizer.minimize(() => {
      const actionValues: tf.Tensor2D = this.model.valueFn.predictOnBatch(
        tf.tensor([outcome.lastAction.state])
      ) as tf.Tensor2D;
      // console.log('actionValues:', actionValues);
      const valueOfPrevious: tf.Tensor = gatherND(
        actionValues,
        tf.tensor([0, this.actionMap.get(outcome.lastAction.action)], [1, 2], 'int32'),
      );
      // console.log(valueOfPrevious);
      const nextActionValues: tf.Tensor2D = this.model.oldValueFn.predictOnBatch(
        tf.tensor([outcome.situation.state])
      ) as tf.Tensor2D;
      // TODO: Select based on epsilon greedy
      // console.log('nextActionValues:', nextActionValues);
      const greedySelections = this.epsilonGreedy(nextActionValues, 0.0);
      const coords = this.epsilonGreedyActionCoordinates(greedySelections);
      // console.log(coords);
      const valueOfNext = gatherND(
        nextActionValues,
        coords,
        // tf.tensor([0, this.actionMap.get(outcome.lastAction.action)], [1, 2], 'int32'),
      );
      // TODO: Discount future reward
      const sarsaTarget: tf.Tensor = stopGradient(
        valueOfNext.mul(0.99).add(outcome.reward)
      );

      const loss = tf.losses.meanSquaredError(sarsaTarget, valueOfPrevious);
      loss.data().then((l) => {
        if (this.stepsOfLearning % 3000 === 0) {
          console.log('loss:', l);
        }
      });
      return loss as tf.Scalar;
    });
  }

  private sampleAction(state: number[], epsilon: number) {
    const actionValues: tf.Tensor2D = this.model.valueFn.predictOnBatch(
      tf.tensor([state])
    ) as tf.Tensor2D;
    const actionSelections: tf.Tensor1D = this.epsilonGreedy(actionValues, epsilon);
    return actionSelections.arraySync()[0];
  }

  private epsilonGreedy(actionValues: tf.Tensor2D, epsilon: number): tf.Tensor1D {
    if (Math.random() < epsilon) {
      return tf.argMax(actionValues, 1);
    } else {
      return tf.randomUniform([actionValues.shape[0], 1], 0, this.actions.length, 'int32');
    }
  }

  private epsilonGreedyActionCoordinates(epsilonGreedySelections: tf.Tensor1D): tf.Tensor2D {
    const batchIndices: tf.Tensor2D = tf.range(0, epsilonGreedySelections.shape[0], 1, 'int32').reshape([-1, 1]);
    const reshapedEpsilonGreedySelections: tf.Tensor2D = epsilonGreedySelections.reshape([-1, 1]);

    return tf.concat2d([batchIndices, reshapedEpsilonGreedySelections], 1);
  }
}

