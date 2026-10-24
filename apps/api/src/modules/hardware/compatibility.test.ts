import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { RequirementTier } from '@tgh/shared';
import { evaluate, grade, type HardwareProfile } from './compatibility';

const tier = (overrides: Partial<RequirementTier>): RequirementTier => ({
  cpuLabel: 'CPU',
  gpuLabel: 'GPU',
  cpuScore: 5000,
  gpuScore: 6000,
  ramGb: 8,
  vramGb: null,
  storageGb: null,
  os: null,
  ...overrides,
});

const rig = (overrides: Partial<HardwareProfile> = {}): HardwareProfile => ({
  cpu: { label: 'Test CPU', score: 20_000 },
  gpu: { label: 'Test GPU', score: 20_000, vramGb: 8 },
  ramGb: 16,
  storageGb: null,
  ...overrides,
});

describe('grade', () => {
  it('ranks against recommended first, then minimum', () => {
    assert.equal(grade(100, 50, 80), 'recommended');
    assert.equal(grade(60, 50, 80), 'minimum');
    assert.equal(grade(40, 50, 80), 'below');
  });

  it('refuses to guess without data', () => {
    assert.equal(grade(null, 50, 80), 'unknown');
    assert.equal(grade(100, null, null), 'unknown');
    // Under the only published tier, we can't tell whether it meets a minimum.
    assert.equal(grade(60, null, 80), 'unknown');
  });
});

describe('evaluate', () => {
  const tiers = { minimum: tier({}), recommended: tier({ cpuScore: 10_000, gpuScore: 12_000, ramGb: 16 }) };

  it('passes a strong rig at the recommended tier', () => {
    const result = evaluate(rig(), tiers);
    assert.equal(result.overall, 'recommended');
    assert.equal(result.confidence, 'full');
    assert.equal(result.bottleneck, null);
  });

  it('reports the weakest part as the bottleneck', () => {
    const result = evaluate(rig({ gpu: { label: 'Weak GPU', score: 7000, vramGb: 4 } }), tiers);
    assert.equal(result.overall, 'minimum');
    assert.equal(result.bottleneck, 'gpu');
  });

  it('fails the whole verdict when any known part is below minimum', () => {
    const result = evaluate(rig({ ramGb: 4 }), tiers);
    assert.equal(result.overall, 'below');
    assert.match(result.detail, /memory/);
  });

  it('checks VRAM only when the developer lists it', () => {
    const withVram = { ...tiers, minimum: tier({ vramGb: 6 }) };
    const result = evaluate(rig({ gpu: { label: 'GPU', score: 20_000, vramGb: 4 } }), withVram);
    assert.equal(result.dimensions.find((d) => d.key === 'vram')?.status, 'below');
    assert.equal(result.overall, 'below');
    assert.equal(evaluate(rig(), tiers).dimensions.some((d) => d.key === 'vram'), false);
  });

  it('treats a single published tier as the target to meet', () => {
    const result = evaluate(rig(), { minimum: tier({}), recommended: null });
    assert.equal(result.overall, 'recommended');
    assert.match(result.detail, /single spec tier/);
    assert.ok(result.dimensions.every((d) => d.recommended === null));
  });

  it('says "unknown" rather than passing a rig it cannot score', () => {
    const result = evaluate(rig({ cpu: { label: 'Mystery CPU', score: null } }), tiers);
    assert.equal(result.overall, 'unknown');
    assert.equal(result.confidence, 'partial');
  });
});
