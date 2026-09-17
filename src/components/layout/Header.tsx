import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { Menu, X } from "lucide-react";
import { useAuthStore } from "@/stores/authStore";
import styles from "./Header.module.css";

type NavItem = {
  href: string;
  label: string;
};

type NavConfig = {
  items: NavItem[];
  /** Приоритетное действие («Регистрация») — рисуется акцентной пилюлей */
  cta?: NavItem;
};

const BOOK_LINKS: NavItem[] = [
  { href: "/recipes", label: "Книга рецептов" },
  { href: "/workouts", label: "Книга тренировок" },
  { href: "/help", label: "Правила и помощь" },
  { href: "/privacy", label: "Персональные данные" },
];

function getNavConfig(
  role: ReturnType<typeof useAuthStore.getState>["role"]
): NavConfig {
  if (!role) {
    return {
      items: [...BOOK_LINKS, { href: "/login", label: "Войти" }],
      cta: { href: "/register", label: "Регистрация" },
    };
  }

  if (role === "admin") {
    return {
      items: [
        ...BOOK_LINKS,
        { href: "/admin", label: "На проверку" },
        { href: "/admin/users", label: "Пользователи" },
        { href: "/admin/help", label: "Статьи помощи" },
        { href: "/admin/products", label: "Продукты" },
        { href: "/account", label: "Аккаунт" },
      ],
    };
  }

  if (role === "mentor") {
    return {
      items: [
        ...BOOK_LINKS,
        { href: "/mentor/templates", label: "Мои шаблоны" },
        { href: "/mentor/templates/new", label: "Создать шаблон" },
        { href: "/mentor/streams", label: "Мои потоки" },
        { href: "/account", label: "Аккаунт" },
      ],
    };
  }

  return {
    items: [
      ...BOOK_LINKS,
      { href: "/dashboard", label: "Мои марафоны" },
      { href: "/account", label: "Аккаунт" },
    ],
  };
}

export default function Header() {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const initAuth = useAuthStore((s) => s.initAuth);
  const logout = useAuthStore((s) => s.logout);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    initAuth();
    setLoading(false);
  }, [router.asPath, initAuth]);

  // Перешли на другую страницу — меню больше не нужно
  useEffect(() => {
    setMenuOpen(false);
  }, [router.asPath]);

  // Esc закрывает мобильное меню
  useEffect(() => {
    if (!menuOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [menuOpen]);

  async function handleLogout() {
    setMenuOpen(false);
    await logout();
    window.location.href = "/";
  }

  const nav = loading ? null : getNavConfig(role);
  const isCurrent = (href: string) => router.pathname === href;

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <Link href="/" className={styles.logo}>
          Marathon Platform
        </Link>

        {nav && (
          <>
            <nav className={styles.nav}>
              {nav.items.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`${styles.link} ${isCurrent(item.href) ? styles.linkActive : ""}`}
                >
                  {item.label}
                </Link>
              ))}
              {nav.cta && (
                <Link href={nav.cta.href} className={styles.linkCta}>
                  {nav.cta.label}
                </Link>
              )}
              {role && (
                <button onClick={handleLogout} className={styles.button}>
                  Выйти
                </button>
              )}
            </nav>

            <button
              type="button"
              className={styles.burger}
              aria-label={menuOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={menuOpen}
              aria-controls="mobile-nav"
              onClick={() => setMenuOpen((open) => !open)}
            >
              {menuOpen ? <X size={20} strokeWidth={1.5} /> : <Menu size={20} strokeWidth={1.5} />}
            </button>
          </>
        )}
      </div>

      {nav && menuOpen && (
        <nav id="mobile-nav" className={styles.mobilePanel}>
          {nav.items.map((item) => (
            <Link key={item.href} href={item.href} className={styles.mobileLink}>
              {item.label}
            </Link>
          ))}
          {nav.cta && (
            <Link href={nav.cta.href} className={styles.mobileCta}>
              {nav.cta.label}
            </Link>
          )}
          {role && (
            <button onClick={handleLogout} className={styles.mobileButton}>
              Выйти
            </button>
          )}
        </nav>
      )}
    </header>
  );
}
