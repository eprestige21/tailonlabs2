import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { hash, compare } from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser, InsertUser } from "@shared/schema";
import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";
import crypto from 'crypto';

// Initialize AWS SES with explicit logging
console.log('[Auth] Initializing AWS SES client with region:', process.env.AWS_REGION);
const sesClient = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
});

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

  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      console.log(`[Auth] Password reset requested for email: ${email}`);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`[Auth] No user found with email: ${email}`);
        // Don't reveal whether the email exists
        return res.status(200).json({
          message: "If an account exists with this email, you will receive a password reset link."
        });
      }

      console.log(`[Auth] User found with email: ${email}`);

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token in database
      await storage.storeResetToken(user.id, resetToken, resetTokenExpiry);

      // Only attempt to send email if AWS credentials are configured
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const appUrl = process.env.APP_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
        const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;
        console.log(`[Auth] Attempting to send password reset email to: ${email}`);
        console.log(`[Auth] Reset URL: ${resetUrl}`);
        console.log(`[Auth] Using SES configuration - Region: ${process.env.AWS_REGION}, From: ${process.env.SES_FROM_EMAIL}`);

        const params = {
          Source: process.env.SES_FROM_EMAIL,
          Destination: {
            ToAddresses: [email],
          },
          Message: {
            Subject: {
              Data: 'Password Reset Request',
            },
            Body: {
              Text: {
                Data: `To reset your password, click this link: ${resetUrl}`,
              },
              Html: {
                Data: `
                  <p>You requested a password reset.</p>
                  <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
                  <p>If you didn't request this, please ignore this email.</p>
                  <p>This link will expire in 1 hour.</p>
                `,
              },
            },
          },
        };

        try {
          console.log('[Auth] Sending email via AWS SES...');
          const result = await sesClient.send(new SendEmailCommand(params));
          console.log(`[Auth] Email sent successfully. MessageId: ${result.MessageId}`);

          if (process.env.NODE_ENV === 'development') {
            return res.status(200).json({
              message: "Password reset email sent successfully. Please check your inbox.",
              debug: { 
                emailSent: true, 
                messageId: result.MessageId,
                resetUrl // Include reset URL in development for testing
              }
            });
          }

          res.status(200).json({
            message: "If an account exists with this email, you will receive a password reset link."
          });
        } catch (error: any) {
          console.error('[Auth] Failed to send email via AWS SES:', error);
          console.error('[Auth] Error details:', {
            code: error.code,
            message: error.message,
            requestId: error.$metadata?.requestId
          });

          // In development, return more detailed error information
          if (process.env.NODE_ENV === 'development') {
            return res.status(500).json({
              message: "Failed to send password reset email",
              error: {
                code: error.code,
                message: error.message,
                details: "Check server logs for more information"
              }
            });
          }

          // In production, use a generic error message
          return res.status(500).json({
            message: "Unable to process your request at this time. Please try again later."
          });
        }
      } else {
        console.log('[Auth] AWS credentials not configured properly');
        console.log('[Auth] AWS_ACCESS_KEY_ID exists:', !!process.env.AWS_ACCESS_KEY_ID);
        console.log('[Auth] AWS_SECRET_ACCESS_KEY exists:', !!process.env.AWS_SECRET_ACCESS_KEY);
        console.log('[Auth] SES_FROM_EMAIL:', process.env.SES_FROM_EMAIL);
        return res.status(500).json({
          message: "Email service is not configured properly. Please contact support."
        });
      }
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({
        message: "Failed to process password reset request. Please try again later."
      });
    }
  });

  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      console.log(`[Auth] Password reset attempt with token`);

      // Verify token and get user
      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
        return res.status(400).json({
          message: "Invalid or expired reset token"
        });
      }

      // Hash new password and update user
      const hashedPassword = await hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashedPassword);

      // Clear reset token
      await storage.clearPasswordResetToken(user.id);

      console.log(`[Auth] Password reset successful for user: ${user.id}`);
      res.status(200).json({
        message: "Password has been reset successfully"
      });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({
        message: "Failed to reset password. Please try again later."
      });
    }
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