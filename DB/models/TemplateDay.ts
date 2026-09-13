import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';


@Table({
  tableName: 'template_days',
  underscored: true,
  timestamps: false,
})
export class TemplateDay extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  templateId!: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
  })
  dayNumber!: number;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  textContent?: string;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isMeasurementDay!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isTrainingDay!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isRestDay!: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  })
  isHealthyEatingDay!: boolean;
}
