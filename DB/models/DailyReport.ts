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
  tableName: 'daily_reports',
  underscored: true,
  timestamps: true,
})
export class DailyReport extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  enrollmentId!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  dayNumber!: number;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: false,
    defaultValue: 0,
  })
  totalCalories!: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
  })
  waterLiters!: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
  })
  steps!: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
  })
  sleepHours!: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
  })
  activityMinutes!: number | null;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true,
    defaultValue: null,
  })
  trainingDone!: boolean | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
  })
  weightKg!: number | null;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: null,
  })
  chestCm!: number | null;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: null,
  })
  waistCm!: number | null;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: null,
  })
  hipCm!: number | null;

  @Column({
    type: DataType.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: null,
  })
  legCm!: number | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
    defaultValue: null,
  })
  comment!: string | null;

  @CreatedAt
  filledAt!: Date;

  @UpdatedAt
  updatedAt!: Date;
}
