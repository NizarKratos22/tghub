'use client';

import { AVATAR_COLORS, type CountryCode, type Me, type TnGovernorate } from '@tgh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormError, TextAreaField, TextField } from '@/components/ui/Field';
import { Toggle } from '@/components/ui/Toggle';
import { SESSION_KEY, SignedIn } from '@/features/auth/session';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { HomeFields } from './HomeFields';
import { ProfileImages } from './ProfileImages';
import styles from './SettingsForm.module.css';

function Form({ me }: { me: Me }) {
  const queryClient = useQueryClient();
  const [values, setValues] = useState({
    displayName: me.displayName,
    bio: me.bio,
    country: me.country ?? '',
    region: me.region && me.region !== 'Abroad' ? me.region : '',
    avatarColor: me.avatarColor,
    shareActivity: me.shareActivity,
  });
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: () =>
      api.me.update({
        displayName: values.displayName,
        bio: values.bio,
        country: (values.country || null) as CountryCode | null,
        region: values.country === 'TN' ? ((values.region || null) as TnGovernorate | null) : null,
        avatarColor: values.avatarColor as (typeof AVATAR_COLORS)[number],
        shareActivity: values.shareActivity,
      }),
    onSuccess: (updated) => {
      queryClient.setQueryData(SESSION_KEY, updated);
      setSaved(true);
    },
  });
  const fields = save.error instanceof ApiError ? save.error.fields : {};

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    save.mutate();
  };

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <ProfileImages me={me} name={values.displayName || me.username} color={values.avatarColor} />

      <fieldset className={styles.swatches}>
        <legend className="label">{me.avatarUrl ? 'Monogram colour (shown if you remove your picture)' : 'Avatar colour'}</legend>
        <div>
          {AVATAR_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={cx(styles.swatch, values.avatarColor === color && styles.swatchOn)}
              style={{ background: color }}
              onClick={() => setValues((v) => ({ ...v, avatarColor: color }))}
              aria-label={`Use colour ${color}`}
              aria-pressed={values.avatarColor === color}
            />
          ))}
        </div>
      </fieldset>

      <TextField label="Display name" value={values.displayName} maxLength={32} onChange={(e) => setValues((v) => ({ ...v, displayName: e.target.value }))} error={fields.displayName} />
      <TextAreaField label="Bio" value={values.bio} maxLength={280} onChange={(e) => setValues((v) => ({ ...v, bio: e.target.value }))} error={fields.bio} hint={`${values.bio.length}/280`} />
      <HomeFields value={{ country: values.country, region: values.region }} onChange={(home) => setValues((v) => ({ ...v, ...home }))} errors={fields} />
      <Toggle
        label="Share my activity"
        description="Level-ups, new listings, clan moves and squad posts appear in your followers' feeds and on your profile."
        checked={values.shareActivity}
        onChange={(shareActivity) => setValues((v) => ({ ...v, shareActivity }))}
      />

      <FormError message={save.error && Object.keys(fields).length === 0 ? save.error.message : null} />
      <div className={styles.actions}>
        {saved ? <span className={styles.saved}>Saved</span> : null}
        <Button type="submit" loading={save.isPending} icon="check">
          Save profile
        </Button>
      </div>
    </form>
  );
}

export function SettingsForm() {
  return <SignedIn prompt="Sign in to edit your profile">{(me) => <Form me={me} />}</SignedIn>;
}
