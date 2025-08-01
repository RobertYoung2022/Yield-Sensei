/**
 * Multi-Wallet Management Module
 * Exports wallet management and security monitoring components
 */

export { WalletManager, WalletManagerConfig } from './wallet-manager';
export { SecurityMonitor, SecurityMonitorConfig } from './security-monitor';

// Re-export types for convenience
export type {
  WalletManagementConfig,
  ManagedWallet,
  WalletType,
  WalletRole,
  WalletHealth,
  BackupStrategy,
  SecurityAlert
} from '../types';