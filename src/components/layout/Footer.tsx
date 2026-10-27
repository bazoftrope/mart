import styles from './Footer.module.css';

export default function Footer() {
  const version = process.env.NEXT_PUBLIC_APP_VERSION;
  const buildDate = process.env.NEXT_PUBLIC_BUILD_DATE;

  const parts: string[] = [];
  if (version) parts.push(`v${version}`);
  if (buildDate) parts.push(`сборка ${buildDate}`);

  if (parts.length === 0) {
    return null;
  }

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p className={styles.text}>{parts.join(' · ')}</p>
      </div>
    </footer>
  );
}
