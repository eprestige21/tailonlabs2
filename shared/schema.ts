import { pgTable, text, serial, integer, boolean, jsonb, timestamp, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"),
  businessId: integer("business_id").references(() => businesses.id),
});

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  website: text("website"),
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
  service: text("service").notNull(), // 'chatgpt', 'twilio_sms', 'heygen', etc.
  quantity: decimal("quantity").notNull(), // number of requests/messages/minutes
  cost: decimal("cost").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
});

export const billingTransactions = pgTable("billing_transactions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  type: text("type").notNull(), // 'auto_recharge', 'manual_recharge', 'usage_deduction'
  amount: decimal("amount").notNull(),
  timestamp: timestamp("timestamp").defaultNow().notNull(),
  description: text("description"),
  status: text("status").notNull(), // 'pending', 'completed', 'failed'
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
  model: text("model").notNull().default("gpt-4"),
  systemPrompt: text("system_prompt").notNull(),
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
  type: text("type").notNull(), // 'text', 'pdf', 'xml', 'url'
  content: text("content").notNull(),
  metadata: jsonb("metadata").$type<{
    sourceUrl?: string;
    originalContent?: string; // For URLs, store original content before editing
    mimeType?: string;
    fileSize?: number;
  }>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertBusinessSchema = createInsertSchema(businesses).pick({
  name: true,
  description: true,
  website: true,
});

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

export const insertAgentSchema = createInsertSchema(agents).pick({
  name: true,
  model: true,
  systemPrompt: true,
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