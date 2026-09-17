import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChartLine, ClipboardList, Salad } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';
import { apiFetch } from '@/lib/apiClient';
import { ButtonLink } from '@/components/ui';
import StreamCard from '@/components/stream/StreamCard';
import cardStyles from '@/components/stream/StreamCard.module.css';
import styles from './index.module.css';

type Mentor = {
  id: string;
  name: string;
  email: string;
};

type Template = {
  id: string;
  title: string;
  description?: string;
  durationDays: number;
};

type Stream = {
  id: string;
  startDate: string;
  status: string;
  enrollmentsCount: number;
  template: Template | null;
  mentor: Mentor | null;
};

const STEPS = [
  {
    title: 'Зарегистрируйтесь',
    text: 'Создайте аккаунт и выберите роль: участник или ментор.',
  },
  {
    title: 'Выберите поток',
    text: 'Запишитесь в открытый марафон до даты старта.',
  },
  {
    title: 'Проходите программу',
    text: 'Каждый день заполняйте отчёт по питанию и следите за прогрессом.',
  },
];

const FEATURES = [
  {
    icon: Salad,
    title: 'Дневник питания',
    text: 'Продукты с калорийностью из базы и дневная норма под вашу цель.',
  },
  {
    icon: ClipboardList,
    title: 'Программа от ментора',
    text: 'Марафон разбит на дни с материалами и понятными заданиями.',
  },
  {
    icon: ChartLine,
    title: 'Рейтинг и дисциплина',
    text: 'Заполняйте дни, чтобы видеть свой прогресс и не терять мотивацию.',
  },
];

export default function Home() {
  const role = useAuthStore((s) => s.role);
  const [streams, setStreams] = useState<Stream[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useAuthStore.getState().initAuth();

    async function loadStreams() {
      try {
        const res = await apiFetch('/api/streams');
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(json.message || json.error || 'Не удалось загрузить потоки');
        }
        setStreams(json.data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Что-то пошло не так');
      } finally {
        setLoading(false);
      }
    }

    loadStreams();
  }, []);

  function getCabinetHref(): string {
    if (role === 'admin') return '/admin';
    if (role === 'mentor') return '/mentor/templates';
    if (role === 'participant') return '/dashboard';
    return '/register';
  }

  return (
    <main className="container">
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <p className={styles.heroEyebrow}>Марафоны здорового питания</p>
          <h1 className={styles.heroTitle}>
            Полезные привычки с поддержкой ментора и понятным планом
          </h1>
          <p className={styles.heroLead}>
            Выбирайте марафон, ведите дневник питания и следите за прогрессом.
            Менторы составляют программу, а рейтинг помогает дойти до конца.
          </p>

          <div className={styles.actions}>
            <a href="#streams" className={styles.btnHeroPrimary}>
              Выбрать поток
            </a>
            {role ? (
              <Link href={getCabinetHref()} className={styles.btnHeroSecondary}>
                В личный кабинет
              </Link>
            ) : (
              <Link href="/register" className={styles.btnHeroSecondary}>
                Зарегистрироваться
              </Link>
            )}
          </div>

          <ul className={styles.tags}>
            <li>Дневник питания</li>
            <li>Калорийность</li>
            <li>Рейтинг потока</li>
            <li>Программа от ментора</li>
          </ul>
        </div>

        {/* Органический переход от sage-панели к кремовому фону страницы */}
        <svg
          className={styles.heroWave}
          viewBox="0 0 1200 90"
          preserveAspectRatio="none"
          aria-hidden="true"
          focusable="false"
        >
          <path d="M0 58 C 150 8 330 0 480 20 C 640 42 780 76 930 70 C 1040 66 1130 46 1200 24 L1200 90 L0 90 Z" />
        </svg>
      </section>

      <section className={styles.section} id="features">
        <h2 className="pageSubtitle">Что даёт платформа</h2>
        <div className={styles.features}>
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            return (
              <article key={feature.title} className={styles.feature}>
                <span className={styles.featureIcon} aria-hidden="true">
                  <Icon size={22} strokeWidth={1.5} />
                </span>
                <h3 className={styles.featureTitle}>{feature.title}</h3>
                <p className={styles.featureText}>{feature.text}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className={styles.section} id="how-it-works">
        <h2 className="pageSubtitle">Как это работает</h2>
        <div className={styles.steps}>
          {STEPS.map((step, index) => (
            <article key={step.title} className={styles.step}>
              <span className={styles.stepNumber}>{index + 1}</span>
              <h3 className={styles.stepTitle}>{step.title}</h3>
              <p className={styles.stepText}>{step.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section} id="streams">
        <div className={styles.sectionHeader}>
          <h2 className="pageSubtitle">Все потоки</h2>
          <p className={styles.sectionLead}>
            Тестовый режим: показаны все статусы — набор, идёт, завершён.
            Записаться можно в любой поток.
          </p>
        </div>

        {loading && <div className="mutedBox">Загружаем открытые потоки...</div>}
        {error && <p className="error">{error}</p>}
        {!loading && !error && streams.length === 0 && (
          <div className={styles.emptyState}>
            <p>Сейчас нет потоков с открытым набором.</p>
            <p className={styles.emptyStateHint}>
              Новые марафоны появятся после модерации. Зарегистрируйтесь, чтобы не
              пропустить старт.
            </p>
            <ButtonLink href="/register" variant="primary">
              Зарегистрироваться
            </ButtonLink>
          </div>
        )}
        {!loading && !error && streams.length > 0 && (
          <ul className={cardStyles.grid}>
            {streams.map((stream) => (
              <StreamCard
                key={stream.id}
                title={stream.template?.title || 'Поток без названия'}
                href={`/streams/${stream.id}`}
                ctaHref={`/streams/${stream.id}`}
                ctaLabel="Подробнее"
                description={stream.template?.description || 'Нет описания'}
                durationDays={stream.template?.durationDays}
                startDate={stream.startDate}
                mentorName={stream.mentor?.name || 'Неизвестно'}
                participantsCount={stream.enrollmentsCount}
                status={stream.status}
              />
            ))}
          </ul>
        )}
      </section>

      <section className={styles.ctaSection}>
        <h2 className={styles.ctaTitle}>Готовы начать?</h2>
        <p className={styles.ctaText}>
          Зарегистрируйтесь как участник, чтобы присоединиться к потоку, или как
          ментор, чтобы запустить собственный марафон.
        </p>
        <div className={styles.actions}>
          {role ? (
            <Link href={getCabinetHref()} className={styles.btnCtaPrimary}>
              Перейти в личный кабинет
            </Link>
          ) : (
            <>
              <Link href="/register" className={styles.btnCtaPrimary}>
                Создать аккаунт
              </Link>
              <Link href="/login" className={styles.btnCtaSecondary}>
                Войти
              </Link>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
