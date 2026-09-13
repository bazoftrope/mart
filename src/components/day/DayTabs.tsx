import Link from 'next/link';
import styles from './DayTabs.module.css';

export type DayTabValue = 'materials' | 'report' | 'pulse' | 'progress';

type DayTabsProps = {
  streamId: string;
  dayNumber: number;
  activeTab: DayTabValue;
};

export default function DayTabs({ streamId, dayNumber, activeTab }: DayTabsProps) {
  const basePath = `/dashboard/marathon/${streamId}`;

  return (
    <nav className={styles.tabs} aria-label="Вкладки дня">
      <Link
        href={`${basePath}?day=${dayNumber}&tab=materials`}
        className={`${styles.tab} ${activeTab === 'materials' ? styles.active : ''}`}
        aria-current={activeTab === 'materials' ? 'page' : undefined}
      >
        Материалы
      </Link>
      <Link
        href={`${basePath}?day=${dayNumber}&tab=report`}
        className={`${styles.tab} ${activeTab === 'report' ? styles.active : ''}`}
        aria-current={activeTab === 'report' ? 'page' : undefined}
      >
        Отчёт
      </Link>
      <Link
        href={`${basePath}?day=${dayNumber}&tab=pulse`}
        className={`${styles.tab} ${activeTab === 'pulse' ? styles.active : ''}`}
        aria-current={activeTab === 'pulse' ? 'page' : undefined}
      >
        Самочувствие
      </Link>
      <Link
        href={`${basePath}?day=${dayNumber}&tab=progress`}
        className={`${styles.tab} ${activeTab === 'progress' ? styles.active : ''}`}
        aria-current={activeTab === 'progress' ? 'page' : undefined}
      >
        Прогресс
      </Link>
    </nav>
  );
}
