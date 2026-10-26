/**
 * What a browser can tell about the computer it runs on. The graphics card's
 * name comes from WebGL; memory from navigator.deviceMemory (Chromium only,
 * rounded down to a power of two and capped — at 8 GB in older versions). No
 * browser reveals the processor, so people paste the specifications Windows
 * copies for them (Settings → System → About → Copy). The pasted text stays in
 * the browser; only part names are looked up.
 */

import { RAM_OPTIONS } from './rig';

/** Software renderers mean "no graphics card visible", not a real part. */
const SOFTWARE = /swiftshader|llvmpipe|softpipe|basic render|microsoft basic|mesa offscreen/i;

/**
 * WebGL renderer string → the part's name.
 *   "ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU (0x000028E0) Direct3D11 vs_5_0 ps_5_0, D3D11)" → "NVIDIA GeForce RTX 4060 Laptop GPU"
 *   "ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3060/PCIe/SSE2, OpenGL 4.5.0)" → "NVIDIA GeForce RTX 3060"
 *   "ANGLE (Apple, ANGLE Metal Renderer: Apple M2, Unspecified Version)" → "Apple M2"
 */
export function cleanRenderer(raw: string): string | null {
  let name = raw.trim();
  const angle = /^ANGLE \((.*)\)$/i.exec(name);
  if (angle) {
    const parts = angle[1]!.split(/,\s*/);
    name = parts.length > 1 ? parts[1]! : parts[0]!;
  }
  name = name
    .replace(/^ANGLE Metal Renderer:\s*/i, '')
    .replace(/\s*\(0x[0-9a-f]+\)/gi, '')
    .replace(/\s+(Direct3D|OpenGL|Vulkan|vs_\d).*$/i, '')
    .split('/')[0]!
    .trim();
  return name.length >= 3 && !SOFTWARE.test(name) ? name : null;
}

export function detectGpuName(): string | null {
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    if (!gl) return null;
    const info = gl.getExtension('WEBGL_debug_renderer_info');
    const raw = info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    return typeof raw === 'string' ? cleanRenderer(raw) : null;
  } catch {
    return null;
  }
}

/** navigator.deviceMemory in GB — a lower bound — or null when the browser doesn't share it. */
export function browserMemoryGb(): number | null {
  const value = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  return typeof value === 'number' && value > 0 ? value : null;
}

/** The PC Lab's memory option closest to an amount. */
export const nearestRam = (gb: number) => RAM_OPTIONS.reduce((best, option) => (Math.abs(option - gb) < Math.abs(best - gb) ? option : best));

/** The largest option that a lower bound guarantees (the smallest option when it guarantees none). */
export const ramAtLeast = (gb: number) => RAM_OPTIONS.filter((option) => option <= gb).at(-1) ?? RAM_OPTIONS[0]!;

export interface PastedSpecs {
  cpu: string | null;
  gpu: string | null;
  ramGb: number | null;
}

/**
 * Text copied from Windows (Settings → System → About, in English, French or
 * Arabic) or from dxdiag → processor, graphics card and installed memory.
 */
export function parseSpecsText(text: string): PastedSpecs {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const labelled = (label: RegExp) => {
    for (const line of lines) {
      const value = label.exec(line)?.[1]?.trim();
      if (value) return value;
    }
    return null;
  };

  const cpu =
    labelled(/^(?:processor|processeur|المعالج|cpu)\s*[:\t]?\s+(.+)$/i) ??
    lines.find((line) => /\b(?:core|ryzen|intel|athlon|pentium|celeron)\b/i.test(line) && !/graphics|radeon\s+rx|geforce/i.test(line)) ??
    null;
  const gpu = labelled(/^(?:card name|display adapter|graphics card|carte graphique|gpu)\s*[:\t]?\s+(.+)$/i);

  let ramGb: number | null = null;
  for (const line of lines) {
    if (!/ram|m[ée]moire|memory|ذاكرة/i.test(line)) continue;
    const gb = /(\d+(?:[.,]\d+)?)\s*(?:gb|go|جيجابايت|جيجا)/i.exec(line);
    const mb = /(\d{3,7})\s*mb/i.exec(line);
    if (gb) ramGb = Math.round(Number(gb[1]!.replace(',', '.')));
    else if (mb) ramGb = Math.round(Number(mb[1]) / 1024);
    if (ramGb) break;
  }
  return { cpu, gpu, ramGb };
}
