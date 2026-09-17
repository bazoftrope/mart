import { useEffect, useRef, useState } from 'react';
import styles from './ProductSearch.module.css';
import { apiFetch } from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import { KCAL_PER_GRAM } from '@/lib/nutritionCalculator';

export type Product = {
  id: string;
  name: string;
  /** ккал на 100 г */
  calories: number;
  /** белки, г на 100 г */
  protein: number;
  /** жиры, г на 100 г */
  fat: number;
  /** углеводы, г на 100 г */
  carbs: number;
};

type ProductSearchProps = {
  onSelect: (product: Product) => void;
  disabled?: boolean;
};

function parseMacro(value: string): number {
  const num = Number(value);
  return Number.isFinite(num) && num >= 0 ? num : 0;
}

function suggestCalories(protein: string, fat: string, carbs: string): string {
  const kcal =
    parseMacro(protein) * KCAL_PER_GRAM.protein +
    parseMacro(fat) * KCAL_PER_GRAM.fat +
    parseMacro(carbs) * KCAL_PER_GRAM.carbs;
  return kcal > 0 ? String(Math.round(kcal)) : '';
}

export default function ProductSearch({ onSelect, disabled }: ProductSearchProps) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [caloriesTouched, setCaloriesTouched] = useState(false);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
        setCustomOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setProducts([]);
      setOpen(false);
      return;
    }

    const timeout = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await apiFetch(
          `/api/products?search=${encodeURIComponent(search)}`,
          { credentials: 'include' }
        );
        const json = await res.json().catch(() => ({}));
        if (res.ok && json.success) {
          setProducts(json.data || []);
          setOpen(true);
        } else {
          setError(json.message || json.error || 'Не удалось загрузить продукты');
        }
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => clearTimeout(timeout);
  }, [search]);

  function resetCustomForm() {
    setCustomName('');
    setCustomCalories('');
    setCustomProtein('');
    setCustomFat('');
    setCustomCarbs('');
    setCaloriesTouched(false);
  }

  function handleSelect(product: Product) {
    onSelect(product);
    setSearch('');
    setProducts([]);
    setOpen(false);
    setCustomOpen(false);
    setError(null);
    resetCustomForm();
  }

  function handleMacroChange(
    field: 'protein' | 'fat' | 'carbs',
    value: string
  ) {
    const next = {
      protein: field === 'protein' ? value : customProtein,
      fat: field === 'fat' ? value : customFat,
      carbs: field === 'carbs' ? value : customCarbs,
    };
    if (field === 'protein') setCustomProtein(value);
    if (field === 'fat') setCustomFat(value);
    if (field === 'carbs') setCustomCarbs(value);

    if (!caloriesTouched) {
      setCustomCalories(suggestCalories(next.protein, next.fat, next.carbs));
    }
  }

  async function handleAddToCatalog(event: React.FormEvent) {
    event.preventDefault();
    const name = customName.trim();
    const calories = Number(customCalories);
    const protein = Number(customProtein || 0);
    const fat = Number(customFat || 0);
    const carbs = Number(customCarbs || 0);

    const macrosValid =
      [protein, fat, carbs].every(
        (value) => Number.isFinite(value) && value >= 0 && value <= 100
      ) && protein + fat + carbs <= 100;

    if (!name || !Number.isFinite(calories) || calories <= 0) {
      setError('Укажите название и калорийность больше 0');
      return;
    }
    if (!macrosValid) {
      setError('БЖУ: числа от 0 до 100, сумма Б+Ж+У не больше 100');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, calories, protein, fat, carbs }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          json.issues?.name ||
          json.issues?.calories ||
          json.issues?.protein ||
          json.message ||
          json.error;
        throw new Error(message || 'Не удалось добавить продукт');
      }

      handleSelect({
        id: json.data.id,
        name: json.data.name,
        calories: json.data.calories,
        protein: json.data.protein,
        fat: json.data.fat,
        carbs: json.data.carbs,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось добавить продукт');
    } finally {
      setAdding(false);
    }
  }

  const showEmptyHint = !loading && products.length === 0 && search.trim().length > 0;

  return (
    <div ref={wrapperRef} className={styles.wrapper}>
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск продукта или блюда..."
        disabled={disabled}
        className={styles.input}
      />
      {open && (
        <div className={styles.dropdown}>
          {loading && products.length === 0 && (
            <div className={styles.hint}>Загрузка...</div>
          )}
          {showEmptyHint && (
            <div className={styles.hint}>Ничего не найдено в каталоге</div>
          )}
          {products.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => handleSelect(product)}
              className={styles.option}
            >
              {product.name}{' '}
              <span className={styles.calories}>
                ({product.calories} ккал/100г · Б {product.protein} · Ж {product.fat} · У{' '}
                {product.carbs})
              </span>
            </button>
          ))}

          {!customOpen ? (
            <button
              type="button"
              onClick={() => {
                setCustomOpen(true);
                setError(null);
              }}
              className={styles.option}
            >
              + Добавить продукт / блюдо в общий каталог
            </button>
          ) : (
            <form onSubmit={handleAddToCatalog} className={styles.customForm}>
              <input
                type="text"
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Название (например, Борщ)"
                className={styles.input}
                autoFocus
              />
              <div className={styles.customGrid}>
                <label className={styles.customField}>
                  <span>ккал/100г</span>
                  <input
                    type="number"
                    min="0.1"
                    max="2000"
                    step="0.1"
                    value={customCalories}
                    onChange={(e) => {
                      setCustomCalories(e.target.value);
                      setCaloriesTouched(true);
                    }}
                    className={styles.input}
                  />
                </label>
                <label className={styles.customField}>
                  <span>Белки, г</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={customProtein}
                    onChange={(e) => handleMacroChange('protein', e.target.value)}
                    className={styles.input}
                  />
                </label>
                <label className={styles.customField}>
                  <span>Жиры, г</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={customFat}
                    onChange={(e) => handleMacroChange('fat', e.target.value)}
                    className={styles.input}
                  />
                </label>
                <label className={styles.customField}>
                  <span>Углеводы, г</span>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={customCarbs}
                    onChange={(e) => handleMacroChange('carbs', e.target.value)}
                    className={styles.input}
                  />
                </label>
              </div>
              <Button type="submit" variant="primary" size="sm" loading={adding}>
                {adding ? 'Добавляем...' : 'Добавить'}
              </Button>
            </form>
          )}

          {error && <div className={styles.errorText}>{error}</div>}
        </div>
      )}
    </div>
  );
}
