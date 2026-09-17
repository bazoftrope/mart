import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
  UpdatedAt,
} from 'sequelize-typescript';

/**
 * Вид согласия. Значение синхронизировано с `ConsentType` из
 * `src/lib/consent.ts` — там же лежат версии и адреса текстов.
 */
export type ConsentType = 'general' | 'health';

/**
 * Факт согласия пользователя на обработку персональных данных.
 *
 * Хранится на сервере, а не только галочкой на клиенте: доказательством
 * согласия служит запись с версией текста, датой, IP и User-Agent.
 * Один пользователь — одна актуальная запись на каждый вид согласия;
 * отзыв не удаляет строку, а проставляет `revokedAt` (нужна история).
 */
@Table({
  tableName: 'user_consents',
  underscored: true,
  timestamps: true,
})
export class UserConsent extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  userId!: string;

  @Column({
    type: DataType.ENUM('general', 'health'),
    allowNull: false,
  })
  type!: ConsentType;

  /** Версия текста согласия, с которой согласился пользователь. */
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  documentVersion!: string;

  @Column({
    type: DataType.DATE,
    allowNull: false,
    defaultValue: DataType.NOW,
  })
  grantedAt!: Date;

  /** Момент отзыва. NULL — согласие действует. */
  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  revokedAt!: Date | null;

  /** IP и User-Agent на момент предоставления согласия (доказательство). */
  @Column({
    type: DataType.STRING(64),
    allowNull: true,
  })
  ip!: string | null;

  @Column({
    type: DataType.STRING(512),
    allowNull: true,
  })
  userAgent!: string | null;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
