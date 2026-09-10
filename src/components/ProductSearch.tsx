import { useEffect, useRef, useState } from 'react';
import styles from './ProductSearch.module.css';
import { apiFetch } from '@/lib/apiClient';

export type Product = {
  id: string;
  name: string;
  calories: number;
};

type ProductSearchProps = {
  onSelect: (product: Product) => void;
  disabled?: boolean;
};

export default function ProductSearch({ onSelect, disabled }: ProductSearchProps) {
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
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

  function handleSelect(product: Product) {
    onSelect(product);
    setSearch('');
    setProducts([]);
    setOpen(false);
    setCustomOpen(false);
    setError(null);
  }

  async function handleAddToCatalog(event: React.FormEvent) {
    event.preventDefault();
    const name = customName.trim();
    const calories = Number(customCalories);
    if (!name || !Number.isFinite(calories) || calories <= 0) {
      setError('Укажите название и калорийность больше 0');
      return;
    }

    setAdding(true);
    setError(null);
    try {
      const res = await apiFetch('/api/products', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, calories }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message =
          json.issues?.name || json.issues?.calories || json.message || json.error;
        throw new Error(message || 'Не удалось добавить продукт');
      }

      handleSelect({
        id: json.data.id,
        name: json.data.name,
        calories: json.data.calories,
      });
      setCustomName('');
      setCustomCalories('');
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
                ({product.calories} ккал/100г)
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
              <div className={styles.customRow}>
                <input
                  type="number"
                  min="1"
                  max="2000"
                  step="0.1"
                  value={customCalories}
                  onChange={(e) => setCustomCalories(e.target.value)}
                  placeholder="ккал/100г"
                  className={styles.input}
                />
                <button
                  type="submit"
                  disabled={adding}
                  className={styles.addCustomButton}
                >
                  {adding ? 'Добавляем...' : 'Добавить'}
                </button>
              </div>
            </form>
          )}

          {error && <div className={styles.errorText}>{error}</div>}
        </div>
      )}
    </div>
  );
}
