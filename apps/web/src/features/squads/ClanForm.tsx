'use client';

import {
  CLAN_COLORS,
  CLAN_JOIN_POLICIES,
  COUNTRY_CODES,
  MAX_CLAN_GAMES,
  SUGGESTED_COUNTRIES,
  type ClanDetail,
  type ClanJoinPolicy,
  type CountryCode,
} from '@tgh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type CSSProperties, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { SignedIn } from '@/features/auth/session';
import { VerifyEmailNotice } from '@/features/auth/VerifyEmailBanner';
import { fill } from '@/i18n/config';
import { useLocale, useT } from '@/i18n/I18nProvider';
import { byName, countryName } from '@/i18n/places';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { ClanEmblem, SQUAD_KEYS, useGameOptions } from './shared';
import styles from './forms.module.css';

interface Values {
  tag: string;
  name: string;
  description: string;
  color: (typeof CLAN_COLORS)[number];
  joinPolicy: ClanJoinPolicy;
  country: CountryCode | '';
  gameIds: string[];
}

/** Create a clan, or edit one (the tag is permanent once created). */
export function ClanFields({ initial, onSaved, submitLabel }: { initial?: ClanDetail; onSaved: (clan: ClanDetail) => void; submitLabel: string }) {
  const t = useT();
  const locale = useLocale();
  const nameOf = (code: CountryCode) => countryName(code, locale);
  const otherCountries = COUNTRY_CODES.filter((code) => !SUGGESTED_COUNTRIES.includes(code)).sort((a, b) => byName(nameOf(a), nameOf(b)));
  const queryClient = useQueryClient();
  const games = useGameOptions();
  const editing = Boolean(initial);
  const [values, setValues] = useState<Values>({
    tag: initial?.tag ?? '',
    name: initial?.name ?? '',
    description: initial?.description ?? '',
    color: (initial?.color as Values['color']) ?? CLAN_COLORS[0],
    joinPolicy: initial?.joinPolicy ?? 'request',
    country: initial?.country ?? 'TN',
    gameIds: initial?.games.map((g) => g.id) ?? [],
  });
  const set = <K extends keyof Values>(key: K, value: Values[K]) => setValues((v) => ({ ...v, [key]: value }));

  const save = useMutation({
    mutationFn: () => {
      const body = {
        name: values.name,
        description: values.description,
        color: values.color,
        joinPolicy: values.joinPolicy,
        country: values.country || null,
        gameIds: values.gameIds,
      };
      return initial ? api.clans.update(initial.tag, body) : api.clans.create({ ...body, tag: values.tag });
    },
    onSuccess: (clan) => {
      queryClient.setQueryData(SQUAD_KEYS.clan(clan.tag), clan);
      void queryClient.invalidateQueries({ queryKey: SQUAD_KEYS.clans });
      onSaved(clan);
    },
  });
  const fields = save.error instanceof ApiError ? save.error.fields : {};
  const tag = values.tag.toUpperCase().replace(/[^A-Z0-9]/g, '');

  const submit = (event: FormEvent) => {
    event.preventDefault();
    save.mutate();
  };

  return (
    <form className={styles.form} onSubmit={submit}>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.clan.identity}</h2>
        <div className={styles.identity}>
          <ClanEmblem tag={tag || 'TAG'} color={values.color} size={76} />
          <div className={styles.row}>
          {editing ? (
            <TextField label={t.clan.tag} value={tag} disabled hint={t.clan.tagPermanent} />
          ) : (
            <TextField label={t.clan.tag} placeholder="TGH" value={tag} maxLength={5} onChange={(e) => set('tag', e.target.value)} error={fields.tag} hint={t.clan.tagHint} required />
          )}
          <TextField label={t.clan.name} placeholder={t.clan.namePlaceholder} value={values.name} maxLength={32} onChange={(e) => set('name', e.target.value)} error={fields.name} required />
          </div>
        </div>
        <div className={styles.group}>
          <span className={styles.groupLabel}>{t.clan.colour}</span>
          <div className={styles.swatches}>
            {CLAN_COLORS.map((color) => (
              <button key={color} type="button" className={cx(styles.swatch, values.color === color && styles.swatchOn)} style={{ background: color }} onClick={() => set('color', color)} aria-label={fill(t.clan.colourOption, { color })} aria-pressed={values.color === color} />
            ))}
          </div>
        </div>
        <TextAreaField label={t.clan.about} placeholder={t.clan.aboutPlaceholder} value={values.description} maxLength={500} rows={4} onChange={(e) => set('description', e.target.value)} error={fields.description} hint={`${values.description.length}/500`} />
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{t.clan.recruitingSection}</h2>
        <div className={styles.cards} role="radiogroup" aria-label={t.clan.whoCanJoin}>
          {CLAN_JOIN_POLICIES.map((policy) => (
            <button key={policy} type="button" role="radio" aria-checked={values.joinPolicy === policy} className={cx(styles.card, values.joinPolicy === policy && styles.cardOn)} onClick={() => set('joinPolicy', policy)}>
              <strong>{t.labels.clanPolicy[policy].label}</strong>
              <span>{t.labels.clanPolicy[policy].description}</span>
            </button>
          ))}
        </div>
        <div className={styles.row}>
          <SelectField label={t.clan.basedIn} value={values.country} onChange={(e) => set('country', e.target.value as CountryCode | '')} error={fields.country}>
            <option value="">{t.clan.worldwide}</option>
            {SUGGESTED_COUNTRIES.map((code) => (
              <option key={code} value={code}>
                {nameOf(code)}
              </option>
            ))}
            <option disabled>──────────</option>
            {otherCountries.map((code) => (
              <option key={code} value={code}>
                {nameOf(code)}
              </option>
            ))}
          </SelectField>
          <SelectField
            label={fill(t.clan.mainGames, { max: MAX_CLAN_GAMES })}
            value=""
            onChange={(e) => e.target.value && values.gameIds.length < MAX_CLAN_GAMES && set('gameIds', [...values.gameIds, e.target.value])}
            disabled={values.gameIds.length >= MAX_CLAN_GAMES}
            error={fields.gameIds}
          >
            <option value="">{values.gameIds.length >= MAX_CLAN_GAMES ? t.clan.removeOne : t.clan.addGame}</option>
            {games
              .filter((game) => !values.gameIds.includes(game.id))
              .map((game) => (
                <option key={game.id} value={game.id}>
                  {game.title}
                </option>
              ))}
          </SelectField>
        </div>
        {values.gameIds.length > 0 ? (
          <div className={styles.selected}>
            {values.gameIds.map((id) => {
              const game = games.find((g) => g.id === id);
              return (
                <button key={id} type="button" className={styles.gameChip} style={{ '--accent': game?.accent } as CSSProperties} onClick={() => set('gameIds', values.gameIds.filter((g) => g !== id))} aria-label={fill(t.clan.removeGame, { game: game?.title ?? '' })}>
                  <i aria-hidden />
                  {game?.title ?? '…'}
                  <Icon name="close" size={12} />
                </button>
              );
            })}
          </div>
        ) : null}
      </section>

      <FormError message={save.error && Object.keys(fields).length === 0 ? save.error.message : null} />
      <div className={styles.submit}>
        <Button type="submit" loading={save.isPending} icon="check">
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

export function CreateClanForm() {
  const t = useT();
  const router = useRouter();
  return (
    <SignedIn prompt={t.clan.signInToCreate}>
      {(me) =>
        me.emailVerified ? (
          <ClanFields submitLabel={t.clan.createButton} onSaved={(clan) => router.push(`/clans/${clan.tag}`)} />
        ) : (
          <VerifyEmailNotice text={t.clan.verifyToCreate} />
        )
      }
    </SignedIn>
  );
}
