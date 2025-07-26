import { WebSocketServer } from '../server/websocket.server';
import { WebSocketMessage, MessageType, ChannelType } from '../types';

/**
 * WebSocket Server Demo
 * Example usage of the WebSocket server
 */
async function runWebSocketDemo() {
  console.log('Starting WebSocket Server Demo...');

  // Create WebSocket server
  const wsServer = new WebSocketServer();

  // Set up event listeners
  wsServer.on('server_started', (port) => {
    console.log(`✅ WebSocket server started on port ${port}`);
    
    // Start demo scenarios
    setTimeout(() => runDemoScenarios(wsServer), 1000);
  });

  wsServer.on('connection', (connection) => {
    console.log(`🔗 New connection: ${connection.id}`);
  });

  wsServer.on('disconnect', (connection, reason) => {
    console.log(`🔌 Connection disconnected: ${connection.id}, reason: ${reason}`);
  });

  wsServer.on('authenticate', (connection, auth) => {
    console.log(`🔐 User authenticated: ${connection.userId}`);
  });

  wsServer.on('subscribe', (connection, channelId, filters) => {
    console.log(`📡 User ${connection.userId} subscribed to channel: ${channelId}`);
  });

  wsServer.on('message_broadcast', (channelId, _message, sentCount) => {
    console.log(`📢 Message broadcast to channel ${channelId}, sent to ${sentCount} subscribers`);
  });

  wsServer.on('metrics', (metrics) => {
    console.log('📊 Server Metrics:', {
      connections: metrics.totalConnections,
      activeConnections: metrics.activeConnections,
      channels: metrics.channels.length,
      queueSize: metrics.performance.messageQueueSize,
    });
  });

  try {
    // Start the server
    await wsServer.start();
  } catch (error) {
    console.error('❌ Failed to start WebSocket server:', error);
    process.exit(1);
  }

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down WebSocket server...');
    await wsServer.stop();
    process.exit(0);
  });
}

/**
 * Run demo scenarios
 */
async function runDemoScenarios(wsServer: WebSocketServer) {
  console.log('\n🎬 Starting Demo Scenarios...');

  // Demo 1: Broadcast market data
  await demoMarketDataBroadcast(wsServer);

  // Demo 2: Send notifications
  await demoNotifications(wsServer);

  // Demo 3: System announcements
  await demoSystemAnnouncements(wsServer);

  // Demo 4: Queue messages for offline users
  await demoMessageQueue(wsServer);
}

/**
 * Demo 1: Market Data Broadcasting
 */
async function demoMarketDataBroadcast(wsServer: WebSocketServer) {
  console.log('\n📈 Demo 1: Market Data Broadcasting');

  const marketDataMessages = [
    {
      symbol: 'AAPL',
      price: 150.25,
      change: 2.15,
      changePercent: 1.45,
      volume: 45000000,
      high: 151.50,
      low: 149.80,
      open: 149.90,
      previousClose: 148.10,
      exchange: 'NASDAQ',
    },
    {
      symbol: 'GOOGL',
      price: 2750.80,
      change: -15.20,
      changePercent: -0.55,
      volume: 12000000,
      high: 2765.00,
      low: 2740.50,
      open: 2755.30,
      previousClose: 2766.00,
      exchange: 'NASDAQ',
    },
    {
      symbol: 'TSLA',
      price: 850.75,
      change: 25.50,
      changePercent: 3.09,
      volume: 35000000,
      high: 855.00,
      low: 830.25,
      open: 835.00,
      previousClose: 825.25,
      exchange: 'NASDAQ',
    },
  ];

  for (const data of marketDataMessages) {
    const message: Omit<WebSocketMessage, 'id' | 'timestamp'> = {
      type: MessageType.PRICE_UPDATE,
      channel: 'market-data',
      data,
      metadata: {
        source: 'market-data-feed',
        priority: 'normal',
      },
    };

    const sentCount = wsServer.broadcastToChannel('market-data', message);
    console.log(`📊 Sent ${data.symbol} price update to ${sentCount} subscribers`);

    // Wait between messages
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * Demo 2: User Notifications
 */
async function demoNotifications(wsServer: WebSocketServer) {
  console.log('\n🔔 Demo 2: User Notifications');

  const notifications = [
    {
      id: 'notif-1',
      type: 'price_alert' as any,
      title: 'Price Alert: AAPL',
      message: 'AAPL has reached your target price of $150.00',
      priority: 'high' as any,
      data: { symbol: 'AAPL', targetPrice: 150.00 },
    },
    {
      id: 'notif-2',
      type: 'portfolio_alert' as any,
      title: 'Portfolio Update',
      message: 'Your portfolio value has increased by 2.5% today',
      priority: 'normal' as any,
      data: { change: 2.5, value: 125000 },
    },
    {
      id: 'notif-3',
      type: 'system_alert' as any,
      title: 'System Maintenance',
      message: 'Scheduled maintenance will begin in 30 minutes',
      priority: 'low' as any,
      data: { maintenanceTime: '30 minutes' },
    },
  ];

  for (const notification of notifications) {
    const message: Omit<WebSocketMessage, 'id' | 'timestamp'> = {
      type: MessageType.NOTIFICATION,
      channel: 'notifications',
      data: notification,
      metadata: {
        source: 'notification-service',
        priority: notification.priority,
      },
    };

    // Simulate sending to specific users (in real app, you'd have user IDs)
    const mockUserId = 'user-123';
    const sentCount = wsServer.sendToUser(mockUserId, message);
    console.log(`🔔 Sent notification "${notification.title}" to ${sentCount} connections`);

    await new Promise(resolve => setTimeout(resolve, 1500));
  }
}

/**
 * Demo 3: System Announcements
 */
async function demoSystemAnnouncements(wsServer: WebSocketServer) {
  console.log('\n📢 Demo 3: System Announcements');

  const announcements = [
    {
      title: 'Welcome to YieldSensei',
      message: 'Real-time market data and portfolio management platform',
      priority: 'normal' as any,
    },
    {
      title: 'New Features Available',
      message: 'Check out our new advanced charting and analysis tools',
      priority: 'high' as any,
    },
    {
      title: 'Market Hours',
      message: 'US markets are now open for trading',
      priority: 'normal' as any,
    },
  ];

  for (const announcement of announcements) {
    const message: Omit<WebSocketMessage, 'id' | 'timestamp'> = {
      type: MessageType.NOTIFICATION,
      channel: 'system',
      data: announcement,
      metadata: {
        source: 'system-service',
        priority: announcement.priority,
      },
    };

    const sentCount = wsServer.broadcastToChannel('system', message);
    console.log(`📢 System announcement "${announcement.title}" sent to ${sentCount} subscribers`);

    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

/**
 * Demo 4: Message Queue for Offline Users
 */
async function demoMessageQueue(wsServer: WebSocketServer) {
  console.log('\n📬 Demo 4: Message Queue for Offline Users');

  const offlineMessages = [
    {
      title: 'Missed Alert',
      message: 'You missed a price alert while offline',
      priority: 'high' as any,
    },
    {
      title: 'Portfolio Summary',
      message: 'Your daily portfolio summary is ready',
      priority: 'normal' as any,
    },
  ];

  for (const msg of offlineMessages) {
    const message: WebSocketMessage = {
      id: `queue-${Date.now()}`,
      type: MessageType.NOTIFICATION,
      channel: 'notifications',
      data: msg,
      timestamp: new Date(),
      metadata: {
        source: 'queue-service',
        priority: msg.priority,
      },
    };

    // Queue message for offline user
    const mockUserId = 'offline-user-456';
    wsServer.queueMessage(mockUserId, 'notifications', message, 1);
    console.log(`📬 Queued message "${msg.title}" for offline user ${mockUserId}`);

    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}

/**
 * Demo 5: Channel Management
 */
async function demoChannelManagement(wsServer: WebSocketServer) {
  console.log('\n📡 Demo 5: Channel Management');

  // Get server status
  const status = wsServer.getStatus();
  console.log('📊 Server Status:', status);

  // Get metrics
  const metrics = wsServer.getMetrics();
  console.log('📈 Server Metrics:', {
    totalConnections: metrics.totalConnections,
    activeConnections: metrics.activeConnections,
    totalChannels: metrics.channels.length,
    queueSize: metrics.performance.messageQueueSize,
    memoryUsage: `${Math.round(metrics.performance.memoryUsage / 1024 / 1024)}MB`,
  });
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runWebSocketDemo().catch(console.error);
}

export { runWebSocketDemo, demoMarketDataBroadcast, demoNotifications, demoSystemAnnouncements, demoMessageQueue, demoChannelManagement }; 