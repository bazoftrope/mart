import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import Button from '@/components/ui/Button';

type MeResponse = {
  user: {
    sex: 'male' | 'female' | null;
    heightCm: number | null;
    weightKg: number | null;
    age: number | null;
  };
  profileCompleted: boolean;
};

export default function OnboardingPage() {
  const router = useRouter();
  const [sex, setSex] = useState<'male' | 'female' | ''>('');
  const [heightCm, setHeightCm] = useState('');
  const [weightKg, setWeightKg] = useState('');
  const [age, setAge] = useState('');
  const [acceptedHealthConsent, setAcceptedHealthConsent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    useAuthStore.getState().initAuth();
    const role = useAuthStore.getState().role;

    if (role === null) {
      router.replace('/login');
      return;
    }

    if (role !== 'participant') {
      router.replace('/dashboard');
      return;
    }

    const next = typeof router.query.next === 'string' ? router.query.next : '/dashboard';

    async function checkProfile() {
      try {
        const data = await apiClient.get<MeResponse>('/api/users/me');
        if (data.profileCompleted) {
          router.replace(next);
        }
      } catch {
        // Ошибка загрузки профиля не блокирует форму.
      }
    }

    checkProfile();
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      await apiClient.patch('/api/users/me', {
        sex,
        heightCm: Number(heightCm),
        weightKg: Number(weightKg),
        age: Number(age),
        healthConsentAccepted: true,
      });
      const next =
        typeof router.query.next === 'string' ? router.query.next : '/dashboard';
      router.push(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось сохранить анкету');
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="authPage">
      <h1 className="pageTitle">Анкета участника</h1>
      <p className="textMuted">
        Вес, рост и возраст относятся к сведениям о здоровье. Они нужны только
        для расчёта дневной нормы калорий и сохраняются в профиле, а вес можно
        обновлять в отчётах. Для обработки этих данных нужно отдельное
        согласие — оно ниже.
      </p>

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div className="formGroup">
          <label htmlFor="sex">Пол</label>
          <select
            id="sex"
            value={sex}
            onChange={(e) => setSex(e.target.value as 'male' | 'female')}
            required
            className="input"
          >
            <option value="" disabled>
              Выберите пол
            </option>
            <option value="male">Мужской</option>
            <option value="female">Женский</option>
          </select>
        </div>

        <div className="formGroup">
          <label htmlFor="heightCm">Рост</label>
          <input
            id="heightCm"
            type="number"
            inputMode="numeric"
            min={50}
            max={250}
            step={1}
            placeholder="см"
            value={heightCm}
            onChange={(e) => setHeightCm(e.target.value)}
            required
            className="input"
          />
        </div>

        <div className="formGroup">
          <label htmlFor="weightKg">Вес</label>
          <input
            id="weightKg"
            type="number"
            inputMode="decimal"
            min={20}
            max={300}
            step={0.1}
            placeholder="кг"
            value={weightKg}
            onChange={(e) => setWeightKg(e.target.value)}
            required
            className="input"
          />
        </div>

        <div className="formGroup">
          <label htmlFor="age">Возраст</label>
          <input
            id="age"
            type="number"
            inputMode="numeric"
            min={18}
            max={120}
            step={1}
            placeholder="полных лет"
            value={age}
            onChange={(e) => setAge(e.target.value)}
            required
            className="input"
          />
        </div>

        <div className="checkboxGroup">
          <label className="checkboxLabel">
            <input
              type="checkbox"
              checked={acceptedHealthConsent}
              onChange={(e) => setAcceptedHealthConsent(e.target.checked)}
              required
            />
            <span>
              Я даю{' '}
              <Link href="/privacy#consent-health">
                согласие на обработку данных о здоровье
              </Link>{' '}
              (пол, рост, вес, возраст)
            </span>
          </label>
        </div>

        <Button
          type="submit"
          variant="primary"
          block
          loading={saving}
          disabled={!acceptedHealthConsent}
        >
          {saving ? 'Сохранение...' : 'Сохранить и продолжить'}
        </Button>
      </form>
    </main>
  );
}
