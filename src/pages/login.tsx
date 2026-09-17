import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import Button from '@/components/ui/Button';
import type { UserRole } from '@/types/auth';

function getDashboardPath(role: UserRole): string {
  if (role === 'admin') return '/admin';
  if (role === 'mentor') return '/mentor/templates';
  return '/dashboard';
}

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const user = await login({ email, password });
      router.push(getDashboardPath(user.role));
    } catch {
      // Error is already handled and stored by authStore.
    }
  }

  return (
    <main className="authPage">
      <h1 className="pageTitle">Вход</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="formGroup">
          <label htmlFor="email">Эл. почта</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="input"
          />
        </div>
        <div className="formGroup">
          <label htmlFor="password">Пароль</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="input"
          />
        </div>
        <Button type="submit" variant="primary" block loading={isLoading}>
          {isLoading ? 'Вход...' : 'Войти'}
        </Button>
      </form>
      <p>
        Нет аккаунта? <Link href="/register">Зарегистрироваться</Link>
      </p>
    </main>
  );
}
