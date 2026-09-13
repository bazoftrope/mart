import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export default function ParticipantMessagesPage() {
  const router = useRouter();

  useEffect(() => {
    useAuthStore.getState().initAuth();
    const currentRole = useAuthStore.getState().role;
    if (currentRole !== 'participant') {
      router.push('/login');
      return;
    }
    if (!router.isReady) return;
    const { streamId } = router.query;
    if (typeof streamId === 'string' && streamId) {
      router.replace(`/dashboard/marathon/${streamId}`);
    } else {
      router.replace('/dashboard');
    }
  }, [router, router.isReady]);

  return (
    <main className="container">
      <h1 className="pageTitle">Чат переехал</h1>
      <p>Сообщения теперь внутри марафона — откройте нужный марафон, чат доступен через иконку в шапке марафона.</p>
      <p>
        <Link href="/dashboard">Перейти к моим марафонам</Link>
      </p>
    </main>
  );
}
