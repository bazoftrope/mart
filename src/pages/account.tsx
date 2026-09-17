import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useAuthStore } from '@/stores/authStore';
import AccountDataSection from '@/components/account/AccountDataSection';

/**
 * Личный раздел «Аккаунт и данные»: согласия, экспорт и удаление (152-ФЗ).
 * Доступен любой авторизованной роли.
 */
export default function AccountPage() {
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    useAuthStore.getState().initAuth();
    if (useAuthStore.getState().role === null) {
      router.replace('/login');
      return;
    }
    setReady(true);
  }, [router]);

  return (
    <>
      <Head>
        <title>Аккаунт и данные — Marathon Platform</title>
      </Head>
      <main className="container">
        <h1 className="pageTitle">Аккаунт и данные</h1>
        {ready && <AccountDataSection />}
      </main>
    </>
  );
}
