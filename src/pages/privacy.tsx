import Head from 'next/head';
import Link from 'next/link';
import PrivacyDocuments from '@/components/legal/PrivacyDocuments';
import styles from './privacy.module.css';

/**
 * Публичная страница с политикой обработки ПДн и текстами согласий.
 *
 * Тексты — в общем компоненте `PrivacyDocuments` (используется и вкладкой
 * «Персональные данные» в разделе «Правила и помощь»), чтобы был единый
 * источник правды и рабочие якори `#policy`, `#consent`, `#consent-health`.
 */
export default function PrivacyPage() {
  return (
    <>
      <Head>
        <title>Персональные данные — Marathon Platform</title>
      </Head>
      <main className="container">
        <header className={styles.header}>
          <p>
            <Link href="/help" className="backLink">
              ← К правилам и помощи
            </Link>
          </p>
          <h1 className="pageTitle">Персональные данные</h1>
          <p className={styles.lead}>
            Как платформа обрабатывает персональные данные: политика и тексты
            согласий, которые подтверждаются при регистрации и заполнении анкеты.
          </p>
        </header>

        <nav className={styles.toc} aria-label="Содержание страницы">
          <a href="#policy">Политика обработки ПДн</a>
          <a href="#consent">Согласие на обработку ПДн</a>
          <a href="#consent-health">Согласие на данные о здоровье</a>
        </nav>

        <PrivacyDocuments />
      </main>
    </>
  );
}