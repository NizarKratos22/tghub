'use client';

import { AVATAR_COLORS, type CountryCode, type Me, type TnGovernorate } from '@tgh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, TextAreaField, TextField } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { SESSION_KEY, SignedIn } from '@/features/auth/session';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { HomeFields } from './HomeFields';
import { ProfileImages } from './ProfileImages';
import styles from './SettingsForm.module.css';

function Form({ me }: { me: Me }) {
  const t = useT();
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    displayName: me.displayName,
    bio: me.bio,
    country: me.country ?? '',
    region: me.region && me.region !== 'Abroad' ? me.region : '',
    avatarColor: me.avatarColor,
    shareActivity: me.shareActivity,
    discordUsername: me.discordUsername ?? '',
  });
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    // Takes the Discord name it sends, so the answer only replaces it if the player hasn't typed since.
    mutationFn: (sentDiscord: string) =>
      api.me.update({
        displayName: values.displayName,
        bio: values.bio,
        country: (values.country || null) as CountryCode | null,
        region: values.country === 'TN' ? ((values.region || null) as TnGovernorate | null) : null,
        avatarColor: values.avatarColor as (typeof AVATAR_COLORS)[number],
        shareActivity: values.shareActivity,
        discordUsername: sentDiscord.trim() || null,
      }),
    onSuccess: (updated, sentDiscord) => {
      queryClient.setQueryData(SESSION_KEY, updated);
      // Show it the way it was saved ("@Sami" becomes "sami").
      setValues((v) => (v.discordUsername === sentDiscord ? { ...v, discordUsername: updated.discordUsername ?? '' } : v));
      setSaved(true);
    },
  });
  const fields = save.error instanceof ApiError ? save.error.fields : {};

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    save.mutate(values.discordUsername);
  };

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <ProfileImages me={me} name={values.displayName || me.username} color={values.avatarColor} />

      <fieldset className={styles.swatches}>
        <legend className="label">{me.avatarUrl ? t.profileEdit.monogramColour : t.profileEdit.avatarColour}</legend>
        <div>
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cx(styles.swatch, values.avatarColor === color && styles.swatchOn)}
              style={{ background: color }}
              onClick={() => setValues((v) => ({ ...v, avatarColor: color }))}
              aria-label={fill(t.profileEdit.useColour, { color })}
              aria-pressed={values.avatarColor === color}
            />
          ))}
        </div>
      </fieldset>

      <TextField label={t.profileEdit.displayName} value={values.displayName} maxLength={32} onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))} error={fields.displayName} />
      <TextAreaField label={t.profileEdit.bio} value={values.bio} maxLength={280} onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))} error={fields.bio} hint={`${values.bio.length}/280`} />
      <TextField
        label={t.profileEdit.discordUsername}
        hint={t.profileEdit.discordUsernameHint}
        value={values.discordUsername}
        maxLength={33}
        placeholder="sami.tn"
        autoComplete="off"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        dir="ltr"
        onChange={(e) => setValues((v) => ({ ...v, discordUsername: e.target.value }))}
        // The API explains in English; the form says it in the player's language.
        error={fields.discordUsername ? t.profileEdit.discordUsernameInvalid : undefined}
      />
      <HomeFields value={{ country: values.country, region: values.region }} onChange={(home) => setValues((v) => ({ ...v, ...home }))} errors={fields} />
      <Toggle
        label={t.profileEdit.shareActivity}
        description={t.profileEdit.shareActivityHint}
        checked={values.shareActivity}
        onChange={(shareActivity) => setValues((v) => ({ ...v, shareActivity }))}
      />

      <FormError message={save.error && Object.keys(fields).length === 0 ? save.error.message : null} />
      <div className={styles.actions}>
        {saved ? <span className={styles.saved}>{t.profileEdit.saved}</span> : null}
        <Button type="submit" loading={save.isPending} icon="check">
          {t.profileEdit.save}
        </Button>
      </div>
    </form>
  );
}

export function SettingsForm() {
  const t = useT();
  return <SignedIn prompt={t.profileEdit.signInPrompt}>{(me) => <Form me={me} />}</SignedIn>;
}
