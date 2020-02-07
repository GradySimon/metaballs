import { Point } from "./common-types";

export enum MetaballKind {
  QUADRATIC = 1,
  NEG_QUADRATIC = 2,
  LINEAR = 3,
  NEG_LINEAR = 4,
  ZERO = 5,
}

export interface Metaball {
  kind?: MetaballKind;
  position: Point;
  radius: number;
}

interface Oscillation {
  period?: number;
  tOffset?: number;
  outMin?: number;
  outMax?: number;
  fn?: (x: number) => number;
}

const oscillate = (t: number, {
  period = 4000,
  tOffset = 0,
  outMin = -0.5,
  outMax = 0.5,
  fn = Math.sin,
}: Oscillation): number => {
  const range = outMax - outMin;
  const tScale = 2 * Math.PI / period;
  return fn((t + tOffset) * tScale) * range / 2 + (range / 2) + outMin;
};


interface Orbit {
  period?: number,
  tOffset?: number,
  xAxis?: number,
  yAxis?: number,
}

const orbit = (t: number, {
  period = 4000,
  tOffset = 0,
  xAxis = 1,
  yAxis = 1,
}: Orbit): Point => {
  return [
    oscillate(t,
      {
        period: period,
        tOffset: tOffset,
        outMin: -xAxis,
        outMax: xAxis,
      }),
    oscillate(t,
      {
        period: period,
        tOffset: tOffset,
        outMin: -yAxis,
        outMax: yAxis,
        fn: Math.cos
      })];
}

interface CircularOrbit extends Orbit {
  radius?: number;
};

const circularOrbit = (t: number, {
  period = 4000, tOffset = 0, radius = 1,
}: CircularOrbit): Point => {
  return orbit(t, {
    period, tOffset,
    xAxis: radius,
    yAxis: radius,
  });
}

const orbitalRing = (t: number,
  count: number,
  orbit: CircularOrbit): Point[] {
  let points: Point[] = [];
  for (let i = 0; i < count; i++) {
    orbit.tOffset = i * (orbit.period / count)
    points.push(circularOrbit(t, orbit));
  }
  return points;
}

const ballsLike =
  (positions: Point[],
    radius: number,
    kind = MetaballKind.QUADRATIC): Metaball[] => {
    let balls: Metaball[] = [];
    for (const position of positions) {
      balls.push({ position, radius, kind });
    }
    return balls;
  }

export interface SceneParams {
  elapsed_time: number;
  mouse: Point;
}

export const metaballScene = (params: SceneParams): Metaball[] => {
  let metaballs: Metaball[] = [];
  const num_balls = 8;
  const period = 48000;
  const radius = 0.77;
  // metaballs.push({ position: params.mouse, radius: 0.06 });
  // metaballs.push({
  //   position:
  //     circularOrbit(params.elapsed_time, { period: 32000, radius: radius }),
  //   radius: 0.07
  // });
  metaballs.push({
    position:
      circularOrbit(params.elapsed_time, { period: 32000, radius: 0.00 }),
    radius: 0.33
  });
  metaballs.push({
    position:
      circularOrbit(params.elapsed_time, { period: 32000, radius: 0.00 }),
    radius: 0.52,
    kind: MetaballKind.ZERO
  });
  metaballs.push(...ballsLike(
    orbitalRing(params.elapsed_time, num_balls,
      { period: period * 2, radius: radius - 0.04 }),
    0.060, MetaballKind.NEG_QUADRATIC));
  metaballs.push(...ballsLike(
    orbitalRing(params.elapsed_time, num_balls
                { period: -period, radius: radius }),
    0.055, MetaballKind.QUADRATIC));
  metaballs.push(...ballsLike(
    orbitalRing(params.elapsed_time + period / (num_balls * 2),
      num_balls,
      { period: -period, radius: radius }),
    0.055, MetaballKind.QUADRATIC));
  metaballs.push(...ballsLike(
    orbitalRing(params.elapsed_time + period / (num_balls * 2),
      num_balls, { period: period, radius: radius + 0.04 }),
    0.060, MetaballKind.NEG_QUADRATIC));
  // metaballs.push(...orbitalRing(params.elapsed_time,
  //   { period: -period, radius: radius }, num_balls, 0.0634));
  // if (params.elapsed_time % 30 === 0) {
  //   console.log(metaballs[0].position)
  //   console.log(metaballs);
  // }
  return metaballs;
}