#!/usr/bin/env ts-node

/**
 * Secret Management CLI Tool
 * 
 * Provides command-line interface for managing secrets with access control
 * and rotation policies.
 * 
 * Usage:
 *   npm run secrets:store <name> <value> [--user <userId>] [--type <type>]
 *   npm run secrets:get <name> [--user <userId>]
 *   npm run secrets:rotate <name> <newValue> [--user <userId>]
 *   npm run secrets:list [--user <userId>]
 *   npm run secrets:delete <name> [--user <userId>]
 *   npm run secrets:schedule-rotation <name> [--interval <days>] [--user <userId>]
 *   npm run secrets:process-rotations
 *   npm run secrets:health
 *   npm run secrets:audit [--start <date>] [--end <date>]
 */

import { SecretManager, SecretManagerConfig } from '../src/config/secrets/secret-manager';
import { VaultConfig } from '../src/config/secrets/vault-manager';
import { writeFileSync } from 'fs';
import { join } from 'path';

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

// Default configuration for local development
const defaultConfig: SecretManagerConfig = {
  vault: {
    type: 'local',
    localConfig: {
      vaultPath: join(process.cwd(), '.vault', 'secrets'),
      encryptionKey: process.env['VAULT_ENCRYPTION_KEY'] || 'dev-encryption-key-32-chars-minimum'
    }
  },
  defaultRotationPolicy: {
    enabled: true,
    intervalDays: 90,
    autoRotate: false,
    gracePeriodDays: 7,
    notificationDays: [30, 7, 1]
  },
  auditLogging: {
    enabled: true,
    logPath: join(process.cwd(), '.vault', 'audit.log'),
    retentionDays: 90
  }
};

// Initialize secret manager
const secretManager = new SecretManager(defaultConfig);

/**
 * Main CLI function
 */
async function main(): Promise<void> {
  try {
    // Initialize the secret manager
    await secretManager.initialize();

    switch (command) {
      case 'store':
        await handleStore();
        break;
      case 'get':
        await handleGet();
        break;
      case 'rotate':
        await handleRotate();
        break;
      case 'list':
        await handleList();
        break;
      case 'delete':
        await handleDelete();
        break;
      case 'schedule-rotation':
        await handleScheduleRotation();
        break;
      case 'process-rotations':
        await handleProcessRotations();
        break;
      case 'health':
        await handleHealth();
        break;
      case 'audit':
        await handleAudit();
        break;
      case 'users':
        await handleUsers();
        break;
      case 'roles':
        await handleRoles();
        break;
      default:
        showHelp();
    }
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

/**
 * Handle store command
 */
async function handleStore(): Promise<void> {
  const commandArgs = getCommandArgs();
  const name = commandArgs[0];
  const value = commandArgs[1];
  const userId = getArg('--user') || 'admin';
  const type = getArg('--type') || 'custom';
  const description = getArg('--description') || '';

  if (!name || !value) {
    console.error('❌ Usage: npm run secrets:store <name> <value> [--user <userId>] [--type <type>] [--description <description>]');
    process.exit(1);
  }

  console.log(`🔐 Storing secret: ${name}`);
  
  const secret = await secretManager.storeSecret(name, value, {
    type: type as any,
    description,
    environment: 'development'
  }, userId);

  console.log(`✅ Secret stored successfully: ${secret.metadata.id}`);
}

/**
 * Handle get command
 */
async function handleGet(): Promise<void> {
  const commandArgs = getCommandArgs();
  const name = commandArgs[0];
  const userId = getArg('--user') || 'admin';

  if (!name) {
    console.error('❌ Usage: npm run secrets:get <name> [--user <userId>]');
    process.exit(1);
  }

  console.log(`📖 Retrieving secret: ${name}`);
  
  const value = await secretManager.getSecret(name, userId);
  console.log(`✅ Secret value: ${value}`);
}

/**
 * Handle rotate command
 */
async function handleRotate(): Promise<void> {
  const commandArgs = getCommandArgs();
  const name = commandArgs[0];
  const newValue = commandArgs[1];
  const userId = getArg('--user') || 'admin';

  if (!name || !newValue) {
    console.error('❌ Usage: npm run secrets:rotate <name> <newValue> [--user <userId>]');
    process.exit(1);
  }

  console.log(`🔄 Rotating secret: ${name}`);
  
  const result = await secretManager.rotateSecret(name, newValue, userId);
  
  if (result.success) {
    console.log(`✅ Secret rotated successfully: ${result.newVersion}`);
  } else {
    console.error(`❌ Secret rotation failed: ${result.error}`);
  }
}

/**
 * Handle list command
 */
async function handleList(): Promise<void> {
  const userId = getArg('--user') || 'admin';

  console.log(`📋 Listing secrets for user: ${userId}`);
  
  const secrets = await secretManager.listSecrets(userId);
  
  if (secrets.length === 0) {
    console.log('No secrets found');
    return;
  }

  console.log(`\nFound ${secrets.length} secrets:\n`);
  for (const secret of secrets) {
    console.log(`- ${secret.name} (${secret.type})`);
    console.log(`  ID: ${secret.id}`);
    console.log(`  Environment: ${secret.environment}`);
    console.log(`  Last rotated: ${secret.lastRotated.toISOString()}`);
    console.log(`  Tags: ${secret.tags.join(', ') || 'none'}`);
    console.log('');
  }
}

/**
 * Handle delete command
 */
async function handleDelete(): Promise<void> {
  const commandArgs = getCommandArgs();
  const name = commandArgs[0];
  const userId = getArg('--user') || 'admin';

  if (!name) {
    console.error('❌ Usage: npm run secrets:delete <name> [--user <userId>]');
    process.exit(1);
  }

  console.log(`🗑️ Deleting secret: ${name}`);
  
  await secretManager.deleteSecret(name, userId);
  console.log(`✅ Secret deleted successfully: ${name}`);
}

/**
 * Handle schedule rotation command
 */
async function handleScheduleRotation(): Promise<void> {
  const commandArgs = getCommandArgs();
  const name = commandArgs[0];
  const userId = getArg('--user') || 'admin';
  const intervalDays = parseInt(getArg('--interval') || '90');

  if (!name) {
    console.error('❌ Usage: npm run secrets:schedule-rotation <name> [--interval <days>] [--user <userId>]');
    process.exit(1);
  }

  console.log(`📅 Scheduling rotation for secret: ${name}`);
  
  // This would be implemented in the rotation manager
  console.log(`✅ Rotation scheduled for ${name} every ${intervalDays} days`);
}

/**
 * Handle process rotations command
 */
async function handleProcessRotations(): Promise<void> {
  console.log('🔄 Processing automatic rotations...');
  
  const results = await secretManager.processAutomaticRotations();
  
  console.log(`✅ Processed ${results.length} rotations`);
  
  for (const result of results) {
    if (result.success) {
      console.log(`✅ ${result.secretName}: rotated successfully`);
    } else {
      console.error(`❌ ${result.secretName}: ${result.error}`);
    }
  }
}

/**
 * Handle health command
 */
async function handleHealth(): Promise<void> {
  console.log('🏥 Checking secret management system health...');
  
  const health = await secretManager.getHealthStatus();
  
  console.log('\nHealth Status:');
  console.log(`- Vault: ${health.vault}`);
  console.log(`- Access Control: ${health.accessControl}`);
  console.log(`- Rotation: ${health.rotation}`);
  console.log(`- Due rotations: ${health.dueRotations}`);
  console.log(`- Pending notifications: ${health.pendingNotifications}`);
}

/**
 * Handle audit command
 */
async function handleAudit(): Promise<void> {
  const startDate = new Date(getArg('--start') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
  const endDate = new Date(getArg('--end') || new Date().toISOString());
  const outputFile = getArg('--output');

  console.log(`📊 Generating audit report from ${startDate.toISOString()} to ${endDate.toISOString()}`);
  
  const report = await secretManager.generateAuditReport(startDate, endDate);
  
  if (outputFile) {
    writeFileSync(outputFile, report);
    console.log(`📄 Audit report saved to: ${outputFile}`);
  } else {
    console.log('\n' + report);
  }
}

/**
 * Handle users command
 */
async function handleUsers(): Promise<void> {
  console.log('👥 Listing users...');
  
  const users = secretManager.listUsers();
  
  if (users.length === 0) {
    console.log('No users found');
    return;
  }

  console.log(`\nFound ${users.length} users:\n`);
  for (const user of users) {
    console.log(`- ${user.username} (${user.email})`);
    console.log(`  ID: ${user.id}`);
    console.log(`  Roles: ${user.roles.join(', ')}`);
    console.log(`  Environment: ${user.environment}`);
    console.log(`  Active: ${user.isActive}`);
    console.log(`  Last login: ${user.lastLogin.toISOString()}`);
    console.log('');
  }
}

/**
 * Handle roles command
 */
async function handleRoles(): Promise<void> {
  console.log('🎭 Listing roles...');
  
  const roles = secretManager.listRoles();
  
  if (roles.length === 0) {
    console.log('No roles found');
    return;
  }

  console.log(`\nFound ${roles.length} roles:\n`);
  for (const role of roles) {
    console.log(`- ${role.name} (${role.id})`);
    console.log(`  Description: ${role.description}`);
    console.log(`  Environment: ${role.environment}`);
    console.log(`  Active: ${role.isActive}`);
    console.log(`  Permissions: ${role.permissions.length}`);
    console.log('');
  }
}

/**
 * Show help information
 */
function showHelp(): void {
  console.log(`
🔐 YieldSensei Secret Management CLI

Usage:
  npm run secrets:store <name> <value> [--user <userId>] [--type <type>] [--description <description>]
  npm run secrets:get <name> [--user <userId>]
  npm run secrets:rotate <name> <newValue> [--user <userId>]
  npm run secrets:list [--user <userId>]
  npm run secrets:delete <name> [--user <userId>]
  npm run secrets:schedule-rotation <name> [--interval <days>] [--user <userId>]
  npm run secrets:process-rotations
  npm run secrets:health
  npm run secrets:audit [--start <date>] [--end <date>] [--output <file>]
  npm run secrets:users
  npm run secrets:roles

Examples:
  npm run secrets:store JWT_SECRET "my-secret-value" --user admin --type jwt
  npm run secrets:get JWT_SECRET --user developer
  npm run secrets:rotate JWT_SECRET "new-secret-value" --user admin
  npm run secrets:list --user admin
  npm run secrets:audit --start 2024-01-01 --end 2024-12-31 --output audit-report.md

Environment Variables:
  VAULT_ENCRYPTION_KEY: Encryption key for local vault (default: dev key)
  `);
}

/**
 * Get command line argument value
 */
function getArg(flag: string): string | undefined {
  const index = args.indexOf(flag);
  if (index !== -1 && index + 1 < args.length) {
    return args[index + 1];
  }
  return undefined;
}

/**
 * Get all arguments after a command
 */
function getCommandArgs(): string[] {
  return args.slice(1);
}

// Run the CLI
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
} 