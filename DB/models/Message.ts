import {
  Table,
  Column,
  Model,
  DataType,
  PrimaryKey,
  Default,
  CreatedAt,
} from 'sequelize-typescript';

export type MessageAttachment = {
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

@Table({
  tableName: 'messages',
  underscored: true,
  timestamps: true,
})
export class Message extends Model {
  @PrimaryKey
  @Default(DataType.UUIDV4)
  @Column(DataType.UUID)
  id!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  conversationId!: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  senderId!: string;

  @Column({
    type: DataType.TEXT,
    allowNull: false,
  })
  text!: string;

  @Column({
    type: DataType.JSONB,
    allowNull: true,
  })
  attachments!: MessageAttachment[] | null;

  @CreatedAt
  createdAt!: Date;
}
