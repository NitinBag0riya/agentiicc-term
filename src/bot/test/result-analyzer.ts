/**
 * Result Analyzer - Analyzes test results and categorizes failures
 */
import type { CrawlResult } from './recursive-crawler';

export interface AnalysisReport {
  summary: {
    total: number;
    passed: number;
    failed: number;
    passRate: string;
  };
  failureCategories: {
    missingHandlers: string[];
    missingExports: string[];
    apiErrors: string[];
    navigationErrors: string[];
    typeErrors: string[];
    other: string[];
  };
  recommendations: string[];
}

export class ResultAnalyzer {
  /**
   * Analyze test results
   */
  analyze(results: CrawlResult[]): AnalysisReport {
    const total = results.length;
    const passed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    const failureCategories = {
      missingHandlers: [] as string[],
      missingExports: [] as string[],
      apiErrors: [] as string[],
      navigationErrors: [] as string[],
      typeErrors: [] as string[],
      other: [] as string[],
    };
    
    // Categorize failures
    for (const result of results.filter(r => !r.success)) {
      const error = result.error || '';
      const cta = result.cta;
      
      if (error.includes('Export') || error.includes('not found in module')) {
        failureCategories.missingExports.push(`${cta}: ${error}`);
      } else if (error.includes('handler') || error.includes('action')) {
        failureCategories.missingHandlers.push(`${cta}: ${error}`);
      } else if (error.includes('API') || error.includes('Unable to connect')) {
        failureCategories.apiErrors.push(`${cta}: ${error}`);
      } else if (error.includes('Scene') || error.includes('navigation')) {
        failureCategories.navigationErrors.push(`${cta}: ${error}`);
      } else if (error.includes('Type') || error.includes('type')) {
        failureCategories.typeErrors.push(`${cta}: ${error}`);
      } else {
        failureCategories.other.push(`${cta}: ${error}`);
      }
    }
    
    // Generate recommendations
    const recommendations = this.generateRecommendations(failureCategories);
    
    return {
      summary: {
        total,
        passed,
        failed,
        passRate: ((passed / total) * 100).toFixed(1) + '%',
      },
      failureCategories,
      recommendations,
    };
  }

  /**
   * Generate fix recommendations
   */
  private generateRecommendations(categories: AnalysisReport['failureCategories']): string[] {
    const recs: string[] = [];
    
    if (categories.missingExports.length > 0) {
      recs.push(`Add missing exports to handler files (${categories.missingExports.length} issues)`);
    }
    
    if (categories.missingHandlers.length > 0) {
      recs.push(`Register missing action handlers (${categories.missingHandlers.length} issues)`);
    }
    
    if (categories.apiErrors.length > 0) {
      recs.push(`Fix API connection issues - ensure API server is running (${categories.apiErrors.length} issues)`);
    }
    
    if (categories.navigationErrors.length > 0) {
      recs.push(`Fix scene navigation - ensure all scenes are registered (${categories.navigationErrors.length} issues)`);
    }
    
    if (categories.typeErrors.length > 0) {
      recs.push(`Fix TypeScript type mismatches (${categories.typeErrors.length} issues)`);
    }
    
    return recs;
  }

  /**
   * Generate detailed report
   */
  generateReport(analysis: AnalysisReport): string {
    let report = '# Bot CTA Test Analysis Report\n\n';
    
    // Summary
    report += '## Summary\n\n';
    report += `- **Total Tests**: ${analysis.summary.total}\n`;
    report += `- **Passed**: ${analysis.summary.passed} ✅\n`;
    report += `- **Failed**: ${analysis.summary.failed} ❌\n`;
    report += `- **Pass Rate**: ${analysis.summary.passRate}\n\n`;
    
    // Failure Categories
    if (analysis.summary.failed > 0) {
      report += '## Failure Categories\n\n';
      
      if (analysis.failureCategories.missingExports.length > 0) {
        report += `### Missing Exports (${analysis.failureCategories.missingExports.length})\n\n`;
        for (const err of analysis.failureCategories.missingExports.slice(0, 5)) {
          report += `- ${err}\n`;
        }
        if (analysis.failureCategories.missingExports.length > 5) {
          report += `- ... and ${analysis.failureCategories.missingExports.length - 5} more\n`;
        }
        report += '\n';
      }
      
      if (analysis.failureCategories.missingHandlers.length > 0) {
        report += `### Missing Handlers (${analysis.failureCategories.missingHandlers.length})\n\n`;
        for (const err of analysis.failureCategories.missingHandlers.slice(0, 5)) {
          report += `- ${err}\n`;
        }
        if (analysis.failureCategories.missingHandlers.length > 5) {
          report += `- ... and ${analysis.failureCategories.missingHandlers.length - 5} more\n`;
        }
        report += '\n';
      }
      
      if (analysis.failureCategories.apiErrors.length > 0) {
        report += `### API Errors (${analysis.failureCategories.apiErrors.length})\n\n`;
        for (const err of analysis.failureCategories.apiErrors.slice(0, 3)) {
          report += `- ${err}\n`;
        }
        if (analysis.failureCategories.apiErrors.length > 3) {
          report += `- ... and ${analysis.failureCategories.apiErrors.length - 3} more\n`;
        }
        report += '\n';
      }
    }
    
    // Recommendations
    if (analysis.recommendations.length > 0) {
      report += '## Recommendations\n\n';
      for (const rec of analysis.recommendations) {
        report += `- ${rec}\n`;
      }
      report += '\n';
    }
    
    return report;
  }
}
