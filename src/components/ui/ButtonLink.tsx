import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';
import styles from './Button.module.css';
import type { ButtonSize, ButtonVariant } from './Button';

type ButtonLinkProps = Omit<ComponentProps<typeof Link>, 'className'> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
};

/**
 * Ссылка, выглядящая как кнопка — для CTA-ссылок (`<Link className="btn...">`).
 * Использует те же токены/варианты что и `Button`, чтобы `Link` и `button` не расходились.
 */
export default function ButtonLink({
  variant = 'secondary',
  size = 'md',
  block = false,
  className,
  leftIcon,
  rightIcon,
  children,
  ...rest
}: ButtonLinkProps) {
  const variantClass =
    variant === 'primary'
      ? styles.primary
      : variant === 'outline'
        ? styles.outline
        : variant === 'ghost'
          ? styles.ghost
          : variant === 'danger'
            ? styles.danger
            : variant === 'success'
              ? styles.success
              : styles.secondary;

  const sizeClass = size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;
  const hasText = Boolean(children);

  const classes = [
    styles.base,
    variantClass,
    sizeClass,
    block ? styles.block : '',
    !hasText && (leftIcon || rightIcon) ? styles.iconOnly : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <Link className={classes} {...rest}>
      {leftIcon && <span className={styles.icon} aria-hidden="true">{leftIcon}</span>}
      {children}
      {rightIcon && <span className={styles.icon} aria-hidden="true">{rightIcon}</span>}
    </Link>
  );
}
