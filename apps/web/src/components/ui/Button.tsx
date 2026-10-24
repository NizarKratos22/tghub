import Link from 'next/link';
import type { ButtonHTMLAttributes, ComponentProps, ReactNode } from 'react';
import { cx } from '@/lib/cx';
import { Icon, type IconName } from './Icon';
import styles from './Button.module.css';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'gold';
type Size = 'sm' | 'md' | 'lg';

interface StyleProps {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  iconRight?: IconName;
  block?: boolean;
}

function classes({ variant = 'primary', size = 'md', block }: StyleProps, className?: string) {
  return cx(styles.button, styles[variant], styles[size], block && styles.block, className);
}

function Content({ icon, iconRight, children, loading }: StyleProps & { children?: ReactNode; loading?: boolean }) {
  return (
    <>
      {loading ? <span className={styles.spinner} aria-hidden /> : icon ? <Icon name={icon} size={16} /> : null}
      {children ? <span>{children}</span> : null}
      {iconRight ? <Icon name={iconRight} size={16} /> : null}
    </>
  );
}

type ButtonProps = StyleProps & ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean };

export function Button({ variant, size, icon, iconRight, block, loading, className, children, disabled, type = 'button', ...rest }: ButtonProps) {
  return (
    <button
      type={type}
      className={classes({ variant, size, block }, className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      <Content icon={icon} iconRight={iconRight} loading={loading}>
        {children}
      </Content>
    </button>
  );
}

type ButtonLinkProps = StyleProps & ComponentProps<typeof Link>;

export function ButtonLink({ variant, size, icon, iconRight, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={classes({ variant, size, block }, className)} {...rest}>
      <Content icon={icon} iconRight={iconRight}>
        {children as ReactNode}
      </Content>
    </Link>
  );
}
