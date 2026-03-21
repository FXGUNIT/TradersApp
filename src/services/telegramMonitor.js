/* eslint-disable no-console */
/**
 * ═══════════════════════════════════════════════════════════════════
 * TELEGRAM CONNECTIVITY MONITORING - ADMIN UTILITIES
 * ═══════════════════════════════════════════════════════════════════
 * 
 * This module provides utilities for admins to monitor and test
 * Telegram connectivity from the browser console or dashboard.
 * 
 * QUICK START:
 * - In browser console: window.__TelegramMonitor.testConnection()
 * - Enable monitoring: window.__TelegramMonitor.startMonitoring()
 * - Check status: window.__TelegramMonitor.getStatus()
 */

import { testTelegramConnectivity, enableContinuousMonitoring, formatDiagnosticsReport } from './telegramDiagnostics.js';

export class TelegramMonitor {
  constructor(token, chatId) {
    this.token = token;
    this.chatId = chatId;
    this.lastDiagnostics = null;
    this.monitoringActive = false;
    this.monitoringInterval = null;
    this.errorLog = [];
    this.successLog = [];
  }

  /**
   * Run connectivity test
   */
  async testConnection() {
    console.log('🔍 Running Telegram connectivity test...');
    try {
      const diagnostics = await testTelegramConnectivity(this.token, this.chatId);
      this.lastDiagnostics = diagnostics;
      this.successLog.push({
        timestamp: new Date().toISOString(),
        status: diagnostics.summary.status
      });
      return diagnostics;
    } catch (error) {
      this.errorLog.push({
        timestamp: new Date().toISOString(),
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Start continuous monitoring
   */
  async startMonitoring(intervalMinutes = 60) {
    console.log(`🔄 Starting Telegram monitoring (every ${intervalMinutes} minutes)...`);
    
    if (this.monitoringActive) {
      console.warn('⚠️ Monitoring already active');
      return;
    }

    this.monitoringActive = true;
    const controller = await enableContinuousMonitoring(this.token, this.chatId, intervalMinutes);
    this.monitoringInterval = controller;

    // Run initial test
    await this.testConnection();

    return {
      running: true,
      stop: () => this.stopMonitoring()
    };
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (this.monitoringActive && this.monitoringInterval) {
      this.monitoringInterval.stop();
      this.monitoringActive = false;
      console.log('⏹️ Telegram monitoring stopped');
      return true;
    }
    return false;
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      lastDiagnostics: this.lastDiagnostics,
      monitoringActive: this.monitoringActive,
      errorCount: this.errorLog.length,
      successCount: this.successLog.length,
      lastErrors: this.errorLog.slice(-5),
      lastSuccess: this.successLog[this.successLog.length - 1],
      uptime: this.calculateUptime()
    };
  }

  /**
   * Calculate uptime percentage
   */
  calculateUptime() {
    if (this.successLog.length === 0) return 0;
    const total = this.successLog.length + this.errorLog.length;
    return ((this.successLog.length / total) * 100).toFixed(2) + '%';
  }

  /**
   * Get formatted HTML report
   */
  getReport() {
    if (!this.lastDiagnostics) {
      return '<p style="color: red;">No diagnostics run yet. Call testConnection() first.</p>';
    }
    return formatDiagnosticsReport(this.lastDiagnostics);
  }

  /**
   * Export diagnostic data as JSON
   */
  exportDiagnostics() {
    return {
      timestamp: new Date().toISOString(),
      lastDiagnostics: this.lastDiagnostics,
      stats: {
        totalTests: this.successLog.length + this.errorLog.length,
        successes: this.successLog.length,
        failures: this.errorLog.length,
        uptime: this.calculateUptime()
      },
      recentErrors: this.errorLog.slice(-10),
      recentSuccess: this.successLog.slice(-10)
    };
  }

  /**
   * Test specific endpoint
   */
  async testEndpoint(url, method = 'GET', timeout = 5000) {
    const start = performance.now();
    try {
      const response = await Promise.race([
        fetch(url, { method }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), timeout)
        )
      ]);
      const latency = performance.now() - start;
      return {
        success: true,
        latency: latency.toFixed(0) + 'ms',
        status: response.status,
        ok: response.ok
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        latency: (performance.now() - start).toFixed(0) + 'ms'
      };
    }
  }

  /**
   * Performance benchmark
   */
  async benchmark() {
    console.log('📊 Running performance benchmark...');
    
    const results = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test 1: API latency
    console.log('Testing API latency...');
    results.tests.push({
      name: 'API Latency',
      result: await this.testEndpoint(`https://api.telegram.org/bot${this.token}/getMe`)
    });

    // Test 2: Message send latency
    console.log('Testing message send...');
    results.tests.push({
      name: 'Message Send',
      result: await this.testEndpoint(
        `https://api.telegram.org/bot${this.token}/sendMessage`,
        'POST'
      )
    });

    // Test 3: Bulk requests (rate limit test)
    console.log('Testing rate limiting...');
    const bulkStart = performance.now();
    const bulkResults = await Promise.all([
      ...Array(5).fill(null).map(() => 
        this.testEndpoint(`https://api.telegram.org/bot${this.token}/getMe`)
      )
    ]);
    results.tests.push({
      name: 'Bulk Requests (5x)',
      result: {
        totalTime: (performance.now() - bulkStart).toFixed(0) + 'ms',
        averageLatency: (bulkResults.reduce((sum, r) => {
          const ms = parseInt(r.latency);
          return sum + (isNaN(ms) ? 0 : ms);
        }, 0) / 5).toFixed(0) + 'ms',
        successRate: (bulkResults.filter(r => r.success).length / 5 * 100).toFixed(0) + '%'
      }
    });

    console.table(results.tests);
    return results;
  }
}

/**
 * Initialize and expose monitor to window
 */
export function initTelegramMonitor(token, chatId) {
  const monitor = new TelegramMonitor(token, chatId);
  window.__TelegramMonitor = monitor;
  
  console.log('✅ Telegram Monitor initialized');
  console.log('Available commands:');
  console.log('  - window.__TelegramMonitor.testConnection()');
  console.log('  - window.__TelegramMonitor.startMonitoring(intervalMinutes)');
  console.log('  - window.__TelegramMonitor.stopMonitoring()');
  console.log('  - window.__TelegramMonitor.getStatus()');
  console.log('  - window.__TelegramMonitor.benchmark()');
  console.log('  - window.__TelegramMonitor.exportDiagnostics()');
  console.log('  - window.__TelegramMonitor.getReport()');
  
  return monitor;
}
