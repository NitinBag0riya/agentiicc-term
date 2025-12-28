/**
 * Bot Welcome Messages
 * 
 * Centralized welcome and onboarding messages.
 */

import { Markup } from 'telegraf';

/**
 * Welcome message for new/unlinked users
 */
export function getWelcomeUnlinked(botUsername: string): string {
  return (
    '👋 **Welcome to StableSolid**\n' +
    'Your Command Citadel for Aster & Hyperliquid\n\n' +
    '**Choose How to Connect:**\n\n' +
    '🔐 **WalletConnect (Recommended)** - One-click wallet connection\n' +
    '🔗 **API Key** - Manual setup for your exchange\n\n' +
    '**Available Exchanges:**\n' +
    `• 🔴 Aster DEX ([Link](https://t.me/${botUsername}?start=link_aster))\n` +
    `• 🔴 Hyperliquid ([Link](https://t.me/${botUsername}?start=link_hyperliquid))\n\n` +
    '🔒 _Your credentials are encrypted and stored securely_\n\n' +
    '**Available Commands:**\n' +
    '/menu - Open main menu\n' +
    '/help - Get help'
  );
}

/**
 * Referral required message
 */
export const REFERRAL_REQUIRED_MESSAGE = 
  '🔒 **Welcome to StableSolid!**\n\n' +
  'This bot requires a **referral code** to access.\n\n' +
  '**How to get started:**\n' +
  '1️⃣ Get a referral code from an existing user\n' +
  '2️⃣ Send `/start YOUR_CODE` to activate access\n\n' +
  '💡 Example: `/start ABC12XYZ`\n\n' +
  "_Don't have a code? Ask a friend who uses this bot!_";

/**
 * Invalid referral code message
 */
export function getInvalidReferralMessage(code: string): string {
  return (
    '❌ **Invalid Referral Code**\n\n' +
    `The code \`${code}\` is not valid.\n\n` +
    '**Please check:**\n' +
    '• Code is typed correctly (case-insensitive)\n' +
    '• Code is from an active user\n\n' +
    'Try again with: `/start VALID_CODE`'
  );
}

/**
 * Keyboard for unlinked users
 */
export function getUnlinkedKeyboard() {
  let url = process.env.MINI_APP_URL;

  if (!url && process.env.WEBHOOK_URL) {
    url = `${process.env.WEBHOOK_URL}/mini-app`;
  }

  if (!url) {
    url = 'https://t.me/My_Test_Tradeee_bot/app';
  }

  return Markup.inlineKeyboard([
    [Markup.button.webApp('🔐 Sign in via WalletConnect', url)],
    [Markup.button.callback('❓ Help', 'help')],
  ]);
}

/**
 * Simple help button keyboard
 */
export function getHelpKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('❓ Help', 'help')],
  ]);
}
