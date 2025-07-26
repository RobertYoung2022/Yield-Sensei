/**
 * Role-Based Access Control (RBAC) for Secret Management
 * 
 * Implements comprehensive access control for secret vault operations
 * with role definitions, permission management, and audit logging.
 */

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  environment: 'development' | 'staging' | 'production' | 'all';
  created: Date;
  lastModified: Date;
  isActive: boolean;
}

export interface Permission {
  resource: 'secret' | 'vault' | 'audit' | 'rotation';
  action: 'read' | 'write' | 'delete' | 'rotate' | 'list' | 'create';
  conditions?: PermissionCondition[];
}

export interface PermissionCondition {
  type: 'environment' | 'secret_type' | 'time' | 'ip' | 'user';
  value: string | string[];
  operator: 'equals' | 'in' | 'not_in' | 'before' | 'after' | 'between';
}

export interface User {
  id: string;
  username: string;
  email: string;
  roles: string[];
  environment: 'development' | 'staging' | 'production' | 'all';
  created: Date;
  lastLogin: Date;
  isActive: boolean;
  metadata: Record<string, any>;
}

export interface AccessRequest {
  userId: string;
  resource: string;
  action: string;
  timestamp: Date;
  ip: string;
  userAgent: string;
  context: Record<string, any>;
}

export interface AccessResult {
  granted: boolean;
  reason?: string;
  conditions?: string[];
  auditTrail: string[];
}

export class AccessControlManager {
  private roles: Map<string, Role> = new Map();
  private users: Map<string, User> = new Map();
  private accessLog: AccessRequest[] = [];

  constructor() {
    this.initializeDefaultRoles();
  }

  /**
   * Initialize default roles for the system
   */
  private initializeDefaultRoles(): void {
    // Admin role - full access
    const adminRole: Role = {
      id: 'admin',
      name: 'Administrator',
      description: 'Full access to all vault operations',
      permissions: [
        { resource: 'secret', action: 'read' },
        { resource: 'secret', action: 'write' },
        { resource: 'secret', action: 'delete' },
        { resource: 'secret', action: 'rotate' },
        { resource: 'secret', action: 'list' },
        { resource: 'secret', action: 'create' },
        { resource: 'vault', action: 'read' },
        { resource: 'vault', action: 'write' },
        { resource: 'audit', action: 'read' },
        { resource: 'rotation', action: 'read' },
        { resource: 'rotation', action: 'write' }
      ],
      environment: 'all',
      created: new Date(),
      lastModified: new Date(),
      isActive: true
    };

    // Developer role - limited access
    const developerRole: Role = {
      id: 'developer',
      name: 'Developer',
      description: 'Access to development secrets and basic operations',
      permissions: [
        { resource: 'secret', action: 'read', conditions: [{ type: 'environment', value: 'development', operator: 'equals' }] },
        { resource: 'secret', action: 'list', conditions: [{ type: 'environment', value: 'development', operator: 'equals' }] },
        { resource: 'vault', action: 'read', conditions: [{ type: 'environment', value: 'development', operator: 'equals' }] }
      ],
      environment: 'development',
      created: new Date(),
      lastModified: new Date(),
      isActive: true
    };

    // Read-only role
    const readOnlyRole: Role = {
      id: 'readonly',
      name: 'Read Only',
      description: 'Read-only access to secrets',
      permissions: [
        { resource: 'secret', action: 'read' },
        { resource: 'secret', action: 'list' },
        { resource: 'vault', action: 'read' }
      ],
      environment: 'all',
      created: new Date(),
      lastModified: new Date(),
      isActive: true
    };

    // Rotation manager role
    const rotationManagerRole: Role = {
      id: 'rotation_manager',
      name: 'Rotation Manager',
      description: 'Manages secret rotation operations',
      permissions: [
        { resource: 'secret', action: 'read' },
        { resource: 'secret', action: 'rotate' },
        { resource: 'rotation', action: 'read' },
        { resource: 'rotation', action: 'write' },
        { resource: 'audit', action: 'read' }
      ],
      environment: 'all',
      created: new Date(),
      lastModified: new Date(),
      isActive: true
    };

    this.roles.set(adminRole.id, adminRole);
    this.roles.set(developerRole.id, developerRole);
    this.roles.set(readOnlyRole.id, readOnlyRole);
    this.roles.set(rotationManagerRole.id, rotationManagerRole);
  }

  /**
   * Create a new role
   */
  createRole(role: Omit<Role, 'id' | 'created' | 'lastModified'>): Role {
    const newRole: Role = {
      ...role,
      id: this.generateRoleId(role.name),
      created: new Date(),
      lastModified: new Date()
    };

    this.roles.set(newRole.id, newRole);
    console.log(`✅ Role created: ${newRole.name} (${newRole.id})`);
    return newRole;
  }

  /**
   * Update an existing role
   */
  updateRole(roleId: string, updates: Partial<Role>): Role {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    const updatedRole: Role = {
      ...role,
      ...updates,
      lastModified: new Date()
    };

    this.roles.set(roleId, updatedRole);
    console.log(`🔄 Role updated: ${updatedRole.name} (${roleId})`);
    return updatedRole;
  }

  /**
   * Delete a role
   */
  deleteRole(roleId: string): void {
    const role = this.roles.get(roleId);
    if (!role) {
      throw new Error(`Role not found: ${roleId}`);
    }

    // Check if any users are using this role
    const usersWithRole = Array.from(this.users.values()).filter(user => 
      user.roles.includes(roleId)
    );

    if (usersWithRole.length > 0) {
      throw new Error(`Cannot delete role: ${usersWithRole.length} users still have this role`);
    }

    this.roles.delete(roleId);
    console.log(`🗑️ Role deleted: ${role.name} (${roleId})`);
  }

  /**
   * Create a new user
   */
  createUser(user: Omit<User, 'id' | 'created' | 'lastLogin'>): User {
    const newUser: User = {
      ...user,
      id: this.generateUserId(user.username),
      created: new Date(),
      lastLogin: new Date()
    };

    // Validate that all roles exist
    for (const roleId of newUser.roles) {
      if (!this.roles.has(roleId)) {
        throw new Error(`Role not found: ${roleId}`);
      }
    }

    this.users.set(newUser.id, newUser);
    console.log(`✅ User created: ${newUser.username} (${newUser.id})`);
    return newUser;
  }

  /**
   * Update user roles
   */
  updateUserRoles(userId: string, roles: string[]): User {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }

    // Validate that all roles exist
    for (const roleId of roles) {
      if (!this.roles.has(roleId)) {
        throw new Error(`Role not found: ${roleId}`);
      }
    }

    const updatedUser: User = {
      ...user,
      roles,
      lastLogin: new Date()
    };

    this.users.set(userId, updatedUser);
    console.log(`🔄 User roles updated: ${updatedUser.username} (${userId})`);
    return updatedUser;
  }

  /**
   * Check if a user has permission to perform an action
   */
  checkPermission(
    userId: string,
    resource: string,
    action: string,
    context: Record<string, any> = {}
  ): AccessResult {
    const user = this.users.get(userId);
    if (!user || !user.isActive) {
      return {
        granted: false,
        reason: 'User not found or inactive',
        auditTrail: []
      };
    }

    const auditTrail: string[] = [];
    auditTrail.push(`Checking permission for user: ${user.username}`);

    // Get all roles for the user
    const userRoles = user.roles.map(roleId => this.roles.get(roleId)).filter(Boolean) as Role[];
    auditTrail.push(`User has ${userRoles.length} roles: ${userRoles.map(r => r.name).join(', ')}`);

    // Check each role for the required permission
    for (const role of userRoles) {
      if (!role.isActive) {
        auditTrail.push(`Role ${role.name} is inactive, skipping`);
        continue;
      }

      const permission = role.permissions.find(p => 
        p.resource === resource && p.action === action
      );

      if (permission) {
        auditTrail.push(`Found permission in role: ${role.name}`);
        
        // Check conditions
        const conditionsMet = this.checkPermissionConditions(permission.conditions || [], context);
        if (conditionsMet) {
          auditTrail.push('All conditions met, permission granted');
          
          // Log the access request
          this.logAccessRequest({
            userId,
            resource,
            action,
            timestamp: new Date(),
            ip: context['ip'] || 'unknown',
            userAgent: context['userAgent'] || 'unknown',
            context
          });

          return {
            granted: true,
            auditTrail
          };
        } else {
          auditTrail.push('Permission conditions not met');
        }
      }
    }

    auditTrail.push('No valid permission found');
    return {
      granted: false,
      reason: 'Insufficient permissions',
      auditTrail
    };
  }

  /**
   * Check if permission conditions are met
   */
  private checkPermissionConditions(
    conditions: PermissionCondition[],
    context: Record<string, any>
  ): boolean {
    if (conditions.length === 0) {
      return true;
    }

    for (const condition of conditions) {
      const contextValue = context[condition.type];
      
      switch (condition.operator) {
        case 'equals':
          if (contextValue !== condition.value) {
            return false;
          }
          break;
        case 'in':
          if (Array.isArray(condition.value)) {
            if (!condition.value.includes(contextValue)) {
              return false;
            }
          }
          break;
        case 'not_in':
          if (Array.isArray(condition.value)) {
            if (condition.value.includes(contextValue)) {
              return false;
            }
          }
          break;
        case 'before':
          if (contextValue >= condition.value) {
            return false;
          }
          break;
        case 'after':
          if (contextValue <= condition.value) {
            return false;
          }
          break;
        case 'between':
          if (Array.isArray(condition.value) && condition.value.length === 2) {
            const min = condition.value[0];
            const max = condition.value[1];
            if (min !== undefined && max !== undefined && (contextValue < min || contextValue > max)) {
              return false;
            }
          }
          break;
      }
    }

    return true;
  }

  /**
   * Log access request for audit
   */
  private logAccessRequest(request: AccessRequest): void {
    this.accessLog.push(request);
    
    // Keep only last 1000 entries to prevent memory issues
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000);
    }
  }

  /**
   * Get access audit log
   */
  getAccessLog(
    startDate?: Date,
    endDate?: Date,
    userId?: string
  ): AccessRequest[] {
    let filteredLog = this.accessLog;

    if (startDate) {
      filteredLog = filteredLog.filter(entry => entry.timestamp >= startDate);
    }

    if (endDate) {
      filteredLog = filteredLog.filter(entry => entry.timestamp <= endDate);
    }

    if (userId) {
      filteredLog = filteredLog.filter(entry => entry.userId === userId);
    }

    return filteredLog;
  }

  /**
   * Generate audit report
   */
  generateAuditReport(startDate: Date, endDate: Date): string {
    const accessLog = this.getAccessLog(startDate, endDate);
    
    let report = `# Access Control Audit Report\n\n`;
    report += `**Period:** ${startDate.toISOString()} to ${endDate.toISOString()}\n`;
    report += `**Generated:** ${new Date().toISOString()}\n\n`;
    
    report += `## Access Summary\n`;
    report += `- Total access attempts: ${accessLog.length}\n`;
    
    const uniqueUsers = new Set(accessLog.map(entry => entry.userId));
    report += `- Unique users: ${uniqueUsers.size}\n`;
    
    const resourceCounts = accessLog.reduce((acc, entry) => {
      acc[entry.resource] = (acc[entry.resource] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    report += `- Access by resource:\n`;
    for (const [resource, count] of Object.entries(resourceCounts)) {
      report += `  - ${resource}: ${count}\n`;
    }
    
    report += `\n## Recent Access Log\n`;
    const recentLog = accessLog.slice(-10);
    for (const entry of recentLog) {
      const user = this.users.get(entry.userId);
      report += `- ${entry.timestamp.toISOString()}: ${user?.username ?? entry.userId} ${entry.action} ${entry.resource}\n`;
    }
    
    return report;
  }

  /**
   * List all roles
   */
  listRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * List all users
   */
  listUsers(): User[] {
    return Array.from(this.users.values());
  }

  /**
   * Get user by ID
   */
  getUser(userId: string): User | undefined {
    return this.users.get(userId);
  }

  /**
   * Get role by ID
   */
  getRole(roleId: string): Role | undefined {
    return this.roles.get(roleId);
  }

  // Private helper methods

  private generateRoleId(name: string): string {
    return `role_${name.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }

  private generateUserId(username: string): string {
    return `user_${username.toLowerCase().replace(/[^a-z0-9]/g, '_')}_${Date.now()}`;
  }
} 