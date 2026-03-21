/* eslint-disable no-console */
/**
 * ═══════════════════════════════════════════════════════════════════
 * STEP 1: UI INTEGRITY AUDIT - THE CRAWLER
 * ═══════════════════════════════════════════════════════════════════
 * Simulates clicks on every icon, button, and navigable element
 * Tracks component load status and render errors
 * 
 * Usage:
 *   import { runUICrawler, getCrawlerReport } from './uiAuditCrawler.js';
 *   
 *   // In component:
 *   const report = await runUICrawler({ verbose: true });
 *   console.log(getCrawlerReport());
 */

const AUDIT_CONFIG = {
  clickDelay: 300,           // ms between clicks
  loadTimeout: 5000,         // ms to wait for component load
  retries: 2,                // Retry failed clicks
  verbose: false,            // Log each click
  excludePatterns: ['logout', 'delete-account', 'factory-reset'],
};

// Storage for audit results
let crawlerResults = {
  timestamp: null,
  totalElements: 0,
  clickedElements: 0,
  failedElements: [],
  errors: [],
  componentsScanned: new Map(),
  accessibilityIssues: [],
  performanceMetrics: {},
};

/**
 * Detect if element is clickable (button, link, input, etc.)
 */
function isClickable(el) {
  if (!el) return false;
  const tagName = el.tagName.toLowerCase();
  const clickableTags = ['button', 'a', 'input', 'select', 'textarea', 'label'];
  const role = el.getAttribute('role');
  const isRoleClickable = role && ['button', 'link', 'tab', 'menuitem'].includes(role);
  
  return clickableTags.includes(tagName) || isRoleClickable || el.onclick !== null;
}

/**
 * Find all clickable elements in sidebar
 */
function findSidebarElements() {
  const sidebar = document.querySelector('[data-testid="sidebar"]') || 
                  document.querySelector('nav') ||
                  document.querySelector('[role="navigation"]');
  
  if (!sidebar) return [];
  
  return Array.from(sidebar.querySelectorAll('button, a, [role="button"], [role="link"], [role="tab"]'));
}

/**
 * Find all clickable elements in command palette
 */
function findCommandPaletteElements() {
  const paletteTrigger = document.querySelector('[data-testid="command-palette"]') ||
                         document.querySelector('[title*="Command"]') ||
                         Array.from(document.querySelectorAll('button')).find(b => 
                           b.textContent.includes('⌘') || b.getAttribute('aria-label')?.includes('command')
                         );
  
  if (!paletteTrigger) return [];
  return [paletteTrigger];
}

/**
 * Find all clickable elements in admin table
 */
function findAdminTableElements() {
  const table = document.querySelector('table') ||
                document.querySelector('[role="grid"]') ||
                document.querySelector('[data-testid="admin-table"]');
  
  if (!table) return [];
  
  return Array.from(table.querySelectorAll('button, a, [role="button"], input[type="checkbox"]'));
}

/**
 * Find all icon elements with accessibility issues
 */
function findIconsWithAccessibilityIssues() {
  const icons = Array.from(document.querySelectorAll('[class*="icon"], svg, img[alt=""], [role="img"]'));
  const issues = [];
  
  icons.forEach(icon => {
    const parent = icon.closest('button, a, [role="button"], [role="link"]');
    if (!parent) return;
    
    const hasAriaLabel = parent.getAttribute('aria-label') || parent.getAttribute('aria-labelledby');
    const hasTitle = parent.getAttribute('title');
    const hasTextContent = parent.textContent.trim().length > 0;
    
    if (!hasAriaLabel && !hasTitle && !hasTextContent) {
      issues.push({
        element: parent,
        issue: 'Missing aria-label for icon button',
        severity: 'high',
        selector: getElementSelector(parent),
      });
    }
  });
  
  return issues;
}

/**
 * Get unique selector for element
 */
function getElementSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.className) return `.${el.className.split(' ')[0]}`;
  return el.tagName.toLowerCase();
}

/**
 * Simulate click with error tracking
 */
async function simulateClick(element, config = AUDIT_CONFIG) {
  return new Promise((resolve) => {
    try {
      const selector = getElementSelector(element);
      const ariaLabel = element.getAttribute('aria-label') || element.getAttribute('title') || element.textContent.slice(0, 30);
      
      if (config.verbose) {
        console.log(`🖱️  Clicking: ${ariaLabel || selector}`);
      }
      
      // Record component state before click
      const beforeState = {
        innerHTML: element.innerHTML,
        className: element.className,
        disabled: element.disabled,
        ariaLabel: element.getAttribute('aria-label'),
      };
      
      // Simulate click
      const clickEvent = new MouseEvent('click', {
        bubbles: true,
        cancelable: true,
        view: window,
      });
      
      const startTime = performance.now();
      element.dispatchEvent(clickEvent);
      
      // Wait for component to respond
      setTimeout(() => {
        const endTime = performance.now();
        const loadTime = endTime - startTime;
        
        crawlerResults.componentsScanned.set(selector, {
          ariaLabel,
          loadTime,
          hasAriaLabel: !!beforeState.ariaLabel,
          disabled: beforeState.disabled,
          clickable: isClickable(element),
        });
        
        crawlerResults.performanceMetrics[selector] = loadTime;
        crawlerResults.clickedElements++;
        
        resolve({
          success: true,
          selector,
          loadTime,
          error: null,
        });
      }, config.loadTimeout);
      
    } catch (error) {
      crawlerResults.errors.push({
        element: getElementSelector(element),
        error: error.message,
        type: 'CLICK_ERROR',
      });
      
      resolve({
        success: false,
        selector: getElementSelector(element),
        error: error.message,
      });
    }
  });
}

/**
 * Main crawler function
 */
export async function runUICrawler(options = {}) {
  const config = { ...AUDIT_CONFIG, ...options };
  
  crawlerResults = {
    timestamp: new Date().toISOString(),
    totalElements: 0,
    clickedElements: 0,
    failedElements: [],
    errors: [],
    componentsScanned: new Map(),
    accessibilityIssues: [],
    performanceMetrics: {},
  };
  
  console.log('🔍 Starting UI Integrity Audit - Crawler Phase');
  console.log('═'.repeat(60));
  
  // Step 1: Find all elements
  const sidebarElements = findSidebarElements();
  const commandPaletteElements = findCommandPaletteElements();
  const adminTableElements = findAdminTableElements();
  const accessibilityIssues = findIconsWithAccessibilityIssues();
  
  crawlerResults.totalElements = sidebarElements.length + 
                                  commandPaletteElements.length + 
                                  adminTableElements.length;
  crawlerResults.accessibilityIssues = accessibilityIssues;
  
  console.log(`📊 Elements Found:`);
  console.log(`   • Sidebar: ${sidebarElements.length}`);
  console.log(`   • Command Palette: ${commandPaletteElements.length}`);
  console.log(`   • Admin Table: ${adminTableElements.length}`);
  console.log(`   • Accessibility Issues: ${accessibilityIssues.length}`);
  console.log('');
  
  // Step 2: Click sidebar elements
  console.log('🖱️  Phase 1: Clicking Sidebar Elements...');
  for (const el of sidebarElements) {
    const shouldSkip = AUDIT_CONFIG.excludePatterns.some(pattern => 
      el.className?.includes(pattern) || el.id?.includes(pattern)
    );
    
    if (shouldSkip) continue;
    
    const result = await simulateClick(el, config);
    if (!result.success) {
      crawlerResults.failedElements.push(result.selector);
    }
    
    await new Promise(resolve => setTimeout(resolve, config.clickDelay));
  }
  
  // Step 3: Click command palette elements
  if (commandPaletteElements.length > 0) {
    console.log('🔍 Phase 2: Opening Command Palette...');
    for (const el of commandPaletteElements) {
      const result = await simulateClick(el, config);
      if (!result.success) {
        crawlerResults.failedElements.push(result.selector);
      }
      await new Promise(resolve => setTimeout(resolve, config.clickDelay));
    }
  }
  
  // Step 4: Click admin table elements
  if (adminTableElements.length > 0) {
    console.log('📋 Phase 3: Clicking Admin Table Elements...');
    for (const el of adminTableElements.slice(0, 20)) { // Limit to first 20
      const result = await simulateClick(el, config);
      if (!result.success) {
        crawlerResults.failedElements.push(result.selector);
      }
      await new Promise(resolve => setTimeout(resolve, config.clickDelay));
    }
  }
  
  return getCrawlerReport();
}

/**
 * Get formatted crawler report
 */
export function getCrawlerReport() {
  const failureRate = crawlerResults.totalElements > 0 
    ? ((crawlerResults.failedElements.length / crawlerResults.totalElements) * 100).toFixed(2)
    : 0;
  
  const avgLoadTime = crawlerResults.clickedElements > 0
    ? (Object.values(crawlerResults.performanceMetrics).reduce((a, b) => a + b, 0) / crawlerResults.clickedElements).toFixed(0)
    : 0;
  
  return {
    timestamp: crawlerResults.timestamp,
    summary: {
      totalElements: crawlerResults.totalElements,
      successfulClicks: crawlerResults.clickedElements,
      failedClicks: crawlerResults.failedElements.length,
      failureRate: `${failureRate}%`,
      accessibilityIssues: crawlerResults.accessibilityIssues.length,
      avgLoadTime: `${avgLoadTime}ms`,
    },
    failedElements: crawlerResults.failedElements,
    accessibilityIssues: crawlerResults.accessibilityIssues.map(issue => ({
      element: issue.selector,
      issue: issue.issue,
      severity: issue.severity,
    })),
    performanceMetrics: {
      slowest: Object.entries(crawlerResults.performanceMetrics)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([selector, time]) => ({ selector, time: `${time.toFixed(0)}ms` })),
      fastest: Object.entries(crawlerResults.performanceMetrics)
        .sort(([,a], [,b]) => a - b)
        .slice(0, 5)
        .map(([selector, time]) => ({ selector, time: `${time.toFixed(0)}ms` })),
    },
    detailedResults: Array.from(crawlerResults.componentsScanned.entries()).map(([selector, data]) => ({
      selector,
      ...data,
      loadTime: `${data.loadTime.toFixed(0)}ms`,
    })),
  };
}

/**
 * Get raw audit data
 */
export function getRawAuditData() {
  return crawlerResults;
}

/**
 * Export crawler report as JSON
 */
export function exportCrawlerReport(filename = 'ui-audit-crawler.json') {
  const report = getCrawlerReport();
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
