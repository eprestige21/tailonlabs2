import { z } from "zod";

const environmentConfigSchema = z.object({
  port: z.number(),
  host: z.string(),
  database: z.object({
    max_connections: z.number(),
    idle_timeout: z.number()
  })
});

const deployConfigSchema = z.object({
  name: z.string(),
  environment: z.object({
    production: environmentConfigSchema,
    development: environmentConfigSchema
  }),
  build: z.object({
    commands: z.array(z.string()),
    output: z.string()
  }),
  healthCheck: z.object({
    path: z.string(),
    interval: z.number()
  })
});

export function validateDeployConfig(config: unknown) {
  try {
    const validConfig = deployConfigSchema.parse(config);
    return {
      isValid: true,
      config: validConfig
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        isValid: false,
        errors: error.errors.map(err => ({
          path: err.path.join('.'),
          message: err.message
        }))
      };
    }
    throw error;
  }
}

export function validateEnvironment(env: string) {
  const requiredVars = [
    'DATABASE_URL',
    'SESSION_SECRET'
  ];

  const missingVars = requiredVars.filter(
    varName => !process.env[varName]
  );

  return {
    isValid: missingVars.length === 0,
    missingVars
  };
}
