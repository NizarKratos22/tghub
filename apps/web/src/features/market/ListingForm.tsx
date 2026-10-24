'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import {
  ASSET_DELIVERIES,
  ASSET_DELIVERY_LABELS,
  ASSET_SOURCE_LABELS,
  ASSET_SOURCES,
  FIVEM_FRAMEWORK_LABELS,
  FIVEM_FRAMEWORKS,
  isDigitalCategory,
  listingInputSchema,
  MARKET_CATEGORIES,
  MARKET_CATEGORY_META,
  MARKET_CONDITION_LABELS,
  MARKET_CONDITIONS,
  MARKET_SUBCATEGORIES,
  MARKET_SUBCATEGORY_LABELS,
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
import { api, ApiError } from '@/lib/api/client';
import { cx } from '@/lib/cx';
import { formatTnd } from '@/lib/format';
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
  const previewPrice = draft.price.trim() === '' ? 'Price' : formatTnd(Number(draft.price) || 0);
  const subline =
    draft.category !== ''
      ? listingSubline({
          digital,
          region: draft.region || null,
          framework: draft.framework || null,
          subcategory: (draft.subcategory || null) as never,
          category: draft.category,
          condition: draft.condition || null,
        })
      : 'Category';
  const error = (key: string) => errors[key];

  return (
    <form className={styles.layout} onSubmit={submit} noValidate>
      <div className={styles.form}>
        <section className={styles.section} data-invalid={Boolean(error('photoIds'))}>
          <PhotoUploader slots={slots} onChange={setSlots} error={error('photoIds')} />
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What are you selling?</h2>
          <div className={styles.categoryGrid} role="radiogroup" aria-label="Category" data-invalid={Boolean(error('category'))}>
            {MARKET_CATEGORIES.map((category) => (
              <button
                key={category}
                type="button"
                role="radio"
                aria-checked={draft.category === category}
                className={cx(styles.category, draft.category === category && styles.categoryOn)}
                onClick={() => setDraft((current) => ({ ...current, category, subcategory: '' }))}
              >
                <strong>{MARKET_CATEGORY_META[category].label}</strong>
                <small>{MARKET_CATEGORY_META[category].description}</small>
                {MARKET_CATEGORY_META[category].digital ? <span className={styles.digitalTag}>Digital</span> : null}
              </button>
            ))}
          </div>
          {error('category') ? <p className={styles.fieldError}>{error('category')}</p> : null}
          {draft.category && MARKET_SUBCATEGORIES[draft.category].length > 0 ? (
            <SelectField label="Type" value={draft.subcategory} onChange={(e) => set('subcategory', e.target.value)} error={error('subcategory')}>
              <option value="">Choose a type (optional)</option>
              {MARKET_SUBCATEGORIES[draft.category].map((sub) => (
                <option key={sub} value={sub}>
                  {MARKET_SUBCATEGORY_LABELS[sub]}
                </option>
              ))}
            </SelectField>
          ) : null}
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Listing</h2>
          <TextField label="Title" value={draft.title} onChange={(e) => set('title', e.target.value)} maxLength={90} placeholder={digital ? 'e.g. Advanced garage script (QBCore)' : 'e.g. RTX 3060 12GB, boxed'} error={error('title')} />
          <div className={styles.priceRow}>
            <TextField
              label="Price (TND)"
              inputMode="numeric"
              value={draft.price}
              onChange={(e) => set('price', e.target.value.replace(/[^\d]/g, ''))}
              placeholder="0 for free"
              error={error('price')}
              hint="Whole dinars."
            />
            <div className={styles.priceChecks}>
              <Check checked={draft.negotiable} onChange={(v) => set('negotiable', v)} label="Negotiable" />
              <Check checked={draft.openToTrades} onChange={(v) => set('openToTrades', v)} label="Open to trades" />
            </div>
          </div>
          <TextAreaField
            label="Description"
            value={draft.description}
            onChange={(e) => set('description', e.target.value)}
            maxLength={4000}
            rows={7}
            placeholder={digital ? 'Features, dependencies, performance (ms), what the buyer gets, support and updates…' : 'Specs, age, condition, what is in the box, why you are selling…'}
            error={error('description')}
            hint={`${draft.description.length}/4000`}
          />
        </section>

        {draft.category && digital ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Asset details</h2>
            {draft.category === 'fivem' ? (
              <div className={styles.group} data-invalid={Boolean(error('digital.framework'))}>
                <span className={styles.groupLabel}>Framework</span>
                <Choice name="Framework" value={draft.framework} options={FIVEM_FRAMEWORKS} labels={FIVEM_FRAMEWORK_LABELS} onChange={(v) => set('framework', v)} />
                {error('digital.framework') ? <p className={styles.fieldError}>{error('digital.framework')}</p> : null}
              </div>
            ) : null}
            <div className={styles.group} data-invalid={Boolean(error('digital.delivery'))}>
              <span className={styles.groupLabel}>How the buyer receives it</span>
              <Choice name="Delivery" value={draft.delivery} options={ASSET_DELIVERIES} labels={ASSET_DELIVERY_LABELS} onChange={(v) => set('delivery', v)} />
              {error('digital.delivery') ? <p className={styles.fieldError}>Choose how the buyer receives it</p> : null}
            </div>
            <div className={styles.group} data-invalid={Boolean(error('digital.source'))}>
              <span className={styles.groupLabel}>Source code</span>
              <Choice name="Source" value={draft.source} options={ASSET_SOURCES} labels={ASSET_SOURCE_LABELS} onChange={(v) => set('source', v)} />
              {error('digital.source') ? <p className={styles.fieldError}>Say whether the source is open or escrowed</p> : null}
            </div>
            <SelectField label="Your location (optional)" value={draft.region} onChange={(e) => set('region', e.target.value as TnRegion | '')}>
              <option value="">Don&apos;t show</option>
              {TN_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </SelectField>
            <div data-invalid={Boolean(error('digital.rightsConfirmed') || error('digital'))}>
              <Check
                checked={draft.rightsConfirmed}
                onChange={(v) => set('rightsConfirmed', v)}
                label="I own this asset or have the right to resell it"
                hint="Leaked, cracked or resold-without-permission assets are removed and the account can be banned."
              />
              {error('digital.rightsConfirmed') || error('digital') ? <p className={styles.fieldError}>{error('digital.rightsConfirmed') ?? error('digital')}</p> : null}
            </div>
          </section>
        ) : null}

        {draft.category && !digital ? (
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Condition & hand-over</h2>
            <div className={styles.group} data-invalid={Boolean(error('condition'))}>
              <span className={styles.groupLabel}>Condition</span>
              <Choice name="Condition" value={draft.condition} options={MARKET_CONDITIONS} labels={MARKET_CONDITION_LABELS} onChange={(v) => set('condition', v)} />
              {error('condition') ? <p className={styles.fieldError}>{error('condition')}</p> : null}
            </div>
            <div className={styles.locationRow}>
              <SelectField label="Governorate" value={draft.region} onChange={(e) => set('region', e.target.value as TnRegion | '')} error={error('region')}>
                <option value="">Choose…</option>
                {TN_REGIONS.filter((region) => region !== 'Abroad').map((region) => (
                  <option key={region} value={region}>
                    {region}
                  </option>
                ))}
              </SelectField>
              <TextField label="Area (optional)" value={draft.area} onChange={(e) => set('area', e.target.value)} maxLength={60} placeholder="e.g. Lac 2, Sahloul" />
            </div>
            <div className={styles.group} data-invalid={Boolean(error('meetup'))}>
              <span className={styles.groupLabel}>Hand-over</span>
              <div className={styles.checkRow}>
                <Check checked={draft.meetup} onChange={(v) => set('meetup', v)} label="Meet-up" hint="Buyer checks it in person" />
                <Check checked={draft.shipping} onChange={(v) => set('shipping', v)} label="Delivery" hint="You ship it (e.g. by courier)" />
              </div>
              {error('meetup') ? <p className={styles.fieldError}>{error('meetup')}</p> : null}
            </div>
          </section>
        ) : null}

        <div className={styles.submit}>
          <FormError message={save.error instanceof ApiError && Object.keys(save.error.fields).length === 0 ? save.error.message : null} />
          <Button type="submit" size="lg" block loading={save.isPending} disabled={uploading}>
            {uploading ? 'Waiting for photos…' : listing ? 'Save changes' : 'Publish listing'}
          </Button>
          <p className={styles.terms}>Listings are public. Payment and hand-over happen between you and the buyer — TG Hub never holds money.</p>
        </div>
      </div>

      <aside className={styles.preview} aria-label="Preview">
        <p className={styles.previewTitle}>
          <Icon name="eye" size={16} /> Preview
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
                <Icon name="download" size={12} /> Digital
              </span>
            ) : draft.shipping ? (
              <span className={cardStyles.badge}>
                <Icon name="box" size={12} /> Delivery
              </span>
            ) : null}
          </span>
          <span className={cardStyles.body}>
            <span className={cx(cardStyles.price, draft.price === '0' && cardStyles.free)}>{previewPrice}</span>
            <span className={cardStyles.title}>{draft.title || 'Title'}</span>
            <span className={cardStyles.sub}>{subline || 'Location'}</span>
          </span>
        </div>
        <p className={styles.previewNote}>This is how your listing appears in the marketplace grid.</p>
      </aside>
    </form>
  );
}
