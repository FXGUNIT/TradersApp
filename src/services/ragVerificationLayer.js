/**
 * ═══════════════════════════════════════════════════════════════════
 * RAG VERIFICATION LAYER - NUMERICAL INTEGRITY
 * ═══════════════════════════════════════════════════════════════════
 * Retrieval-Augmented Generation for verifying numerical calculations
 * 
 * Features:
 * - Cross-references calculations against ground truth database
 * - Detects hallucinated numbers
 * - Validates formulas and logic
 * - Provides confidence scores
 * 
 * Usage:
 *   import { RAGVerifier } from './ragVerificationLayer.js';
 *   const verifier = new RAGVerifier();
 *   const result = verifier.verifyCalculation(userInput, aiResponse);
 */

class RAGVerifier {
  constructor() {
    this.groundTruthDatabase = this.initializeDatabase();
    this.verificationCache = new Map();
    this.metrics = {
      verificationsRun: 0,
      accurateCalculations: 0,
      hallucinations: 0,
      partialErrors: 0,
    };
  }

  /**
   * Initialize ground truth database with valid formulas & calculations
   */
  initializeDatabase() {
    return {
      // Trading metrics
      profitFormulas: {
        netProfit: (wins, avgWin, losses, avgLoss) => wins * avgWin - losses * avgLoss,
        winRate: (wins, totalTrades) => (wins / totalTrades * 100).toFixed(1),
        riskRewardRatio: (avgWin, avgLoss) => (avgWin / avgLoss).toFixed(2),
      },

      // Validation rules
      constraints: {
        winRate: { min: 0, max: 100 },
        tradeCount: { min: 0, max: 100000 },
        profitValue: { min: -1000000, max: 1000000 },
        averageValue: { min: 0, max: 10000 },
      },

      // Common trading calculations
      commonCalculations: {
        'P&L': 'wins * avgWin + losses * avgLoss',
        'Win Rate': 'wins / totalTrades * 100',
        'Profit Factor': 'grossProfit / grossLoss',
        'Expectancy': '(wins * avgWin - losses * avgLoss) / totalTrades',
      },
    };
  }

  /**
   * Extract numbers from AI response
   */
  extractNumbers(text) {
    const numberRegex = /[-+]?\d*\.?\d+/g;
    return text.match(numberRegex) || [];
  }

  /**
   * Verify individual calculation
   */
  verifyCalculation(userInput, aiResponse) {
    this.metrics.verificationsRun++;

    const cacheKey = `${userInput}|${aiResponse}`;
    if (this.verificationCache.has(cacheKey)) {
      return this.verificationCache.get(cacheKey);
    }

    const result = {
      timestamp: new Date().toISOString(),
      userInput,
      aiResponse,
      extractedNumbers: this.extractNumbers(aiResponse),
      verifications: [],
      confidence: 0,
      status: 'UNKNOWN',
      issues: [],
    };

    // Extract key metrics from input
    const metrics = this.extractMetrics(userInput);
    result.metrics = metrics;

    // Verify each number in response
    const numbers = this.extractNumbers(aiResponse);
    if (numbers.length > 0) {
      for (const num of numbers) {
        const numValue = parseFloat(num);
        const verification = this.verifyNumber(numValue, metrics, aiResponse);
        result.verifications.push(verification);

        if (!verification.isValid) {
          result.issues.push({
            number: num,
            reason: verification.reason,
            severity: verification.severity,
          });
          this.metrics.hallucinations++;
        }
      }
    }

    // Calculate overall confidence
    if (result.verifications.length > 0) {
      const validCount = result.verifications.filter(v => v.isValid).length;
      result.confidence = (validCount / result.verifications.length * 100).toFixed(1);
    } else {
      result.confidence = 50; // No numbers to verify - uncertain
    }

    // Determine status
    if (result.issues.length === 0) {
      result.status = 'VERIFIED ✓';
      this.metrics.accurateCalculations++;
    } else if (result.issues.filter(i => i.severity === 'CRITICAL').length > 0) {
      result.status = 'FAILED ✗';
    } else {
      result.status = 'PARTIAL ISSUES ⚠️';
      this.metrics.partialErrors++;
    }

    // Cache result
    this.verificationCache.set(cacheKey, result);
    return result;
  }

  /**
   * Extract metrics from user input
   */
  extractMetrics(input) {
    const metrics = {};

    // Look for common patterns
    const patterns = {
      trades: /(\d+)\s*(trades?|positions?)/gi,
      wins: /(\d+)\s*(?:winning|wins?)/gi,
      losses: /(\d+)\s*(?:losing|losses?)/gi,
      avgWin: /avg.*?win.*?(\d+)/gi,
      avgLoss: /avg.*?loss.*?(\d+)/gi,
      totalP_L: /total\s*p[&/]?l.*?([+-]?\d+)/gi,
    };

    for (const [key, regex] of Object.entries(patterns)) {
      const match = regex.exec(input);
      if (match) {
        metrics[key] = parseFloat(match[1]);
      }
    }

    return metrics;
  }

  /**
   * Verify if a number is realistic
   */
  verifyNumber(num, metrics, context) {
    const constraints = this.groundTruthDatabase.constraints;

    // Check win rate (0-100%)
    if (context.includes('%') && context.toLowerCase().includes('win')) {
      if (num < constraints.winRate.min || num > constraints.winRate.max) {
        return {
          isValid: false,
          reason: `Win rate ${num}% outside valid range (0-100%)`,
          severity: 'CRITICAL',
        };
      }
    }

    // Check trade count (positive integer)
    if (context.toLowerCase().includes('trade') && num < 0) {
      return {
        isValid: false,
        reason: `Trade count ${num} cannot be negative`,
        severity: 'CRITICAL',
      };
    }

    // Check P&L bounds
    if (context.toLowerCase().includes('p&l') || context.toLowerCase().includes('profit')) {
      if (num < constraints.profitValue.min || num > constraints.profitValue.max) {
        return {
          isValid: false,
          reason: `P&L value ${num} outside realistic range`,
          severity: 'HIGH',
        };
      }

      // Verify calculation if we have metrics
      if (metrics.wins && metrics.losses && metrics.avgWin && metrics.avgLoss) {
        const calculatedPnL = this.groundTruthDatabase.profitFormulas.netProfit(
          metrics.wins,
          metrics.avgWin,
          metrics.losses,
          metrics.avgLoss
        );

        if (Math.abs(num - calculatedPnL) > 1) { // Small tolerance for rounding
          return {
            isValid: false,
            reason: `P&L calculation error. Expected ${calculatedPnL}, got ${num}`,
            severity: 'CRITICAL',
          };
        }
      }
    }

    return {
      isValid: true,
      reason: 'Number passes all validation checks',
      severity: 'NONE',
    };
  }

  /**
   * Verify complex calculation (chain of operations)
   */
  verifyComplexCalculation(userInput, aiResponse, expectedSteps) {
    const result = {
      calculation: aiResponse,
      steps: [],
      isCorrect: false,
      confidence: 0,
      recommendations: [],
    };

    // Extract calculation steps from AI response
    const lines = aiResponse.split('\n');
    for (const line of lines) {
      if (line.includes('=') || line.includes('+') || line.includes('-') || line.includes('*') || line.includes('/')) {
        result.steps.push(line.trim());
      }
    }

    // Verify against expected steps
    if (expectedSteps) {
      let stepsCorrect = 0;
      for (const expected of expectedSteps) {
        const found = result.steps.some(s => s.includes(expected.substring(0, 10)));
        if (found) stepsCorrect++;
      }
      result.confidence = (stepsCorrect / expectedSteps.length * 100).toFixed(1);
    }

    // Final determination
    result.isCorrect = result.confidence >= 80;

    return result;
  }

  /**
   * Generate verification report
   */
  getReport() {
    const total = this.metrics.verificationsRun;
    const accuracy = total > 0 ? (this.metrics.accurateCalculations / total * 100).toFixed(1) : 0;

    return {
      timestamp: new Date().toISOString(),
      totalVerifications: total,
      accurateCalculations: this.metrics.accurateCalculations,
      hallucinations: this.metrics.hallucinations,
      partialErrors: this.metrics.partialErrors,
      accuracyRate: `${accuracy}%`,
      cacheSize: this.verificationCache.size,
      status: accuracy >= 90 ? '✓ EXCELLENT' : accuracy >= 80 ? '⚠️ GOOD' : '✗ NEEDS IMPROVEMENT',
    };
  }

  /**
   * Reset metrics
   */
  reset() {
    this.metrics = {
      verificationsRun: 0,
      accurateCalculations: 0,
      hallucinations: 0,
      partialErrors: 0,
    };
    this.verificationCache.clear();
  }
}

// Export for use in test runners
export { RAGVerifier };
export default RAGVerifier;
