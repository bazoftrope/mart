import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiClient } from '@/lib/apiClient';
import WorkoutForm, {
  type WorkoutFormValues,
} from '@/components/workouts/WorkoutForm';
import type { Workout } from '@/types/workout';
import styles from './new.module.css';

export default function NewWorkoutPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    useAuthStore.getState().initAuth();
    if (!useAuthStore.getState().role) {
      router.replace('/login');
      return;
    }
    setChecking(false);
  }, [router]);

  async function handleSubmit(values: WorkoutFormValues) {
    const workout = await apiClient.post<Workout>('/api/workouts', {
      title: values.title,
      description: values.description,
      exercises: values.exercises,
      execution: values.execution,
      attachments: values.attachments,
    });
    router.push(`/workouts/${workout.id}`);
  }

  if (checking) {
    return (
      <main className="containerMd">
        <p>Загрузка...</p>
      </main>
    );
  }

  return (
    <main className="containerMd">
      <p>
        <Link href="/workouts" className="backLink">
          ← К книге тренировок
        </Link>
      </p>

      <h1 className="pageTitle">Новая тренировка</h1>
      <p className={styles.lead}>
        Тренировка появится в общей книге и будет доступна всем посетителям.
        Имя автора нигде не отображается.
      </p>

      <WorkoutForm
        submitLabel="Добавить тренировку"
        onSubmit={handleSubmit}
        onCancel={() => router.push('/workouts')}
      />
    </main>
  );
}
