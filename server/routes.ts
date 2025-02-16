import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { businesses, knowledgeBase, usageHistory, billingTransactions, voiceSettings, users } from "@shared/schema";
import { eq, and, gte, desc } from "drizzle-orm";
import { db } from "./db";
import { subDays, subMonths, subYears, startOfDay } from "date-fns";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Business profile routes
  app.get("/api/business/:id", async (req, res) => {
    const [business] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, parseInt(req.params.id)));

    if (!business) {
      return res.status(404).send("Business not found");
    }
    res.json(business);
  });

  app.post("/api/business", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }

    const [business] = await db
      .insert(businesses)
      .values({
        ...req.body,
        billingInfo: {
          balance: 0,
          autoRechargeThreshold: 10,
          autoRechargeAmount: 50
        }
      })
      .returning();

    // Update user with the new business ID
    await db
      .update(users)
      .set({ businessId: business.id })
      .where(eq(users.id, req.user.id));

    res.status(201).json(business);
  });

  // Knowledge base routes
  app.get("/api/knowledge-base", async (req, res) => {
    const entries = await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.businessId, req.user?.businessId!))
      .orderBy(desc(knowledgeBase.updatedAt));
    res.json(entries);
  });

  app.post("/api/knowledge-base", async (req, res) => {
    if (!req.user?.businessId) {
      return res.status(400).send("Business ID is required");
    }

    const [entry] = await db
      .insert(knowledgeBase)
      .values({
        ...req.body,
        businessId: req.user.businessId,
      })
      .returning();
    res.status(201).json(entry);
  });

  app.patch("/api/knowledge-base/:id", async (req, res) => {
    if (!req.user?.businessId) {
      return res.status(400).send("Business ID is required");
    }

    const [entry] = await db
      .update(knowledgeBase)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(knowledgeBase.id, parseInt(req.params.id)),
          eq(knowledgeBase.businessId, req.user.businessId)
        )
      )
      .returning();

    if (!entry) {
      return res.status(404).send("Entry not found");
    }

    res.json(entry);
  });

  app.post("/api/knowledge-base/:id/execute", async (req, res) => {
    if (!req.user?.businessId) {
      return res.status(400).send("Business ID is required");
    }

    const [entry] = await db
      .select()
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.id, parseInt(req.params.id)),
          eq(knowledgeBase.businessId, req.user.businessId)
        )
      );

    if (!entry) {
      return res.status(404).send("Entry not found");
    }

    if (entry.type !== "function") {
      return res.status(400).send("This entry is not a function");
    }

    try {
      const result = await executeFunction(entry, req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  });

  app.post("/api/knowledge-base/:id/query", async (req, res) => {
    if (!req.user?.businessId) {
      return res.status(400).send("Business ID is required");
    }

    const [entry] = await db
      .select()
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.id, parseInt(req.params.id)),
          eq(knowledgeBase.businessId, req.user.businessId)
        )
      );

    if (!entry) {
      return res.status(404).send("Entry not found");
    }

    if (entry.type !== "knowledge") {
      return res.status(400).send("This entry is not a knowledge base item");
    }

    try {
      const response = await getKnowledgeBaseResponse(entry, req.body.query);
      res.json({ response });
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  });

  app.post("/api/knowledge-base/validate-function", async (req, res) => {
    if (!req.user?.businessId) {
      return res.status(400).send("Business ID is required");
    }

    try {
      const result = await validateFunctionDefinition(req.body);
      res.json(result);
    } catch (error) {
      res.status(400).json({
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    }
  });

  // Usage history routes
  app.get("/api/usage-history", async (req, res) => {
    const { service, period } = req.query;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).send("Business ID is required");
    }

    let startDate = new Date();
    switch (period) {
      case "day":
        startDate = startOfDay(subDays(new Date(), 1));
        break;
      case "week":
        startDate = startOfDay(subDays(new Date(), 7));
        break;
      case "month":
        startDate = startOfDay(subMonths(new Date(), 1));
        break;
      case "year":
        startDate = startOfDay(subYears(new Date(), 1));
        break;
      default:
        startDate = startOfDay(subMonths(new Date(), 1)); // Default to last month
    }

    const query = db
      .select()
      .from(usageHistory)
      .where(
        and(
          eq(usageHistory.businessId, businessId),
          gte(usageHistory.timestamp, startDate)
        )
      );

    if (service && service !== "all") {
      query.where(eq(usageHistory.service, service));
    }

    const history = await query;
    res.json(history);
  });

  // Billing transaction routes
  app.get("/api/billing-transactions", async (req, res) => {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).send("Business ID is required");
    }

    const transactions = await db
      .select()
      .from(billingTransactions)
      .where(eq(billingTransactions.businessId, businessId));

    res.json(transactions);
  });

  // Update auto-recharge settings
  app.post("/api/billing/auto-recharge", async (req, res) => {
    const businessId = req.user?.businessId;
    const { threshold, amount } = req.body;

    if (!businessId) {
      return res.status(400).send("Business ID is required");
    }

    // Get current business data
    const [currentBusiness] = await db
      .select()
      .from(businesses)
      .where(eq(businesses.id, businessId));

    if (!currentBusiness) {
      return res.status(404).send("Business not found");
    }

    const [business] = await db
      .update(businesses)
      .set({
        billingInfo: {
          ...currentBusiness.billingInfo,
          autoRechargeThreshold: threshold,
          autoRechargeAmount: amount,
        },
      })
      .where(eq(businesses.id, businessId))
      .returning();

    res.json(business);
  });

  // Voice settings routes
  app.get("/api/voice-settings", async (req, res) => {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).send("Business ID is required");
    }

    const [settings] = await db
      .select()
      .from(voiceSettings)
      .where(eq(voiceSettings.businessId, businessId));

    res.json(settings);
  });

  app.post("/api/voice-settings", async (req, res) => {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).send("Business ID is required");
    }

    const [existingSettings] = await db
      .select()
      .from(voiceSettings)
      .where(eq(voiceSettings.businessId, businessId));

    if (existingSettings) {
      const [settings] = await db
        .update(voiceSettings)
        .set({ ...req.body })
        .where(eq(voiceSettings.businessId, businessId))
        .returning();
      res.json(settings);
    } else {
      const [settings] = await db
        .insert(voiceSettings)
        .values({ ...req.body, businessId })
        .returning();
      res.json(settings);
    }
  });

  app.post("/api/voice-settings/preview", async (req, res) => {
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).send("Business ID is required");
    }

    // In a real implementation, this would call the ElevenLabs API
    // For now, we'll return a mock response
    res.status(501).send("Preview functionality not implemented");
  });

  const httpServer = createServer(app);
  return httpServer;
}

// Placeholder functions -  These need to be implemented elsewhere
async function executeFunction(entry: any, body: any): Promise<any> {
  throw new Error("Function not implemented");
}

async function getKnowledgeBaseResponse(entry: any, query: string): Promise<string> {
  throw new Error("Function not implemented");
}

async function validateFunctionDefinition(definition: any): Promise<boolean> {
  throw new Error("Function not implemented");
}