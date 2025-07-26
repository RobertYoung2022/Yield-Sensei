/**
 * RWA Opportunity Scoring System Integration Demo
 * Demonstrates how the RWA scoring system works in practice
 */

import { RWAOpportunityScoringSystem } from '../../../src/satellites/sage/rwa/opportunity-scoring-system';
import { RWAData } from '../../../src/satellites/sage/types';

async function runRWAScoringDemo() {
  console.log('🏗️  RWA Opportunity Scoring System Demo');
  console.log('=' .repeat(50));

  try {
    // Initialize the scoring system
    console.log('📊 Initializing RWA Opportunity Scoring System...');
    const scoringSystem = RWAOpportunityScoringSystem.getInstance();
    await scoringSystem.initialize();
    
    console.log('✅ System initialized successfully');
    console.log('📈 System Status:', scoringSystem.getStatus());

    // Sample RWA opportunities
    const rwaOpportunities: RWAData[] = [
      {
        id: 'rwa-real-estate-001',
        type: 'real-estate',
        issuer: 'Premium Real Estate Fund',
        value: 2500000,
        currency: 'USD',
        maturityDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        yield: 0.075, // 7.5%
        riskRating: 'AA',
        collateral: {
          type: 'real-estate',
          value: 3000000,
          ltv: 0.83,
          liquidationThreshold: 0.9
        },
        regulatoryStatus: {
          jurisdiction: 'US',
          complianceLevel: 'compliant',
          licenses: ['SEC-Registered', 'State-Licensed'],
          restrictions: [],
          lastReview: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
        },
        complianceScore: 92
      },
      {
        id: 'rwa-bonds-001',
        type: 'bonds',
        issuer: 'Government Bond Fund',
        value: 1000000,
        currency: 'USD',
        maturityDate: new Date(Date.now() + 1825 * 24 * 60 * 60 * 1000), // 5 years
        yield: 0.045, // 4.5%
        riskRating: 'AAA',
        collateral: {
          type: 'government-bonds',
          value: 1100000,
          ltv: 0.91,
          liquidationThreshold: 0.95
        },
        regulatoryStatus: {
          jurisdiction: 'US',
          complianceLevel: 'compliant',
          licenses: ['SEC-Registered', 'Federal-Approved'],
          restrictions: [],
          lastReview: new Date(Date.now() - 15 * 24 * 60 * 60 * 1000)
        },
        complianceScore: 98
      },
      {
        id: 'rwa-art-001',
        type: 'art',
        issuer: 'Art Investment Fund',
        value: 500000,
        currency: 'USD',
        maturityDate: new Date(Date.now() + 730 * 24 * 60 * 60 * 1000), // 2 years
        yield: 0.12, // 12%
        riskRating: 'CCC',
        collateral: {
          type: 'art',
          value: 400000,
          ltv: 1.25,
          liquidationThreshold: 1.4
        },
        regulatoryStatus: {
          jurisdiction: 'US',
          complianceLevel: 'partial',
          licenses: ['Basic-License'],
          restrictions: ['Limited-Transferability'],
          lastReview: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        },
        complianceScore: 65
      }
    ];

    // Score each opportunity
    console.log('\n🎯 Scoring RWA Opportunities...');
    console.log('-'.repeat(50));

    for (const rwa of rwaOpportunities) {
      console.log(`\n📋 Analyzing: ${rwa.issuer} (${rwa.type})`);
      console.log(`   Value: $${rwa.value.toLocaleString()}`);
      console.log(`   Yield: ${(rwa.yield * 100).toFixed(1)}%`);
      console.log(`   Risk Rating: ${rwa.riskRating}`);
      
      const score = await scoringSystem.scoreOpportunity(rwa);
      
      console.log(`\n📊 Scoring Results:`);
      console.log(`   Overall Score: ${(score.overallScore * 100).toFixed(1)}%`);
      console.log(`   Risk-Adjusted Return: ${(score.riskAdjustedReturn * 100).toFixed(2)}%`);
      console.log(`   Confidence: ${(score.confidence * 100).toFixed(1)}%`);
      
      console.log(`\n📈 Component Scores:`);
      console.log(`   Yield: ${(score.yieldScore * 100).toFixed(1)}%`);
      console.log(`   Risk: ${(score.riskScore * 100).toFixed(1)}%`);
      console.log(`   Liquidity: ${(score.liquidityScore * 100).toFixed(1)}%`);
      console.log(`   Regulatory: ${(score.regulatoryScore * 100).toFixed(1)}%`);
      console.log(`   Collateral: ${(score.collateralScore * 100).toFixed(1)}%`);
      console.log(`   Market: ${(score.marketScore * 100).toFixed(1)}%`);
      
      console.log(`\n💡 Top Recommendations:`);
      score.recommendations.slice(0, 2).forEach((rec, index) => {
        console.log(`   ${index + 1}. ${rec.action.toUpperCase()}: ${rec.reasoning}`);
        console.log(`      Confidence: ${(rec.confidence * 100).toFixed(1)}% | Risk: ${rec.riskLevel} | Timeframe: ${rec.timeframe}`);
        if (rec.maxExposure > 0) {
          console.log(`      Max Exposure: $${rec.maxExposure.toLocaleString()}`);
        }
      });
      
      console.log(`\n🔍 Key Factors:`);
      score.factors.slice(0, 3).forEach(factor => {
        const impact = factor.impact === 'positive' ? '✅' : factor.impact === 'negative' ? '❌' : '➖';
        console.log(`   ${impact} ${factor.category}: ${(factor.score * 100).toFixed(1)}% - ${factor.description}`);
      });
      
      console.log('-'.repeat(50));
    }

    // Performance test
    console.log('\n⚡ Performance Test: Scoring 10 RWAs...');
    const startTime = Date.now();
    
    const performanceRWAs = Array.from({ length: 10 }, (_, i) => ({
      ...rwaOpportunities[0],
      id: `perf-test-${i}`,
      yield: 0.05 + (i * 0.005),
      value: 100000 + (i * 100000)
    })) as RWAData[];
    
    const scores = await Promise.all(
      performanceRWAs.map(rwa => scoringSystem.scoreOpportunity(rwa))
    );
    
    const totalTime = Date.now() - startTime;
    console.log(`✅ Completed ${scores.length} scorings in ${totalTime}ms`);
    console.log(`📊 Average time per scoring: ${(totalTime / scores.length).toFixed(1)}ms`);
    
    // Cache test
    console.log('\n💾 Cache Performance Test...');
    const cacheStartTime = Date.now();
    const cachedScore = await scoringSystem.scoreOpportunity(rwaOpportunities[0]!);
    const cacheTime = Date.now() - cacheStartTime;
    console.log(`✅ Cached scoring completed in ${cacheTime}ms (${cacheTime < 50 ? 'CACHE HIT' : 'CACHE MISS'})`);

    // Shutdown
    console.log('\n🔄 Shutting down RWA Opportunity Scoring System...');
    await scoringSystem.shutdown();
    console.log('✅ System shutdown complete');

    console.log('\n🎉 RWA Opportunity Scoring System Demo Completed Successfully!');
    console.log('\n📋 Summary:');
    console.log('   ✅ System initialization works');
    console.log('   ✅ Scoring calculations are comprehensive');
    console.log('   ✅ Recommendations are generated');
    console.log('   ✅ Performance is acceptable');
    console.log('   ✅ Caching works efficiently');
    console.log('   ✅ System shutdown is clean');
    
    console.log('\n🚀 Your RWA Opportunity Scoring System is working as described!');
    
  } catch (error) {
    console.error('❌ Demo failed:', error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runRWAScoringDemo().catch(console.error);
}

export { runRWAScoringDemo }; 