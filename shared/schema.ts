import { pgTable, text, serial, integer, boolean, jsonb, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  businessId: integer("business_id").references(() => businesses.id),
  resetToken: text("reset_token"),
  resetTokenExpires: timestamp("reset_token_expires"),
  phoneNumber: text("phone_number"),
  firstName: text("first_name"),
  lastName: text("last_name"),
  city: text("city"),
  state: text("state"),
  zipCode: text("zip_code"),
  twoFactorEnabled: boolean("two_factor_enabled").default(false),
  twoFactorSecret: text("two_factor_secret"),
  twoFactorVerified: boolean("two_factor_verified").default(false),
  twoFactorBackupCodes: text("two_factor_backup_codes").array(),
  twoFactorTempSecret: text("two_factor_temp_secret"),
  twoFactorTempSecretExpires: timestamp("two_factor_temp_secret_expires"),
});

export const userApiKeys = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  name: text("name").notNull(),
  key: text("key").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastUsed: timestamp("last_used"),
  expiresAt: timestamp("expires_at"),
});

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  website: text("website"),
  address: text("address"),
  phoneNumber: text("phone_number"),
  apiIntegrations: jsonb("api_integrations").$type<{
    chatgpt?: { enabled: boolean; apiKey?: string };
    twilio?: { enabled: boolean; accountSid?: string; authToken?: string };
    heygen?: { enabled: boolean; apiKey?: string };
    elevenlabs?: { enabled: boolean; apiKey?: string };
  }>(),
  billingInfo: jsonb("billing_info").$type<{
    plan?: string;
    balance: number;
    autoRechargeThreshold: number;
    autoRechargeAmount: number;
    paymentMethod?: {
      type: string;
      last4: string;
      expiry: string;
    };
  }>(),
});

export const usageHistory = pgTable("usage_history", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  service: text("service").notNull(),
  quantity: decimal("quantity").notNull(),
  cost: decimal("cost").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const billingTransactions = pgTable("billing_transactions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  type: text("type").notNull(),
  amount: decimal("amount").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  description: text("description"),
  status: text("status").notNull(),
});

export const voiceSettings = pgTable("voice_settings", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  voiceId: text("voice_id").notNull(),
  name: text("name").notNull(),
  language: text("language").notNull(),
  stability: decimal("stability").notNull().default("0.5"),
  similarityBoost: decimal("similarity_boost").notNull().default("0.75"),
  style: decimal("style").notNull().default("0.0"),
  speakingRate: decimal("speaking_rate").notNull().default("1.0"),
  pauseTime: decimal("pause_time").notNull().default("0.5"),
});

export const agents = pgTable("agents", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  name: text("name").notNull(),
  description: text("description"),
  model: text("model").notNull().default("gpt-4"),
  personality: text("personality").default("professional"),
  tone: text("tone").default("formal"),
  temperature: decimal("temperature").default("0.7"),
  systemPrompt: text("system_prompt").notNull(),
  webhook: text("webhook_url"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentFunctions = pgTable("agent_functions", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id),
  name: text("name").notNull(),
  description: text("description").notNull(),
  parameters: jsonb("parameters").$type<{
    type: string;
    properties: Record<string, { type: string; description: string }>;
    required: string[];
  }>().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id),
  title: text("title").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<{
    sourceUrl?: string;
    originalContent?: string;
    mimeType?: string;
    fileSize?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const agentEvaluations = pgTable("agent_evaluations", {
  id: serial("id").primaryKey(),
  agentId: integer("agent_id").references(() => agents.id),
  conversationId: text("conversation_id").notNull(),
  score: decimal("score").notNull(),
  evaluationDate: timestamp("evaluation_date").defaultNow().notNull(),
  feedback: text("feedback"),
  correctResponses: integer("correct_responses").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  details: jsonb("details").$type<{
    questions: Array<{
      question: string;
      expectedAnswer: string;
      actualAnswer: string;
      correct: boolean;
    }>;
  }>(),
});

export const insertUserSchema = createInsertSchema(users).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
}).pick({
  username: true,
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  city: true,
  state: true,
  zipCode: true,
});

export const updateUserProfileSchema = createInsertSchema(users).extend({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  zipCode: z.string().optional(),
}).pick({
  firstName: true,
  lastName: true,
  phoneNumber: true,
  city: true,
  state: true,
  zipCode: true,
});

export const insertApiKeySchema = createInsertSchema(userApiKeys).pick({
  name: true,
});

export const insertAgentEvaluationSchema = createInsertSchema(agentEvaluations).pick({
  agentId: true,
  conversationId: true,
  score: true,
  feedback: true,
  correctResponses: true,
  totalQuestions: true,
  details: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type UsageHistory = typeof usageHistory.$inferSelect;
export type BillingTransaction = typeof billingTransactions.$inferSelect;
export type VoiceSettings = typeof voiceSettings.$inferSelect;
export type InsertVoiceSettings = z.infer<typeof insertVoiceSettingsSchema>;
export type InsertAgent = z.infer<typeof insertAgentSchema>;
export type Agent = typeof agents.$inferSelect;
export type AgentFunction = typeof agentFunctions.$inferSelect;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
export type InsertAgentFunction = z.infer<typeof insertAgentFunctionSchema>;
export type InsertKnowledgeBase = z.infer<typeof insertKnowledgeBaseSchema>;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;
export type AgentEvaluation = typeof agentEvaluations.$inferSelect;
export type InsertAgentEvaluation = z.infer<typeof insertAgentEvaluationSchema>;

export const insertBusinessSchema = createInsertSchema(businesses).pick({
  name: true,
  description: true,
  website: true,
  address: true,
  phoneNumber: true,
});

export type InsertBusiness = z.infer<typeof insertBusinessSchema>;

export const insertUsageHistorySchema = createInsertSchema(usageHistory).pick({
  service: true,
  quantity: true,
  cost: true,
});

export const insertBillingTransactionSchema = createInsertSchema(billingTransactions).pick({
  type: true,
  amount: true,
  description: true,
});

export const insertVoiceSettingsSchema = createInsertSchema(voiceSettings).pick({
  voiceId: true,
  name: true,
  language: true,
  stability: true,
  similarityBoost: true,
  style: true,
  speakingRate: true,
  pauseTime: true,
});

export const insertAgentSchema = createInsertSchema(agents).extend({
  personality: z.string(),
  tone: z.string(),
  temperature: z.number().min(0).max(1),
  webhook: z.string().url().optional(),
}).pick({
  name: true,
  description: true,
  model: true,
  personality: true,
  tone: true,
  temperature: true,
  systemPrompt: true,
  webhook: true,
  isActive: true,
});

export const insertAgentFunctionSchema = createInsertSchema(agentFunctions).pick({
  name: true,
  description: true,
  parameters: true,
});

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).pick({
  title: true,
  type: true,
  content: true,
  metadata: true,
});

export type UserApiKey = typeof userApiKeys.$inferSelect;