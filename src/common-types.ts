export type Vec2 = [number, number];

export const distance = (a: Vec2, b: Vec2): number => {
  return Math.sqrt(
    (a[0] - b[0]) * (a[0] - b[0]) + (a[1] - b[1]) * (a[1] - b[1])
  );
};

export const l2 = (p: Vec2): number => {
  return distance(p, [0, 0]);
};

export const scale = (v: Vec2, scalar: number): Vec2 => {
  return [v[0] * scalar, v[1] * scalar];
};

export const add = (...summands: Vec2[]): Vec2 => {
  let sum: Vec2 = [0, 0];
  for (const summand of summands) {
    sum = [sum[0] + summand[0], sum[1] + summand[1]];
  }
  return sum;
};

export const subtract = (a: Vec2, b: Vec2): Vec2 => {
  return [a[0] - b[0], a[1] - b[1]];
};

export const unitVector = (v: Vec2) => {
  return scale(v, l2(v));
};

export const dot = (a: Vec2, b: Vec2): number => {
  return a[0] * b[0] + a[1] * b[1];
};
