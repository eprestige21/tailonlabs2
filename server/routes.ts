import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";

export async function registerRoutes(app: Express): Promise<Server> {
  setupAuth(app);

  // Business profile routes
  app.get("/api/business/:id", async (req, res) => {
    const businessId = parseInt(req.params.id);
    const business = await storage.getBusiness(businessId);
    if (!business) {
      return res.status(404).send("Business not found");
    }
    res.json(business);
  });

  app.post("/api/business", async (req, res) => {
    const business = await storage.createBusiness(req.body);
    res.status(201).json(business);
  });

  // Knowledge base routes
  app.get("/api/knowledge-base", async (req, res) => {
    const entries = await storage.listKnowledgeBase();
    res.json(entries);
  });

  app.post("/api/knowledge-base", async (req, res) => {
    const entry = await storage.createKnowledgeBase(req.body);
    res.status(201).json(entry);
  });

  const httpServer = createServer(app);
  return httpServer;
}
