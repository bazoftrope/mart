import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import ProductForm, {
  type ProductFormPayload,
} from '@/components/admin/ProductForm';

export default function AdminProductNewPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

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

  async function handleSubmit(values: ProductFormPayload) {
    await apiClient.post('/api/admin/products', values);
    router.push('/admin/products');
  }

  if (!ready) {
    return (
      <main className="containerMd">
        <p>Загрузка...</p>
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

      <h1 className="pageTitle">Новый продукт</h1>

      <ProductForm
        submitLabel="Создать продукт"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/products')}
      />
    </main>
  );
}
