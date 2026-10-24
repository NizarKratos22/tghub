'use client';

import type { MarketPhoto } from '@tgh/shared';
import { MAX_LISTING_PHOTOS } from '@tgh/shared';
import { useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/ui/Icon';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import styles from './PhotoUploader.module.css';

export interface PhotoSlot {
  key: string;
  status: 'uploading' | 'done' | 'error';
  /** Local object URL while uploading; the server thumbnail afterwards. */
  src: string;
  photo?: MarketPhoto;
  error?: string;
}

const ACCEPT = 'image/jpeg,image/png,image/webp,image/avif,image/gif';
let counter = 0;

export function slotsFromPhotos(photos: MarketPhoto[]): PhotoSlot[] {
  return photos.map((photo) => ({ key: photo.id, status: 'done', src: photo.thumbUrl, photo }));
}

/**
 * Uploads as soon as files are picked, so publishing is instant. The first
 * photo is the cover; arrows reorder, × removes. Uploads run two at a time.
 */
export function PhotoUploader({ slots, onChange, error }: { slots: PhotoSlot[]; onChange: (update: (slots: PhotoSlot[]) => PhotoSlot[]) => void; error?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const objectUrls = useRef(new Set<string>());

  useEffect(() => {
    const urls = objectUrls.current;
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, []);

  const upload = async (key: string, file: File) => {
    try {
      const photo = await api.market.uploadPhoto(file);
      onChange((current) => current.map((slot) => (slot.key === key ? { ...slot, status: 'done', photo } : slot)));
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Upload failed';
      onChange((current) => current.map((slot) => (slot.key === key ? { ...slot, status: 'error', error: message } : slot)));
    }
  };

  const addFiles = async (files: FileList | File[]) => {
    const room = MAX_LISTING_PHOTOS - slots.length;
    const picked = Array.from(files)
      .filter((file) => file.type.startsWith('image/'))
      .slice(0, Math.max(0, room));
    if (picked.length === 0) return;
    const added = picked.map((file) => {
      const src = URL.createObjectURL(file);
      objectUrls.current.add(src);
      counter += 1;
      return { slot: { key: `local-${counter}`, status: 'uploading' as const, src }, file };
    });
    onChange((current) => [...current, ...added.map((item) => item.slot)]);
    // Two at a time: fast on good connections, gentle on mobile data.
    for (let i = 0; i < added.length; i += 2) {
      await Promise.all(added.slice(i, i + 2).map((item) => upload(item.slot.key, item.file)));
    }
  };

  const move = (index: number, step: number) =>
    onChange((current) => {
      const next = [...current];
      const target = index + step;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target]!, next[index]!];
      return next;
    });

  const remove = (key: string) => onChange((current) => current.filter((slot) => slot.key !== key));

  return (
    <div className={styles.uploader}>
      <div className={styles.head}>
        <span className={styles.title}>
          Photos · {slots.length}/{MAX_LISTING_PHOTOS}
        </span>
        <span className={styles.hint}>The first photo is the cover. Location data is removed from every upload.</span>
      </div>
      <ul className={styles.tiles}>
        {slots.map((slot, index) => (
          <li key={slot.key} className={cx(styles.tile, slot.status === 'error' && styles.failed)}>
            <img src={slot.status === 'done' && slot.photo ? slot.photo.thumbUrl : slot.src} alt={`Photo ${index + 1}`} />
            {index === 0 ? <span className={styles.cover}>Cover</span> : null}
            {slot.status === 'uploading' ? (
              <span className={styles.overlay}>
                <span className={styles.spinner} aria-label="Uploading" />
              </span>
            ) : null}
            {slot.status === 'error' ? (
              <span className={cx(styles.overlay, styles.errorOverlay)} title={slot.error}>
                <Icon name="alert" size={18} />
                {slot.error}
              </span>
            ) : null}
            <span className={styles.controls}>
              <button type="button" onClick={() => move(index, -1)} disabled={index === 0} aria-label="Move earlier">
                <Icon name="chevronLeft" size={14} />
              </button>
              <button type="button" onClick={() => move(index, 1)} disabled={index === slots.length - 1} aria-label="Move later">
                <Icon name="chevronRight" size={14} />
              </button>
              <button type="button" onClick={() => remove(slot.key)} aria-label="Remove photo">
                <Icon name="close" size={14} />
              </button>
            </span>
          </li>
        ))}
        {slots.length < MAX_LISTING_PHOTOS ? (
          <li>
            <button
              type="button"
              className={cx(styles.add, dragging && styles.dragging, error && styles.addInvalid)}
              onClick={() => input.current?.click()}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                void addFiles(event.dataTransfer.files);
              }}
            >
              <Icon name="camera" size={26} />
              <span>{slots.length === 0 ? 'Add photos' : 'Add more'}</span>
              <small>or drag them here</small>
            </button>
          </li>
        ) : null}
      </ul>
      <input
        ref={input}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(event) => {
          if (event.target.files) void addFiles(event.target.files);
          event.target.value = '';
        }}
      />
      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
