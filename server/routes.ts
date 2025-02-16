import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { businesses, agents, agentFunctions, knowledgeBase, usageHistory, billingTransactions, voiceSettings, users } from "@shared/schema";
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

  // Agent routes
  app.get("/api/agents", async (req, res) => {
    try {
      if (!req.user?.businessId) {
        return res.status(400).json({ message: "Business ID is required" });
      }

      console.log('Fetching agents for business:', req.user.businessId);
      const agentsList = await db
        .select()
        .from(agents)
        .where(eq(agents.businessId, req.user.businessId))
        .orderBy(desc(agents.updatedAt));

      console.log('Found agents:', agentsList);
      res.json(agentsList);
    } catch (error) {
      console.error('Error fetching agents:', error);
      res.status(500).json({ message: "Failed to fetch agents" });
    }
  });

  app.post("/api/agents", async (req, res) => {
    try {
      if (!req.user?.businessId) {
        return res.status(400).json({ message: "Business ID is required" });
      }

      const {
        name,
        description,
        model,
        personality,
        tone,
        temperature,
        systemPrompt,
        webhook,
      } = req.body;

      const [agent] = await db
        .insert(agents)
        .values({
          name,
          description,
          model,
          personality,
          tone,
          temperature,
          systemPrompt,
          webhook,
          isActive: true,
          businessId: req.user.businessId,
        })
        .returning();

      res.status(201).json(agent);
    } catch (error) {
      console.error('Error creating agent:', error);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  app.patch("/api/agents/:id", async (req, res) => {
    try {
      if (!req.user?.businessId) {
        return res.status(400).json({ message: "Business ID is required" });
      }

      // Verify the agent belongs to the user's business
      const [existingAgent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, parseInt(req.params.id)),
            eq(agents.businessId, req.user.businessId)
          )
        );

      if (!existingAgent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const [agent] = await db
        .update(agents)
        .set({
          ...req.body,
          updatedAt: new Date(),
        })
        .where(eq(agents.id, parseInt(req.params.id)))
        .returning();

      res.json(agent);
    } catch (error) {
      console.error('Error updating agent:', error);
      res.status(500).json({ message: "Failed to update agent" });
    }
  });


  // Agent functions routes
  app.get("/api/agents/:agentId/functions", async (req, res) => {
    const functions = await db
      .select()
      .from(agentFunctions)
      .where(eq(agentFunctions.agentId, parseInt(req.params.agentId)))
      .orderBy(desc(agentFunctions.updatedAt));

    res.json(functions);
  });

  app.post("/api/agents/:agentId/functions", async (req, res) => {
    const [func] = await db
      .insert(agentFunctions)
      .values({
        ...req.body,
        agentId: parseInt(req.params.agentId),
      })
      .returning();

    res.status(201).json(func);
  });

  // Knowledge base routes
  app.get("/api/agents/:agentId/knowledge", async (req, res) => {
    const entries = await db
      .select()
      .from(knowledgeBase)
      .where(eq(knowledgeBase.agentId, parseInt(req.params.agentId)))
      .orderBy(desc(knowledgeBase.updatedAt));

    res.json(entries);
  });

  app.post("/api/agents/:agentId/knowledge", async (req, res) => {
    const [entry] = await db
      .insert(knowledgeBase)
      .values({
        ...req.body,
        agentId: parseInt(req.params.agentId),
      })
      .returning();

    res.status(201).json(entry);
  });

  app.patch("/api/agents/:agentId/knowledge/:id", async (req, res) => {
    const [entry] = await db
      .update(knowledgeBase)
      .set({
        ...req.body,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(knowledgeBase.id, parseInt(req.params.id)),
          eq(knowledgeBase.agentId, parseInt(req.params.agentId))
        )
      )
      .returning();

    if (!entry) {
      return res.status(404).send("Knowledge base entry not found");
    }

    res.json(entry);
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