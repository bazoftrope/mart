import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
} from 'sequelize-typescript';

@Table({
  tableName: 'pulse_readings',
  underscored: true,
  timestamps: false,
})
export class PulseReading extends Model {
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
    type: DataType.DATE,
    allowNull: false,
  })
  measuredAt!: Date;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
    defaultValue: null,
  })
  pulse!: number | null;

  @Column({
    type: DataType.SMALLINT,
    allowNull: true,
    defaultValue: null,
  })
  systolic!: number | null;

  @Column({
    type: DataType.SMALLINT,
    allowNull: true,
    defaultValue: null,
  })
  diastolic!: number | null;

}
