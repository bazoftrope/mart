import { Op, type Model, type Transaction } from 'sequelize';
import { sequelize } from '@/lib/db';
import {
  User,
  UserConsent,
  Stream,
  StreamEnrollment,
  StreamRating,
  DailyReport,
  ReportLine,
  PulseReading,
  Message,
  Conversation,
  ConversationMember,
  Recipe,
  RecipeFavorite,
  Workout,
  WorkoutFavorite,
  Product,
  MarathonTemplate,
} from '@db/models';
import { Forbidden, NotFound } from './errors';
import type { DeletionImpact } from '@/types/account';

/** Плоское представление строки Sequelize (атрибуты в camelCase, даты — ISO). */
function toPlain<T extends Model>(row: T): Record<string, unknown> {
  return row.get({ plain: true }) as Record<string, unknown>;
}

/**
 * Собрать все персональные данные пользователя одним JSON.
 *
 * Право субъекта на доступ к своим данным (152-ФЗ). Пароль не включается.
 * Данные других людей (например, чужие сообщения в чате) не выгружаются —
 * только собственные сообщения пользователя.
 */
export async function exportUserData(userId: string): Promise<Record<string, unknown>> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFound('User not found');
  }

  const consents = await UserConsent.findAll({ where: { userId } });
  const enrollments = await StreamEnrollment.findAll({ where: { participantId: userId } });
  const enrollmentIds = enrollments.map((row) => row.id);

  const reports = enrollmentIds.length
    ? await DailyReport.findAll({ where: { enrollmentId: { [Op.in]: enrollmentIds } } })
    : [];
  const reportIds = reports.map((row) => row.id);

  const lines = reportIds.length
    ? await ReportLine.findAll({ where: { reportId: { [Op.in]: reportIds } } })
    : [];
  const pulseReadings = reportIds.length
    ? await PulseReading.findAll({ where: { reportId: { [Op.in]: reportIds } } })
    : [];

  const productIds = Array.from(new Set(lines.map((row) => row.productId)));
  const products = productIds.length
    ? await Product.findAll({ where: { id: { [Op.in]: productIds } } })
    : [];

  const ratings = await StreamRating.findAll({ where: { participantId: userId } });
  const recipeFavorites = await RecipeFavorite.findAll({ where: { userId } });
  const workoutFavorites = await WorkoutFavorite.findAll({ where: { userId } });
  const messages = await Message.findAll({ where: { senderId: userId } });
  const recipes = await Recipe.findAll({ where: { createdBy: userId } });
  const workouts = await Workout.findAll({ where: { createdBy: userId } });

  const streamIds = Array.from(
    new Set([
      ...enrollments.map((row) => row.streamId),
      ...ratings.map((row) => row.streamId),
    ])
  );
  const streams = streamIds.length
    ? await Stream.findAll({ where: { id: { [Op.in]: streamIds } } })
    : [];
  const templateIds = Array.from(new Set(streams.map((row) => row.templateId)));
  const templates = templateIds.length
    ? await MarathonTemplate.findAll({ where: { id: { [Op.in]: templateIds } } })
    : [];

  const favoriteRecipeIds = recipeFavorites.map((row) => row.recipeId);
  const favoriteRecipes = favoriteRecipeIds.length
    ? await Recipe.findAll({ where: { id: { [Op.in]: favoriteRecipeIds } } })
    : [];
  const favoriteWorkoutIds = workoutFavorites.map((row) => row.workoutId);
  const favoriteWorkouts = favoriteWorkoutIds.length
    ? await Workout.findAll({ where: { id: { [Op.in]: favoriteWorkoutIds } } })
    : [];

  const productNames = new Map(products.map((row) => [row.id, row.name]));
  const streamsById = new Map(streams.map((row) => [row.id, row]));
  const templatesById = new Map(templates.map((row) => [row.id, row]));

  const profile = toPlain(user);
  delete profile.passwordHash;

  return {
    exportedAt: new Date().toISOString(),
    note:
      'Экспорт персональных данных пользователя. Пароль не включён. ' +
      'Сообщения других участников не выгружаются.',
    profile,
    consents: consents.map(toPlain),
    enrollments: enrollments.map((enrollment) => {
      const stream = streamsById.get(enrollment.streamId);
      const template = stream ? templatesById.get(stream.templateId) : undefined;
      return {
        ...toPlain(enrollment),
        stream: stream
          ? {
              id: stream.id,
              startDate: stream.startDate,
              status: stream.status,
              templateTitle: template?.title ?? null,
            }
          : null,
        reports: reports
          .filter((report) => report.enrollmentId === enrollment.id)
          .map((report) => ({
            ...toPlain(report),
            lines: lines
              .filter((line) => line.reportId === report.id)
              .map((line) => ({
                ...toPlain(line),
                productName: productNames.get(line.productId) ?? null,
              })),
            pulseReadings: pulseReadings
              .filter((reading) => reading.reportId === report.id)
              .map(toPlain),
          })),
      };
    }),
    ratings: ratings.map(toPlain),
    favorites: {
      recipes: favoriteRecipes.map((row) => ({ id: row.id, title: row.title })),
      workouts: favoriteWorkouts.map((row) => ({ id: row.id, title: row.title })),
    },
    messages: messages.map(toPlain),
    authoredContent: {
      recipes: recipes.map(toPlain),
      workouts: workouts.map(toPlain),
    },
  };
}

/**
 * Посчитать последствия удаления аккаунта.
 *
 * У участника это его собственные данные. У ментора каскад затрагивает
 * чужие данные: вместе с шаблонами удаляются потоки, а вместе с ними —
 * записи и отчёты участников. Числа показываются в подтверждении удаления.
 */
export async function getDeletionImpact(userId: string): Promise<DeletionImpact> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFound('User not found');
  }

  if (user.role === 'participant') {
    const enrollments = await StreamEnrollment.count({ where: { participantId: userId } });
    return {
      role: user.role,
      templates: 0,
      streams: 0,
      enrollments,
      participants: 0,
    };
  }

  const templates = await MarathonTemplate.findAll({ where: { mentorId: userId } });
  const templateIds = templates.map((row) => row.id);
  const streams = templateIds.length
    ? await Stream.findAll({ where: { templateId: { [Op.in]: templateIds } } })
    : [];
  const streamIds = streams.map((row) => row.id);
  const enrollments = streamIds.length
    ? await StreamEnrollment.findAll({ where: { streamId: { [Op.in]: streamIds } } })
    : [];
  const participantIds = Array.from(new Set(enrollments.map((row) => row.participantId)));

  return {
    role: user.role,
    templates: templates.length,
    streams: streams.length,
    enrollments: enrollments.length,
    participants: participantIds.length,
  };
}

/**
 * Удалить аккаунт и связанные персональные данные.
 *
 * У участника каскады БД убирают отчёты, строки рациона, замеры пульса,
 * рейтинг, избранное, согласия, членство в чатах и собственные сообщения.
 *
 * У ментора каскад шире и затрагивает других людей: `marathon_templates.mentor_id`
 * → потоки → записи участников → их отчёты, рацион, замеры, рейтинг и чаты.
 * Владелец принял это осознанно; UI перед удалением показывает числа из
 * `getDeletionImpact`. Служебный админский аккаунт удалить нельзя — он
 * восстанавливается из env при входе.
 */
export async function deleteUserAccount(userId: string): Promise<void> {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new NotFound('User not found');
  }
  if (user.role === 'admin') {
    throw new Forbidden('Служебный аккаунт администратора нельзя удалить');
  }

  await sequelize.transaction(async (transaction: Transaction) => {
    const memberships = await ConversationMember.findAll({
      where: { userId },
      transaction,
    });
    const conversationIds = memberships.map((row) => row.conversationId);

    await User.destroy({ where: { id: userId }, transaction });

    // Парная беседа ментор↔участник без участников больше не нужна.
    for (const conversationId of conversationIds) {
      const membersLeft = await ConversationMember.count({
        where: { conversationId },
        transaction,
      });
      if (membersLeft > 0) continue;

      const conversation = await Conversation.findByPk(conversationId, { transaction });
      if (conversation?.type === 'mentor_pair') {
        await Conversation.destroy({ where: { id: conversationId }, transaction });
      }
    }
  });
}
