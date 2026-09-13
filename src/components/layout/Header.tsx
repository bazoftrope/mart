import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useAuthStore } from '@/stores/authStore';
import styles from './Header.module.css';

export default function Header() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const initAuth = useAuthStore((s) => s.initAuth);
  const logout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAuth();
    setLoading(false);
  }, [router.asPath, initAuth]);

  async function handleLogout() {
    await logout();
    window.location.href = '/';
  }

  function renderNav() {
    if (loading) return null;

    const bookLinks = (
      <>
        <Link href="/recipes" className={styles.link}>
          Книга рецептов
        </Link>
        <Link href="/workouts" className={styles.link}>
          Книга тренировок
        </Link>
        <Link href="/help" className={styles.link}>
          Правила и помощь
        </Link>
      </>
    );

    if (!role) {
      return (
        <>
          {bookLinks}
          <Link href="/login" className={styles.link}>
            Войти
          </Link>
          <Link href="/register" className={styles.link}>
            Регистрация
          </Link>
        </>
      );
    }

    if (role === 'admin') {
      return (
        <>
          {bookLinks}
          <Link href="/admin" className={styles.link}>
            На проверку
          </Link>
          <Link href="/admin/users" className={styles.link}>
            Пользователи
          </Link>
          <Link href="/admin/help" className={styles.link}>
            Статьи помощи
          </Link>
          <button onClick={handleLogout} className={styles.button}>
            Выйти
          </button>
        </>
      );
    }

    if (role === 'mentor') {
      return (
        <>
          {bookLinks}
          <Link href="/mentor" className={styles.link}>
            Панель
          </Link>
          <Link href="/mentor/templates" className={styles.link}>
            Мои шаблоны
          </Link>
          <Link href="/mentor/templates/new" className={styles.link}>
            Создать шаблон
          </Link>
          <Link href="/mentor/streams" className={styles.link}>
            Мои потоки
          </Link>
          <button onClick={handleLogout} className={styles.button}>
            Выйти
          </button>
        </>
      );
    }

    // role === 'participant'
    return (
      <>
        {bookLinks}
        <Link href="/dashboard" className={styles.link}>
          Мои марафоны
        </Link>
        <button onClick={handleLogout} className={styles.button}>
          Выйти
        </button>
      </>
    );
  }

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          <Image
            src="/logo.png"
            alt="Marathon Platform"
            width={33}
            height={36}
            className={styles.logoImage}
          />
          <span>Marathon Platform</span>
        </Link>
        <nav className={styles.nav}>{renderNav()}</nav>
      </div>
    </header>
  );
}
