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

export type HelpSection = 'rules' | 'faq' | 'guide';
export type HelpAudience = 'all' | 'participant' | 'mentor' | 'admin';

@Table({
  tableName: 'help_articles',
  underscored: true,
  timestamps: true,
})
export class HelpArticle extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  /** Человекочитаемый адрес статьи: /help/kak-zapolnyat-otchet */
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  slug!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  summary!: string | null;

  /** HTML из Quill. Санируется на сервере при сохранении. */
  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  content!: string;

  @Column({
    type: DataType.ENUM('rules', 'faq', 'guide'),
    allowNull: false,
    defaultValue: 'rules',
  })
  section!: HelpSection;

  @Column({
    type: DataType.ENUM('all', 'participant', 'mentor', 'admin'),
    allowNull: false,
    defaultValue: 'all',
  })
  audience!: HelpAudience;

  /** Порядок вывода внутри раздела. */
  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  position!: number;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: true,
  })
  isPublished!: boolean;

  /**
   * Служебное поле: кто создал статью. Нужен только для модерации,
   * в интерфейсе раздела не отображается.
   */
  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  createdBy!: string | null;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
