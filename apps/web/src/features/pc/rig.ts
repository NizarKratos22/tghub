'use client';

import type { HardwareComponent, PcSpec, SpecHardwareInput } from '@tgh/shared';
import { useCallback, useEffect, useState } from 'react';

/** The rig being edited in the PC Lab. Guests keep it in this browser only. */
export interface RigDraft {
  cpu: HardwareComponent | null;
  gpu: HardwareComponent | null;
  ramGb: number;
  storageGb: number | null;
}

const STORAGE_KEY = 'tgh.rig.v1';
export const EMPTY_RIG: RigDraft = { cpu: null, gpu: null, ramGb: 16, storageGb: null };
export const RAM_OPTIONS = [4, 8, 12, 16, 24, 32, 64];

function readStoredRig(): RigDraft | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? ({ ...EMPTY_RIG, ...JSON.parse(raw) } as RigDraft) : null;
  } catch {
    return null;
  }
}

export function useRigDraft() {
  const [rig, setRig] = useState<RigDraft>(EMPTY_RIG);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = readStoredRig();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage only exists after hydration; reading it in render would mismatch the server HTML.
    if (stored) setRig(stored);
    setLoaded(true);
  }, []);

  const update = useCallback((changes: Partial<RigDraft>) => {
    setRig((current) => {
      const next = { ...current, ...changes };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Private mode or storage full — the rig just won't persist.
      }
      return next;
    });
  }, []);

  return { rig, update, loaded };
}

export const isComplete = (rig: RigDraft): rig is RigDraft & { cpu: HardwareComponent; gpu: HardwareComponent } =>
  Boolean(rig.cpu && rig.gpu && rig.ramGb);

export function toHardware(rig: RigDraft & { cpu: HardwareComponent; gpu: HardwareComponent }): SpecHardwareInput {
  return { cpuId: rig.cpu.id, gpuId: rig.gpu.id, ramGb: rig.ramGb, storageGb: rig.storageGb };
}

export const rigFromSpec = (spec: PcSpec): RigDraft => ({ cpu: spec.cpu, gpu: spec.gpu, ramGb: spec.ramGb, storageGb: spec.storageGb });

export const componentName = (component: HardwareComponent) => `${component.brand} ${component.model}`;
