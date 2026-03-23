/**
 * ═══════════════════════════════════════════════════════════════════
 * STEP 3: UI INTEGRITY AUDIT - ICON VALIDATION
 * ═══════════════════════════════════════════════════════════════════
 * Validates aria-labels, active state glows, and icon accessibility
 * Reports on keyboard navigation and screen reader compatibility
 * 
 * Usage:
 *   import { runIconValidation, getIconValidationReport } from './uiAuditIconValidation.js';
 *   
 *   // In component:
 *   const report = await runIconValidation({ 
 *     checkActiveStates: true,
 *     testKeyboardNavigation: true
 *   });
 *   console.log(report);
 */

const VALIDATION_CONFIG = {
  checkAriaLabels: true,
  checkTitles: true,
  checkActiveStates: true,
  checkKeyboardNavigation: true,
  checkContrast: true,
  verbose: false,
  activeStateSelector: '[class*="active"], [aria-current], [class*="glow"]',
  glowPatterns: ['box-shadow', 'text-shadow', 'filter'],
  keyboardKeys: ['Enter', ' ', 'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown'],
};

let validationResults = {
  timestamp: null,
  totalIcons: 0,
  validIcons: 0,
  invalidIcons: [],
  accessibilityIssues: [],
  activeStateCoverage: {
    withActiveState: 0,
    withoutActiveState: 0,
    activeStateElements: [],
  },
  keyboardNavigation: {
    navigableElements: 0,
    keyboardTraps: [],
    tabOrder: [],
  },
  contrastIssues: [],
  screenReaderTests: [],
};

/**
 * Find all icon elements
 */
function findAllIcons() {
  const selectors = [
    'svg',
    'i[class*="icon"]',
    'span[class*="icon"]',
    'img[alt=""]',
    '[role="img"]',
    'button svg',
    'a svg',
    '[class*="fa-"]',  // FontAwesome
    '[class*="material-"]', // Material Icons
  ];
  
  const icons = [];
  const seen = new Set();
  
  selectors.forEach(selector => {
    try {
      document.querySelectorAll(selector).forEach(el => {
        if (!seen.has(el)) {
          icons.push(el);
          seen.add(el);
        }
      });
    } catch {
      console.warn(`Invalid selector: ${selector}`);
    }
  });
  
  return icons;
}

/**
 * Check if icon has proper accessibility labels
 */
function validateIconAccessibility(icon) {
  const issues = [];
  const parent = icon.closest('button, a, [role="button"], [role="link"], label');
  
  if (!parent) {
    issues.push({
      type: 'MISSING_PARENT',
      message: 'Icon is not wrapped in a clickable parent',
      severity: 'high',
    });
    return issues;
  }
  
  // Check for aria-label
  const hasAriaLabel = parent.getAttribute('aria-label');
  if (!hasAriaLabel && VALIDATION_CONFIG.checkAriaLabels) {
    issues.push({
      type: 'MISSING_ARIA_LABEL',
      message: 'Missing aria-label on icon button',
      severity: 'critical',
      suggestion: `Add aria-label="${getButtonPurpose(parent)}"`,
    });
  }
  
  // Check for title attribute
  const hasTitle = parent.getAttribute('title');
  if (!hasTitle && !hasAriaLabel && VALIDATION_CONFIG.checkTitles) {
    issues.push({
      type: 'MISSING_TITLE',
      message: 'Missing title attribute or aria-label',
      severity: 'high',
      suggestion: `Add title="${getButtonPurpose(parent)}"`,
    });
  }
  
  // Check for visible text content
  const textContent = parent.textContent.trim();
  if (!textContent && !hasAriaLabel && !hasTitle) {
    issues.push({
      type: 'NO_ACCESSIBLE_TEXT',
      message: 'Icon has no accessible name (aria-label, title, or text)',
      severity: 'critical',
    });
  }
  
  // Check for proper role
  if (!parent.getAttribute('role') && !['BUTTON', 'A'].includes(parent.tagName)) {
    issues.push({
      type: 'MISSING_ROLE',
      message: 'Icon parent should have proper ARIA role',
      severity: 'medium',
      suggestion: `Add role="button"`,
    });
  }
  
  // Check for disabled state accessibility
  if (parent.disabled) {
    const hasAriaDisabled = parent.getAttribute('aria-disabled');
    if (!hasAriaDisabled) {
      issues.push({
        type: 'MISSING_ARIA_DISABLED',
        message: 'Disabled button should have aria-disabled="true"',
        severity: 'medium',
        suggestion: `Add aria-disabled="true"`,
      });
    }
  }
  
  return issues;
}

/**
 * Infer button purpose from context
 */
function getButtonPurpose(button) {
  const keywords = {
    'close': /×|close|✕/i,
    'edit': /edit|pencil|✏️/i,
    'delete': /delete|trash|remove|🗑️/i,
    'save': /save|check|✓|💾/i,
    'search': /search|🔍|🔎/i,
    'menu': /menu|☰|≡/i,
    'settings': /settings|gear|⚙️|🔧/i,
    'home': /home|🏠|house/i,
    'back': /back|◄|←/i,
    'next': /next|►|→/i,
    'more': /more|⋯|…|⋮/i,
    'notification': /notification|bell|🔔/i,
    'user': /user|profile|👤|person/i,
    'logout': /logout|exit|sign out/i,
  };
  
  const text = button.textContent.toLowerCase();
  for (const [purpose, regex] of Object.entries(keywords)) {
    if (regex.test(text) || regex.test(button.innerHTML)) {
      return purpose;
    }
  }
  
  return 'button';
}

/**
 * Check if element has active/selected state
 */
function checkActiveState(element) {
  const parent = element.closest('button, a, [role="button"], [role="tab"], li, [role="menuitem"]');
  if (!parent) return null;
  
  const hasActiveClass = parent.classList.toString().match(/(active|selected|current|focus|highlight)/i);
  const hasAriaCurrent = parent.getAttribute('aria-current');
  const hasAriaSelected = parent.getAttribute('aria-selected');
  
  // Get computed styles
  const styles = window.getComputedStyle(parent);
  const boxShadow = styles.boxShadow;
  const textShadow = styles.textShadow;
  const filter = styles.filter;
  
  const hasVisualGlow = 
    (boxShadow && boxShadow !== 'none') ||
    (textShadow && textShadow !== 'none') ||
    (filter && filter !== 'none');
  
  return {
    hasActiveClass: !!hasActiveClass,
    hasAriaCurrent: !!hasAriaCurrent,
    hasAriaSelected: !!hasAriaSelected,
    hasVisualGlow: hasVisualGlow,
    glowDetails: {
      boxShadow: boxShadow !== 'none' ? boxShadow : null,
      textShadow: textShadow !== 'none' ? textShadow : null,
      filter: filter !== 'none' ? filter : null,
    },
  };
}

/**
 * Test keyboard navigation
 */
async function testKeyboardNavigation(element) {
  const parent = element.closest('button, a, [role="button"], [role="tab"], [role="menuitem"], input');
  if (!parent) return null;
  
  const isNativelyKeyboardAccessible = [
    'BUTTON', 'A', 'INPUT', 'SELECT', 'TEXTAREA'
  ].includes(parent.tagName);
  
  const tabIndex = parent.getAttribute('tabindex');
  const isTabable = isNativelyKeyboardAccessible || (tabIndex && parseInt(tabIndex) >= 0);
  
  const issuesList = [];
  
  if (!isTabable) {
    issuesList.push({
      type: 'NOT_KEYBOARD_ACCESSIBLE',
      message: 'Element is not keyboard accessible (not tabbable)',
      severity: 'critical',
      suggestion: 'Add proper tabindex or use native button/link',
    });
  }
  
  // Check for keyboard trap
  if (tabIndex && parseInt(tabIndex) < 0) {
    issuesList.push({
      type: 'KEYBOARD_TRAP',
      message: 'Element has negative tabindex (removed from tab order)',
      severity: 'medium',
    });
  }
  
  return {
    isKeyboardAccessible: isTabable,
    isNativelyAccessible: isNativelyKeyboardAccessible,
    tabIndex: tabIndex || 'auto',
    keyboardIssues: issuesList,
  };
}

/**
 * Check color contrast (simplified WCAG 2.1 AA check)
 */
function checkColorContrast(element) {
  try {
    const styles = window.getComputedStyle(element);
    const bgColor = styles.backgroundColor;
    const fgColor = styles.color;
    
    // Simple contrast approximation (full implementation would use proper luminance calc)
    const hasLowContrast = bgColor === fgColor || bgColor === 'transparent';
    
    return {
      hasLowContrast,
      backgroundColor: bgColor,
      foregroundColor: fgColor,
      severity: hasLowContrast ? 'medium' : 'ok',
    };
  } catch (err) {
    return { error: err.message };
  }
}

/**
 * Simulate page navigation to test active states
 */
async function testActiveStateGlow() {
  const results = {
    testedElements: 0,
    elementsWithGlow: 0,
    elementsWithoutGlow: [],
    navigationTests: [],
  };
  
  // Find all navigation links
  const navLinks = document.querySelectorAll('a[href], [role="tab"], [role="menuitem"]');
  
  navLinks.forEach(link => {
    const icon = link.querySelector('svg, i[class*="icon"], span[class*="icon"]');
    if (!icon) return;
    
    const linkHref = link.getAttribute('href');
    const currentPage = window.location.pathname;
    
    // Check if this link's href matches current page (simulating active state)
    const isCurrentPage = linkHref && currentPage.includes(linkHref);
    
    if (isCurrentPage) {
      const activeState = checkActiveState(icon);
      results.testedElements++;
      
      if (activeState.hasVisualGlow || activeState.hasAriaCurrent || activeState.hasActiveClass) {
        results.elementsWithGlow++;
      } else {
        results.elementsWithoutGlow.push({
          icon: getElementSelector(icon),
          parent: getElementSelector(link),
          issue: 'Active state glow not detected',
        });
      }
    }
  });
  
  return results;
}

/**
 * Get element selector
 */
function getElementSelector(el) {
  if (el.id) return `#${el.id}`;
  if (el.className) return `.${el.className.split(' ').join('.')}`;
  return `${el.tagName.toLowerCase()}`;
}

/**
 * Main validation function
 */
export async function runIconValidation(options = {}) {
  Object.assign(VALIDATION_CONFIG, options);
  
  validationResults = {
    timestamp: new Date().toISOString(),
    totalIcons: 0,
    validIcons: 0,
    invalidIcons: [],
    accessibilityIssues: [],
    activeStateCoverage: {
      withActiveState: 0,
      withoutActiveState: 0,
      activeStateElements: [],
    },
    keyboardNavigation: {
      navigableElements: 0,
      keyboardTraps: [],
      tabOrder: [],
    },
    contrastIssues: [],
    screenReaderTests: [],
  };
  
  console.log('🔍 Starting Icon Validation Audit...');
  console.log('═'.repeat(60));
  
  const icons = findAllIcons();
  validationResults.totalIcons = icons.length;
  
  console.log(`📊 Found ${icons.length} icons to validate`);
  console.log('');
  
  // Validate each icon
  console.log('🔎 Phase 1: Accessibility Validation...');
  icons.forEach((icon) => {
    const accessIssues = validateIconAccessibility(icon);
    const keyboardNav = testKeyboardNavigation(icon);
    const contrast = checkColorContrast(icon);
    const activeState = checkActiveState(icon);
    
    if (accessIssues.length === 0 && keyboardNav?.isKeyboardAccessible) {
      validationResults.validIcons++;
    } else {
      const selector = getElementSelector(icon);
      validationResults.invalidIcons.push({
        selector,
        accessibilityIssues: accessIssues,
        keyboardIssues: keyboardNav?.keyboardIssues || [],
      });
    }
    
    // Track accessibility issues
    if (accessIssues.length > 0) {
      validationResults.accessibilityIssues.push({
        element: getElementSelector(icon),
        issues: accessIssues,
      });
    }
    
    // Track keyboard navigation
    if (keyboardNav) {
      validationResults.keyboardNavigation.navigableElements++;
      if (keyboardNav.keyboardIssues.length > 0) {
        validationResults.keyboardNavigation.keyboardTraps.push({
          element: getElementSelector(icon),
          issues: keyboardNav.keyboardIssues,
        });
      }
    }
    
    // Track active states
    if (activeState) {
      if (activeState.hasActiveClass || activeState.hasAriaCurrent || activeState.hasVisualGlow) {
        validationResults.activeStateCoverage.withActiveState++;
        validationResults.activeStateCoverage.activeStateElements.push({
          element: getElementSelector(icon),
          states: {
            hasActiveClass: activeState.hasActiveClass,
            hasAriaCurrent: activeState.hasAriaCurrent,
            hasVisualGlow: activeState.hasVisualGlow,
          },
        });
      } else {
        validationResults.activeStateCoverage.withoutActiveState++;
      }
    }
    
    // Track contrast issues
    if (contrast.hasLowContrast) {
      validationResults.contrastIssues.push({
        element: getElementSelector(icon),
        bg: contrast.backgroundColor,
        fg: contrast.foregroundColor,
      });
    }
  });
  
  // Test active state glows
  if (VALIDATION_CONFIG.checkActiveStates) {
    console.log('✨ Phase 2: Active State Glow Detection...');
    const glowTests = await testActiveStateGlow();
    validationResults.screenReaderTests.push({
      name: 'Active State Glow',
      tested: glowTests.testedElements,
      passed: glowTests.elementsWithGlow,
      failed: glowTests.elementsWithoutGlow,
    });
  }
  
  console.log('✅ Icon Validation Complete');
  console.log('');
  
  return getIconValidationReport();
}

/**
 * Get formatted validation report
 */
export function getIconValidationReport() {
  const passRate = validationResults.totalIcons > 0
    ? ((validationResults.validIcons / validationResults.totalIcons) * 100).toFixed(2)
    : 0;
  
  const activeStateCoverage = 
    (validationResults.activeStateCoverage.withActiveState + 
     validationResults.activeStateCoverage.withoutActiveState) > 0
    ? ((validationResults.activeStateCoverage.withActiveState / 
        (validationResults.activeStateCoverage.withActiveState + 
         validationResults.activeStateCoverage.withoutActiveState)) * 100).toFixed(2)
    : 0;
  
  return {
    timestamp: validationResults.timestamp,
    summary: {
      totalIcons: validationResults.totalIcons,
      validIcons: validationResults.validIcons,
      invalidIcons: validationResults.invalidIcons.length,
      passRate: `${passRate}%`,
      accessibilityIssues: validationResults.accessibilityIssues.length,
      keyboardTraps: validationResults.keyboardNavigation.keyboardTraps.length,
      contrastIssues: validationResults.contrastIssues.length,
      activeStateCoverage: `${activeStateCoverage}%`,
    },
    criticalIssues: validationResults.accessibilityIssues.filter(issue =>
      issue.issues.some(i => i.severity === 'critical')
    ),
    accessibilityIssues: validationResults.accessibilityIssues,
    keyboardNavigation: validationResults.keyboardNavigation,
    activeStateAnalysis: validationResults.activeStateCoverage,
    contrastIssues: validationResults.contrastIssues,
    detailedResults: validationResults.invalidIcons,
  };
}

/**
 * Generate accessibility report in a11y format
 */
export function generateA11yReport() {
  const report = getIconValidationReport();
  
  const wcagViolations = {
    'WCAG 2.1 Level A': [],
    'WCAG 2.1 Level AA': [],
    'WCAG 2.1 Level AAA': [],
  };
  
  // Map issues to WCAG criteria
  report.accessibilityIssues.forEach(issue => {
    issue.issues.forEach(i => {
      if (i.type === 'MISSING_ARIA_LABEL' || i.type === 'NO_ACCESSIBLE_TEXT') {
        wcagViolations['WCAG 2.1 Level A'].push({
          criterion: '1.1.1 Non-text Content (Level A)',
          issue: i.message,
          element: issue.element,
          suggestion: i.suggestion,
        });
      }
      
      if (i.type === 'NOT_KEYBOARD_ACCESSIBLE') {
        wcagViolations['WCAG 2.1 Level A'].push({
          criterion: '2.1.1 Keyboard (Level A)',
          issue: i.message,
          element: issue.element,
          suggestion: i.suggestion,
        });
      }
      
      if (i.type === 'KEYBOARD_TRAP') {
        wcagViolations['WCAG 2.1 Level A'].push({
          criterion: '2.1.2 No Keyboard Trap (Level A)',
          issue: i.message,
          element: issue.element,
        });
      }
    });
  });
  
  report.contrastIssues.forEach(issue => {
    wcagViolations['WCAG 2.1 Level AA'].push({
      criterion: '1.4.3 Contrast (Minimum) (Level AA)',
      issue: `Low color contrast (${issue.bg} on ${issue.fg})`,
      element: issue.element,
    });
  });
  
  return {
    timestamp: report.timestamp,
    wcagCompliance: wcagViolations,
    overallScore: report.summary.passRate,
    recommendations: generateRecommendations(report),
  };
}

/**
 * Generate actionable recommendations
 */
function generateRecommendations(report) {
  const recommendations = [];
  
  if (report.summary.accessibilityIssues > 0) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Add aria-labels to all icon buttons',
      impact: `${report.summary.accessibilityIssues} icons affected`,
      effort: 'LOW',
    });
  }
  
  if (report.summary.keyboardTraps > 0) {
    recommendations.push({
      priority: 'CRITICAL',
      action: 'Fix keyboard navigation issues',
      impact: `${report.summary.keyboardTraps} keyboard traps detected`,
      effort: 'MEDIUM',
    });
  }
  
  if (report.summary.contrastIssues > 0) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Improve color contrast ratios',
      impact: `${report.summary.contrastIssues} contrast issues found`,
      effort: 'MEDIUM',
    });
  }
  
  if (parseInt(report.summary.activeStateCoverage) < 80) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Add visual active state indicators to navigation icons',
      impact: `${100 - parseInt(report.summary.activeStateCoverage)}% of icons lack active states`,
      effort: 'MEDIUM',
    });
  }
  
  return recommendations;
}

/**
 * Export validation report
 */
export function exportIconValidationReport(filename = 'ui-audit-icon-validation.json') {
  const report = getIconValidationReport();
  const dataStr = JSON.stringify(report, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
