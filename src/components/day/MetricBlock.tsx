import type { ReactNode } from 'react';
import styles from './MetricBlock.module.css';

export type MetricNumberField = {
  kind: 'number';
  key: string;
  label: string;
  value: number | '';
  onChange: (value: string) => void;
  min?: number;
  max?: number;
  step?: number | string;
  disabled?: boolean;
  placeholder?: string;
};

export type MetricActivityField = {
  kind: 'activity';
  key: string;
  label: string;
  hoursValue: number | '';
  minutesValue: number | '';
  onHoursChange: (value: string) => void;
  onMinutesChange: (value: string) => void;
  disabled?: boolean;
};

export type MetricField = MetricNumberField | MetricActivityField;

/** Секция внутри карточки метрик: подпись + свои поля. */
export type MetricGroup = {
  key: string;
  title?: string;
  fields?: MetricField[];
  children?: ReactNode;
};

type MetricBlockProps = {
  title?: string;
  /** Плоский список полей — когда секции не нужны. */
  fields?: MetricField[];
  /** Секции с подписями и разделителями; при наличии имеет приоритет над `fields`. */
  groups?: MetricGroup[];
  children?: ReactNode;
};

function NumberMetricField({
  label,
  value,
  onChange,
  min,
  max,
  step,
  disabled,
  placeholder,
}: Omit<MetricNumberField, 'kind' | 'key'>) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder={placeholder}
        className={styles.input}
      />
    </label>
  );
}

function ActivityMetricField({
  label,
  hoursValue,
  minutesValue,
  onHoursChange,
  onMinutesChange,
  disabled,
}: Omit<MetricActivityField, 'kind' | 'key'>) {
  return (
    <label className={styles.field}>
      <span>{label}</span>
      <div className={styles.activityInputs}>
        <input
          type="number"
          min={0}
          max={23}
          step={1}
          value={hoursValue}
          onChange={(e) => onHoursChange(e.target.value)}
          disabled={disabled}
          placeholder="ч"
          className={`${styles.input} ${styles.inputCompact}`}
        />
        <span>:</span>
        <input
          type="number"
          min={0}
          max={59}
          step={1}
          value={minutesValue}
          onChange={(e) => onMinutesChange(e.target.value)}
          disabled={disabled}
          placeholder="мин"
          className={`${styles.input} ${styles.inputCompact}`}
        />
      </div>
    </label>
  );
}

function renderField(field: MetricField) {
  return field.kind === 'activity' ? (
    <ActivityMetricField
      key={field.key}
      label={field.label}
      hoursValue={field.hoursValue}
      minutesValue={field.minutesValue}
      onHoursChange={field.onHoursChange}
      onMinutesChange={field.onMinutesChange}
      disabled={field.disabled}
    />
  ) : (
    <NumberMetricField
      key={field.key}
      label={field.label}
      value={field.value}
      onChange={field.onChange}
      min={field.min}
      max={field.max}
      step={field.step}
      disabled={field.disabled}
      placeholder={field.placeholder}
    />
  );
}

export default function MetricBlock({
  title,
  fields = [],
  groups,
  children,
}: MetricBlockProps) {
  return (
    <div className={styles.block}>
      {title && <h4 className={styles.title}>{title}</h4>}
      {groups ? (
        groups.map((group, index) => (
          <section
            key={group.key}
            className={`${styles.group} ${index > 0 ? styles.groupDivided : ''}`}
          >
            {group.title && <h5 className={styles.groupTitle}>{group.title}</h5>}
            <div className={styles.fields}>
              {(group.fields ?? []).map(renderField)}
              {group.children}
            </div>
          </section>
        ))
      ) : fields.length > 0 ? (
        <div className={styles.fields}>
          {fields.map(renderField)}
          {children}
        </div>
      ) : (
        children
      )}
    </div>
  );
}
