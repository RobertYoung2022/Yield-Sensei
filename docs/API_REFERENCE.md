# SnikDis Crypto API Reference
## Your DeFi, Your Way: Powered by SnikDis Crypto

Welcome to the SnikDis Crypto API reference. Our comprehensive API provides programmatic access to all platform features, enabling developers to integrate AI-powered DeFi portfolio management into their applications.

## 🚀 **Quick Start**

### **Authentication**
```bash
# Get your API key from the SnikDis Crypto dashboard
curl -H "Authorization: Bearer YOUR_API_KEY" \
  https://api.snikdis.com/v1/status
```

### **Base URL**
```
Production: https://api.snikdis.com/v1
Sandbox: https://api-sandbox.snikdis.com/v1
```

### **Rate Limits**
- **Free Tier**: 1,000 requests/hour
- **Pro Tier**: 10,000 requests/hour
- **Institutional**: 100,000 requests/hour

## 📊 **Portfolio Management**

### **Get Portfolio Overview**
```http
GET /portfolios/{portfolio_id}
```

**Response:**
```json
{
  "id": "portfolio_123",
  "name": "My DeFi Portfolio",
  "totalValue": 25000.50,
  "totalValue24h": 25250.75,
  "change24h": 1.0,
  "riskScore": 0.35,
  "satellites": {
    "sage": "active",
    "aegis": "active",
    "forge": "active",
    "pulse": "active",
    "bridge": "active",
    "oracle": "active",
    "echo": "active",
    "fuel": "active"
  },
  "positions": [
    {
      "id": "pos_1",
      "protocol": "Uniswap V3",
      "asset": "ETH/USDC",
      "value": 5000.00,
      "apy": 12.5,
      "riskLevel": "low"
    }
  ],
  "lastUpdated": "2024-01-15T10:30:00Z"
}
```

### **Create Portfolio**
```http
POST /portfolios
```

**Request Body:**
```json
{
  "name": "My New Portfolio",
  "riskTolerance": "moderate",
  "targetReturn": 15.0,
  "initialDeposit": 10000.00,
  "preferences": {
    "maxDrawdown": 20.0,
    "preferredChains": ["ethereum", "polygon"],
    "excludedProtocols": ["protocol1", "protocol2"]
  }
}
```

### **Update Portfolio Settings**
```http
PUT /portfolios/{portfolio_id}/settings
```

## 🛰️ **Satellite Operations**

### **SAGE - Market Research**

#### **Analyze Protocol**
```http
POST /satellites/sage/analyze
```

**Request Body:**
```json
{
  "protocolId": "uniswap_v3",
  "analysisType": "comprehensive",
  "includeRWA": true,
  "jurisdiction": "US"
}
```

**Response:**
```json
{
  "protocolId": "uniswap_v3",
  "overallScore": 8.5,
  "riskAssessment": {
    "riskLevel": "low",
    "riskScore": 0.25,
    "factors": [
      {
        "factor": "TVL Stability",
        "score": 0.9,
        "description": "High TVL stability indicates strong protocol health"
      }
    ]
  },
  "recommendations": [
    {
      "type": "buy",
      "confidence": 0.85,
      "reasoning": "Strong fundamentals across all metrics",
      "timeframe": "long",
      "riskLevel": "low"
    }
  ],
  "compliance": {
    "usCompliant": true,
    "euCompliant": true,
    "regulatoryScore": 0.9
  }
}
```

#### **Research Market**
```http
POST /satellites/sage/research
```

**Request Body:**
```json
{
  "topic": "DeFi yield farming trends",
  "jurisdiction": "US",
  "timeframe": "30d",
  "includeSentiment": true
}
```

### **AEGIS - Risk Management**

#### **Get Risk Assessment**
```http
GET /satellites/aegis/risk/{portfolio_id}
```

**Response:**
```json
{
  "portfolioId": "portfolio_123",
  "overallRisk": "medium",
  "riskScore": 0.35,
  "riskFactors": [
    {
      "category": "Concentration Risk",
      "description": "High exposure to single protocol",
      "impact": "medium",
      "probability": 0.3,
      "mitigation": "Consider diversification"
    }
  ],
  "alerts": [
    {
      "type": "liquidation_warning",
      "severity": "medium",
      "message": "Position approaching liquidation threshold",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  ]
}
```

#### **Set Risk Parameters**
```http
PUT /satellites/aegis/risk/{portfolio_id}/parameters
```

**Request Body:**
```json
{
  "maxDrawdown": 20.0,
  "liquidationThreshold": 0.8,
  "correlationLimit": 0.7,
  "concentrationLimit": 0.3
}
```

### **PULSE - Yield Optimization**

#### **Get Yield Opportunities**
```http
GET /satellites/pulse/opportunities
```

**Query Parameters:**
- `minApy` (number): Minimum APY threshold
- `riskLevel` (string): Risk tolerance level
- `chains` (array): Preferred blockchain networks
- `protocols` (array): Preferred DeFi protocols

**Response:**
```json
{
  "opportunities": [
    {
      "id": "opp_1",
      "protocol": "Aave V3",
      "strategy": "Lending",
      "asset": "USDC",
      "apy": 8.5,
      "riskLevel": "low",
      "liquidity": "high",
      "estimatedReturn": 8.5,
      "recommendedAllocation": 0.2
    }
  ],
  "portfolioOptimization": {
    "currentApy": 6.2,
    "optimizedApy": 8.7,
    "improvement": 2.5,
    "recommendedChanges": [
      {
        "action": "increase_allocation",
        "protocol": "Aave V3",
        "currentAllocation": 0.1,
        "recommendedAllocation": 0.2
      }
    ]
  }
}
```

#### **Execute Strategy**
```http
POST /satellites/pulse/execute
```

**Request Body:**
```json
{
  "portfolioId": "portfolio_123",
  "strategyId": "strategy_456",
  "executionType": "auto",
  "confirmationRequired": false
}
```

### **BRIDGE - Cross-Chain Operations**

#### **Get Arbitrage Opportunities**
```http
GET /satellites/bridge/arbitrage
```

**Response:**
```json
{
  "opportunities": [
    {
      "id": "arb_1",
      "asset": "ETH",
      "sourceChain": "ethereum",
      "targetChain": "polygon",
      "priceDifference": 0.032,
      "estimatedProfit": 320.00,
      "executionTime": "2s",
      "gasCost": 15.50,
      "netProfit": 304.50
    }
  ]
}
```

#### **Execute Cross-Chain Transfer**
```http
POST /satellites/bridge/transfer
```

**Request Body:**
```json
{
  "portfolioId": "portfolio_123",
  "asset": "ETH",
  "amount": 1.0,
  "sourceChain": "ethereum",
  "targetChain": "polygon",
  "executionType": "optimal"
}
```

## 📈 **Analytics & Reporting**

### **Get Portfolio Analytics**
```http
GET /analytics/portfolio/{portfolio_id}
```

**Query Parameters:**
- `timeframe` (string): 1d, 7d, 30d, 90d, 1y
- `metrics` (array): Performance metrics to include

**Response:**
```json
{
  "portfolioId": "portfolio_123",
  "timeframe": "30d",
  "performance": {
    "totalReturn": 12.5,
    "riskAdjustedReturn": 1.8,
    "sharpeRatio": 1.2,
    "maxDrawdown": 8.5,
    "volatility": 15.2
  },
  "satellitePerformance": {
    "sage": {
      "contribution": 2.1,
      "accuracy": 0.85
    },
    "aegis": {
      "riskReduction": 15.0,
      "alertsGenerated": 3
    },
    "pulse": {
      "yieldImprovement": 3.2,
      "strategiesExecuted": 8
    }
  },
  "assetAllocation": {
    "ethereum": 0.4,
    "polygon": 0.3,
    "arbitrum": 0.2,
    "other": 0.1
  }
}
```

### **Get Strategy Performance**
```http
GET /analytics/strategies/{strategy_id}
```

### **Export Report**
```http
GET /analytics/reports/{report_type}
```

**Query Parameters:**
- `format` (string): pdf, csv, json
- `timeframe` (string): Report timeframe
- `includeCharts` (boolean): Include visualizations

## 🔒 **Security & Compliance**

### **Get Compliance Status**
```http
GET /compliance/status/{portfolio_id}
```

**Response:**
```json
{
  "portfolioId": "portfolio_123",
  "overallCompliance": 0.95,
  "jurisdictions": {
    "US": {
      "compliant": true,
      "score": 0.98,
      "requirements": [
        {
          "requirement": "KYC Verification",
          "status": "complete",
          "lastUpdated": "2024-01-15T10:30:00Z"
        }
      ]
    },
    "EU": {
      "compliant": true,
      "score": 0.92,
      "requirements": [
        {
          "requirement": "GDPR Compliance",
          "status": "complete",
          "lastUpdated": "2024-01-15T10:30:00Z"
        }
      ]
    }
  },
  "auditTrail": {
    "lastAudit": "2024-01-15T10:30:00Z",
    "nextAudit": "2024-02-15T10:30:00Z",
    "complianceScore": 0.95
  }
}
```

### **Get Security Alerts**
```http
GET /security/alerts
```

## 🔧 **Webhooks**

### **Configure Webhooks**
```http
POST /webhooks
```

**Request Body:**
```json
{
  "url": "https://your-app.com/webhooks",
  "events": ["portfolio.updated", "risk.alert", "yield.opportunity"],
  "secret": "your_webhook_secret",
  "description": "My app webhook"
}
```

### **Webhook Events**

#### **Portfolio Updated**
```json
{
  "event": "portfolio.updated",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "portfolioId": "portfolio_123",
    "totalValue": 25000.50,
    "change24h": 1.0,
    "riskScore": 0.35
  }
}
```

#### **Risk Alert**
```json
{
  "event": "risk.alert",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "portfolioId": "portfolio_123",
    "alertType": "liquidation_warning",
    "severity": "medium",
    "message": "Position approaching liquidation threshold",
    "positionId": "pos_1"
  }
}
```

#### **Yield Opportunity**
```json
{
  "event": "yield.opportunity",
  "timestamp": "2024-01-15T10:30:00Z",
  "data": {
    "portfolioId": "portfolio_123",
    "opportunityId": "opp_1",
    "protocol": "Aave V3",
    "apy": 8.5,
    "estimatedReturn": 8.5,
    "riskLevel": "low"
  }
}
```

## 📱 **Mobile API**

### **Get Mobile Portfolio Summary**
```http
GET /mobile/portfolio/{portfolio_id}/summary
```

### **Get Push Notifications**
```http
GET /mobile/notifications
```

## 🚀 **SDK Libraries**

### **JavaScript/TypeScript**
```bash
npm install @snikdis/sdk
```

```javascript
import { SnikDisClient } from '@snikdis/sdk';

const client = new SnikDisClient({
  apiKey: 'your_api_key',
  environment: 'production'
});

// Get portfolio
const portfolio = await client.portfolios.get('portfolio_123');

// Analyze protocol
const analysis = await client.satellites.sage.analyze({
  protocolId: 'uniswap_v3'
});

// Get yield opportunities
const opportunities = await client.satellites.pulse.getOpportunities({
  minApy: 5.0,
  riskLevel: 'low'
});
```

### **Python**
```bash
pip install snikdis-sdk
```

```python
from snikdis import SnikDisClient

client = SnikDisClient(
    api_key='your_api_key',
    environment='production'
)

# Get portfolio
portfolio = client.portfolios.get('portfolio_123')

# Analyze protocol
analysis = client.satellites.sage.analyze({
    'protocolId': 'uniswap_v3'
})

# Get yield opportunities
opportunities = client.satellites.pulse.get_opportunities({
    'minApy': 5.0,
    'riskLevel': 'low'
})
```

### **Go**
```bash
go get github.com/snikdis/sdk-go
```

```go
package main

import (
    "github.com/snikdis/sdk-go"
)

func main() {
    client := snikdis.NewClient(&snikdis.Config{
        APIKey: "your_api_key",
        Environment: "production",
    })

    // Get portfolio
    portfolio, err := client.Portfolios.Get("portfolio_123")
    if err != nil {
        panic(err)
    }

    // Analyze protocol
    analysis, err := client.Satellites.Sage.Analyze(&snikdis.AnalyzeRequest{
        ProtocolID: "uniswap_v3",
    })
    if err != nil {
        panic(err)
    }
}
```

## 🔍 **Error Handling**

### **Error Response Format**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Please try again later.",
    "details": {
      "limit": 1000,
      "reset": "2024-01-15T11:00:00Z"
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### **Common Error Codes**
- `INVALID_API_KEY` - API key is invalid or expired
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `INVALID_REQUEST` - Request format is invalid
- `PORTFOLIO_NOT_FOUND` - Portfolio does not exist
- `INSUFFICIENT_PERMISSIONS` - Insufficient permissions for operation
- `SATELLITE_UNAVAILABLE` - Satellite service temporarily unavailable

## 📊 **Rate Limits**

### **Free Tier**
- **Portfolio Operations**: 100 requests/hour
- **Satellite Operations**: 50 requests/hour
- **Analytics**: 25 requests/hour
- **Webhooks**: 10 webhooks

### **Pro Tier**
- **Portfolio Operations**: 1,000 requests/hour
- **Satellite Operations**: 500 requests/hour
- **Analytics**: 250 requests/hour
- **Webhooks**: 100 webhooks

### **Institutional Tier**
- **Portfolio Operations**: 10,000 requests/hour
- **Satellite Operations**: 5,000 requests/hour
- **Analytics**: 2,500 requests/hour
- **Webhooks**: 1,000 webhooks

## 🔗 **Support & Resources**

### **API Status**
- **Status Page**: [status.snikdis.com](https://status.snikdis.com)
- **API Health**: `GET /status`

### **Documentation**
- **Interactive Docs**: [docs.snikdis.com/api](https://docs.snikdis.com/api)
- **SDK Documentation**: [docs.snikdis.com/sdk](https://docs.snikdis.com/sdk)
- **Webhook Guide**: [docs.snikdis.com/webhooks](https://docs.snikdis.com/webhooks)

### **Support**
- **API Support**: api-support@snikdis.com
- **Developer Discord**: [discord.gg/snikdis-dev](https://discord.gg/snikdis-dev)
- **GitHub Issues**: [github.com/snikdis/api-issues](https://github.com/snikdis/api-issues)

---

**SnikDis Crypto** - Your DeFi, Your Way: Powered by SnikDis Crypto

*Transform your DeFi experience with AI-driven simplicity.* 