import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import styles from './Button.module.css';

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** растянуть на 100% ширины родителя (для мобильных рядов) */
  block?: boolean;
  /** состояние загрузки — показывает спиннер, блокирует клики */
  loading?: boolean;
  /** иконка слева от текста */
  leftIcon?: ReactNode;
  /** иконка справа от текста */
  rightIcon?: ReactNode;
}

/**
 * Единый компонент кнопки по дизайн-системе v2.
 *
 * Токены — только из `globals.css`, без литеральных hex.
 * Совместим с глобальными классами .btn / .btnPrimary по визуалу,
 * но инкапсулирован как переиспользуемый компонент.
 *
 * @example
 * <Button variant="primary" size="lg" loading={saving} disabled={!canSave} onClick={handleSave}>
 *   Сохранить отчёт
 * </Button>
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'secondary',
    size = 'md',
    block = false,
    loading = false,
    leftIcon,
    rightIcon,
    children,
    className,
    disabled,
    type = 'button',
    ...rest
  },
  ref
) {
  const isDisabled = disabled || loading;
  const hasText = Boolean(children);

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

  const sizeClass =
    size === 'sm' ? styles.sm : size === 'lg' ? styles.lg : styles.md;

  const classes = [
    styles.base,
    variantClass,
    sizeClass,
    block ? styles.block : '',
    loading ? styles.loading : '',
    !hasText && (leftIcon || rightIcon) ? styles.iconOnly : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={isDisabled}
      aria-disabled={isDisabled}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading && <span className={styles.spinner} aria-hidden="true" />}
      {leftIcon && !loading && <span className={styles.icon} aria-hidden="true">{leftIcon}</span>}
      {children}
      {rightIcon && <span className={styles.icon} aria-hidden="true">{rightIcon}</span>}
    </button>
  );
});

export default Button;
