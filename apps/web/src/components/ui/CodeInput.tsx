'use client';

import { useEffect, useRef, type ClipboardEvent, type KeyboardEvent } from 'react';
import { cx } from '@/lib/cx';
import styles from './CodeInput.module.css';

export const CODE_LENGTH = 6;

/**
 * Six one-digit boxes for emailed codes. Typing advances, Backspace goes back,
 * pasting or phone autofill fills every box, and a full code submits itself.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  invalid = false,
  disabled = false,
  autoFocus = true,
}: {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (code: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  useEffect(() => {
    if (autoFocus) boxes.current[0]?.focus();
  }, [autoFocus]);

  const setDigits = (digits: string, focusAt: number) => {
    const next = digits.replace(/\D/g, '').slice(0, CODE_LENGTH);
    onChange(next);
    boxes.current[Math.min(focusAt, CODE_LENGTH - 1)]?.focus();
    if (next.length === CODE_LENGTH) onComplete?.(next);
  };

  const onKey = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      event.preventDefault();
      setDigits(value.slice(0, index - 1) + value.slice(index), index - 1);
    }
    if (event.key === 'ArrowLeft' && index > 0) boxes.current[index - 1]?.focus();
    if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) boxes.current[index + 1]?.focus();
  };

  const onPaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData('text').replace(/\D/g, '');
    if (pasted) setDigits(pasted, pasted.length);
  };

  return (
    <div className={cx(styles.code, invalid && styles.codeInvalid)} role="group" aria-label="6-digit code" dir="ltr">
      {Array.from({ length: CODE_LENGTH }, (_, index) => (
        <input
          key={index}
          ref={(el) => {
            boxes.current[index] = el;
          }}
          className={styles.digit}
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={CODE_LENGTH}
          value={value[index] ?? ''}
          disabled={disabled}
          aria-label={`Digit ${index + 1}`}
          onChange={(event) => {
            const typed = event.target.value.replace(/\D/g, '');
            if (!typed) {
              setDigits(value.slice(0, index) + value.slice(index + 1), index);
              return;
            }
            // Typing into a box replaces from here on; autofill can drop all six into one.
            setDigits(value.slice(0, index) + typed + value.slice(index + typed.length), index + typed.length);
          }}
          onKeyDown={onKey(index)}
          onPaste={onPaste}
          onFocus={(event) => event.target.select()}
        />
      ))}
    </div>
  );
}
