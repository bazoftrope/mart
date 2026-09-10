import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import HelpForm, { type HelpFormValues } from '@/components/help/HelpForm';

export default function AdminHelpNewPage() {
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

  async function handleSubmit(values: HelpFormValues) {
    await apiClient.post('/api/help', values);
    router.push('/admin/help');
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
        <Link href="/admin/help" className="backLink">
          ← К управлению разделом
        </Link>
      </p>

      <h1 className="pageTitle">Новая статья</h1>

      <HelpForm
        submitLabel="Создать статью"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/admin/help')}
      />
    </main>
  );
}
