import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { hash, compare } from "bcrypt";
import { storage } from "./storage";
import { User as SelectUser, InsertUser } from "@shared/schema";
import sgMail from '@sendgrid/mail';
import crypto from 'crypto';
import { send2FAVerificationEmail } from "./services/email";
import { db } from "./db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";

if (!process.env.SENDGRID_API_KEY) {
  console.warn('[Auth] SENDGRID_API_KEY not set. Email functionality will be disabled.');
}

if (!process.env.SES_FROM_EMAIL?.includes('@')) {
  console.error('[Auth] SES_FROM_EMAIL must be a valid email address');
  throw new Error('Invalid SES_FROM_EMAIL configuration');
}

// Initialize SendGrid
sgMail.setApiKey(process.env.SENDGRID_API_KEY || '');

async function sendPasswordResetEmail(email: string, resetUrl: string): Promise<{ success: boolean; error?: string }> {
  try {
    if (!process.env.SENDGRID_API_KEY) {
      console.error('[Auth] Missing SENDGRID_API_KEY configuration');
      return { success: false, error: 'Email service configuration missing' };
    }

    if (!process.env.SES_FROM_EMAIL) {
      console.error('[Auth] Missing SES_FROM_EMAIL configuration');
      return { success: false, error: 'Sender email configuration missing' };
    }

    console.log('[Auth] SendGrid Configuration:', {
      fromEmail: process.env.SES_FROM_EMAIL,
      hasApiKey: !!process.env.SENDGRID_API_KEY
    });

    const msg = {
      to: email,
      from: process.env.SES_FROM_EMAIL,
      subject: 'Password Reset Request',
      text: `To reset your password, click this link: ${resetUrl}\n\nThis link will expire in 1 hour.`,
      html: `
        <h2>Password Reset Request</h2>
        <p>You requested to reset your password.</p>
        <p>Click <a href="${resetUrl}">here</a> to reset your password.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <p>This link will expire in 1 hour.</p>
      `
    };

    console.log('[Auth] Attempting to send email via SendGrid');
    await sgMail.send(msg);

    console.log('[Auth] Email sent successfully');
    return { success: true };
  } catch (error: any) {
    console.error('[Auth] SendGrid Error:', {
      code: error.code,
      message: error.message,
      response: error.response?.body
    });

    if (error.code === 401) {
      return {
        success: false,
        error: 'Invalid SendGrid API key. Please check your configuration.'
      };
    }

    if (error.code === 403) {
      return {
        success: false,
        error: 'Sender email not verified with SendGrid.'
      };
    }

    return {
      success: false,
      error: `Failed to send email: ${error.message}`
    };
  }
}

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

export function setupAuth(app: Express) {
  console.log('[Auth] Starting auth setup...');

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

  console.log('[Auth] Configuring session middleware...');
  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  console.log('[Auth] Configuring passport strategy...');
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

  // Register endpoint
  app.post("/api/register", async (req, res, next) => {
    try {
      const { username, email, password } = req.body;
      console.log(`[Auth] Registration attempt for username: ${username}, email: ${email}`);

      if (!username || !password || !email) {
        console.log(`[Auth] Registration failed: Missing required fields`);
        return res.status(400).json({ message: "Username, email and password are required" });
      }

      const existingUser = await storage.getUserByUsername(username);
      if (existingUser) {
        console.log(`[Auth] Registration failed: Username already exists: ${username}`);
        return res.status(400).json({ message: "Username already exists" });
      }

      const existingEmail = await storage.getUserByEmail(email);
      if (existingEmail) {
        console.log(`[Auth] Registration failed: Email already exists: ${email}`);
        return res.status(400).json({ message: "Email already exists" });
      }

      console.log(`[Auth] Hashing password for new user`);
      const hashedPassword = await hash(password, 10);
      const newUser: InsertUser = {
        username,
        email,
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
        const { password, ...userWithoutPassword } = user;
        console.log(`[Auth] Registration complete, user logged in: ${user.id}`);
        res.status(201).json(userWithoutPassword);
      });
    } catch (error) {
      console.error("Registration error:", error);
      next(error);
    }
  });

  // Login endpoint
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
        const { password, ...userWithoutPassword } = user;
        console.log(`[Auth] Login successful, session established for user: ${user.id}`);
        res.status(200).json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Logout endpoint
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

  // Forgot password endpoint
  app.post("/api/forgot-password", async (req, res) => {
    try {
      const { email } = req.body;
      console.log(`[Auth] Password reset requested for email: ${email}`);

      const user = await storage.getUserByEmail(email);
      if (!user) {
        console.log(`[Auth] No user found with email: ${email}`);
        // Return success even if user not found for security
        return res.status(200).json({
          message: "If an account exists with this email, you will receive a password reset link."
        });
      }

      console.log(`[Auth] User found with email: ${email}`);

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now

      // Store reset token in database first
      await storage.storeResetToken(user.id, resetToken, resetTokenExpiry);

      // Check if SendGrid API key is configured
      if (!process.env.SENDGRID_API_KEY) {
        console.error('[Auth] SendGrid API key not configured');
        return res.status(500).json({
          message: "Email service is not configured properly. Please try again later.",
          details: "Missing SendGrid API key"
        });
      }

      const appUrl = process.env.APP_URL || `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;
      const resetUrl = `${appUrl}/reset-password?token=${resetToken}`;

      // Set a timeout for the email sending process - increased to 30 seconds
      const emailTimeoutMs = 30000; // 30 seconds timeout
      const emailPromise = sendPasswordResetEmail(email, resetUrl);

      try {
        const emailResult = await Promise.race([
          emailPromise,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Email sending timed out')), emailTimeoutMs)
          )
        ]);

        if (!emailResult.success) {
          console.error('[Auth] Failed to send reset email:', emailResult.error);
          return res.status(500).json({
            message: "Unable to send reset email. Please try again later.",
            details: emailResult.error
          });
        }
      } catch (emailError: any) {
        console.error('[Auth] Email sending error:', emailError);
        return res.status(500).json({
          message: "Unable to send reset email. Please try again later.",
          details: emailError.message
        });
      }

      res.status(200).json({
        message: "If an account exists with this email, you will receive a password reset link."
      });
    } catch (error) {
      console.error("[Auth] Password reset request error:", error);
      res.status(500).json({
        message: "Failed to process password reset request. Please try again later.",
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Reset password endpoint
  app.post("/api/reset-password", async (req, res) => {
    try {
      const { token, newPassword } = req.body;
      console.log(`[Auth] Password reset attempt with token`);

      const user = await storage.getUserByResetToken(token);
      if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
        return res.status(400).json({
          message: "Invalid or expired reset token"
        });
      }

      const hashedPassword = await hash(newPassword, 10);
      await storage.updateUserPassword(user.id, hashedPassword);
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

  // Get user endpoint
  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) {
      console.log(`[Auth] Unauthorized access to /api/user`);
      return res.sendStatus(401);
    }
    const { password, ...userWithoutPassword } = req.user;
    console.log(`[Auth] User data retrieved for: ${req.user.id}`);
    res.json(userWithoutPassword);
  });

  // Enable 2FA for a user
  app.post("/api/2fa/enable", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Unauthorized");
    }

    try {
      // Update user to enable 2FA
      await db
        .update(users)
        .set({
          twoFactorEnabled: true,
        })
        .where(eq(users.id, req.user.id));

      // Generate and send verification code
      const verificationCode = (Math.floor(100000 + Math.random() * 900000)).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes from now

      await db
        .update(users)
        .set({
          twoFactorTempSecret: verificationCode,
          twoFactorTempSecretExpires: expiresAt,
        })
        .where(eq(users.id, req.user.id));

      // Send verification email
      const emailSent = await send2FAVerificationEmail(req.user.email, verificationCode);
      if (!emailSent) {
        return res.status(500).json({ message: "Failed to send verification email" });
      }

      res.status(200).json({ message: "2FA enabled, verification code sent" });
    } catch (error) {
      console.error("[2FA Enable] Error:", error);
      res.status(500).json({ message: "Failed to enable 2FA" });
    }
  });

  // Verify 2FA setup
  app.post("/api/2fa/verify", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Unauthorized");
    }

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ message: "Verification code is required" });
    }

    try {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, req.user.id));

      if (!user.twoFactorTempSecret || !user.twoFactorTempSecretExpires) {
        return res.status(400).json({ message: "No verification in progress" });
      }

      if (new Date() > user.twoFactorTempSecretExpires) {
        return res.status(400).json({ message: "Verification code has expired" });
      }

      if (code !== user.twoFactorTempSecret) {
        return res.status(400).json({ message: "Invalid verification code" });
      }

      // Generate backup codes
      const backupCodes = Array.from({ length: 10 }, () =>
        Math.random().toString(36).substr(2, 8)
      );

      // Update user as verified
      await db
        .update(users)
        .set({
          twoFactorVerified: true,
          twoFactorTempSecret: null,
          twoFactorTempSecretExpires: null,
          twoFactorBackupCodes: backupCodes,
        })
        .where(eq(users.id, req.user.id));

      res.status(200).json({
        message: "2FA verified successfully",
        backupCodes,
      });
    } catch (error) {
      console.error("[2FA Verify] Error:", error);
      res.status(500).json({ message: "Failed to verify 2FA" });
    }
  });

  // Disable 2FA
  app.post("/api/2fa/disable", async (req, res) => {
    if (!req.isAuthenticated()) {
      return res.status(401).send("Unauthorized");
    }

    try {
      await db
        .update(users)
        .set({
          twoFactorEnabled: false,
          twoFactorVerified: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
        })
        .where(eq(users.id, req.user.id));

      res.status(200).json({ message: "2FA disabled successfully" });
    } catch (error) {
      console.error("[2FA Disable] Error:", error);
      res.status(500).json({ message: "Failed to disable 2FA" });
    }
  });

  console.log('[Auth] Auth setup completed');
}