'use client';

import { COUNTRY_CODES, countryName, SUGGESTED_COUNTRIES, TN_GOVERNORATES } from '@tgh/shared';
import { useMemo } from 'react';
import { SelectField } from '@/components/ui/Field';
import styles from './HomeFields.module.css';

export interface HomeValue {
  country: string;
  region: string;
}

/**
 * Country for everyone, governorate for players in Tunisia. Suggested countries
 * come first; the rest are sorted by their English name.
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
  const others = useMemo(
    () =>
      COUNTRY_CODES.filter((code) => !SUGGESTED_COUNTRIES.includes(code))
        .map((code) => ({ code, name: countryName(code) }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    [],
  );

  return (
    <div className={styles.row}>
      <SelectField
        label={optional ? 'Country (optional)' : 'Country'}
        value={value.country}
        onChange={(event) => onChange({ country: event.target.value, region: event.target.value === 'TN' ? value.region : '' })}
        error={errors.country}
      >
        <option value="">{optional ? 'Prefer not to say' : 'Not set'}</option>
        <optgroup label="Suggested">
          {SUGGESTED_COUNTRIES.map((code) => (
            <option key={code} value={code}>
              {countryName(code)}
            </option>
          ))}
        </optgroup>
        <optgroup label="All countries">
          {others.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </optgroup>
      </SelectField>
      {value.country === 'TN' ? (
        <SelectField
          label="Governorate"
          value={value.region}
          onChange={(event) => onChange({ ...value, region: event.target.value })}
          error={errors.region}
          hint="Your season XP also counts toward your governorate."
        >
          <option value="">Not set</option>
          {TN_GOVERNORATES.map((region) => (
            <option key={region} value={region}>
              {region}
            </option>
          ))}
        </SelectField>
      ) : null}
    </div>
  );
}
