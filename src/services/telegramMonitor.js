/**
 * ═══════════════════════════════════════════════════════════════════
 * TELEGRAM CONNECTIVITY MONITORING - ADMIN UTILITIES
 * ═══════════════════════════════════════════════════════════════════
 *
 * J01 (Phase 11): Telegram tokens are no longer in browser bundles.
 * Diagnostic and monitor operations now route through the BFF at
 * /telegram/send-message. initTelegramMonitor() no longer requires
 * token/chatId — it degrades gracefully when BFF is unavailable.
 *
 * QUICK START (post-J01):
 * - In browser console: window.__TelegramMonitor.testConnection()
 * - Enable monitoring: window.__TelegramMonitor.startMonitoring()
 * - Check status: window.__TelegramMonitor.getStatus()
 */

import { testTelegramConnectivity, enableContinuousMonitoring, formatDiagnosticsReport } from './telegramDiagnostics.js';

export class TelegramMonitor {
  constructor() {
    this.lastDiagnostics = null;
    this.monitoringActive = false;
    this.monitoringInterval = null;
    this.errorLog = [];
    this.successLog = [];
  }

  /**
   * Run connectivity test (BFF proxy route — no token needed)
   */
  async testConnection() {
    console.log('🔍 Running Telegram connectivity test via BFF...');
    try {
      const diagnostics = await testTelegramConnectivity();
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
   * Start continuous monitoring via BFF proxy
   */
  async startMonitoring(intervalMinutes = 60) {
    console.log(`🔄 Starting Telegram monitoring (every ${intervalMinutes} minutes) via BFF...`);

    if (this.monitoringActive) {
      console.warn('⚠️ Monitoring already active');
      return;
    }

    this.monitoringActive = true;
    const controller = await enableContinuousMonitoring(intervalMinutes);
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
}

/**
 * Initialize and expose monitor to window (J01 — no token required)
 * Token-free: diagnostics now route through BFF at /telegram/send-message
 */
export function initTelegramMonitor() {
  const monitor = new TelegramMonitor();
  window.__TelegramMonitor = monitor;

  console.log('✅ Telegram Monitor initialized (BFF proxy mode — no token in bundle)');
  console.log('Available commands:');
  console.log('  - window.__TelegramMonitor.testConnection()');
  console.log('  - window.__TelegramMonitor.startMonitoring(intervalMinutes)');
  console.log('  - window.__TelegramMonitor.stopMonitoring()');
  console.log('  - window.__TelegramMonitor.getStatus()');
  console.log('  - window.__TelegramMonitor.exportDiagnostics()');
  console.log('  - window.__TelegramMonitor.getReport()');

  return monitor;
}
