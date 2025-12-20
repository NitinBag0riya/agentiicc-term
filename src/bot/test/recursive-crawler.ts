/**
 * Recursive Crawler - Automatically discovers and tests all bot screens and CTAs
 */
import { Telegraf } from 'telegraf';
import type { BotContext } from '../types/context';
import { BotTester } from './BotTester';
import { SCREEN_DEFINITIONS, CTA_PATTERNS, CTA_TO_API } from './screen-definitions';

export interface CrawlResult {
  screen: string;
  cta: string;
  success: boolean;
  error?: string;
  apiCalls: string[];
  nextScreen?: string;
  duration: number;
}

export interface NavigationGraph {
  nodes: Set<string>; // Screens
  edges: Map<string, Set<string>>; // Screen -> reachable screens
  ctaMap: Map<string, string[]>; // Screen -> available CTAs
}

export class RecursiveCrawler {
  private bot: Telegraf<BotContext>;
  private tester: BotTester;
  private results: CrawlResult[] = [];
  private graph: NavigationGraph = {
    nodes: new Set(),
    edges: new Map(),
    ctaMap: new Map(),
  };
  private visited: Set<string> = new Set();
  private queue: Array<{ screen: string; cta: string }> = [];

  constructor(bot: Telegraf<BotContext>) {
    this.bot = bot;
    this.tester = new BotTester();
  }

  /**
   * Start crawling from the beginning
   */
  async crawl(): Promise<{
    results: CrawlResult[];
    graph: NavigationGraph;
    summary: any;
  }> {
    console.log('🕷️  Starting recursive crawl...\n');
    
    // Start from /start command
    await this.testCommand('/start', 'start');
    
    // Process queue until empty
    while (this.queue.length > 0) {
      const { screen, cta } = this.queue.shift()!;
      await this.testCTA(screen, cta);
    }
    
    return {
      results: this.results,
      graph: this.graph,
      summary: this.generateSummary(),
    };
  }

  /**
   * Test a command
   */
  private async testCommand(command: string, screenName: string) {
    console.log(`\n📍 Testing command: ${command}`);
    const startTime = Date.now();
    
    try {
      this.tester.reset();
      const ctx = this.tester.createTextContext(command);
      
      // Simulate command handler
      await this.bot.handleUpdate({
        update_id: Math.random(),
        message: ctx.message,
      } as any);
      
      const duration = Date.now() - startTime;
      const callbacks = this.tester.extractCallbacks();
      
      // Record screen
      this.graph.nodes.add(screenName);
      this.graph.ctaMap.set(screenName, callbacks);
      
      // Queue discovered CTAs
      for (const callback of callbacks) {
        if (!this.visited.has(`${screenName}:${callback}`)) {
          this.queue.push({ screen: screenName, cta: callback });
        }
      }
      
      this.results.push({
        screen: screenName,
        cta: command,
        success: true,
        apiCalls: this.tester.apiCalls.map(c => c.method),
        duration,
      });
      
      console.log(`  ✅ Success - Found ${callbacks.length} CTAs`);
    } catch (error: any) {
      console.log(`  ❌ Failed: ${error.message}`);
      this.results.push({
        screen: screenName,
        cta: command,
        success: false,
        error: error.message,
        apiCalls: [],
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Test a CTA (callback action)
   */
  private async testCTA(screen: string, cta: string) {
    const key = `${screen}:${cta}`;
    if (this.visited.has(key)) return;
    
    this.visited.add(key);
    console.log(`\n🔘 Testing CTA: ${cta} (from ${screen})`);
    
    const startTime = Date.now();
    
    try {
      this.tester.reset();
      const ctx = this.tester.createContext(cta);
      
      // Simulate callback handler
      await this.bot.handleUpdate({
        update_id: Math.random(),
        callback_query: ctx.callbackQuery,
      } as any);
      
      const duration = Date.now() - startTime;
      const callbacks = this.tester.extractCallbacks();
      const apiCalls = this.tester.apiCalls.map(c => c.method);
      
      // Determine next screen (simplified - based on message content)
      const nextScreen = this.inferNextScreen(cta, this.tester.lastMessage);
      
      // Update graph
      if (nextScreen) {
        this.graph.nodes.add(nextScreen);
        if (!this.graph.edges.has(screen)) {
          this.graph.edges.set(screen, new Set());
        }
        this.graph.edges.get(screen)!.add(nextScreen);
        this.graph.ctaMap.set(nextScreen, callbacks);
        
        // Queue new CTAs
        for (const callback of callbacks) {
          if (!this.visited.has(`${nextScreen}:${callback}`)) {
            this.queue.push({ screen: nextScreen, cta: callback });
          }
        }
      }
      
      // Verify expected API calls
      const expectedAPI = this.getExpectedAPI(cta);
      const success = !expectedAPI || apiCalls.includes(expectedAPI);
      
      this.results.push({
        screen,
        cta,
        success,
        apiCalls,
        nextScreen,
        duration,
        error: success ? undefined : `Expected API call: ${expectedAPI}`,
      });
      
      console.log(`  ${success ? '✅' : '❌'} ${success ? 'Success' : 'Failed'} - API: ${apiCalls.join(', ') || 'none'}`);
      if (nextScreen) {
        console.log(`  📍 Next screen: ${nextScreen} (${callbacks.length} CTAs)`);
      }
    } catch (error: any) {
      console.log(`  ❌ Error: ${error.message}`);
      this.results.push({
        screen,
        cta,
        success: false,
        error: error.message,
        apiCalls: [],
        duration: Date.now() - startTime,
      });
    }
  }

  /**
   * Infer next screen from CTA and response
   */
  private inferNextScreen(cta: string, message: string): string | undefined {
    // Simple heuristics
    if (cta === 'menu') return 'menu';
    if (cta === 'citadel') return 'citadel';
    if (cta === 'positions') return 'positions';
    if (cta === 'assets') return 'assets';
    if (cta === 'settings') return 'settings';
    if (cta === 'trading') return 'trading';
    if (cta.startsWith('pos_refresh:')) return 'position_detail';
    if (cta.startsWith('link_')) return 'link_exchange';
    
    // Check message content for clues
    if (message.includes('Position') && message.includes('Management')) return 'position_detail';
    if (message.includes('Leverage')) return 'leverage_menu';
    if (message.includes('Margin')) return 'margin_menu';
    
    return undefined;
  }

  /**
   * Get expected API call for a CTA
   */
  private getExpectedAPI(cta: string): string | undefined {
    for (const [pattern, api] of Object.entries(CTA_TO_API)) {
      if (cta.startsWith(pattern)) {
        return api;
      }
    }
    return undefined;
  }

  /**
   * Generate summary
   */
  private generateSummary() {
    const total = this.results.length;
    const passed = this.results.filter(r => r.success).length;
    const failed = this.results.filter(r => !r.success).length;
    
    return {
      total,
      passed,
      failed,
      passRate: ((passed / total) * 100).toFixed(1) + '%',
      screensDiscovered: this.graph.nodes.size,
      totalCTAs: Array.from(this.graph.ctaMap.values()).reduce((sum, ctas) => sum + ctas.length, 0),
      avgDuration: (this.results.reduce((sum, r) => sum + r.duration, 0) / total).toFixed(0) + 'ms',
    };
  }

  /**
   * Get failed tests
   */
  getFailedTests(): CrawlResult[] {
    return this.results.filter(r => !r.success);
  }

  /**
   * Get navigation graph as string
   */
  getGraphString(): string {
    let output = '# Navigation Graph\n\n';
    
    for (const [screen, targets] of this.graph.edges.entries()) {
      output += `${screen}\n`;
      for (const target of targets) {
        output += `  ├─ ${target}\n`;
      }
    }
    
    return output;
  }
}
