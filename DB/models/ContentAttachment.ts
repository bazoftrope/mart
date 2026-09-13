import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
} from 'sequelize-typescript';

export type ContentAttachmentOwnerType = 'recipe' | 'workout';
export type ContentAttachmentKind = 'file' | 'image' | 'audio' | 'video';

@Table({
  tableName: 'content_attachments',
  underscored: true,
  timestamps: true,
  updatedAt: false,
})
export class ContentAttachment extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.ENUM('recipe', 'workout'),
    allowNull: false,
  })
  ownerType!: ContentAttachmentOwnerType;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  ownerId!: string;

  @Column({
    type: DataType.ENUM('file', 'image', 'audio', 'video'),
    allowNull: false,
  })
  kind!: ContentAttachmentKind;

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
