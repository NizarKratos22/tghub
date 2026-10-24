import type { RigPreset } from '@tgh/shared';
import { HardwareComponent, type ComponentDoc } from './hardware.model';
import { toComponent } from './hardware.service';

/**
 * Typical setups players can start from, referenced by stable component keys.
 * They describe kinds of machines, not shop listings — no prices, no brands of laptop.
 */
const PRESETS: Array<Omit<RigPreset, 'cpu' | 'gpu'> & { cpu: string; gpu: string }> = [
  { id: 'everyday-laptop', name: 'Everyday laptop', description: 'Thin and light, integrated graphics', cpu: 'intel-i5-1135g7', gpu: 'intel-iris-xe', ramGb: 8 },
  { id: 'entry-gaming-laptop', name: 'Entry gaming laptop', description: 'GTX 1650-class laptop', cpu: 'intel-i5-11400h', gpu: 'nvidia-gtx-1650-laptop', ramGb: 8 },
  { id: 'mainstream-gaming-laptop', name: 'Mainstream gaming laptop', description: 'RTX 3050-class laptop', cpu: 'intel-i5-12450h', gpu: 'nvidia-rtx-3050-laptop', ramGb: 16 },
  { id: 'current-gaming-laptop', name: 'Current gaming laptop', description: 'RTX 4060-class laptop', cpu: 'intel-i7-13620h', gpu: 'nvidia-rtx-4060-laptop', ramGb: 16 },
  { id: 'second-hand-desktop', name: 'Second-hand desktop', description: 'Older office PC with a GTX 1050 Ti added', cpu: 'intel-i5-4590', gpu: 'nvidia-gtx-1050ti', ramGb: 8 },
  { id: 'apu-desktop', name: 'Desktop without a graphics card', description: 'Ryzen APU on its integrated graphics', cpu: 'amd-r5-5600g', gpu: 'amd-vega-7', ramGb: 16 },
  { id: 'sweet-spot-desktop', name: '1080p sweet spot', description: 'Popular mid-range desktop', cpu: 'amd-r5-5600', gpu: 'nvidia-rtx-3060', ramGb: 16 },
  { id: 'high-end-desktop', name: 'High-end desktop', description: 'Built for 1440p and above', cpu: 'amd-r7-7800x3d', gpu: 'nvidia-rtx-4070s', ramGb: 32 },
];

export async function listPresets(): Promise<RigPreset[]> {
  const keys = PRESETS.flatMap((preset) => [preset.cpu, preset.gpu]);
  const docs = await HardwareComponent.find({ key: { $in: keys } }).lean<ComponentDoc[]>();
  const byKey = new Map(docs.map((doc) => [doc.key, toComponent(doc)]));

  // A preset whose parts are missing from the index is skipped rather than half-filled.
  return PRESETS.flatMap(({ cpu, gpu, ...preset }) => {
    const cpuPart = byKey.get(cpu);
    const gpuPart = byKey.get(gpu);
    return cpuPart && gpuPart ? [{ ...preset, cpu: cpuPart, gpu: gpuPart }] : [];
  });
}
