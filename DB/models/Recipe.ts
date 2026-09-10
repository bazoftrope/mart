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
  tableName: 'recipes',
  underscored: true,
  timestamps: true,
})
export class Recipe extends Model {
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
  ingredients!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  steps!: string;

  /**
   * Служебное поле: кто добавил рецепт. Нужен только для прав на
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
