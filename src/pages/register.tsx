import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { HELP_SLUG_RULES } from '@/lib/helpSlug';
import type { UserRole } from '@/types/auth';

function getDashboardPath(role: UserRole): string {
  if (role === 'admin') return '/admin';
  if (role === 'mentor') return '/mentor/templates';
  return '/dashboard';
}

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState<'participant' | 'mentor'>('participant');
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);
  const error = useAuthStore((s) => s.error);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    try {
      const user = await register({ email, password, name, role });
      router.push(user.role === 'participant' ? '/onboarding' : getDashboardPath(user.role));
    } catch {
      // Error is already handled and stored by authStore.
    }
  }

  return (
    <main className="containerNarrow">
      <h1 className="pageTitle">Регистрация</h1>
      {error && <p className="error">{error}</p>}
      <form onSubmit={handleSubmit}>
        <div className="formGroup">
          <label htmlFor="name">Имя</label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="input"
          />
        </div>
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
            minLength={6}
            className="input"
          />
        </div>
        <div className="formGroup">
          <label htmlFor="role">Роль</label>
          <select
            id="role"
            value={role}
            onChange={(e) => setRole(e.target.value as 'participant' | 'mentor')}
            className="input"
          >
            <option value="participant">Участник</option>
            <option value="mentor">Ментор</option>
          </select>
        </div>
        <button type="submit" disabled={isLoading} className="btn btnPrimary btnBlock">
          {isLoading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>
      <p className="textMuted">
        Регистрируясь, вы соглашаетесь с{' '}
        <Link href={`/help/${HELP_SLUG_RULES}`}>правилами марафона</Link>.
      </p>
      <p>
        Уже есть аккаунт? <Link href="/login">Войти</Link>
      </p>
    </main>
  );
}
