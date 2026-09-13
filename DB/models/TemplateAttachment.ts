import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
} from 'sequelize-typescript';

export type AttachmentScope = 'intro' | 'day';
export type AttachmentKind = 'audio' | 'video' | 'file' | 'image';

@Table({
  tableName: 'template_attachments',
  underscored: true,
  timestamps: true,
  updatedAt: false,
})
export class TemplateAttachment extends Model {
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
    type: DataType.UUID,
    allowNull: true,
  })
  templateDayId?: string | null;

  @Column({
    type: DataType.ENUM('intro', 'day'),
    allowNull: false,
  })
  scope!: AttachmentScope;

  @Column({
    type: DataType.ENUM('audio', 'video', 'file', 'image'),
    allowNull: false,
  })
  kind!: AttachmentKind;

  @Column({
    type: DataType.STRING(2048),
    allowNull: false,
  })
  url!: string;

  @Column({
    type: DataType.STRING(512),
    allowNull: true,
  })
  fileName?: string | null;

  @Column({
    type: DataType.STRING(255),
    allowNull: true,
  })
  mimeType?: string | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  sizeBytes?: number | null;

  @Column({
    type: DataType.INTEGER,
    allowNull: false,
    defaultValue: 0,
  })
  position!: number;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  pairId?: string | null;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  description?: string | null;

  @CreatedAt
  createdAt!: Date;
}
