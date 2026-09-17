import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import ProductForm, {
  type ProductFormPayload,
} from '@/components/admin/ProductForm';
import type { ProductDto } from '@/types/product';

export default function AdminProductEditPage() {
  const router = useRouter();
  const rawId = router.query.id;
  const id = Array.isArray(rawId) ? rawId[0] : rawId;

  const [product, setProduct] = useState<ProductDto | null>(null);
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initAuth = useAuthStore.getState().initAuth;
    initAuth();
    const role = useAuthStore.getState().role;
    if (role !== 'admin') {
      router.push('/login');
      return;
    }
    setReady(true);
  }, [router]);

  useEffect(() => {
    if (!ready || !id) return;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient.get<ProductDto>(`/api/admin/products/${id}`);
        setProduct(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Не удалось загрузить продукт');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [ready, id]);

  async function handleSubmit(values: ProductFormPayload) {
    if (!id) return;
    await apiClient.put(`/api/admin/products/${id}`, values);
    router.push('/admin/products');
  }

  if (!ready || loading) {
    return (
      <main className="containerMd">
        <p>Загрузка...</p>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="containerMd">
        <p className="error">{error || 'Продукт не найден'}</p>
        <p>
          <Link href="/admin/products" className="backLink">
            ← К каталогу продуктов
          </Link>
        </p>
      </main>
    );
  }

  return (
    <main className="containerMd">
      <p>
        <Link href="/admin/products" className="backLink">
          ← К каталогу продуктов
        </Link>
      </p>

      <h1 className="pageTitle">{product.name}</h1>

      <ProductForm
        initialValues={{
          name: product.name,
          calories: String(product.calories),
          protein: String(product.protein),
          fat: String(product.fat),
          carbs: String(product.carbs),
        }}
        submitLabel="Сохранить"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/products')}
      />
    </main>
  );
}
