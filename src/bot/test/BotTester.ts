import type { Context } from 'telegraf';
import type { SessionData, BotContext } from '../types/context';
import { UniversalApiService } from '../services/universal-api.service';
import * as redisDb from '../db/redis';
import * as postgresDb from '../db/postgres';

export interface TestError {
  timestamp: number;
  action: string;
  error: Error;
  stack?: string;
  context?: any;
}

export interface StateSnapshot {
  timestamp: number;
  action: string;
  session: SessionData;
  lastMessage: string;
  lastButtons: any[];
  apiCalls: number;
}

export interface ExecutionPath {
  path: string[];
  actions: string[];
  errors: TestError[];
  duration: number;
}

/**
 * Enhanced BotTester - Simulates Telegram Bot interactions with comprehensive tracking
 */
export class BotTester {
  public session: SessionData = {};
  public lastMessage: string = '';
  public lastButtons: any[] = [];
  public apiCalls: Array<{ method: string; args: any[] }> = [];
  
  // Enhanced tracking
  public errors: TestError[] = [];
  public stateSnapshots: StateSnapshot[] = [];
  public executionPaths: ExecutionPath[] = [];
  public currentPath: string[] = [];
  public currentActions: string[] = [];
  public pathStartTime: number = 0;
  
  // Navigation tracking
  public visitedScreens: Set<string> = new Set();
  public discoveredCTAs: Map<string, string[]> = new Map(); // screen -> CTAs
  
  constructor(userId: number = 123) {
    this.session = {
      userId,
      isLinked: true,
      activeExchange: 'aster',
    };
    this.mockApi();
    this.mockDb();
    this.pathStartTime = Date.now();
  }

  /**
   * Mock DB utilities - Skip mocking for now, let real implementations handle it
   */
  private mockDb() {
    // Skip DB mocking - the actual DB utilities will handle missing connections gracefully
    // This avoids readonly property assignment issues
  }

  /**
   * Mock UniversalApiService to track calls - Simplified version
   */
  private mockApi() {
    // Skip API mocking for now - we'll track calls differently
    // This avoids complex mocking issues
  }

  /**
   * Record an error
   */
  public recordError(action: string, error: Error, context?: any) {
    this.errors.push({
      timestamp: Date.now(),
      action,
      error,
      stack: error.stack,
      context,
    });
  }

  /**
   * Take a state snapshot
   */
  public takeSnapshot(action: string) {
    this.stateSnapshots.push({
      timestamp: Date.now(),
      action,
      session: { ...this.session },
      lastMessage: this.lastMessage,
      lastButtons: [...this.lastButtons],
      apiCalls: this.apiCalls.length,
    });
  }

  /**
   * Start tracking a new execution path
   */
  public startPath(initialScreen: string) {
    this.currentPath = [initialScreen];
    this.currentActions = [];
    this.pathStartTime = Date.now();
  }

  /**
   * Record a navigation action
   */
  public recordNavigation(from: string, to: string, action: string) {
    this.currentPath.push(to);
    this.currentActions.push(action);
    this.visitedScreens.add(to);
  }

  /**
   * Complete current execution path
   */
  public completePath() {
    this.executionPaths.push({
      path: [...this.currentPath],
      actions: [...this.currentActions],
      errors: this.errors.filter(e => e.timestamp >= this.pathStartTime),
      duration: Date.now() - this.pathStartTime,
    });
  }

  /**
   * Discover CTAs on current screen
   */
  public discoverCTAs(screen: string, ctas: string[]) {
    this.discoveredCTAs.set(screen, ctas);
  }

  /**
   * Extract callback data from buttons
   */
  public extractCallbacks(): string[] {
    const callbacks: string[] = [];
    for (const row of this.lastButtons) {
      for (const button of row) {
        if (button.callback_data) {
          callbacks.push(button.callback_data);
        }
      }
    }
    return callbacks;
  }

  /**
   * Create a mock context for a handler
   */
  public createContext(callbackData?: string): BotContext {
    const tester = this;
    const ctx: any = {
      session: this.session,
      from: { id: 123, username: 'test_user', is_bot: false, first_name: 'Test' },
      chat: { id: 123, type: 'private' },
      
      reply: async (text: string, extra?: any) => {
        tester.lastMessage = text;
        tester.lastButtons = extra?.reply_markup?.inline_keyboard || [];
        return { message_id: Math.floor(Math.random() * 1000) } as any;
      },

      editMessageText: async (text: string, extra?: any) => {
        tester.lastMessage = text;
        tester.lastButtons = extra?.reply_markup?.inline_keyboard || [];
        return true as any;
      },

      answerCbQuery: async (text?: string) => {
        return true;
      },
      
      // Scene support
      scene: {
        enter: async (id: string, state?: any) => {
          console.log(`[BotTester] Entering scene: ${id}`, state);
          if (state) {
            (ctx.wizard as any) = { state };
          }
          return;
        },
        leave: async () => {
          console.log(`[BotTester] Leaving scene`);
        },
      },
      
      // Wizard support
      wizard: {
        state: {},
        cursor: 0,
        next: () => {},
        selectStep: (step: number) => {},
        steps: [],
      },
      
      // Callback query
      callbackQuery: callbackData ? {
        data: callbackData,
        message: { message_id: 123, chat: { id: 123 } },
      } : undefined,
      
      // Match for regex handlers
      match: callbackData ? callbackData.match(/(.+)/) : null,
      
      // Message
      message: undefined,
    };
    
    return ctx as BotContext;
  }

  /**
   * Simulate text input
   */
  public createTextContext(text: string): BotContext {
    const ctx = this.createContext();
    (ctx as any).message = {
      text,
      message_id: 123,
      chat: { id: 123 },
      from: ctx.from,
      date: Date.now(),
    };
    return ctx;
  }

  /**
   * Clear tracked data
   */
  public clearCalls() {
    this.apiCalls = [];
  }

  /**
   * Reset all tracking
   */
  public reset() {
    this.apiCalls = [];
    this.errors = [];
    this.stateSnapshots = [];
    this.lastMessage = '';
    this.lastButtons = [];
  }

  /**
   * Get test summary
   */
  public getSummary() {
    return {
      totalPaths: this.executionPaths.length,
      totalErrors: this.errors.length,
      totalSnapshots: this.stateSnapshots.length,
      totalApiCalls: this.apiCalls.length,
      visitedScreens: Array.from(this.visitedScreens),
      discoveredCTAs: Object.fromEntries(this.discoveredCTAs),
    };
  }
}
