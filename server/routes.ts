import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { businesses, agents, agentFunctions, knowledgeBase, usageHistory, billingTransactions, voiceSettings, users, agentEvaluations, insertBusinessSchema } from "@shared/schema";
import { eq, and, gte, desc, lte } from "drizzle-orm";
import { db } from "./db";
import { subDays, subMonths, subYears, startOfDay } from "date-fns";
import { hash } from "bcrypt";
import { deploymentManager } from "./deploy";
import crypto from 'crypto';
import {userApiKeys} from "@shared/schema";

export async function registerRoutes(app: Express): Promise<Server> {
  // Add health check endpoint for deployment monitoring
  app.get("/api/health", (req, res) => {
    const healthcheck = {
      uptime: process.uptime(),
      status: "OK",
      timestamp: Date.now(),
      deployment: deploymentManager.getStatus(),
      build: deploymentManager.getBuildStatus()
    };
    try {
      res.send(healthcheck);
    } catch (error) {
      healthcheck.status = "ERROR";
      res.status(503).send(healthcheck);
    }
  });

  // Ensure auth is set up first
  setupAuth(app);

  // Business profile routes
  app.get("/api/business/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }

    try {
      const [business] = await db
        .select()
        .from(businesses)
        .where(eq(businesses.id, parseInt(req.params.id)));

      if (!business) {
        return res.status(404).send("Business not found");
      }
      res.json(business);
    } catch (error) {
      console.error('Error fetching business:', error);
      res.status(500).json({ message: "Failed to fetch business details" });
    }
  });

app.post("/api/business", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }

    try {
      console.log('Creating business with data:', req.body);

      // Validate the request body
      const businessData = insertBusinessSchema.parse(req.body);
      console.log('Validated business data:', businessData);

      const [business] = await db
        .insert(businesses)
        .values({
          ...businessData,
          billingInfo: {
            balance: 0,
            autoRechargeThreshold: 10,
            autoRechargeAmount: 50
          }
        })
        .returning();

      console.log('Business created:', business);

      // Update user with the new business ID
      await db
        .update(users)
        .set({ businessId: business.id })
        .where(eq(users.id, req.user.id));

      res.status(201).json(business);
    } catch (error) {
      console.error('Error creating business:', error);
      if (error.name === 'ZodError') {
        res.status(400).json({ 
          message: "Invalid business data",
          details: error.errors 
        });
      } else {
        res.status(500).json({ 
          message: "Failed to create business",
          details: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  app.patch("/api/business/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }

    try {
      const [business] = await db
        .update(businesses)
        .set({
          name: req.body.name,
          description: req.body.description,
          website: req.body.website,
          address: req.body.address,
          phoneNumber: req.body.phoneNumber,
        })
        .where(eq(businesses.id, parseInt(req.params.id)))
        .returning();

      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      res.json(business);
    } catch (error) {
      console.error('Error updating business:', error);
      res.status(500).json({ 
        message: "Failed to update business",
        details: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Usage history routes
  app.get("/api/usage-history", async (req, res) => {
    const { period, from, to } = req.query;
    const businessId = req.user?.businessId;

    if (!businessId) {
      return res.status(400).send("Business ID is required");
    }

    let startDate = new Date();
    let endDate = new Date();

    switch (period) {
      case "today":
        startDate = startOfDay(new Date());
        break;
      case "yesterday":
        startDate = startOfDay(subDays(new Date(), 1));
        endDate = startOfDay(new Date());
        break;
      case "week":
        startDate = startOfDay(subDays(new Date(), 7));
        break;
      case "month":
        startDate = startOfDay(subMonths(new Date(), 1));
        break;
      case "custom":
        if (!from || !to) {
          return res.status(400).send("From and to dates are required for custom range");
        }
        startDate = startOfDay(new Date(from as string));
        endDate = startOfDay(new Date(to as string));
        break;
      default:
        startDate = startOfDay(new Date()); // Default to today
    }

    const history = await db
      .select()
      .from(usageHistory)
      .where(
        and(
          eq(usageHistory.businessId, businessId),
          gte(usageHistory.timestamp, startDate),
          period === "custom"
            ? lte(usageHistory.timestamp, endDate)
            : undefined
        )
      );

    // Aggregate usage by service
    const usage = history.reduce((acc, record) => {
      const service = record.service.toLowerCase();
      acc[service] = (acc[service] || 0) + Number(record.quantity);
      return acc;
    }, {} as Record<string, number>);

    res.json(usage);
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
          balance: currentBusiness.billingInfo?.balance ?? 0,
          autoRechargeThreshold: Number(threshold),
          autoRechargeAmount: Number(amount),
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

      console.log('Creating agent with data:', req.body); 
      console.log('User business ID:', req.user.businessId); 

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

      console.log('Created agent:', agent); 
      res.status(201).json(agent);
    } catch (error) {
      console.error('Error creating agent:', error);
      res.status(500).json({ 
        message: "Failed to create agent",
        details: error instanceof Error ? error.message : String(error)
      });
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

  app.get("/api/agents/:agentId/knowledge/export", async (req, res) => {
    try {
      if (!req.user?.businessId) {
        return res.status(400).json({ message: "Business ID is required" });
      }

      // Verify the agent belongs to the user's business
      const [agent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, parseInt(req.params.agentId)),
            eq(agents.businessId, req.user.businessId)
          )
        );

      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const entries = await db
        .select()
        .from(knowledgeBase)
        .where(eq(knowledgeBase.agentId, parseInt(req.params.agentId)))
        .orderBy(desc(knowledgeBase.updatedAt));

      // Send as a downloadable JSON file
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename=knowledge-base-${req.params.agentId}-${new Date().toISOString()}.json`);
      res.json(entries);
    } catch (error) {
      console.error('Error exporting knowledge base:', error);
      res.status(500).json({ message: "Failed to export knowledge base" });
    }
  });

  // User management routes
  app.get("/api/users", async (req, res) => {
    if (!req.user?.businessId) {
      return res.status(401).json({ message: "Unauthorized - No business association" });
    }

    const usersList = await db
      .select()
      .from(users)
      .where(eq(users.businessId, req.user.businessId));

    res.json(usersList);
  });

  app.post("/api/users", async (req, res) => {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized - Not logged in" });
    }

    if (!req.user.businessId) {
      return res.status(401).json({ message: "Unauthorized - No business association" });
    }

    const { username, password, role = "user" } = req.body;

    try {
      const hashedPassword = await hash(password, 10);
      const [newUser] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          role,
          businessId: req.user.businessId,
        })
        .returning();

      res.status(201).json(newUser);
    } catch (error: any) {
      console.error('Error creating user:', error);
      if (error.code === "23505") { 
        res.status(400).json({ message: "Username already exists" });
      } else {
        res.status(500).json({ message: "Failed to create user" });
      }
    }
  });

  app.patch("/api/users/:id", async (req, res) => {
    if (!req.user?.businessId) {
      return res.status(401).send("Unauthorized");
    }

    const userId = parseInt(req.params.id);
    const { username, password, role } = req.body;

    // Verify user belongs to the business
    const [existingUser] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.businessId, req.user.businessId)
        )
      );

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    try {
      const updateData: Partial<typeof users.$inferInsert> = {};
      if (username) updateData.username = username;
      if (password) updateData.password = await hash(password, 10);
      if (role) updateData.role = role;

      const [updatedUser] = await db
        .update(users)
        .set(updateData)
        .where(eq(users.id, userId))
        .returning();

      res.json(updatedUser);
    } catch (error: any) {
      if (error.code === "23505") {
        res.status(400).json({ message: "Username already exists" });
      } else {
        res.status(500).json({ message: "Failed to update user" });
      }
    }
  });

  app.delete("/api/users/:id", async (req, res) => {
    if (!req.user?.businessId) {
      return res.status(401).send("Unauthorized");
    }

    const userId = parseInt(req.params.id);

    // Verify user belongs to the business and is not the current user
    const [userToDelete] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, userId),
          eq(users.businessId, req.user.businessId)
        )
      );

    if (!userToDelete) {
      return res.status(404).json({ message: "User not found" });
    }

    if (userToDelete.id === req.user.id) {
      return res.status(400).json({ message: "Cannot delete your own account" });
    }

    await db
      .delete(users)
      .where(eq(users.id, userId));

    res.status(204).send();
  });

  // Account profile update endpoint
  app.patch("/api/account/profile", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }

    try {
      const [user] = await db
        .update(users)
        .set({
          firstName: req.body.firstName,
          lastName: req.body.lastName,
          phoneNumber: req.body.phoneNumber,
          city: req.body.city,
          state: req.body.state,
          zipCode: req.body.zipCode,
        })
        .where(eq(users.id, req.user.id))
        .returning();

      const { password, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Profile update error:", error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // API Keys endpoints
  app.get("/api/account/api-keys", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }

    try {
      const apiKeys = await db
        .select()
        .from(userApiKeys)
        .where(eq(userApiKeys.userId, req.user.id))
        .orderBy(desc(userApiKeys.createdAt));

      res.json(apiKeys);
    } catch (error) {
      console.error("API keys fetch error:", error);
      res.status(500).json({ message: "Failed to fetch API keys" });
    }
  });

  app.post("/api/account/api-keys", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }

    try {
      const apiKey = crypto.randomBytes(32).toString('hex');
      const [newKey] = await db
        .insert(userApiKeys)
        .values({
          userId: req.user.id,
          name: req.body.name,
          key: apiKey,
        })
        .returning();

      res.status(201).json({ ...newKey, key: apiKey });
    } catch (error) {
      console.error("API key creation error:", error);
      res.status(500).json({ message: "Failed to create API key" });
    }
  });

  app.delete("/api/account/api-keys/:id", async (req, res) => {
    if (!req.user) {
      return res.status(401).send("Unauthorized");
    }

    try {
      await db
        .delete(userApiKeys)
        .where(
          and(
            eq(userApiKeys.id, parseInt(req.params.id)),
            eq(userApiKeys.userId, req.user.id)
          )
        );

      res.status(204).send();
    } catch (error) {
      console.error("API key deletion error:", error);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // Agent evaluation routes
  app.get("/api/agent-evaluations", async (req, res) => {
    try {
      if (!req.user?.businessId) {
        return res.status(400).json({ message: "Business ID is required" });
      }

      const evaluations = await db
        .select({
          evaluation: agentEvaluations,
          agent: agents,
        })
        .from(agentEvaluations)
        .innerJoin(agents, eq(agentEvaluations.agentId, agents.id))
        .where(eq(agents.businessId, req.user.businessId))
        .orderBy(desc(agentEvaluations.evaluationDate));

      res.json(evaluations);
    } catch (error) {
      console.error('Error fetching evaluations:', error);
      res.status(500).json({ message: "Failed to fetch evaluations" });
    }
  });

  app.get("/api/agents/:agentId/evaluations", async (req, res) => {
    try {
      if (!req.user?.businessId) {
        return res.status(400).json({ message: "Business ID is required" });
      }

      // Verify the agent belongs to the user's business
      const [agent] = await db
        .select()
        .from(agents)
        .where(
          and(
            eq(agents.id, parseInt(req.params.agentId)),
            eq(agents.businessId, req.user.businessId)
          )
        );

      if (!agent) {
        return res.status(404).json({ message: "Agent not found" });
      }

      const evaluations = await db
        .select()
        .from(agentEvaluations)
        .where(eq(agentEvaluations.agentId, parseInt(req.params.agentId)))
        .orderBy(desc(agentEvaluations.evaluationDate));

      res.json(evaluations);
    } catch (error) {
      console.error('Error fetching agent evaluations:', error);
      res.status(500).json({ message: "Failed to fetch evaluations" });
    }
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