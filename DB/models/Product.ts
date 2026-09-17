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
  tableName: 'products',
  underscored: true,
  timestamps: true,
})
export class Product extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
    unique: true,
  })
  name!: string;

  @Column({
    type: DataType.DECIMAL(8, 2),
    allowNull: false,
  })
  calories!: number;

  /** Белки, г на 100 г. */
  @Column({
    type: DataType.DECIMAL(6, 2),
    allowNull: false,
    defaultValue: 0,
  })
  protein!: number;

  /** Жиры, г на 100 г. */
  @Column({
    type: DataType.DECIMAL(6, 2),
    allowNull: false,
    defaultValue: 0,
  })
  fat!: number;

  /** Углеводы, г на 100 г. */
  @Column({
    type: DataType.DECIMAL(6, 2),
    allowNull: false,
    defaultValue: 0,
  })
  carbs!: number;

  @CreatedAt
  createdAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
