import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '@/lib/cx';
import styles from './Field.module.css';

interface FieldShellProps {
  label: string;
  hint?: ReactNode;
  error?: string;
  id: string;
  children: ReactNode;
  className?: string;
}

function FieldShell({ label, hint, error, id, children, className }: FieldShellProps) {
  return (
    <div className={cx(styles.field, error && styles.invalid, className)}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p className={styles.error} id={`${id}-error`} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint} id={`${id}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type Shared = { label: string; hint?: ReactNode; error?: string; wrapperClassName?: string };

export function TextField({ label, hint, error, wrapperClassName, className, id, ...rest }: Shared & InputHTMLAttributes<HTMLInputElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} className={wrapperClassName}>
      <input
        id={fieldId}
        className={cx(styles.control, className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        {...rest}
      />
    </FieldShell>
  );
}

export function SelectField({ label, hint, error, wrapperClassName, className, id, children, ...rest }: Shared & SelectHTMLAttributes<HTMLSelectElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} className={wrapperClassName}>
      <select id={fieldId} className={cx(styles.control, styles.select, className)} aria-invalid={error ? true : undefined} {...rest}>
        {children}
      </select>
    </FieldShell>
  );
}

export function TextAreaField({ label, hint, error, wrapperClassName, className, id, ...rest }: Shared & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} className={wrapperClassName}>
      <textarea id={fieldId} className={cx(styles.control, styles.textarea, className)} aria-invalid={error ? true : undefined} {...rest} />
    </FieldShell>
  );
}

/** Banner for errors that don't belong to one field. */
export function FormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p className={styles.formError} role="alert">
      {message}
    </p>
  );
}
