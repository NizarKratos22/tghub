'use client';

import { COUNTRY_CODES, SUGGESTED_COUNTRIES, TN_GOVERNORATES } from '@tgh/shared';
import { useMemo } from 'react';
import { SelectField } from '@/components/ui/Field';
import { useLocale, useT } from '@/i18n/I18nProvider';
import { byName, countryName, regionName } from '@/i18n/places';
import styles from './HomeFields.module.css';

export interface HomeValue {
  country: string;
  region: string;
}

/**
 * Country for everyone, governorate for players in Tunisia. Suggested countries
 * come first; the rest are sorted by name in the player's language.
 */
export function HomeFields({
  value,
  onChange,
  errors = {},
  optional = false,
}: {
  value: HomeValue;
  onChange: (value: HomeValue) => void;
  errors?: { country?: string; region?: string };
  optional?: boolean;
}) {
  const t = useT();
  const locale = useLocale();
  const others = useMemo(
    () =>
      COUNTRY_CODES.filter((code) => !SUGGESTED_COUNTRIES.includes(code))
        .map((code) => ({ code, name: countryName(code, locale) }))
        .sort((a, b) => byName(a.name, b.name)),
    [locale],
  );

  return (
    <div className={styles.row}>
      <SelectField
        label={optional ? t.profileEdit.countryOptional : t.profileEdit.country}
        value={value.country}
        onChange={(event) => onChange({ country: event.target.value, region: event.target.value === 'TN' ? value.region : '' })}
        error={errors.country}
      >
        <option value="">{optional ? t.profileEdit.preferNot : t.profileEdit.notSet}</option>
        <optgroup label={t.profileEdit.suggested}>
          {SUGGESTED_COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {countryName(code, locale)}
            </option>
          ))}
        </optgroup>
        <optgroup label={t.profileEdit.allCountries}>
          {others.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </optgroup>
      </SelectField>
      {value.country === 'TN' ? (
        <SelectField
          label={t.profileEdit.governorate}
          value={value.region}
          onChange={(event) => onChange({ ...value, region: event.target.value })}
          error={errors.region}
          hint={t.profileEdit.governorateHint}
        >
          <option value="">{t.profileEdit.notSet}</option>
          {TN_GOVERNORATES.map((region) => (
            <option key={region} value={region}>
              {regionName(region, t)}
            </option>
          ))}
        </SelectField>
      ) : null}
    </div>
  );
}
