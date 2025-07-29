/**
 * Data Catalog
 * Comprehensive cataloging and discovery system for test datasets
 */

import fs from 'fs/promises';
import path from 'path';
import { Logger } from 'winston';
import { createLogger, format, transports } from 'winston';
import { DatasetMetadata } from './test-data-manager';

export interface CatalogEntry {
  id: string;
  metadata: DatasetMetadata;
  location: {
    basePath: string;
    files: string[];
    format: string[];
  };
  usage: {
    accessCount: number;
    lastAccessed: Date;
    popularQueries: string[];
    avgRating: number;
    totalRatings: number;
  };
  relationships: {
    derivedFrom: string[];
    usedBy: string[];
    similarDatasets: string[];
    dependencies: string[];
  };
  quality: {
    completeness: number; // 0-100%
    accuracy: number; // 0-100%
    consistency: number; // 0-100%
    timeliness: number; // 0-100%
    validity: number; // 0-100%
    uniqueness: number; // 0-100%
    overallScore: number; // 0-100%
    lastAssessment: Date;
  };
  lineage: {
    created: {
      by: string;
      method: string;
      source: string;
      timestamp: Date;
    };
    modifications: Array<{
      by: string;
      action: string;
      timestamp: Date;
      description: string;
    }>;
  };
}

export interface SearchQuery {
  text?: string;
  tags?: string[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sizeRange?: {
    min: number;
    max: number;
  };
  qualityThreshold?: number;
  format?: string[];
  generator?: string;
  sortBy?: 'relevance' | 'date' | 'size' | 'quality' | 'popularity';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
}

export interface SearchResult {
  entry: CatalogEntry;
  score: number;
  highlights: string[];
  matchedFields: string[];
}

export interface CatalogStats {
  totalDatasets: number;
  totalSize: number;
  avgQualityScore: number;
  formatDistribution: Record<string, number>;
  generatorDistribution: Record<string, number>;
  tagDistribution: Record<string, number>;
  qualityDistribution: {
    excellent: number; // 90-100%
    good: number; // 70-89%
    fair: number; // 50-69%
    poor: number; // 0-49%
  };
  usageStats: {
    mostAccessed: CatalogEntry[];
    highestRated: CatalogEntry[];
    recentlyCreated: CatalogEntry[];
  };
}

export class DataCatalog {
  private logger: Logger;
  private catalogPath: string;
  private entries: Map<string, CatalogEntry> = new Map();
  private indexes: {
    byTag: Map<string, Set<string>>;
    byFormat: Map<string, Set<string>>;
    byGenerator: Map<string, Set<string>>;
    byQuality: Map<number, Set<string>>; // Quality score ranges
    fullText: Map<string, Set<string>>; // Simple text index
  };

  constructor(catalogPath: string) {
    this.catalogPath = catalogPath;
    this.logger = createLogger({
      level: 'info',
      format: format.combine(
        format.timestamp(),
        format.simple()
      ),
      transports: [
        new transports.Console(),
        new transports.File({ filename: 'logs/data-catalog.log' })
      ],
    });

    this.indexes = {
      byTag: new Map(),
      byFormat: new Map(),
      byGenerator: new Map(),
      byQuality: new Map(),
      fullText: new Map(),
    };
  }

  async initialize(): Promise<void> {
    this.logger.info('Initializing Data Catalog');
    
    // Ensure catalog directory exists
    await this.ensureDirectoryExists(this.catalogPath);
    
    // Load existing catalog
    await this.loadCatalog();
    
    // Build indexes
    this.buildIndexes();
    
    this.logger.info(`Data Catalog initialized with ${this.entries.size} entries`);
  }

  async addEntry(metadata: DatasetMetadata, location: CatalogEntry['location']): Promise<void> {
    const entry: CatalogEntry = {
      id: metadata.id,
      metadata,
      location,
      usage: {
        accessCount: 0,
        lastAccessed: new Date(),
        popularQueries: [],
        avgRating: 0,
        totalRatings: 0,
      },
      relationships: {
        derivedFrom: metadata.dependencies || [],
        usedBy: [],
        similarDatasets: [],
        dependencies: metadata.dependencies || [],
      },
      quality: await this.assessDataQuality(metadata),
      lineage: {
        created: {
          by: 'system',
          method: metadata.generator || 'unknown',
          source: 'test-data-manager',
          timestamp: metadata.created,
        },
        modifications: [],
      },
    };

    this.entries.set(metadata.id, entry);
    this.updateIndexes(entry);
    
    // Update relationships
    await this.updateRelationships(entry);
    
    // Persist catalog
    await this.saveCatalog();
    
    this.logger.info(`Added dataset ${metadata.name} to catalog`);
  }

  async updateEntry(id: string, updates: Partial<CatalogEntry>): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Dataset not found in catalog: ${id}`);
    }

    // Create updated entry
    const updatedEntry: CatalogEntry = {
      ...entry,
      ...updates,
    };

    // Add modification to lineage
    if (updates.metadata) {
      updatedEntry.lineage.modifications.push({
        by: 'system',
        action: 'metadata_update',
        timestamp: new Date(),
        description: 'Metadata updated',
      });
    }

    // Update quality assessment if metadata changed
    if (updates.metadata) {
      updatedEntry.quality = await this.assessDataQuality(updates.metadata);
    }

    this.entries.set(id, updatedEntry);
    this.updateIndexes(updatedEntry);
    
    await this.saveCatalog();
    
    this.logger.info(`Updated catalog entry for dataset: ${id}`);
  }

  async removeEntry(id: string): Promise<void> {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Dataset not found in catalog: ${id}`);
    }

    // Remove from indexes
    this.removeFromIndexes(entry);
    
    // Remove from relationships
    await this.removeFromRelationships(id);
    
    // Remove entry
    this.entries.delete(id);
    
    await this.saveCatalog();
    
    this.logger.info(`Removed dataset ${id} from catalog`);
  }

  async search(query: SearchQuery): Promise<SearchResult[]> {
    let candidateIds = new Set<string>(this.entries.keys());

    // Apply filters
    if (query.tags && query.tags.length > 0) {
      candidateIds = this.intersectSets(candidateIds, this.searchByTags(query.tags));
    }

    if (query.format && query.format.length > 0) {
      candidateIds = this.intersectSets(candidateIds, this.searchByFormats(query.format));
    }

    if (query.generator) {
      const generatorMatches = this.indexes.byGenerator.get(query.generator) || new Set();
      candidateIds = this.intersectSets(candidateIds, generatorMatches);
    }

    if (query.qualityThreshold) {
      candidateIds = this.intersectSets(candidateIds, this.searchByQuality(query.qualityThreshold));
    }

    if (query.dateRange) {
      candidateIds = this.filterByDateRange(candidateIds, query.dateRange);
    }

    if (query.sizeRange) {
      candidateIds = this.filterBySizeRange(candidateIds, query.sizeRange);
    }

    // Text search
    if (query.text) {
      const textMatches = this.searchByText(query.text);
      candidateIds = this.intersectSets(candidateIds, textMatches);
    }

    // Convert to results with scoring
    const results: SearchResult[] = [];
    for (const id of candidateIds) {
      const entry = this.entries.get(id);
      if (entry) {
        const result = this.scoreResult(entry, query);
        results.push(result);
      }
    }

    // Sort results
    this.sortResults(results, query.sortBy || 'relevance', query.sortOrder || 'desc');

    // Apply limit
    const limit = query.limit || 50;
    return results.slice(0, limit);
  }

  async getEntry(id: string): Promise<CatalogEntry | null> {
    const entry = this.entries.get(id);
    if (entry) {
      // Update access statistics
      entry.usage.accessCount++;
      entry.usage.lastAccessed = new Date();
      await this.saveCatalog();
    }
    return entry || null;
  }

  async rateDataset(id: string, rating: number, comment?: string): Promise<void> {
    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    const entry = this.entries.get(id);
    if (!entry) {
      throw new Error(`Dataset not found: ${id}`);
    }

    // Update rating
    const totalScore = entry.usage.avgRating * entry.usage.totalRatings + rating;
    entry.usage.totalRatings++;
    entry.usage.avgRating = totalScore / entry.usage.totalRatings;

    // Add to lineage
    entry.lineage.modifications.push({
      by: 'user',
      action: 'rating',
      timestamp: new Date(),
      description: `Rated ${rating}/5${comment ? `: ${comment}` : ''}`,
    });

    await this.saveCatalog();
    this.logger.info(`Dataset ${id} rated ${rating}/5`);
  }

  async getStats(): Promise<CatalogStats> {
    const entries = Array.from(this.entries.values());
    
    const stats: CatalogStats = {
      totalDatasets: entries.length,
      totalSize: entries.reduce((sum, e) => sum + e.metadata.size, 0),
      avgQualityScore: entries.length > 0 
        ? entries.reduce((sum, e) => sum + e.quality.overallScore, 0) / entries.length 
        : 0,
      formatDistribution: this.getDistribution(entries, e => e.location.format),
      generatorDistribution: this.getDistribution(entries, e => [e.metadata.generator]),
      tagDistribution: this.getDistribution(entries, e => e.metadata.tags),
      qualityDistribution: {
        excellent: entries.filter(e => e.quality.overallScore >= 90).length,
        good: entries.filter(e => e.quality.overallScore >= 70 && e.quality.overallScore < 90).length,
        fair: entries.filter(e => e.quality.overallScore >= 50 && e.quality.overallScore < 70).length,
        poor: entries.filter(e => e.quality.overallScore < 50).length,
      },
      usageStats: {
        mostAccessed: entries
          .sort((a, b) => b.usage.accessCount - a.usage.accessCount)
          .slice(0, 10),
        highestRated: entries
          .filter(e => e.usage.totalRatings > 0)
          .sort((a, b) => b.usage.avgRating - a.usage.avgRating)
          .slice(0, 10),
        recentlyCreated: entries
          .sort((a, b) => b.metadata.created.getTime() - a.metadata.created.getTime())
          .slice(0, 10),
      },
    };

    return stats;
  }

  async exportCatalog(format: 'json' | 'csv' = 'json'): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `catalog-export-${timestamp}.${format}`;
    const filepath = path.join(this.catalogPath, filename);

    if (format === 'json') {
      const data = {
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
        entries: Array.from(this.entries.values()),
      };
      await fs.writeFile(filepath, JSON.stringify(data, null, 2), 'utf-8');
    } else {
      const csv = this.convertToCsv(Array.from(this.entries.values()));
      await fs.writeFile(filepath, csv, 'utf-8');
    }

    this.logger.info(`Catalog exported to ${filepath}`);
    return filepath;
  }

  async importCatalog(filepath: string): Promise<number> {
    const content = await fs.readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    
    let importedCount = 0;
    
    if (data.entries && Array.isArray(data.entries)) {
      for (const entry of data.entries) {
        if (this.validateEntry(entry)) {
          this.entries.set(entry.id, entry);
          this.updateIndexes(entry);
          importedCount++;
        }
      }
    }

    this.buildIndexes();
    await this.saveCatalog();
    
    this.logger.info(`Imported ${importedCount} entries from ${filepath}`);
    return importedCount;
  }

  // Private helper methods

  private async loadCatalog(): Promise<void> {
    try {
      const catalogFile = path.join(this.catalogPath, 'catalog.json');
      const content = await fs.readFile(catalogFile, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.entries) {
        for (const entry of data.entries) {
          if (this.validateEntry(entry)) {
            // Convert date strings back to Date objects
            entry.metadata.created = new Date(entry.metadata.created);
            entry.metadata.updated = new Date(entry.metadata.updated);
            entry.usage.lastAccessed = new Date(entry.usage.lastAccessed);
            entry.quality.lastAssessment = new Date(entry.quality.lastAssessment);
            entry.lineage.created.timestamp = new Date(entry.lineage.created.timestamp);
            
            for (const mod of entry.lineage.modifications) {
              mod.timestamp = new Date(mod.timestamp);
            }
            
            this.entries.set(entry.id, entry);
          }
        }
      }
    } catch (error) {
      this.logger.warn('No existing catalog found or error loading:', error);
    }
  }

  private async saveCatalog(): Promise<void> {
    const catalogFile = path.join(this.catalogPath, 'catalog.json');
    const data = {
      savedAt: new Date().toISOString(),
      version: '1.0.0',
      entries: Array.from(this.entries.values()),
    };
    
    await fs.writeFile(catalogFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  private buildIndexes(): void {
    // Clear existing indexes
    this.indexes.byTag.clear();
    this.indexes.byFormat.clear();
    this.indexes.byGenerator.clear();
    this.indexes.byQuality.clear();
    this.indexes.fullText.clear();

    // Build new indexes
    for (const entry of this.entries.values()) {
      this.updateIndexes(entry);
    }
  }

  private updateIndexes(entry: CatalogEntry): void {
    const id = entry.id;

    // Tag index
    for (const tag of entry.metadata.tags) {
      if (!this.indexes.byTag.has(tag)) {
        this.indexes.byTag.set(tag, new Set());
      }
      this.indexes.byTag.get(tag)!.add(id);
    }

    // Format index
    for (const format of entry.location.format) {
      if (!this.indexes.byFormat.has(format)) {
        this.indexes.byFormat.set(format, new Set());
      }
      this.indexes.byFormat.get(format)!.add(id);
    }

    // Generator index
    const generator = entry.metadata.generator;
    if (!this.indexes.byGenerator.has(generator)) {
      this.indexes.byGenerator.set(generator, new Set());
    }
    this.indexes.byGenerator.get(generator)!.add(id);

    // Quality index (by score ranges)
    const qualityRange = Math.floor(entry.quality.overallScore / 10) * 10;
    if (!this.indexes.byQuality.has(qualityRange)) {
      this.indexes.byQuality.set(qualityRange, new Set());
    }
    this.indexes.byQuality.get(qualityRange)!.add(id);

    // Full text index (simple tokenization)
    const text = `${entry.metadata.name} ${entry.metadata.description} ${entry.metadata.tags.join(' ')}`;
    const tokens = text.toLowerCase().split(/\s+/);
    
    for (const token of tokens) {
      if (token.length > 2) { // Ignore very short tokens
        if (!this.indexes.fullText.has(token)) {
          this.indexes.fullText.set(token, new Set());
        }
        this.indexes.fullText.get(token)!.add(id);
      }
    }
  }

  private removeFromIndexes(entry: CatalogEntry): void {
    const id = entry.id;

    // Remove from all indexes
    for (const tagSet of this.indexes.byTag.values()) {
      tagSet.delete(id);
    }
    for (const formatSet of this.indexes.byFormat.values()) {
      formatSet.delete(id);
    }
    for (const generatorSet of this.indexes.byGenerator.values()) {
      generatorSet.delete(id);
    }
    for (const qualitySet of this.indexes.byQuality.values()) {
      qualitySet.delete(id);
    }
    for (const textSet of this.indexes.fullText.values()) {
      textSet.delete(id);
    }
  }

  private async assessDataQuality(metadata: DatasetMetadata): Promise<CatalogEntry['quality']> {
    // Simple quality assessment based on metadata
    let completeness = 100;
    let accuracy = 85; // Assumed for generated data
    let consistency = 90; // Assumed for generated data
    let timeliness = 100;
    let validity = 95;
    let uniqueness = 98;

    // Adjust based on metadata completeness
    const requiredFields = ['name', 'description', 'schema', 'generator'];
    const presentFields = requiredFields.filter(field => metadata[field as keyof DatasetMetadata]);
    completeness = (presentFields.length / requiredFields.length) * 100;

    // Adjust timeliness based on age
    const ageInDays = (Date.now() - metadata.created.getTime()) / (1000 * 60 * 60 * 24);
    if (ageInDays > 30) timeliness = Math.max(50, 100 - (ageInDays - 30) * 2);

    // Calculate overall score
    const overallScore = (completeness + accuracy + consistency + timeliness + validity + uniqueness) / 6;

    return {
      completeness,
      accuracy,
      consistency,
      timeliness,
      validity,
      uniqueness,
      overallScore,
      lastAssessment: new Date(),
    };
  }

  private async updateRelationships(entry: CatalogEntry): Promise<void> {
    // Update reverse relationships for dependencies
    for (const depId of entry.relationships.dependencies) {
      const depEntry = this.entries.get(depId);
      if (depEntry) {
        if (!depEntry.relationships.usedBy.includes(entry.id)) {
          depEntry.relationships.usedBy.push(entry.id);
        }
      }
    }

    // Find similar datasets (simple similarity based on tags and generator)
    entry.relationships.similarDatasets = this.findSimilarDatasets(entry);
  }

  private async removeFromRelationships(id: string): Promise<void> {
    // Remove from all relationships
    for (const entry of this.entries.values()) {
      entry.relationships.derivedFrom = entry.relationships.derivedFrom.filter(depId => depId !== id);
      entry.relationships.usedBy = entry.relationships.usedBy.filter(depId => depId !== id);
      entry.relationships.similarDatasets = entry.relationships.similarDatasets.filter(depId => depId !== id);
      entry.relationships.dependencies = entry.relationships.dependencies.filter(depId => depId !== id);
    }
  }

  private findSimilarDatasets(entry: CatalogEntry): string[] {
    const similar: Array<{ id: string; score: number }> = [];

    for (const [id, otherEntry] of this.entries) {
      if (id === entry.id) continue;

      let score = 0;

      // Same generator
      if (entry.metadata.generator === otherEntry.metadata.generator) {
        score += 30;
      }

      // Common tags
      const commonTags = entry.metadata.tags.filter(tag => otherEntry.metadata.tags.includes(tag));
      score += commonTags.length * 10;

      // Similar size (within 50%)
      const sizeDiff = Math.abs(entry.metadata.size - otherEntry.metadata.size);
      const avgSize = (entry.metadata.size + otherEntry.metadata.size) / 2;
      if (sizeDiff / avgSize < 0.5) {
        score += 20;
      }

      if (score > 30) { // Threshold for similarity
        similar.push({ id, score });
      }
    }

    return similar
      .sort((a, b) => b.score - a.score)
      .slice(0, 5) // Top 5 similar
      .map(s => s.id);
  }

  private searchByTags(tags: string[]): Set<string> {
    const results = new Set<string>();
    
    for (const tag of tags) {
      const tagResults = this.indexes.byTag.get(tag) || new Set();
      for (const id of tagResults) {
        results.add(id);
      }
    }
    
    return results;
  }

  private searchByFormats(formats: string[]): Set<string> {
    const results = new Set<string>();
    
    for (const format of formats) {
      const formatResults = this.indexes.byFormat.get(format) || new Set();
      for (const id of formatResults) {
        results.add(id);
      }
    }
    
    return results;
  }

  private searchByQuality(threshold: number): Set<string> {
    const results = new Set<string>();
    
    for (const [range, ids] of this.indexes.byQuality) {
      if (range >= threshold) {
        for (const id of ids) {
          const entry = this.entries.get(id);
          if (entry && entry.quality.overallScore >= threshold) {
            results.add(id);
          }
        }
      }
    }
    
    return results;
  }

  private searchByText(text: string): Set<string> {
    const tokens = text.toLowerCase().split(/\s+/);
    const results = new Set<string>();
    
    for (const token of tokens) {
      const tokenResults = this.indexes.fullText.get(token) || new Set();
      for (const id of tokenResults) {
        results.add(id);
      }
    }
    
    return results;
  }

  private filterByDateRange(candidates: Set<string>, dateRange: { start: Date; end: Date }): Set<string> {
    const filtered = new Set<string>();
    
    for (const id of candidates) {
      const entry = this.entries.get(id);
      if (entry) {
        const created = entry.metadata.created;
        if (created >= dateRange.start && created <= dateRange.end) {
          filtered.add(id);
        }
      }
    }
    
    return filtered;
  }

  private filterBySizeRange(candidates: Set<string>, sizeRange: { min: number; max: number }): Set<string> {
    const filtered = new Set<string>();
    
    for (const id of candidates) {
      const entry = this.entries.get(id);
      if (entry) {
        const size = entry.metadata.size;
        if (size >= sizeRange.min && size <= sizeRange.max) {
          filtered.add(id);
        }
      }
    }
    
    return filtered;
  }

  private scoreResult(entry: CatalogEntry, query: SearchQuery): SearchResult {
    let score = 0;
    const highlights: string[] = [];
    const matchedFields: string[] = [];

    // Text relevance
    if (query.text) {
      const queryTokens = query.text.toLowerCase().split(/\s+/);
      const entryText = `${entry.metadata.name} ${entry.metadata.description}`.toLowerCase();
      
      for (const token of queryTokens) {
        if (entryText.includes(token)) {
          score += 10;
          highlights.push(token);
          if (entry.metadata.name.toLowerCase().includes(token)) {
            matchedFields.push('name');
            score += 5; // Bonus for name match
          }
          if (entry.metadata.description.toLowerCase().includes(token)) {
            matchedFields.push('description');
          }
        }
      }
    }

    // Tag matches
    if (query.tags) {
      const matchedTags = query.tags.filter(tag => entry.metadata.tags.includes(tag));
      score += matchedTags.length * 15;
      highlights.push(...matchedTags);
      if (matchedTags.length > 0) {
        matchedFields.push('tags');
      }
    }

    // Quality bonus
    score += entry.quality.overallScore / 10;

    // Popularity bonus
    score += Math.log(entry.usage.accessCount + 1) * 2;

    // Rating bonus
    if (entry.usage.totalRatings > 0) {
      score += entry.usage.avgRating * 2;
    }

    return {
      entry,
      score,
      highlights: Array.from(new Set(highlights)),
      matchedFields: Array.from(new Set(matchedFields)),
    };
  }

  private sortResults(results: SearchResult[], sortBy: string, sortOrder: string): void {
    results.sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'relevance':
          comparison = a.score - b.score;
          break;
        case 'date':
          comparison = a.entry.metadata.created.getTime() - b.entry.metadata.created.getTime();
          break;
        case 'size':
          comparison = a.entry.metadata.size - b.entry.metadata.size;
          break;
        case 'quality':
          comparison = a.entry.quality.overallScore - b.entry.quality.overallScore;
          break;
        case 'popularity':
          comparison = a.entry.usage.accessCount - b.entry.usage.accessCount;
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }

  private intersectSets<T>(set1: Set<T>, set2: Set<T>): Set<T> {
    const result = new Set<T>();
    for (const item of set1) {
      if (set2.has(item)) {
        result.add(item);
      }
    }
    return result;
  }

  private getDistribution<T>(entries: CatalogEntry[], accessor: (entry: CatalogEntry) => T[]): Record<string, number> {
    const distribution: Record<string, number> = {};
    
    for (const entry of entries) {
      const values = accessor(entry);
      for (const value of values) {
        const key = String(value);
        distribution[key] = (distribution[key] || 0) + 1;
      }
    }
    
    return distribution;
  }

  private validateEntry(entry: any): entry is CatalogEntry {
    return entry && 
           typeof entry.id === 'string' &&
           entry.metadata &&
           entry.location &&
           entry.usage &&
           entry.relationships &&
           entry.quality &&
           entry.lineage;
  }

  private convertToCsv(entries: CatalogEntry[]): string {
    const headers = [
      'ID', 'Name', 'Description', 'Generator', 'Size', 'Records', 'Quality Score',
      'Access Count', 'Rating', 'Created', 'Tags', 'Formats'
    ];

    const rows = entries.map(entry => [
      entry.id,
      entry.metadata.name,
      entry.metadata.description,
      entry.metadata.generator,
      entry.metadata.size,
      entry.metadata.recordCount,
      entry.quality.overallScore.toFixed(1),
      entry.usage.accessCount,
      entry.usage.avgRating.toFixed(1),
      entry.metadata.created.toISOString(),
      entry.metadata.tags.join(';'),
      entry.location.format.join(';'),
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private async ensureDirectoryExists(dir: string): Promise<void> {
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }
  }
}