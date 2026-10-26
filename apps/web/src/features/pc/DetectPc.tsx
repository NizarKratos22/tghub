'use client';

import { useMutation } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { browserMemoryGb, detectGpuName, nearestRam, parseSpecsText, ramAtLeast } from './detect';
import { componentName, type RigDraft } from './rig';
import styles from './PcLab.module.css';

type Part = 'gpu' | 'cpu' | 'ram';

interface Finding {
  part: Part;
  tone: 'ok' | 'info' | 'warn';
  text: string;
}

const TONE_ICON = { ok: 'check', info: 'info', warn: 'alert' } as const;
const PART_ORDER: Part[] = ['gpu', 'cpu', 'ram'];

/** Newer findings replace older ones about the same part. */
const merge = (current: Finding[] | null, found: Finding[]) =>
  PART_ORDER.flatMap((part) => found.filter((f) => f.part === part).concat(found.some((f) => f.part === part) ? [] : (current ?? []).filter((f) => f.part === part)));

/**
 * "Detect this PC": fills the graphics card (and memory, when the browser's
 * figure is exact enough) from this browser — on its own the first time the
 * PC Lab opens with an empty rig. The processor comes from pasted Windows specs.
 */
export function DetectPc({ rig, onApply }: { rig: RigDraft; onApply: (changes: Partial<RigDraft>) => void }) {
  const t = useT();
  const words = t.pc.detect;
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [auto, setAuto] = useState(false);
  const [pasted, setPasted] = useState('');
  const started = useRef(false);

  const detect = useMutation({
    mutationFn: async () => {
      const changes: Partial<RigDraft> = {};
      const found: Finding[] = [];

      const gpuName = detectGpuName();
      const gpu = gpuName ? await api.pc.matchComponent('gpu', gpuName).catch(() => null) : null;
      if (gpu) {
        changes.gpu = gpu;
        found.push({ part: 'gpu', tone: 'ok', text: fill(words.gpuFound, { name: componentName(gpu) }) });
      } else {
        found.push(
          gpuName ? { part: 'gpu', tone: 'warn', text: fill(words.gpuUnknown, { name: gpuName }) } : { part: 'gpu', tone: 'info', text: words.gpuHidden },
        );
      }

      // Browsers round memory down (and cap it), so it's a floor: safe for "will it run", worth checking.
      const memory = browserMemoryGb();
      if (memory === null) found.push({ part: 'ram', tone: 'info', text: words.memoryHidden });
      else {
        changes.ramGb = ramAtLeast(memory);
        found.push({ part: 'ram', tone: 'info', text: fill(words.memoryAtLeast, { gb: changes.ramGb }) });
      }

      found.push({ part: 'cpu', tone: 'info', text: words.cpuHidden });
      return { changes, found };
    },
    onSuccess: ({ changes, found }) => {
      if (Object.keys(changes).length > 0) onApply(changes);
      setFindings((current) => merge(current, found));
    },
  });

  const readPasted = useMutation({
    mutationFn: async () => {
      const specs = parseSpecsText(pasted);
      const changes: Partial<RigDraft> = {};
      const found: Finding[] = [];
      const [cpu, gpu] = await Promise.all([
        specs.cpu ? api.pc.matchComponent('cpu', specs.cpu).catch(() => null) : null,
        specs.gpu ? api.pc.matchComponent('gpu', specs.gpu).catch(() => null) : null,
      ]);
      if (cpu) {
        changes.cpu = cpu;
        found.push({ part: 'cpu', tone: 'ok', text: fill(words.cpuFound, { name: componentName(cpu) }) });
      } else if (specs.cpu) found.push({ part: 'cpu', tone: 'warn', text: fill(words.cpuUnknown, { name: specs.cpu.replace(/\s+/g, ' ') }) });
      if (gpu) {
        changes.gpu = gpu;
        found.push({ part: 'gpu', tone: 'ok', text: fill(words.gpuFound, { name: componentName(gpu) }) });
      }
      if (specs.ramGb) {
        changes.ramGb = nearestRam(specs.ramGb);
        found.push({ part: 'ram', tone: 'ok', text: fill(words.memoryFound, { gb: changes.ramGb }) });
      }
      if (found.length === 0) found.push({ part: 'cpu', tone: 'warn', text: words.pasteEmpty });
      return { changes, found };
    },
    onSuccess: ({ changes, found }) => {
      if (Object.keys(changes).length > 0) onApply(changes);
      setFindings((current) => merge(current, found));
      setAuto(false);
    },
  });

  // First visit with nothing picked yet: detect without being asked.
  useEffect(() => {
    if (started.current || rig.cpu || rig.gpu) return;
    started.current = true;
    setAuto(true);
    detect.mutate();
  }, [rig.cpu, rig.gpu, detect]);

  return (
    <div className={styles.detect}>
      <div className={styles.detectHead}>
        <span className={styles.detectIcon} aria-hidden>
          <Icon name="cpu" size={20} />
        </span>
        <span className={styles.detectWords}>
          <span className={styles.detectTitle}>{words.title}</span>
          <span className={styles.detectText}>{auto && findings ? words.autoNote : words.text}</span>
        </span>
        <Button
          size="sm"
          variant={findings ? 'outline' : 'primary'}
          icon="refresh"
          loading={detect.isPending}
          onClick={() => {
            setAuto(false);
            detect.mutate();
          }}
        >
          {findings ? words.again : words.button}
        </Button>
      </div>

      {findings ? (
        <ul className={styles.findings} aria-live="polite">
          {findings.map((finding) => (
            <li key={finding.text} className={cx(styles.finding, styles[`finding_${finding.tone}`])}>
              <Icon name={TONE_ICON[finding.tone]} size={14} />
              <span dir="auto">{finding.text}</span>
            </li>
          ))}
        </ul>
      ) : null}

      <details className={styles.paste}>
        <summary>{words.pasteLabel}</summary>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            readPasted.mutate();
          }}
        >
          <textarea
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={words.pastePlaceholder}
            rows={4}
            dir="auto"
            aria-label={words.pasteLabel}
          />
          <Button type="submit" size="sm" disabled={!pasted.trim()} loading={readPasted.isPending}>
            {words.pasteButton}
          </Button>
        </form>
        <p className={styles.detectPrivacy}>{words.privacy}</p>
      </details>
    </div>
  );
}
