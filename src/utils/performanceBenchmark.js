/* eslint-disable no-console */
/**
 * ═══════════════════════════════════════════════════════════════════
 * STAGE 3: DATA LOAD TEST - FPS & RAM MONITORING
 * ═══════════════════════════════════════════════════════════════════
 * Simulates loading 500 dummy traders into grid
 * Monitors RAM usage and frame rate (FPS)
 * Suggests optimizations if FPS drops below 60
 * 
 * Usage:
 *   import { runDataLoadTest } from './performanceBenchmark.js';
 *   const results = await runDataLoadTest(500);
 *   console.log(results);
 */

const BENCHMARK_CONFIG = {
  dummyTraderCount: 500,
  renderUpdateInterval: 100, // ms between render updates
  fpsThreshold: 60,
  ramThreshold: 100, // MB
  testDuration: 30000, // 30 seconds
};

let benchmarkState = {
  isRunning: false,
  frameCount: 0,
  fps: 0,
  ramUsage: 0,
  peakRam: 0,
  minFps: 60,
  maxFps: 0,
  fpsHistory: [],
  ramHistory: [],
  renderMetrics: [],
  gridNodes: [],
  bottlenecks: [],
};

/**
 * Generate dummy trader data
 */
function generateDummyTraders(count = 500) {
  const traders = [];
  const statuses = ['ACTIVE', 'PENDING', 'PAUSED', 'LIQUIDATED'];
  const strategies = ['Long Only', 'Short Only', 'Pairs Trading', 'Grid Trading', 'DCA'];

  for (let i = 0; i < count; i++) {
    traders.push({
      uid: `dummy_trader_${i}`,
      fullName: `Dummy Trader ${i + 1}`,
      email: `dummy${i}@tradersapp.com`,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      balance: Math.floor(Math.random() * 100000) + 1000,
      initialDeposit: Math.floor(Math.random() * 50000) + 500,
      strategy: strategies[Math.floor(Math.random() * strategies.length)],
      profitLoss: (Math.random() - 0.5) * 50000,
      roi: (Math.random() - 0.5) * 200,
      joinDate: new Date(Date.now() - Math.random() * 365 * 24 * 60 * 60 * 1000).toISOString(),
      mobile: `+1${Math.floor(Math.random() * 9000000000) + 1000000000}`,
      riskLevel: Math.ceil(Math.random() * 5),
      trades: Math.floor(Math.random() * 1000),
      winRate: Math.random() * 100,
      averageReturn: (Math.random() - 0.5) * 50,
      createdAt: new Date().toISOString(),
      lastLogin: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    });
  }

  return traders;
}

/**
 * Get RAM usage (only in Node.js environments)
 */
function getRamUsage() {
  if (typeof performance === 'undefined' || !performance.memory) {
    // Browser environment - estimate from DOM nodes
    return (document.querySelectorAll('*').length * 0.001).toFixed(2); // Rough estimate in MB
  }
  
  // Node.js environment
  const used = Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
  return used;
}

/**
 * Calculate FPS using requestAnimationFrame
 */
function startFpsMonitoring() {
  benchmarkState.frameCount = 0;
  benchmarkState.fpsHistory = [];
  
  const fpsCheckInterval = setInterval(() => {
    benchmarkState.fps = benchmarkState.frameCount;
    benchmarkState.fpsHistory.push(benchmarkState.fps);
    
    if (benchmarkState.fps < benchmarkState.minFps) {
      benchmarkState.minFps = benchmarkState.fps;
    }
    if (benchmarkState.fps > benchmarkState.maxFps) {
      benchmarkState.maxFps = benchmarkState.fps;
    }
    
    benchmarkState.frameCount = 0;
  }, 1000);
  
  const frameCounter = () => {
    if (benchmarkState.isRunning) {
      benchmarkState.frameCount++;
      requestAnimationFrame(frameCounter);
    }
  };
  
  requestAnimationFrame(frameCounter);
  
  return fpsCheckInterval;
}

/**
 * Create DOM grid with trader rows
 */
function createTraderGrid(traders) {
  const gridContainer = document.createElement('div');
  gridContainer.id = 'benchmark-grid-container';
  gridContainer.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(10, 10, 15, 0.9);
    z-index: 9999;
    overflow-y: auto;
    display: none;
  `;

  // Create header
  const header = document.createElement('div');
  header.style.cssText = `
    display: grid;
    grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
    gap: 10px;
    padding: 16px;
    position: sticky;
    top: 0;
    background: rgba(191,90,242,0.1);
    border-bottom: 1px solid rgba(191,90,242,0.3);
    font-weight: 700;
    color: #BF5AF2;
  `;
  header.innerHTML = `
    <div>Name</div>
    <div>Status</div>
    <div>Balance</div>
    <div>P&L</div>
    <div>Win Rate</div>
  `;
  gridContainer.appendChild(header);

  // Create rows
  const rowsContainer = document.createElement('div');
  rowsContainer.id = 'benchmark-rows';
  rowsContainer.style.cssText = `
    display: contents;
  `;

  traders.forEach((trader, idx) => {
    const row = document.createElement('div');
    row.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr 1fr 1fr 1fr;
      gap: 10px;
      padding: 8px 16px;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      align-items: center;
      font-size: 12px;
      color: #D1D1D6;
    `;
    row.innerHTML = `
      <div>${trader.fullName}</div>
      <div style="color: ${trader.status === 'ACTIVE' ? '#30D158' : '#FFD60A'}">${trader.status}</div>
      <div>$${trader.balance.toFixed(2)}</div>
      <div style="color: ${trader.profitLoss >= 0 ? '#30D158' : '#FF453A'}">${trader.profitLoss.toFixed(2)}</div>
      <div>${trader.winRate.toFixed(1)}%</div>
    `;
    rowsContainer.appendChild(row);

    benchmarkState.renderMetrics.push({
      rowIndex: idx,
      renderTime: 0,
      mounted: true,
    });
  });

  gridContainer.appendChild(rowsContainer);
  benchmarkState.gridNodes.push(gridContainer);
  
  return gridContainer;
}

/**
 * Mount and measure rendering performance
 */
async function renderTraderGrid(grid) {
  return new Promise((resolve) => {
    const startTime = performance.now();
    document.body.appendChild(grid);
    grid.style.display = 'block';

    requestAnimationFrame(() => {
      const endTime = performance.now();
      benchmarkState.renderMetrics.push({
        gridRenderTime: endTime - startTime,
        nodeCount: grid.querySelectorAll('[style]').length,
      });

      resolve(endTime - startTime);
    });
  });
}

/**
 * Monitor performance during grid rendering
 */
function monitorPerformance(duration = 30000) {
  return new Promise((resolve) => {
    const monitoringStartTime = performance.now();

    const monitor = setInterval(() => {
      const ramUsage = getRamUsage();
      benchmarkState.ramUsage = ramUsage;
      benchmarkState.ramHistory.push(ramUsage);

      if (ramUsage > benchmarkState.peakRam) {
        benchmarkState.peakRam = ramUsage;
      }

      // Check for bottlenecks
      if (benchmarkState.fps < BENCHMARK_CONFIG.fpsThreshold) {
        benchmarkState.bottlenecks.push({
          time: performance.now() - monitoringStartTime,
          fps: benchmarkState.fps,
          ram: ramUsage,
          severity: benchmarkState.fps < 30 ? 'CRITICAL' : 'HIGH',
        });
      }

      if (ramUsage > BENCHMARK_CONFIG.ramThreshold) {
        benchmarkState.bottlenecks.push({
          time: performance.now() - monitoringStartTime,
          type: 'HIGH_RAM_USAGE',
          ram: ramUsage,
          severity: ramUsage > 150 ? 'CRITICAL' : 'HIGH',
        });
      }
    }, 500);

    setTimeout(() => {
      clearInterval(monitor);
      resolve();
    }, duration);
  });
}

/**
 * Clean up grid
 */
function cleanupGrid() {
  benchmarkState.gridNodes.forEach(node => {
    if (node && node.parentNode) {
      node.parentNode.removeChild(node);
    }
  });
  benchmarkState.gridNodes = [];
}

/**
 * Detect performance optimizations needed
 */
function detectOptimizations() {
  const recommendations = [];

  if (benchmarkState.minFps < 60) {
    recommendations.push({
      priority: 'HIGH',
      optimization: 'Virtual Scroll / Windowing',
      reason: `FPS dropped to ${benchmarkState.minFps}. Rendering all 500 rows at once is expensive.`,
      implementation: [
        '1. Use react-window for virtualized lists',
        '2. Only render visible rows (50-100)',
        '3. Implement intersection observer for lazy loading',
        'Expected improvement: 2-3x faster rendering',
      ],
      estimatedGain: '20-30ms reduction in render time',
    });
  }

  if (benchmarkState.minFps < 30) {
    recommendations.push({
      priority: 'CRITICAL',
      optimization: 'React.memo on Row Components',
      reason: 'Severe FPS drops detected. Each row re-renders unnecessarily.',
      implementation: [
        '1. Wrap TraderRow in React.memo()',
        '2. Use useCallback for row handlers',
        '3. Move formatters to memoized functions',
        'Expected improvement: 50-60% faster rendering',
      ],
      estimatedGain: '10-50ms reduction depending on row complexity',
    });
  }

  if (benchmarkState.peakRam > 150) {
    recommendations.push({
      priority: 'MEDIUM',
      optimization: 'Data Structure & Memory Cleanup',
      reason: `Peak RAM usage: ${benchmarkState.peakRam}MB. Consider optimizing data structure.`,
      implementation: [
        '1. Use Immer for immutable updates',
        '2. Implement data pagination (load 100 traders at a time)',
        '3. Clear old data from cache after scroll',
        'Expected improvement: 20-40% memory reduction',
      ],
      estimatedGain: '30-50MB memory savings',
    });
  }

  if (benchmarkState.renderMetrics.some(m => m.gridRenderTime > 100)) {
    recommendations.push({
      priority: 'HIGH',
      optimization: 'CSS Optimization',
      reason: 'Grid rendering time is high. CSS calculations may be expensive.',
      implementation: [
        '1. Use CSS Grid instead of Flexbox for large lists',
        '2. Add will-change: transform to rows',
        '3. Use contain: layout for performance hints',
        'Expected improvement: 10-20% render speedup',
      ],
      estimatedGain: '5-20ms reduction per render',
    });
  }

  return recommendations;
}

/**
 * Run complete data load test
 */
export async function runDataLoadTest(traderCount = 500) {
  if (benchmarkState.isRunning) {
    console.warn('⚠️ Data load test already running');
    return null;
  }

  benchmarkState.isRunning = true;
  benchmarkState.minFps = 60;
  benchmarkState.maxFps = 0;
  benchmarkState.frameCount = 0;
  benchmarkState.bottlenecks = [];
  benchmarkState.renderMetrics = [];

  console.log('🚀 Starting Data Load Test...');
  console.log(`📊 Loading ${traderCount} dummy traders`);
  console.log('═'.repeat(70));

  // Start FPS monitoring
  const fpsInterval = startFpsMonitoring();

  // Generate traders
  console.log('📝 Generating trader data...');
  const startGenerate = performance.now();
  const traders = generateDummyTraders(traderCount);
  const generateTime = performance.now() - startGenerate;
  console.log(`✅ Generated ${traderCount} traders in ${generateTime.toFixed(2)}ms`);

  // Create grid
  console.log('🏗️  Creating grid DOM...');
  const startGridCreate = performance.now();
  const grid = createTraderGrid(traders);
  const gridCreateTime = performance.now() - startGridCreate;
  console.log(`✅ Grid created in ${gridCreateTime.toFixed(2)}ms`);

  // Render grid
  console.log('🎨 Rendering grid to DOM...');
  const renderTime = await renderTraderGrid(grid);
  console.log(`✅ Grid rendered in ${renderTime.toFixed(2)}ms`);

  // Monitor performance
  console.log('📊 Monitoring performance for 30 seconds...');
  await monitorPerformance(BENCHMARK_CONFIG.testDuration);

  // Stop FPS monitoring
  clearInterval(fpsInterval);
  benchmarkState.isRunning = false;

  // Get final stats
  const avgFps = benchmarkState.fpsHistory.length > 0
    ? (benchmarkState.fpsHistory.reduce((a, b) => a + b, 0) / benchmarkState.fpsHistory.length).toFixed(2)
    : 0;

  const avgRam = benchmarkState.ramHistory.length > 0
    ? (benchmarkState.ramHistory.reduce((a, b) => a + b, 0) / benchmarkState.ramHistory.length).toFixed(2)
    : 0;

  // Get optimizations
  const optimizations = detectOptimizations();

  // Cleanup
  cleanupGrid();

  const report = {
    timestamp: new Date().toISOString(),
    testType: 'Data Load Test',
    traders_loaded: traderCount,
    duration_seconds: (BENCHMARK_CONFIG.testDuration / 1000).toFixed(1),
    performance: {
      generation: {
        time_ms: generateTime.toFixed(2),
      },
      grid_creation: {
        time_ms: gridCreateTime.toFixed(2),
      },
      grid_render: {
        time_ms: renderTime.toFixed(2),
      },
      fps: {
        current: benchmarkState.fps,
        average: avgFps,
        min: benchmarkState.minFps,
        max: benchmarkState.maxFps,
        status: benchmarkState.minFps >= 60 ? '✅ Excellent' : benchmarkState.minFps >= 30 ? '⚠️ Acceptable' : '❌ Poor',
      },
      ram: {
        current_mb: benchmarkState.ramUsage,
        average_mb: avgRam,
        peak_mb: benchmarkState.peakRam,
        status: benchmarkState.peakRam > 150 ? '⚠️ High' : '✅ Good',
      },
    },
    bottlenecks: benchmarkState.bottlenecks,
    optimizations: optimizations,
    health_score: calculateHealthScore(benchmarkState.minFps, benchmarkState.peakRam),
  };

  console.log('');
  console.log('═'.repeat(70));
  console.log('📊 DATA LOAD TEST RESULTS');
  console.log('═'.repeat(70));
  console.log(`FPS: ${report.performance.fps.average} avg (${report.performance.fps.min}-${report.performance.fps.max})`);
  console.log(`RAM: ${report.performance.ram.peak_mb}MB peak`);
  console.log(`Bottlenecks: ${report.bottlenecks.length}`);
  console.log(`Optimizations suggested: ${report.optimizations.length}`);
  console.log('═'.repeat(70));

  return report;
}

/**
 * Calculate health score
 */
function calculateHealthScore(fps, ram) {
  let score = 100;

  if (fps < 60) score -= (60 - fps) * 0.5;
  if (fps < 30) score -= 20;

  if (ram > 150) score -= (ram - 150) * 0.2;
  if (ram > 200) score -= 20;

  return Math.max(0, Math.min(100, score)).toFixed(2);
}

/**
 * Get current benchmark state
 */
export function getBenchmarkState() {
  return {
    isRunning: benchmarkState.isRunning,
    fps: benchmarkState.fps,
    ram: benchmarkState.ramUsage,
    peakRam: benchmarkState.peakRam,
    bottlenecks: benchmarkState.bottlenecks,
  };
}

/**
 * Export benchmark report
 */
export function exportBenchmarkReport(report, filename = 'performance-benchmark-report.json') {
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
