'use client';

import type { Me } from '@tgh/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useRef, useState, type ChangeEvent } from 'react';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/primitives';
import { SESSION_KEY } from '@/features/auth/session';
import { fill } from '@/i18n/config';
import { useT } from '@/i18n/I18nProvider';
import { api } from '@/lib/api/client';
import { ImageCropDialog, type CropSpec } from './ImageCropDialog';
import styles from './ProfileImages.module.css';

type Kind = 'avatar' | 'banner';

const SPECS: Record<Kind, CropSpec> = {
  avatar: { aspect: 1, width: 512, height: 512, shape: 'circle' },
  banner: { aspect: 4, width: 1600, height: 400, shape: 'rect' },
};
const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif,image/heic,image/heif';
/** The cropped upload is small; this only guards the uncropped fallback. */
const MAX_SOURCE_MB = 25;

/**
 * Cover and picture, editable in place like a social profile. Changes save on
 * their own — they don't wait for the profile form's Save button.
 */
export function ProfileImages({ me, name, color }: { me: Me; name: string; color: string }) {
  const t = useT();
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [picking, setPicking] = useState<Kind>('avatar');
  const [editing, setEditing] = useState<{ kind: Kind; file: File } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const done = (updated: Me) => {
    queryClient.setQueryData(SESSION_KEY, updated);
    setEditing(null);
  };
  const upload = useMutation({ mutationFn: ({ kind, image }: { kind: Kind; image: Blob }) => api.me.uploadImage(kind, image), onSuccess: done });
  const remove = useMutation({ mutationFn: (kind: Kind) => api.me.removeImage(kind), onSuccess: done, onError: (error) => setNotice(error.message) });

  const pick = (kind: Kind) => {
    setPicking(kind);
    setNotice(null);
    input.current?.click();
  };

  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/') && !/\.(heic|heif)$/i.test(file.name)) return setNotice(t.profileEdit.chooseImage);
    if (file.size > MAX_SOURCE_MB * 1024 * 1024) return setNotice(fill(t.profileEdit.tooBig, { mb: MAX_SOURCE_MB }));
    upload.reset();
    setEditing({ kind: picking, file });
  };

  return (
    <div className={styles.root}>
      <div className={styles.banner}>
        {me.bannerUrl ? <img src={me.bannerUrl} alt="" className={styles.bannerImage} /> : null}
        <div className={styles.bannerTools}>
          <button type="button" className={styles.chip} onClick={() => pick('banner')}>
            <Icon name="camera" size={15} /> {me.bannerUrl ? t.profileEdit.changeCover : t.profileEdit.addCover}
          </button>
          {me.bannerUrl ? (
            <button type="button" className={styles.chip} onClick={() => remove.mutate('banner')} disabled={remove.isPending} aria-label={t.profileEdit.removeCover}>
              <Icon name="trash" size={15} />
            </button>
          ) : null}
        </div>
      </div>

      <div className={styles.identity}>
        <div className={styles.avatar}>
          <Avatar name={name} color={color} src={me.avatarUrl} size={96} />
          <button type="button" className={styles.avatarEdit} onClick={() => pick('avatar')} aria-label={me.avatarUrl ? t.profileEdit.changePicture : t.profileEdit.addPicture}>
            <Icon name="camera" size={16} />
          </button>
        </div>
        <div className={styles.meta}>
          <p className={styles.name}>{name}</p>
          <p className={styles.handle}>
            @{me.username} · <Link href={`/u/${me.username}`}>{t.profileEdit.viewProfile}</Link>
          </p>
          {me.avatarUrl ? (
            <button type="button" className={styles.textButton} onClick={() => remove.mutate('avatar')} disabled={remove.isPending}>
              {t.profileEdit.removePicture}
            </button>
          ) : null}
        </div>
      </div>
      {notice ? (
        <p className={styles.notice} role="alert">
          {notice}
        </p>
      ) : null}

      <input ref={input} type="file" accept={ACCEPT} hidden onChange={onFile} />
      {editing ? (
        <ImageCropDialog
          file={editing.file}
          spec={SPECS[editing.kind]}
          title={editing.kind === 'avatar' ? t.profileEdit.pictureTitle : t.profileEdit.coverTitle}
          hint={editing.kind === 'banner' ? t.profileEdit.coverHint : t.profileEdit.pictureHint}
          busy={upload.isPending}
          error={upload.error?.message}
          onCancel={() => setEditing(null)}
          onConfirm={(image) => upload.mutate({ kind: editing.kind, image })}
        />
      ) : null}
    </div>
  );
}
