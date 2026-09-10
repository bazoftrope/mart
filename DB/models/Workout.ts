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

@Table({
  tableName: 'workouts',
  underscored: true,
  timestamps: true,
})
export class Workout extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  title!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description!: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  exercises!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  execution!: string;

  /**
   * Служебное поле: кто добавил тренировку. Нужен только для прав на
   * редактирование/удаление и нигде в интерфейсе не отображается.
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
