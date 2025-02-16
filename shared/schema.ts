import { pgTable, text, serial, integer, boolean, jsonb } from "drizzle-orm/pg-core";
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
    paymentMethod?: {
      type: string;
      last4: string;
      expiry: string;
    };
  }>(),
});

export const knowledgeBase = pgTable("knowledge_base", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull(), // function, knowledge
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

export const insertKnowledgeBaseSchema = createInsertSchema(knowledgeBase).pick({
  title: true,
  content: true,
  type: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type KnowledgeBase = typeof knowledgeBase.$inferSelect;
