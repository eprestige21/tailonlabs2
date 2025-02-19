import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { hash, compare } from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser, InsertUser } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  // Ensure we have a session secret
  if (!process.env.SESSION_SECRET) {
    console.error("SESSION_SECRET environment variable is required");
    process.exit(1);
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    },
    name: 'sid'
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username: string, password: string, done) => {
      try {
        console.log(`[Auth] Attempting login for user: ${username}`);
        const user = await storage.getUserByUsername(username);

        if (!user) {
          console.log(`[Auth] User not found: ${username}`);
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log(`[Auth] User found, comparing passwords`);
        const isValidPassword = await compare(password, user.password);
        console.log(`[Auth] Password comparison result: ${isValidPassword}`);

        if (!isValidPassword) {
          return done(null, false, { message: "Invalid username or password" });
        }

        console.log(`[Auth] Login successful for user: ${username}`);
        return done(null, user);
      } catch (error) {
        console.error("Authentication error:", error);
        return done(error);
      }
    })
  );

  passport.serializeUser((user, done) => {
    console.log(`[Auth] Serializing user: ${user.id}`);
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      console.log(`[Auth] Deserializing user: ${id}`);
      const user = await storage.getUser(id);
      if (!user) {
        console.log(`[Auth] User not found during deserialization: ${id}`);
        return done(null, false);
      }
      console.log(`[Auth] User deserialized successfully: ${id}`);
      done(null, user);
    } catch (error) {
      console.error(`[Auth] Deserialization error:`, error);
      done(error);
    }
  });

  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, password } = req.body;
      console.log(`[Auth] Registration attempt for username: ${username}`);

      if (!username || !password) {
        console.log(`[Auth] Registration failed: Missing username or password`);
        return res.status(400).json({ message: "Username and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log(`[Auth] Registration failed: Username already exists: ${username}`);
        return res.status(400).json({ message: "Username already exists" });
      }

      console.log(`[Auth] Hashing password for new user`);
      const hashedPassword = await hash(password, 10);
      const newUser: InsertUser = {
        username,
        password: hashedPassword
      };

      console.log(`[Auth] Creating new user in database`);
      const user = await storage.createUser(newUser);
      console.log(`[Auth] User created successfully: ${user.id}`);

      req.login(user, (err) => {
        if (err) {
          console.error(`[Auth] Login error after registration:`, err);
          return next(err);
        }
        // Don't send password hash back to client
        const { password, ...userWithoutPassword } = user;
        console.log(`[Auth] Registration complete, user logged in: ${user.id}`);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  app.post("/api/login", (req, res, next) => {
    console.log(`[Auth] Login attempt for username: ${req.body.username}`);
    passport.authenticate("local", (err: Error | null, user: SelectUser | false, info: { message: string } | undefined) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      if (!user) {
        console.log(`[Auth] Login failed: ${info?.message}`);
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      req.login(user, (err) => {
        if (err) {
          console.error("Session error:", err);
          return res.status(500).json({ message: "Failed to establish session" });
        }
        // Don't send password hash back to client
        const { password, ...userWithoutPassword } = user;
        console.log(`[Auth] Login successful, session established for user: ${user.id}`);
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  app.post("/api/logout", (req, res, next) => {
    const userId = req.user?.id;
    console.log(`[Auth] Logout attempt for user: ${userId}`);
    req.logout((err) => {
      if (err) {
        console.error(`[Auth] Logout error:`, err);
        return next(err);
      }
      req.session.destroy((err) => {
        if (err) {
          console.error(`[Auth] Session destruction error:`, err);
          return next(err);
        }
        console.log(`[Auth] Logout successful for user: ${userId}`);
        res.sendStatus(200);
      });
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log(`[Auth] Unauthorized access to /api/user`);
      return res.sendStatus(401);
    }
    // Don't send password hash back to client
    const { password, ...userWithoutPassword } = req.user;
    console.log(`[Auth] User data retrieved for: ${req.user.id}`);
    res.json(userWithoutPassword);
  });
}