import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

export default function MentorMessagesPage() {
  const router = useRouter();

  useEffect(() => {
    useAuthStore.getState().initAuth();
    const currentRole = useAuthStore.getState().role;
    if (currentRole !== 'mentor') {
      router.push('/login');
      return;
    }
    if (!router.isReady) return;
    const { streamId, participantId } = router.query;
    if (typeof streamId === 'string' && streamId) {
      const target = participantId
        ? `/mentor/streams/${streamId}?participantId=${participantId}#chat`
        : `/mentor/streams/${streamId}#chat`;
      router.replace(target);
    } else {
      router.replace('/mentor/streams');
    }
  }, [router, router.isReady]);

  return (
    <main className="container">
      <h1 className="pageTitle">Чат переехал</h1>
      <p>Сообщения теперь внутри каждого марафона — откройте нужный поток, чат находится внизу страницы потока.</p>
      <p>
        <Link href="/mentor/streams">Перейти к моим потокам</Link>
      </p>
    </main>
  );
}
