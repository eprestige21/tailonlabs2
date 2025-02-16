import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { businesses, knowledgeBase, usageHistory, billingTransactions } from "@shared/schema";
import { eq, and, gte } from "drizzle-orm";
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
    const [business] = await db
      .insert(businesses)
      .values(req.body)
      .returning();
    res.status(201).json(business);
  });

  // Knowledge base routes
  app.get("/api/knowledge-base", async (req, res) => {
    const entries = await db
      .select()
      .from(knowledgeBase);
    res.json(entries);
  });

  app.post("/api/knowledge-base", async (req, res) => {
    const [entry] = await db
      .insert(knowledgeBase)
      .values(req.body)
      .returning();
    res.status(201).json(entry);
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

    const [business] = await db
      .update(businesses)
      .set({
        billingInfo: {
          autoRechargeThreshold: threshold,
          autoRechargeAmount: amount,
        },
      })
      .where(eq(businesses.id, businessId))
      .returning();

    res.json(business);
  });

  const httpServer = createServer(app);
  return httpServer;
}