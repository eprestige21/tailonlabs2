import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { validateDeployConfig, validateEnvironment } from './utils/deploy-validator';

const execAsync = promisify(exec);

interface DeploymentStatus {
  isHealthy: boolean;
  lastCheck: Date;
  uptime: number;
  errors: string[];
  buildStatus?: {
    lastBuild: Date;
    success: boolean;
    output: string;
  };
}

export class DeploymentManager {
  private status: DeploymentStatus = {
    isHealthy: true,
    lastCheck: new Date(),
    uptime: 0,
    errors: []
  };

  private startTime: Date = new Date();
  private config: any;

  async initialize() {
    try {
      console.log('[Deploy] Starting deployment manager initialization...');

      // Load and validate deployment config
      const configPath = path.join(process.cwd(), 'deploy.config.json');
      console.log(`[Deploy] Loading config from ${configPath}`);
      const configContent = await fs.promises.readFile(configPath, 'utf-8');
      this.config = JSON.parse(configContent);

      const configValidation = validateDeployConfig(this.config);
      if (!configValidation.isValid) {
        throw new Error(
          `Invalid deployment configuration: ${JSON.stringify(configValidation.errors)}`
        );
      }
      console.log('[Deploy] Configuration validated successfully');

      // Validate environment
      const env = process.env.NODE_ENV || 'development';
      console.log(`[Deploy] Validating environment for ${env}`);
      const envValidation = validateEnvironment(env);
      if (!envValidation.isValid) {
        throw new Error(
          `Missing required environment variables: ${envValidation.missingVars.join(', ')}`
        );
      }
      console.log('[Deploy] Environment validation successful');

      // Start health check monitoring
      this.startHealthCheck(this.config.healthCheck.interval);
      console.log(`[Deploy] Health check started with interval ${this.config.healthCheck.interval}ms`);

      // Run initial build
      await this.runBuild();

      return {
        success: true,
        config: configValidation.config
      };
    } catch (error) {
      console.error('[Deploy] Deployment initialization failed:', error);
      this.status.isHealthy = false;
      this.status.errors.push(error instanceof Error ? error.message : 'Unknown error');

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  private startHealthCheck(interval: number) {
    setInterval(() => {
      this.status.lastCheck = new Date();
      this.status.uptime = (new Date().getTime() - this.startTime.getTime()) / 1000;

      // Log health check status
      console.log(`[Deploy] Health check at ${new Date().toISOString()}: Status ${this.status.isHealthy ? 'OK' : 'ERROR'}`);
      if (this.status.errors.length > 0) {
        console.error('[Deploy] Current errors:', this.status.errors);
      }
    }, interval);
  }

  async runBuild() {
    try {
      console.log('[Deploy] Starting build process...');
      let buildOutput = '';

      // Execute each build command sequentially
      for (const command of this.config.build.commands) {
        console.log(`[Deploy] Executing build command: ${command}`);
        const { stdout, stderr } = await execAsync(command);
        buildOutput += `${command}:\n${stdout}\n${stderr}\n\n`;
      }

      this.status.buildStatus = {
        lastBuild: new Date(),
        success: true,
        output: buildOutput
      };

      console.log('[Deploy] Build completed successfully');
      return true;
    } catch (error) {
      console.error('[Deploy] Build failed:', error);
      this.status.buildStatus = {
        lastBuild: new Date(),
        success: false,
        output: error instanceof Error ? error.message : 'Unknown error'
      };
      this.status.errors.push(`Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  getStatus(): DeploymentStatus {
    console.log('[Deploy] Getting status:', this.status);
    return { ...this.status };
  }

  getBuildStatus() {
    console.log('[Deploy] Getting build status:', this.status.buildStatus);
    return this.status.buildStatus;
  }

  // Add method to clear errors
  clearErrors() {
    this.status.errors = [];
    console.log('[Deploy] Cleared error log');
  }
}

export const deploymentManager = new DeploymentManager();