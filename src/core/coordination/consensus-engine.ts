/**
 * YieldSensei Consensus Engine
 * Task 45.3: Distributed Coordination and Consensus Framework
 * 
 * Implements Raft consensus algorithm for distributed coordination among satellites
 */

import { EventEmitter } from 'events';
import Logger from '@/shared/logging/logger';
import { AgentId } from '@/types';

const logger = Logger.getLogger('consensus-engine');

/**
 * Node State in Raft Consensus
 */
export type NodeState = 'follower' | 'candidate' | 'leader';

/**
 * Log Entry for Raft Consensus
 */
export interface LogEntry {
  term: number;
  index: number;
  command: any;
  timestamp: Date;
  nodeId: AgentId;
}

/**
 * Vote Request Message
 */
export interface VoteRequest {
  term: number;
  candidateId: AgentId;
  lastLogIndex: number;
  lastLogTerm: number;
}

/**
 * Vote Response Message
 */
export interface VoteResponse {
  term: number;
  voteGranted: boolean;
  nodeId: AgentId;
}

/**
 * Append Entries Request (Heartbeat/Log Replication)
 */
export interface AppendEntriesRequest {
  term: number;
  leaderId: AgentId;
  prevLogIndex: number;
  prevLogTerm: number;
  entries: LogEntry[];
  leaderCommit: number;
}

/**
 * Append Entries Response
 */
export interface AppendEntriesResponse {
  term: number;
  success: boolean;
  nodeId: AgentId;
  matchIndex?: number;
}

/**
 * Consensus Configuration
 */
export interface ConsensusConfig {
  nodeId: AgentId;
  clusterNodes: AgentId[];
  electionTimeoutMin: number;
  electionTimeoutMax: number;
  heartbeatInterval: number;
  maxLogEntries: number;
  snapshotThreshold: number;
  enablePersistence: boolean;
}

export const DEFAULT_CONSENSUS_CONFIG: ConsensusConfig = {
  nodeId: 'unknown',
  clusterNodes: [],
  electionTimeoutMin: 150,   // 150ms
  electionTimeoutMax: 300,   // 300ms
  heartbeatInterval: 50,     // 50ms
  maxLogEntries: 10000,
  snapshotThreshold: 1000,
  enablePersistence: true,
};

/**
 * Consensus State
 */
interface ConsensusState {
  // Persistent state
  currentTerm: number;
  votedFor: AgentId | null;
  log: LogEntry[];
  
  // Volatile state (all servers)
  commitIndex: number;
  lastApplied: number;
  
  // Volatile state (leaders)
  nextIndex: Map<AgentId, number>;
  matchIndex: Map<AgentId, number>;
  
  // Node state
  state: NodeState;
  leaderId: AgentId | null;
  votes: Set<AgentId>;
}

/**
 * Raft Consensus Engine
 * Implements distributed consensus for satellite coordination
 */
export class ConsensusEngine extends EventEmitter {
  private config: ConsensusConfig;
  private state: ConsensusState;
  
  // Timers
  private electionTimer?: NodeJS.Timeout;
  private heartbeatTimer?: NodeJS.Timeout;
  
  // Status
  private isRunning: boolean = false;

  constructor(config: ConsensusConfig = DEFAULT_CONSENSUS_CONFIG) {
    super();
    this.config = config;
    
    this.state = {
      currentTerm: 0,
      votedFor: null,
      log: [],
      commitIndex: -1,
      lastApplied: -1,
      nextIndex: new Map(),
      matchIndex: new Map(),
      state: 'follower',
      leaderId: null,
      votes: new Set(),
    };

    // Initialize leader state for all cluster nodes
    for (const nodeId of config.clusterNodes) {
      if (nodeId !== config.nodeId) {
        this.state.nextIndex.set(nodeId, 0);
        this.state.matchIndex.set(nodeId, -1);
      }
    }
  }

  /**
   * Start the consensus engine
   */
  async start(): Promise<void> {
    if (this.isRunning) {
      logger.warn('Consensus engine already running');
      return;
    }

    logger.info(`Starting consensus engine for node ${this.config.nodeId}`);
    
    // Load persistent state if enabled
    if (this.config.enablePersistence) {
      await this.loadPersistentState();
    }

    // Start as follower
    this.becomeFollower(this.state.currentTerm);
    
    this.isRunning = true;
    logger.info('Consensus engine started successfully');
    this.emit('started');
  }

  /**
   * Stop the consensus engine
   */
  async stop(): Promise<void> {
    if (!this.isRunning) {
      return;
    }

    logger.info('Stopping consensus engine...');
    
    // Clear timers
    this.clearElectionTimer();
    this.clearHeartbeatTimer();
    
    // Save persistent state if enabled
    if (this.config.enablePersistence) {
      await this.savePersistentState();
    }

    this.isRunning = false;
    logger.info('Consensus engine stopped');
    this.emit('stopped');
  }

  /**
   * Submit command to the consensus log
   */
  async submitCommand(command: any): Promise<boolean> {
    if (this.state.state !== 'leader') {
      logger.warn('Cannot submit command: not the leader');
      return false;
    }

    try {
      const entry: LogEntry = {
        term: this.state.currentTerm,
        index: this.state.log.length,
        command,
        timestamp: new Date(),
        nodeId: this.config.nodeId,
      };

      this.state.log.push(entry);
      
      logger.debug(`Submitted command to log at index ${entry.index}`);
      this.emit('command_submitted', { entry, command });
      
      // Immediately replicate to followers
      await this.replicateToFollowers();
      
      return true;
    } catch (error) {
      logger.error('Failed to submit command:', error);
      return false;
    }
  }

  /**
   * Handle vote request from candidate
   */
  async handleVoteRequest(request: VoteRequest): Promise<VoteResponse> {
    logger.debug(`Received vote request from ${request.candidateId} for term ${request.term}`);

    // Update term if request has higher term
    if (request.term > this.state.currentTerm) {
      this.becomeFollower(request.term);
    }

    const response: VoteResponse = {
      term: this.state.currentTerm,
      voteGranted: false,
      nodeId: this.config.nodeId,
    };

    // Grant vote if conditions are met
    if (request.term >= this.state.currentTerm &&
        (this.state.votedFor === null || this.state.votedFor === request.candidateId) &&
        this.isLogUpToDate(request.lastLogIndex, request.lastLogTerm)) {
      
      this.state.votedFor = request.candidateId;
      response.voteGranted = true;
      
      // Reset election timer when granting vote
      this.resetElectionTimer();
      
      logger.info(`Granted vote to ${request.candidateId} for term ${request.term}`);
      this.emit('vote_granted', { candidateId: request.candidateId, term: request.term });
    } else {
      logger.debug(`Denied vote to ${request.candidateId} for term ${request.term}`);
    }

    return response;
  }

  /**
   * Handle append entries request (heartbeat/log replication)
   */
  async handleAppendEntries(request: AppendEntriesRequest): Promise<AppendEntriesResponse> {
    logger.debug(`Received append entries from ${request.leaderId} for term ${request.term}`);

    // Update term if request has higher term
    if (request.term > this.state.currentTerm) {
      this.becomeFollower(request.term);
    }

    const response: AppendEntriesResponse = {
      term: this.state.currentTerm,
      success: false,
      nodeId: this.config.nodeId,
    };

    // Reject if term is outdated
    if (request.term < this.state.currentTerm) {
      return response;
    }

    // Accept leader and reset election timer
    this.state.leaderId = request.leaderId;
    this.resetElectionTimer();

    // Check log consistency
    if (request.prevLogIndex >= 0) {
      if (request.prevLogIndex >= this.state.log.length ||
          this.state.log[request.prevLogIndex].term !== request.prevLogTerm) {
        logger.debug('Log consistency check failed');
        return response;
      }
    }

    // Append new entries
    if (request.entries.length > 0) {
      // Remove conflicting entries
      let insertIndex = request.prevLogIndex + 1;
      for (let i = 0; i < request.entries.length; i++) {
        const entryIndex = insertIndex + i;
        if (entryIndex < this.state.log.length) {
          if (this.state.log[entryIndex].term !== request.entries[i].term) {
            // Remove conflicting entries and all that follow
            this.state.log = this.state.log.slice(0, entryIndex);
            break;
          }
        }
      }

      // Append new entries
      for (const entry of request.entries) {
        if (entry.index >= this.state.log.length) {
          this.state.log.push(entry);
        }
      }

      logger.debug(`Appended ${request.entries.length} entries to log`);
    }

    // Update commit index
    if (request.leaderCommit > this.state.commitIndex) {
      this.state.commitIndex = Math.min(request.leaderCommit, this.state.log.length - 1);
      await this.applyCommittedEntries();
    }

    response.success = true;
    response.matchIndex = this.state.log.length - 1;

    return response;
  }

  /**
   * Get current consensus state
   */
  getState(): {
    nodeId: AgentId;
    state: NodeState;
    currentTerm: number;
    leaderId: AgentId | null;
    logLength: number;
    commitIndex: number;
    isLeader: boolean;
  } {
    return {
      nodeId: this.config.nodeId,
      state: this.state.state,
      currentTerm: this.state.currentTerm,
      leaderId: this.state.leaderId,
      logLength: this.state.log.length,
      commitIndex: this.state.commitIndex,
      isLeader: this.state.state === 'leader',
    };
  }

  /**
   * Get consensus statistics
   */
  getStats() {
    return {
      nodeId: this.config.nodeId,
      state: this.state.state,
      currentTerm: this.state.currentTerm,
      leaderId: this.state.leaderId,
      logLength: this.state.log.length,
      commitIndex: this.state.commitIndex,
      lastApplied: this.state.lastApplied,
      clusterSize: this.config.clusterNodes.length,
      isRunning: this.isRunning,
    };
  }

  /**
   * Become follower
   */
  private becomeFollower(term: number): void {
    logger.info(`Becoming follower for term ${term}`);
    
    this.state.state = 'follower';
    this.state.currentTerm = term;
    this.state.votedFor = null;
    this.state.leaderId = null;
    this.state.votes.clear();
    
    this.clearHeartbeatTimer();
    this.resetElectionTimer();
    
    this.emit('state_changed', { state: 'follower', term });
  }

  /**
   * Become candidate and start election
   */
  private becomeCandidate(): void {
    logger.info(`Becoming candidate for term ${this.state.currentTerm + 1}`);
    
    this.state.state = 'candidate';
    this.state.currentTerm++;
    this.state.votedFor = this.config.nodeId;
    this.state.leaderId = null;
    this.state.votes.clear();
    this.state.votes.add(this.config.nodeId); // Vote for self
    
    this.clearHeartbeatTimer();
    this.resetElectionTimer();
    
    this.emit('state_changed', { state: 'candidate', term: this.state.currentTerm });
    
    // Start election
    this.startElection();
  }

  /**
   * Become leader
   */
  private becomeLeader(): void {
    logger.info(`Becoming leader for term ${this.state.currentTerm}`);
    
    this.state.state = 'leader';
    this.state.leaderId = this.config.nodeId;
    
    // Initialize leader state
    const nextIndex = this.state.log.length;
    for (const nodeId of this.config.clusterNodes) {
      if (nodeId !== this.config.nodeId) {
        this.state.nextIndex.set(nodeId, nextIndex);
        this.state.matchIndex.set(nodeId, -1);
      }
    }
    
    this.clearElectionTimer();
    this.startHeartbeat();
    
    this.emit('state_changed', { state: 'leader', term: this.state.currentTerm });
    this.emit('leader_elected', { leaderId: this.config.nodeId, term: this.state.currentTerm });
  }

  /**
   * Start election process
   */
  private async startElection(): Promise<void> {
    const lastLogIndex = this.state.log.length - 1;
    const lastLogTerm = lastLogIndex >= 0 ? this.state.log[lastLogIndex].term : 0;

    const voteRequest: VoteRequest = {
      term: this.state.currentTerm,
      candidateId: this.config.nodeId,
      lastLogIndex,
      lastLogTerm,
    };

    // Send vote requests to all other nodes
    for (const nodeId of this.config.clusterNodes) {
      if (nodeId !== this.config.nodeId) {
        this.sendVoteRequest(nodeId, voteRequest);
      }
    }

    logger.debug(`Started election for term ${this.state.currentTerm}`);
  }

  /**
   * Process vote response
   */
  processVoteResponse(response: VoteResponse): void {
    if (this.state.state !== 'candidate' || response.term !== this.state.currentTerm) {
      return;
    }

    if (response.term > this.state.currentTerm) {
      this.becomeFollower(response.term);
      return;
    }

    if (response.voteGranted) {
      this.state.votes.add(response.nodeId);
      logger.debug(`Received vote from ${response.nodeId}, total votes: ${this.state.votes.size}`);

      // Check if we have majority
      const majority = Math.floor(this.config.clusterNodes.length / 2) + 1;
      if (this.state.votes.size >= majority) {
        this.becomeLeader();
      }
    }
  }

  /**
   * Start heartbeat (leader only)
   */
  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(async () => {
      if (this.state.state === 'leader') {
        await this.sendHeartbeats();
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * Send heartbeats to all followers
   */
  private async sendHeartbeats(): Promise<void> {
    for (const nodeId of this.config.clusterNodes) {
      if (nodeId !== this.config.nodeId) {
        await this.sendAppendEntries(nodeId);
      }
    }
  }

  /**
   * Replicate log entries to followers
   */
  private async replicateToFollowers(): Promise<void> {
    if (this.state.state !== 'leader') {
      return;
    }

    for (const nodeId of this.config.clusterNodes) {
      if (nodeId !== this.config.nodeId) {
        await this.sendAppendEntries(nodeId);
      }
    }
  }

  /**
   * Send append entries to specific follower
   */
  private async sendAppendEntries(nodeId: AgentId): Promise<void> {
    const nextIndex = this.state.nextIndex.get(nodeId) || 0;
    const prevLogIndex = nextIndex - 1;
    const prevLogTerm = prevLogIndex >= 0 ? this.state.log[prevLogIndex]?.term || 0 : 0;
    
    const entries = this.state.log.slice(nextIndex);

    const request: AppendEntriesRequest = {
      term: this.state.currentTerm,
      leaderId: this.config.nodeId,
      prevLogIndex,
      prevLogTerm,
      entries,
      leaderCommit: this.state.commitIndex,
    };

    this.emit('append_entries_request', { nodeId, request });
  }

  /**
   * Process append entries response
   */
  processAppendEntriesResponse(nodeId: AgentId, response: AppendEntriesResponse): void {
    if (this.state.state !== 'leader' || response.term !== this.state.currentTerm) {
      return;
    }

    if (response.term > this.state.currentTerm) {
      this.becomeFollower(response.term);
      return;
    }

    if (response.success) {
      // Update next and match indices
      const nextIndex = this.state.nextIndex.get(nodeId) || 0;
      this.state.nextIndex.set(nodeId, this.state.log.length);
      this.state.matchIndex.set(nodeId, response.matchIndex || this.state.log.length - 1);

      // Update commit index if majority has replicated
      this.updateCommitIndex();
    } else {
      // Decrement nextIndex and retry
      const nextIndex = this.state.nextIndex.get(nodeId) || 0;
      this.state.nextIndex.set(nodeId, Math.max(0, nextIndex - 1));
      
      // Retry append entries
      this.sendAppendEntries(nodeId);
    }
  }

  /**
   * Update commit index based on majority replication
   */
  private updateCommitIndex(): void {
    const matchIndices = Array.from(this.state.matchIndex.values());
    matchIndices.push(this.state.log.length - 1); // Include leader's match index
    matchIndices.sort((a, b) => b - a); // Sort descending

    const majority = Math.floor(this.config.clusterNodes.length / 2) + 1;
    const newCommitIndex = matchIndices[majority - 1];

    if (newCommitIndex > this.state.commitIndex && 
        newCommitIndex < this.state.log.length &&
        this.state.log[newCommitIndex].term === this.state.currentTerm) {
      
      this.state.commitIndex = newCommitIndex;
      logger.debug(`Updated commit index to ${newCommitIndex}`);
      this.applyCommittedEntries();
    }
  }

  /**
   * Apply committed entries to state machine
   */
  private async applyCommittedEntries(): Promise<void> {
    while (this.state.lastApplied < this.state.commitIndex) {
      this.state.lastApplied++;
      const entry = this.state.log[this.state.lastApplied];
      
      if (entry) {
        logger.debug(`Applying entry ${entry.index}: ${JSON.stringify(entry.command)}`);
        this.emit('command_applied', { entry, command: entry.command });
      }
    }
  }

  /**
   * Check if candidate's log is up-to-date
   */
  private isLogUpToDate(lastLogIndex: number, lastLogTerm: number): boolean {
    const ourLastIndex = this.state.log.length - 1;
    const ourLastTerm = ourLastIndex >= 0 ? this.state.log[ourLastIndex].term : 0;

    if (lastLogTerm !== ourLastTerm) {
      return lastLogTerm > ourLastTerm;
    }
    
    return lastLogIndex >= ourLastIndex;
  }

  /**
   * Reset election timer with random timeout
   */
  private resetElectionTimer(): void {
    this.clearElectionTimer();
    
    const timeout = this.config.electionTimeoutMin + 
                   Math.random() * (this.config.electionTimeoutMax - this.config.electionTimeoutMin);
    
    this.electionTimer = setTimeout(() => {
      if (this.state.state !== 'leader') {
        logger.debug('Election timeout, starting new election');
        this.becomeCandidate();
      }
    }, timeout);
  }

  /**
   * Clear election timer
   */
  private clearElectionTimer(): void {
    if (this.electionTimer) {
      clearTimeout(this.electionTimer);
      delete this.electionTimer;
    }
  }

  /**
   * Clear heartbeat timer
   */
  private clearHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      delete this.heartbeatTimer;
    }
  }

  /**
   * Send vote request (to be handled by external message system)
   */
  private sendVoteRequest(nodeId: AgentId, request: VoteRequest): void {
    this.emit('vote_request', { nodeId, request });
  }

  /**
   * Load persistent state from storage
   */
  private async loadPersistentState(): Promise<void> {
    // Placeholder for persistence loading
    logger.debug('Loading persistent state...');
  }

  /**
   * Save persistent state to storage
   */
  private async savePersistentState(): Promise<void> {
    // Placeholder for persistence saving
    logger.debug('Saving persistent state...');
  }
}