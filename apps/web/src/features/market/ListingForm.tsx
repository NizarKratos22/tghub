'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  ASSET_DELIVERIES,
  ASSET_SOURCES,
  FIVEM_FRAMEWORKS,
  isDigitalCategory,
  listingInputSchema,
  MARKET_CATEGORIES,
  MARKET_CATEGORY_META,
  MARKET_CONDITIONS,
  MARKET_SUBCATEGORIES,
  TN_REGIONS,
  type AssetDelivery,
  type AssetSource,
  type FivemFramework,
  type ListingDetail,
  type MarketCategory,
  type MarketCondition,
  type TnRegion,
} from '@tgh/shared';
import { Button } from '@/components/ui/Button';
import { FormError, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { Icon } from '@/components/ui/Icon';
import { SESSION_KEY } from '@/features/auth/session';
import { useFormat, useT } from '@/i18n/I18nProvider';
import { regionName } from '@/i18n/places';
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { LISTING_KEYS, listingSubline } from './meta';
import { PhotoUploader, slotsFromPhotos, type PhotoSlot } from './PhotoUploader';
import cardStyles from './ListingCard.module.css';
import styles from './ListingForm.module.css';

interface Draft {
  category: MarketCategory | '';
  subcategory: string;
  title: string;
  description: string;
  price: string;
  negotiable: boolean;
  openToTrades: boolean;
  condition: MarketCondition | '';
  region: TnRegion | '';
  area: string;
  meetup: boolean;
  shipping: boolean;
  framework: FivemFramework | '';
  delivery: AssetDelivery | '';
  source: AssetSource | '';
  rightsConfirmed: boolean;
}

function draftFrom(listing?: ListingDetail): Draft {
  return {
    category: listing?.category ?? '',
    subcategory: listing?.subcategory ?? '',
    title: listing?.title ?? '',
    description: listing?.description ?? '',
    price: listing ? String(listing.price) : '',
    negotiable: listing?.negotiable ?? false,
    openToTrades: listing?.openToTrades ?? false,
    condition: listing?.condition ?? '',
    region: listing?.region ?? '',
    area: listing?.area ?? '',
    meetup: listing?.meetup ?? true,
    shipping: listing?.shipping ?? false,
    framework: listing?.digitalInfo?.framework ?? '',
    delivery: listing?.digitalInfo?.delivery ?? '',
    source: listing?.digitalInfo?.source ?? '',
    // Editing doesn't re-ask: the seller already vouched when they published.
    rightsConfirmed: Boolean(listing?.digitalInfo),
  };
}

/** Builds the API payload; the shared schema then validates it exactly as the server will. */
function toInput(draft: Draft, slots: PhotoSlot[]) {
  const digital = draft.category ? isDigitalCategory(draft.category) : false;
  return {
    title: draft.title,
    description: draft.description,
    category: draft.category || undefined,
    subcategory: draft.subcategory || null,
    price: draft.price.trim() === '' ? undefined : Number(draft.price),
    negotiable: draft.negotiable,
    openToTrades: draft.openToTrades,
    condition: digital ? null : draft.condition || null,
    region: draft.region || null,
    area: draft.area,
    meetup: digital ? false : draft.meetup,
    shipping: digital ? false : draft.shipping,
    digital: digital
      ? {
          framework: draft.category === 'fivem' ? draft.framework || null : null,
          delivery: draft.delivery || undefined,
          source: draft.source || undefined,
          rightsConfirmed: draft.rightsConfirmed,
        }
      : null,
    photoIds: slots.flatMap((slot) => (slot.status === 'done' && slot.photo ? [slot.photo.id] : [])),
  };
}

function Choice<T extends string>({ value, options, labels, onChange, name }: { value: T | ''; options: readonly T[]; labels: Record<T, string>; onChange: (value: T) => void; name: string }) {
  return (
    <div className={styles.choices} role="radiogroup" aria-label={name}>
      {options.map((option) => (
        <button key={option} type="button" role="radio" aria-checked={value === option} className={cx(styles.choice, value === option && styles.choiceOn)} onClick={() => onChange(option)}>
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

function Check({ checked, onChange, label, hint }: { checked: boolean; onChange: (checked: boolean) => void; label: string; hint?: string }) {
  return (
    <label className={cx(styles.check, checked && styles.checkOn)}>
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>
        <strong>{label}</strong>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}

export function ListingForm({ listing }: { listing?: ListingDetail }) {
  const t = useT();
  const format = useFormat();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => draftFrom(listing));
  const [slots, setSlots] = useState<PhotoSlot[]>(() => slotsFromPhotos(listing?.photos ?? []));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((current) => ({ ...current, [key]: value }));

  const digital = draft.category ? isDigitalCategory(draft.category) : false;
  const uploading = slots.some((slot) => slot.status === 'uploading');

  const save = useMutation({
    mutationFn: (input: ReturnType<typeof listingInputSchema.parse>) => (listing ? api.market.update(listing.id, input) : api.market.create(input)),
    onSuccess: (saved) => {
      void queryClient.invalidateQueries({ queryKey: LISTING_KEYS.mine });
      void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      router.push(`/market/item/${saved.id}`);
      router.refresh();
    },
    onError: (error) => {
      if (error instanceof ApiError) setErrors(error.fields);
    },
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const parsed = listingInputSchema.safeParse(toInput(draft, slots));
    if (!parsed.success) {
      const fields: Record<string, string> = {};
      for (const issue of parsed.error.issues) fields[issue.path.join('.') || '_root'] ??= issue.message;
      setErrors(fields);
      document.querySelector('[aria-invalid="true"], [data-invalid="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setErrors({});
    save.mutate(parsed.data);
  };

  const cover = slots.find((slot) => slot.status === 'done' || slot.status === 'uploading');
  const previewPrice = draft.price.trim() === '' ? t.sell.previewPrice : format.tnd(Number(draft.price) || 0);
  const subline =
    draft.category !== ''
      ? listingSubline({
          digital,
          region: draft.region || null,
          framework: draft.framework || null,
          subcategory: (draft.subcategory || null) as never,
          category: draft.category,
          condition: draft.condition || null,
        }, t)
      : t.sell.previewCategory;
  const error = (key: string) => errors[key];

  return (
    <form className={styles.layout} onSubmit={submit} noValidate>
      <div className={styles.form}>
        <section className={styles.section} data-invalid={Boolean(error('photoIds'))}>
          <PhotoUploader slots={slots} onChange={setSlots} error={error('photoIds')} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.sell.whatSelling}</h2>
          <div className={styles.categoryGrid} role="radiogroup" aria-label={t.sell.category} data-invalid={Boolean(error('category'))}>
            {MARKET_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                role="radio"
                aria-checked={draft.category === category}
                className={cx(styles.category, draft.category === category && styles.categoryOn)}
                onClick={() => setDraft((current) => ({ ...current, category, subcategory: '' }))}
              >
                <strong>{t.market.categoryNames[category]}</strong>
                <small>{t.labels.categoryDescription[category]}</small>
                {MARKET_CATEGORY_META[category].digital ? <span className={styles.digitalTag}>{t.sell.digital}</span> : null}
              </button>
            ))}
          </div>
          {error('category') ? <p className={styles.fieldError}>{error('category')}</p> : null}
          {draft.category && MARKET_SUBCATEGORIES[draft.category].length > 0 ? (
            <SelectField label={t.sell.type} value={draft.subcategory} onChange={(e) => set('subcategory', e.target.value)} error={error('subcategory')}>
              <option value="">{t.sell.chooseType}</option>
              {MARKET_SUBCATEGORIES[draft.category].map((sub) => (
                <option key={sub} value={sub}>
                  {t.labels.subcategory[sub]}
                </option>
              ))}
            </SelectField>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>{t.sell.listing}</h2>
          <TextField label={t.sell.titleLabel} value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={90} placeholder={digital ? t.sell.titleDigital : t.sell.titleItem} error={error('title')} />
          <div className={styles.priceRow}>
            <TextField
              label={t.sell.price}
              inputMode="numeric"
              value={draft.price}
              onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))}
              placeholder={t.sell.pricePlaceholder}
              error={error('price')}
              hint={t.sell.priceHint}
            />
            <div className={styles.priceChecks}>
              <Check checked={draft.negotiable} onChange={(v) => set('negotiable', v)} label={t.sell.negotiable} />
              <Check checked={draft.openToTrades} onChange={(v) => set('openToTrades', v)} label={t.sell.openToTrades} />
            </div>
          </div>
          <TextAreaField
            label={t.sell.description}
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={4000}
            rows={7}
            placeholder={digital ? t.sell.descriptionDigital : t.sell.descriptionItem}
            error={error('description')}
            hint={`${draft.description.length}/4000`}
          />
        </section>

        {draft.category && digital ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.sell.assetDetails}</h2>
            {draft.category === 'fivem' ? (
              <div className={styles.group} data-invalid={Boolean(error('digital.framework'))}>
                <span className={styles.groupLabel}>{t.sell.framework}</span>
                <Choice name={t.sell.framework} value={draft.framework} options={FIVEM_FRAMEWORKS} labels={t.labels.framework} onChange={(v) => set('framework', v)} />
                {error('digital.framework') ? <p className={styles.fieldError}>{error('digital.framework')}</p> : null}
              </div>
            ) : null}
            <div className={styles.group} data-invalid={Boolean(error('digital.delivery'))}>
              <span className={styles.groupLabel}>{t.sell.howReceives}</span>
              <Choice name={t.sell.howReceives} value={draft.delivery} options={ASSET_DELIVERIES} labels={t.labels.delivery} onChange={(v) => set('delivery', v)} />
              {error('digital.delivery') ? <p className={styles.fieldError}>{t.sell.deliveryMissing}</p> : null}
            </div>
            <div className={styles.group} data-invalid={Boolean(error('digital.source'))}>
              <span className={styles.groupLabel}>{t.sell.sourceCode}</span>
              <Choice name={t.sell.sourceCode} value={draft.source} options={ASSET_SOURCES} labels={t.labels.source} onChange={(v) => set('source', v)} />
              {error('digital.source') ? <p className={styles.fieldError}>{t.sell.sourceMissing}</p> : null}
            </div>
            <SelectField label={t.sell.yourLocation} value={draft.region} onChange={(e) => set('region', e.target.value as TnRegion | '')}>
              <option value="">{t.sell.dontShow}</option>
              {TN_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {regionName(region, t)}
                </option>
              ))}
            </SelectField>
            <div data-invalid={Boolean(error('digital.rightsConfirmed') || error('digital'))}>
              <Check
                checked={draft.rightsConfirmed}
                onChange={(v) => set('rightsConfirmed', v)}
                label={t.sell.rights}
                hint={t.sell.rightsHint}
              />
              {error('digital.rightsConfirmed') || error('digital') ? <p className={styles.fieldError}>{error('digital.rightsConfirmed') ?? error('digital')}</p> : null}
            </div>
          </section>
        ) : null}

        {draft.category && !digital ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>{t.sell.conditionHandOver}</h2>
            <div className={styles.group} data-invalid={Boolean(error('condition'))}>
              <span className={styles.groupLabel}>{t.sell.condition}</span>
              <Choice name={t.sell.condition} value={draft.condition} options={MARKET_CONDITIONS} labels={t.labels.condition} onChange={(v) => set('condition', v)} />
              {error('condition') ? <p className={styles.fieldError}>{error('condition')}</p> : null}
            </div>
            <div className={styles.locationRow}>
              <SelectField label={t.sell.governorate} value={draft.region} onChange={(e) => set('region', e.target.value as TnRegion | '')} error={error('region')}>
                <option value="">{t.sell.choose}</option>
                {TN_REGIONS.filter((region) => region !== 'Abroad').map((region) => (
                  <option key={region} value={region}>
                    {regionName(region, t)}
                  </option>
                ))}
              </SelectField>
              <TextField label={t.sell.area} value={draft.area} onChange={(e) => set('area', e.target.value)} maxLength={60} placeholder={t.sell.areaPlaceholder} />
            </div>
            <div className={styles.group} data-invalid={Boolean(error('meetup'))}>
              <span className={styles.groupLabel}>{t.sell.handOver}</span>
              <div className={styles.checkRow}>
                <Check checked={draft.meetup} onChange={(v) => set('meetup', v)} label={t.sell.meetup} hint={t.sell.meetupHint} />
                <Check checked={draft.shipping} onChange={(v) => set('shipping', v)} label={t.sell.shipping} hint={t.sell.shippingHint} />
              </div>
              {error('meetup') ? <p className={styles.fieldError}>{error('meetup')}</p> : null}
            </div>
          </section>
        ) : null}

        <div className={styles.submit}>
          <FormError message={save.error instanceof ApiError && Object.keys(save.error.fields).length === 0 ? save.error.message : null} />
          <Button type="submit" size="lg" block loading={save.isPending} disabled={uploading}>
            {uploading ? t.sell.waitingPhotos : listing ? t.sell.saveChanges : t.sell.publish}
          </Button>
          <p className={styles.terms}>{t.sell.terms}</p>
        </div>
      </div>

      <aside className={styles.preview} aria-label={t.sell.preview}>
        <p className={styles.previewTitle}>
          <Icon name="eye" size={16} /> {t.sell.preview}
        </p>
        <div className={cardStyles.card}>
          <span className={cardStyles.photo}>
            {cover ? (
              <img src={cover.status === 'done' && cover.photo ? cover.photo.thumbUrl : cover.src} alt="" />
            ) : (
              <span className={cardStyles.noPhoto}>
                <Icon name="image" size={36} />
              </span>
            )}
            {digital ? (
              <span className={cardStyles.badge}>
                <Icon name="download" size={12} /> {t.market.digital}
              </span>
            ) : draft.shipping ? (
              <span className={cardStyles.badge}>
                <Icon name="box" size={12} /> {t.market.delivery}
              </span>
            ) : null}
          </span>
          <span className={cardStyles.body}>
            <span className={cx(cardStyles.price, draft.price === '0' && cardStyles.free)}>{previewPrice}</span>
            <span className={cardStyles.title}>{draft.title || t.sell.previewTitle}</span>
            <span className={cardStyles.sub}>{subline || t.sell.previewLocation}</span>
          </span>
        </div>
        <p className={styles.previewNote}>{t.sell.previewNote}</p>
      </aside>
    </form>
  );
}
