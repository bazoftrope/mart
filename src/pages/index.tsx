import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ChartLine, ClipboardList, Flame, Salad } from 'lucide-react';
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

const HERO_TAGS = [
  { icon: Salad, label: 'Дневник питания' },
  { icon: Flame, label: 'Калорийность' },
  { icon: ChartLine, label: 'Рейтинг потока' },
  { icon: ClipboardList, label: 'Программа от ментора' },
];

type StreamsSectionProps = {
  streams: Stream[];
  loading: boolean;
  error: string | null;
  isParticipant: boolean;
};

function StreamsSection({
  streams,
  loading,
  error,
  isParticipant,
}: StreamsSectionProps) {
  return (
    <section
      className={`${styles.section} ${isParticipant ? styles.sectionCatalog : ''}`}
      id="streams"
    >
      <div className={styles.sectionHeader}>
        {isParticipant ? (
          <div className={styles.catalogHeader}>
            <div>
              <h1 className="pageTitle">Марафоны</h1>
              <p className={styles.sectionLead}>
                Открытые и идущие потоки. Выберите новый марафон или вернитесь к
                своим.
              </p>
            </div>
            <ButtonLink href="/dashboard" variant="secondary">
              Мои марафоны
            </ButtonLink>
          </div>
        ) : (
          <>
            <h2 className="pageSubtitle">Все потоки</h2>
            <p className={styles.sectionLead}>
              Открытые и идущие марафоны. Завершённые потоки доступны в личном
              кабинете.
            </p>
          </>
        )}
      </div>

      {loading && <div className="mutedBox">Загружаем открытые потоки...</div>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && streams.length === 0 && (
        <div className={styles.emptyState}>
          <p>Сейчас нет доступных потоков.</p>
          <p className={styles.emptyStateHint}>
            {isParticipant
              ? 'Новые марафоны появятся после модерации. Загляните позже.'
              : 'Новые марафоны появятся после модерации. Зарегистрируйтесь, чтобы не пропустить старт.'}
          </p>
          {isParticipant ? (
            <ButtonLink href="/dashboard" variant="primary">
              Мои марафоны
            </ButtonLink>
          ) : (
            <ButtonLink href="/register" variant="primary">
              Зарегистрироваться
            </ButtonLink>
          )}
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
  );
}

export default function Home() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const initialized = useAuthStore((s) => s.initialized);
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

  // Middleware закрывает жёсткий заход на `/`, но при клиентском переходе
  // (например, по логотипу) он может не сработать — дублируем редирект здесь.
  useEffect(() => {
    if (initialized && role === 'mentor') {
      router.replace('/mentor/templates');
    }
  }, [initialized, role, router]);

  function getCabinetHref(): string {
    if (role === 'admin') return '/admin';
    if (role === 'mentor') return '/mentor/templates';
    if (role === 'participant') return '/dashboard';
    return '/register';
  }

  if (initialized && role === 'mentor') {
    return (
      <main className="container">
        <div className="mutedBox">Переходим в личный кабинет...</div>
      </main>
    );
  }

  if (initialized && role === 'participant') {
    return (
      <main className="container">
        <StreamsSection
          streams={streams}
          loading={loading}
          error={error}
          isParticipant
        />
      </main>
    );
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
          <ul className={styles.tags}>
            {HERO_TAGS.map((tag) => {
              const Icon = tag.icon;
              return (
                <li key={tag.label} title={tag.label}>
                  <Icon size={20} strokeWidth={1.5} aria-hidden="true" />
                  <span className={styles.tagLabel}>{tag.label}</span>
                </li>
              );
            })}
          </ul>

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


        </div>
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

      <StreamsSection
        streams={streams}
        loading={loading}
        error={error}
        isParticipant={false}
      />

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
