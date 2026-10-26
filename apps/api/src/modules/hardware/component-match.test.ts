import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { bestComponentMatch } from './component-match';

const index = (...models: string[]) => models.map((model, i) => ({ model, score: 1000 - i }));
const pick = (name: string, candidates: ReturnType<typeof index>) => bestComponentMatch(name, candidates)?.model ?? null;

describe('bestComponentMatch', () => {
  const gpus = index('GeForce RTX 4060 Ti', 'GeForce RTX 4060', 'GeForce RTX 4060 Laptop', 'GeForce GTX 1060 6GB', 'GeForce GTX 1060 3GB', 'Radeon RX 6600 XT', 'Radeon RX 6600', 'Arc A770', 'Radeon 890M');
  const cpus = index('Core i7-8700K', 'Core i7-8700', 'Core i5-12400F', 'Ryzen 5 5600X', 'Ryzen 7 5800X3D', 'Ryzen 7 5800X', 'Ryzen AI 9 HX 370', 'Core Ultra 7 155H');

  it('reads graphics names as browsers report them', () => {
    assert.equal(pick('NVIDIA GeForce RTX 4060 Laptop GPU', gpus), 'GeForce RTX 4060 Laptop');
    assert.equal(pick('NVIDIA GeForce RTX 4060', gpus), 'GeForce RTX 4060');
    assert.equal(pick('NVIDIA GeForce RTX 4060 Ti', gpus), 'GeForce RTX 4060 Ti');
    assert.equal(pick('AMD Radeon RX 6600', gpus), 'Radeon RX 6600');
    assert.equal(pick('AMD Radeon(TM) RX 6600 XT', gpus), 'Radeon RX 6600 XT');
    assert.equal(pick('Intel(R) Arc(TM) A770 Graphics', gpus), 'Arc A770');
    assert.equal(pick('NVIDIA GeForce GTX 1060 3GB', gpus), 'GeForce GTX 1060 3GB');
  });

  it('reads processor names as Windows reports them', () => {
    assert.equal(pick('12th Gen Intel(R) Core(TM) i5-12400F   2.50 GHz', cpus), 'Core i5-12400F');
    assert.equal(pick('Intel(R) Core(TM) i7-8700 CPU @ 3.20GHz', cpus), 'Core i7-8700');
    assert.equal(pick('AMD Ryzen 5 5600X 6-Core Processor', cpus), 'Ryzen 5 5600X');
    assert.equal(pick('AMD Ryzen 7 5800X3D 8-Core Processor', cpus), 'Ryzen 7 5800X3D');
    assert.equal(pick('AMD Ryzen AI 9 HX 370 w/ Radeon 890M', cpus), 'Ryzen AI 9 HX 370');
    assert.equal(pick('Intel(R) Core(TM) Ultra 7 155H', cpus), 'Core Ultra 7 155H');
  });

  it('gives up rather than guessing', () => {
    assert.equal(pick('AMD Radeon(TM) Graphics', gpus), null);
    assert.equal(pick('NVIDIA GeForce RTX 3060', gpus), null);
    assert.equal(pick('Apple M2', cpus), null);
  });
});
