import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';


export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

@Table({
  tableName: 'report_lines',
  underscored: true,
  timestamps: false,
})
export class ReportLine extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  reportId!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  productId!: string;

  @Column({
    type: DataType.ENUM('breakfast', 'lunch', 'dinner', 'snack'),
    allowNull: false,
  })
  mealType!: MealType;

  @Column({
    type: DataType.DECIMAL(8, 2),
    allowNull: false,
  })
  weightGrams!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
  })
  lineCalories!: number;

  /** Белки строки с учётом веса, г. */
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  lineProtein!: number;

  /** Жиры строки с учётом веса, г. */
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  lineFat!: number;

  /** Углеводы строки с учётом веса, г. */
  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  lineCarbs!: number;
}
