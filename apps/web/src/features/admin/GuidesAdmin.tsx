'use client';

import type { AdminGuideRow } from '@tgh/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, TextAreaField, TextField } from '@/components/ui/Field';
import { Skeleton, Tag } from '@/components/ui/primitives';
import { RelativeTime } from '@/components/ui/time';
import { api } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { fieldsOf, messageOf, Panel } from './sections';
import styles from './admin.module.css';

type Section = { title: string; items: Array<{ label: string; text: string }> };
type App = { name: string; url: string; description: string };
type Form = { published: boolean; intro: string; sections: Section[]; overwolfApps: App[]; overwolfStoreUrl: string };

const blankSection = (): Section => ({ title: '', items: [{ label: '', text: '' }] });
const formFor = (row: AdminGuideRow): Form =>
  row.guide
    ? { ...row.guide, overwolfStoreUrl: row.guide.overwolfStoreUrl ?? '' }
    : { published: false, intro: '', sections: [blankSection()], overwolfApps: [], overwolfStoreUrl: '' };

function GuideEditor({ row, onClose }: { row: AdminGuideRow; onClose: () => void }) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Form>(() => formFor(row));
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['admin', 'guides'] });
  };
  const save = useMutation({
    mutationFn: () =>
      api.admin.saveGuide(row.game.id, {
        ...form,
        // Empty rows are left out rather than rejected.
        sections: form.sections
          .map((section) => ({ ...section, items: section.items.filter((item) => item.label.trim() || item.text.trim()) }))
          .filter((section) => section.title.trim() || section.items.length > 0),
        overwolfApps: form.overwolfApps.filter((app) => app.name.trim() || app.url.trim()),
        overwolfStoreUrl: form.overwolfStoreUrl.trim() || null,
      }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: () => api.admin.deleteGuide(row.game.id), onSuccess: () => (refresh(), onClose()) });
  const fields = fieldsOf(save.error);

  const setSection = (index: number, change: Partial<Section>) => setForm({ ...form, sections: form.sections.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  const setItem = (sectionIndex: number, itemIndex: number, change: Partial<Section['items'][number]>) =>
    setSection(sectionIndex, { items: form.sections[sectionIndex]!.items.map((item, i) => (i === itemIndex ? { ...item, ...change } : item)) });
  const setApp = (index: number, change: Partial<App>) => setForm({ ...form, overwolfApps: form.overwolfApps.map((a, i) => (i === index ? { ...a, ...change } : a)) });

  return (
    <Panel
      title={`${row.game.title} guide`}
      aside={
        row.guide?.published ? (
          <Link href={`/guides/${row.game.slug}`} target="_blank" className={styles.dim}>
            View on the site ↗
          </Link>
        ) : null
      }
    >
      <form className={styles.form} onSubmit={(event) => (event.preventDefault(), save.mutate())}>
        <label className={styles.inlineCheck}>
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} />
          Published (shown on /guides and the game page)
        </label>
        <TextAreaField label="Introduction" rows={3} value={form.intro} onChange={(e) => setForm({ ...form, intro: e.target.value })} error={fields.intro} />

        {form.sections.map((section, sIndex) => (
          <fieldset key={sIndex} className={styles.guideSection}>
            <div className={styles.guideSectionHead}>
              <TextField
                label={`Section ${sIndex + 1}`}
                value={section.title}
                onChange={(e) => setSection(sIndex, { title: e.target.value })}
                placeholder="Settings that matter"
                error={fields[`sections.${sIndex}.title`]}
              />
              <Button size="sm" variant="ghost" icon="trash" aria-label={`Remove section ${sIndex + 1}`} onClick={() => setForm({ ...form, sections: form.sections.filter((_, i) => i !== sIndex) })} />
            </div>
            {section.items.map((item, iIndex) => (
              <div key={iIndex} className={styles.guideItem}>
                <TextField label="Point" value={item.label} onChange={(e) => setItem(sIndex, iIndex, { label: e.target.value })} placeholder="Mouse acceleration" />
                <TextField label="Explanation" value={item.text} onChange={(e) => setItem(sIndex, iIndex, { text: e.target.value })} placeholder="Turn off “Enhance pointer precision” in Windows." />
                <Button
                  size="sm"
                  variant="ghost"
                  icon="trash"
                  aria-label="Remove point"
                  onClick={() => setSection(sIndex, { items: section.items.filter((_, i) => i !== iIndex) })}
                />
              </div>
            ))}
            {fields[`sections.${sIndex}.items`] ? <p className={styles.error}>{fields[`sections.${sIndex}.items`]}</p> : null}
            <Button size="sm" variant="outline" icon="plus" onClick={() => setSection(sIndex, { items: [...section.items, { label: '', text: '' }] })}>
              Add point
            </Button>
          </fieldset>
        ))}
        {form.sections.length < 8 ? (
          <Button size="sm" variant="outline" icon="plus" onClick={() => setForm({ ...form, sections: [...form.sections, blankSection()] })}>
            Add section
          </Button>
        ) : null}

        <fieldset className={styles.guideSection}>
          <legend className="label">Overwolf apps</legend>
          {form.overwolfApps.map((app, index) => (
            <div key={index} className={styles.guideApp}>
              <TextField label="Name" value={app.name} onChange={(e) => setApp(index, { name: e.target.value })} error={fields[`overwolfApps.${index}.name`]} />
              <TextField
                label="Overwolf page"
                value={app.url}
                onChange={(e) => setApp(index, { url: e.target.value })}
                placeholder="https://www.overwolf.com/app/…"
                error={fields[`overwolfApps.${index}.url`]}
              />
              <TextField
                label="What it does"
                value={app.description}
                onChange={(e) => setApp(index, { description: e.target.value })}
                error={fields[`overwolfApps.${index}.description`]}
              />
              <Button size="sm" variant="ghost" icon="trash" aria-label="Remove app" onClick={() => setForm({ ...form, overwolfApps: form.overwolfApps.filter((_, i) => i !== index) })} />
            </div>
          ))}
          {form.overwolfApps.length < 8 ? (
            <Button size="sm" variant="outline" icon="plus" onClick={() => setForm({ ...form, overwolfApps: [...form.overwolfApps, { name: '', url: '', description: '' }] })}>
              Add app
            </Button>
          ) : null}
          <TextField
            label="Overwolf's page for this game (optional)"
            value={form.overwolfStoreUrl}
            onChange={(e) => setForm({ ...form, overwolfStoreUrl: e.target.value })}
            placeholder="https://www.overwolf.com/browse-by-game/…"
            error={fields.overwolfStoreUrl}
          />
          <p className={styles.dim}>Check each app on Overwolf before adding it: players install what we recommend.</p>
        </fieldset>

        <FormError message={messageOf(save.error) ?? remove.error?.message} />
        {save.isSuccess && !save.isPending ? <p className={styles.result}>Saved.</p> : null}
        <div className={styles.buttons}>
          <Button type="submit" icon="check" loading={save.isPending}>
            Save guide
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
          {row.guide ? (
            <Button variant="danger" icon="trash" onClick={() => window.confirm(`Delete the ${row.game.title} guide?`) && remove.mutate()} loading={remove.isPending}>
              Delete
            </Button>
          ) : null}
        </div>
      </form>
    </Panel>
  );
}

export function GuidesAdmin() {
  const guides = useQuery({ queryKey: ['admin', 'guides'], queryFn: api.admin.guides });
  const [open, setOpen] = useState<string | null>(null);
  const row = guides.data?.find((r) => r.game.id === open) ?? null;

  return (
    <div className={styles.stackCol}>
      <Panel title="Competitive guides" aside={<span className={styles.dim}>One guide per game · written in English for now</span>}>
        {guides.data ? (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Guide</th>
                  <th className={styles.num}>Sections</th>
                  <th className={styles.num}>Overwolf apps</th>
                  <th>Updated</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {guides.data.map((r) => (
                  <tr key={r.game.id} className={cx(open === r.game.id && styles.rowEditing)}>
                    <td className={styles.cellTitle}>{r.game.title}</td>
                    <td>{r.guide ? <Tag tone={r.guide.published ? 'success' : 'gold'}>{r.guide.published ? 'Published' : 'Draft'}</Tag> : <span className={styles.dim}>None</span>}</td>
                    <td className={styles.num}>{r.guide?.sections.length ?? '—'}</td>
                    <td className={styles.num}>{r.guide?.overwolfApps.length ?? '—'}</td>
                    <td className={styles.cellTime}>{r.guide ? <RelativeTime iso={r.guide.updatedAt} /> : '—'}</td>
                    <td className={styles.actions}>
                      <Button size="sm" variant={r.guide ? 'ghost' : 'outline'} icon={r.guide ? 'edit' : 'plus'} onClick={() => setOpen(r.game.id)}>
                        {r.guide ? 'Edit' : 'Write'}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Skeleton height={300} />
        )}
      </Panel>
      {row ? <GuideEditor key={row.game.id} row={row} onClose={() => setOpen(null)} /> : null}
    </div>
  );
}
