/**
 * Auto-Fixer - Automatically fixes common bot issues
 */
import * as fs from 'fs';
import * as path from 'path';

export interface Fix {
  type: string;
  file: string;
  description: string;
  applied: boolean;
  error?: string;
}

export class AutoFixer {
  private fixes: Fix[] = [];
  private projectRoot: string;

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot;
  }

  /**
   * Apply fixes based on error patterns
   */
  async applyFixes(errors: string[]): Promise<Fix[]> {
    this.fixes = [];
    
    for (const error of errors) {
      if (error.includes('Export') && error.includes('not found')) {
        await this.fixMissingExport(error);
      } else if (error.includes('handler') || error.includes('action')) {
        await this.fixMissingHandler(error);
      }
    }
    
    return this.fixes;
  }

  /**
   * Fix missing export
   */
  private async fixMissingExport(error: string) {
    // Extract function name and file from error
    const match = error.match(/Export named '(\w+)' not found in module '(.+)'/);
    if (!match) return;
    
    const [, functionName, filePath] = match;
    const fullPath = path.join(this.projectRoot, filePath);
    
    try {
      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        this.fixes.push({
          type: 'missing_export',
          file: filePath,
          description: `File not found: ${filePath}`,
          applied: false,
          error: 'File does not exist',
        });
        return;
      }
      
      // Read file
      const content = fs.readFileSync(fullPath, 'utf-8');
      
      // Check if function already exists but not exported
      if (content.includes(`function ${functionName}`) && !content.includes(`export function ${functionName}`)) {
        // Add export keyword
        const newContent = content.replace(
          new RegExp(`function ${functionName}`, 'g'),
          `export function ${functionName}`
        );
        fs.writeFileSync(fullPath, newContent);
        
        this.fixes.push({
          type: 'missing_export',
          file: filePath,
          description: `Added export to ${functionName}`,
          applied: true,
        });
      } else {
        // Function doesn't exist - create stub
        const stub = this.generateHandlerStub(functionName);
        const newContent = content + '\n' + stub;
        fs.writeFileSync(fullPath, newContent);
        
        this.fixes.push({
          type: 'missing_export',
          file: filePath,
          description: `Created stub for ${functionName}`,
          applied: true,
        });
      }
    } catch (err: any) {
      this.fixes.push({
        type: 'missing_export',
        file: filePath,
        description: `Failed to fix ${functionName}`,
        applied: false,
        error: err.message,
      });
    }
  }

  /**
   * Fix missing handler
   */
  private async fixMissingHandler(error: string) {
    // This would require more complex analysis
    // For now, just log it
    this.fixes.push({
      type: 'missing_handler',
      file: 'unknown',
      description: error,
      applied: false,
      error: 'Manual fix required',
    });
  }

  /**
   * Generate handler stub
   */
  private generateHandlerStub(functionName: string): string {
    return `
/**
 * ${functionName} - Auto-generated stub
 */
export function ${functionName}(composer: Composer<BotContext>) {
  composer.action(/^${functionName.replace('register', '').toLowerCase()}/, async (ctx) => {
    await ctx.answerCbQuery('Coming soon!');
    // TODO: Implement handler logic
  });
}
`;
  }

  /**
   * Get fixes summary
   */
  getSummary(): string {
    const total = this.fixes.length;
    const applied = this.fixes.filter(f => f.applied).length;
    const failed = this.fixes.filter(f => !f.applied).length;
    
    let summary = `## Auto-Fix Summary\n\n`;
    summary += `- **Total Fixes Attempted**: ${total}\n`;
    summary += `- **Successfully Applied**: ${applied} ✅\n`;
    summary += `- **Failed**: ${failed} ❌\n\n`;
    
    if (applied > 0) {
      summary += `### Applied Fixes\n\n`;
      for (const fix of this.fixes.filter(f => f.applied)) {
        summary += `- ${fix.description} (${fix.file})\n`;
      }
      summary += '\n';
    }
    
    if (failed > 0) {
      summary += `### Failed Fixes\n\n`;
      for (const fix of this.fixes.filter(f => !f.applied)) {
        summary += `- ${fix.description}: ${fix.error}\n`;
      }
      summary += '\n';
    }
    
    return summary;
  }
}
