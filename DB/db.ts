import 'reflect-metadata';
import { Sequelize } from 'sequelize-typescript';
import { User } from './models/User';
import { Product } from './models/Product';
import { MarathonTemplate } from './models/MarathonTemplate';
import { TemplateDay } from './models/TemplateDay';
import { TemplateAttachment } from './models/TemplateAttachment';
import { Stream } from './models/Stream';
import { StreamEnrollment } from './models/StreamEnrollment';
import { DailyReport } from './models/DailyReport';
import { ReportLine } from './models/ReportLine';
import { StreamRating } from './models/StreamRating';
import { PulseReading } from './models/PulseReading';
import { Conversation } from './models/Conversation';
import { ConversationMember } from './models/ConversationMember';
import { Message } from './models/Message';
import { Recipe } from './models/Recipe';
import { RecipeFavorite } from './models/RecipeFavorite';
import { Workout } from './models/Workout';
import { WorkoutFavorite } from './models/WorkoutFavorite';
import { HelpArticle } from './models/HelpArticle';

const parseDatabaseUrl = (url?: string) => {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return {
      database: parsed.pathname.replace(/^\//, ''),
      username: parsed.username,
      password: parsed.password,
      host: parsed.hostname,
      port: parsed.port ? parseInt(parsed.port, 10) : 5432,
    };
  } catch {
    return null;
  }
};

const urlConfig = parseDatabaseUrl(process.env.DATABASE_URL);

export const sequelize = new Sequelize({
  database: process.env.DB_NAME || urlConfig?.database || process.env.PGDATABASE,
  username: process.env.DB_USER || urlConfig?.username || process.env.PGUSER,
  password: process.env.DB_PASSWORD || urlConfig?.password || process.env.PGPASSWORD,
  host: process.env.DB_HOST || urlConfig?.host || process.env.PGHOST,
  port: parseInt(
    process.env.DB_PORT || (urlConfig?.port ? String(urlConfig.port) : '') || process.env.PGPORT || '5432',
    10
  ),
  dialect: 'postgres',
  models: [
    User,
    Product,
    MarathonTemplate,
    TemplateDay,
    TemplateAttachment,
    Stream,
    StreamEnrollment,
    DailyReport,
    ReportLine,
    StreamRating,
    PulseReading,
    Conversation,
    ConversationMember,
    Message,
    Recipe,
    RecipeFavorite,
    Workout,
    WorkoutFavorite,
    HelpArticle,
  ],
  logging: process.env.NODE_ENV === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
  },
});
