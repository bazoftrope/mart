import { User } from './User';
import { Product } from './Product';
import { MarathonTemplate } from './MarathonTemplate';
import { TemplateDay } from './TemplateDay';
import { TemplateAttachment } from './TemplateAttachment';
import { Stream } from './Stream';
import { StreamEnrollment } from './StreamEnrollment';
import { DailyReport } from './DailyReport';
import { ReportLine } from './ReportLine';
import { StreamRating } from './StreamRating';
import { PulseReading } from './PulseReading';
import { Conversation } from './Conversation';
import { ConversationMember } from './ConversationMember';
import { Message } from './Message';
import { Recipe } from './Recipe';
import { RecipeFavorite } from './RecipeFavorite';
import { Workout } from './Workout';
import { WorkoutFavorite } from './WorkoutFavorite';
import { HelpArticle } from './HelpArticle';
import { ContentAttachment } from './ContentAttachment';

export * from './User';
export * from './Product';
export * from './MarathonTemplate';
export * from './TemplateDay';
export * from './TemplateAttachment';
export * from './Stream';
export * from './StreamEnrollment';
export * from './DailyReport';
export * from './ReportLine';
export * from './StreamRating';
export * from './PulseReading';
export * from './Conversation';
export * from './ConversationMember';
export * from './Message';
export * from './Recipe';
export * from './RecipeFavorite';
export * from './Workout';
export * from './WorkoutFavorite';
export * from './HelpArticle';
export * from './ContentAttachment';

export const models = {
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
  ContentAttachment,
};

export type AppModels = typeof models;
