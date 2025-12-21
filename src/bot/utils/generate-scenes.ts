/**
 * Scene Generator Script
 * 
 * Reads dataflow-telegram.json and automatically generates all 57 scene files
 * with exact UI text, CTAs, and navigation from the source.
 */

import * as fs from 'fs';
import * as path from 'path';

// Read the dataflow file
const dataflowPath = path.join(__dirname, '../../../dataflow-telegram.json');
const dataflowContent = fs.readFileSync(dataflowPath, 'utf-8');

// Extract the screens object (it's defined as a const in the file)
const screensMatch = dataflowContent.match(/const screens = ({[\s\S]*?});[\s\S]*export type ScreenKey/);
if (!screensMatch) {
  throw new Error('Could not find screens object in dataflow file');
}

// Parse the screens object
const screensCode = screensMatch[1];
const screens = eval(`(${screensCode})`);

// Screen name to scene ID mapping
const screenNameToSceneId: Record<string, string> = {
  'welcome': 'welcome',
  'exchange_selection_aster': 'exchange_selection_aster',
  'exchange_selection_hyperliquid': 'exchange_selection_hyperliquid',
  'mini_app_auth_aster': 'mini_app_auth_aster',
  'mini_app_auth_hyperliquid': 'mini_app_auth_hyperliquid',
  'link_wizard_aster': 'link_wizard_aster_step1',
  'link_wizard_aster_step2': 'link_wizard_aster_step2',
  'link_wizard_hyperliquid': 'link_wizard_hyperliquid_step1',
  'link_wizard_hyperliquid_step2': 'link_wizard_hyperliquid_step2',
  'validating_aster': 'validating_aster',
  'validating_hyperliquid': 'validating_hyperliquid',
  'auth_error_aster': 'auth_error_aster',
  'auth_error_hyperliquid': 'auth_error_hyperliquid',
  'confirm_connect_aster': 'confirm_connect_aster',
  'confirm_connect_hyperliquid': 'confirm_connect_hyperliquid',
  'universal_citadel': 'universal_citadel',
  'citadel_aster': 'citadel_aster',
  'citadel_hyperliquid': 'citadel_hyperliquid',
  // Add all other screen mappings...
};

// Function to extract CTAs from telegram_ui
function extractCTAs(telegram_ui: string): string[] {
  const lines = telegram_ui.split('\n');
  const ctaLines = lines.filter(line => line.trim().startsWith('[') && line.trim().endsWith(']'));
  
  const ctas: string[] = [];
  ctaLines.forEach(line => {
    const matches = line.match(/\[([^\]]+)\]/g);
    if (matches) {
      matches.forEach(match => {
        const cta = match.slice(1, -1).trim();
        if (cta && cta !== '   ') {
          ctas.push(cta);
        }
      });
    }
  });
  
  return ctas;
}

// Function to generate action callback name from CTA text
function ctaToCallback(cta: string): string {
  return cta
    .toLowerCase()
    .replace(/[🔸🔐🔗🔙❌❓📊📈💰🔄⚙️⏳🔑🎯📋⚡🏰]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

// Function to generate scene TypeScript code
function generateSceneCode(screenKey: string, screenData: any): string {
  const sceneId = screenNameToSceneId[screenKey] || screenKey;
  const sceneName = screenKey.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  const className = `${sceneName}Scene`;
  
  // Extract UI message (everything before the CTA lines)
  const uiLines = screenData.telegram_ui.split('\n');
  const lastBoxLine = uiLines.findIndex((line: string) => line.includes('└─────────────────────────────┘'));
  const uiMessage = uiLines.slice(0, lastBoxLine + 1).join('\n');
  
  // Extract CTAs
  const ctas = extractCTAs(screenData.telegram_ui);
  
  // Generate CTA buttons
  const ctaButtons = ctas.map((cta, index) => {
    const callback = ctaToCallback(cta);
    return `        Markup.button.callback('${cta}', '${callback}')`;
  });
  
  // Group CTAs into rows of 3
  const ctaRows: string[][] = [];
  for (let i = 0; i < ctaButtons.length; i += 3) {
    ctaRows.push(ctaButtons.slice(i, i + 3));
  }
  
  const keyboard = ctaRows.map(row => `      [${row.join(',\n')}]`).join(',\n');
  
  // Generate action handlers
  const actionHandlers = ctas.map((cta, index) => {
    const callback = ctaToCallback(cta);
    const nav = screenData.navigation[index];
    const targetScene = nav ? screenNameToSceneId[nav.to] || nav.to : 'welcome';
    
    return `
// CTA ${index + 1}: ${cta} → ${nav?.to || 'unknown'}
${sceneId}Scene.action('${callback}', async (ctx) => {
  await ctx.answerCbQuery();
  await ctx.scene.enter('${targetScene}');
});`;
  }).join('\n');
  
  return `import { Scenes, Markup } from 'telegraf';
import { BotContext } from '../types/context';

export const ${sceneId}Scene = new Scenes.BaseScene<BotContext>('${sceneId}');

// Enter handler - ${screenData.name}
${sceneId}Scene.enter(async (ctx) => {
  const message = \`${uiMessage}\`;

  await ctx.reply(message, {
    ...Markup.inlineKeyboard([
${keyboard}
    ]),
  });
});
${actionHandlers}

export default ${sceneId}Scene;
`;
}

// Generate all scenes
console.log('Generating scenes from dataflow-telegram.json...\n');

Object.entries(screens).forEach(([screenKey, screenData]: [string, any]) => {
  const sceneId = screenNameToSceneId[screenKey] || screenKey;
  const fileName = `${sceneId}.scene.ts`;
  const filePath = path.join(__dirname, '../scenes', fileName);
  
  try {
    const code = generateSceneCode(screenKey, screenData);
    fs.writeFileSync(filePath, code, 'utf-8');
    console.log(`✅ Generated: ${fileName}`);
  } catch (error) {
    console.error(`❌ Failed to generate ${fileName}:`, error);
  }
});

console.log('\n✨ Scene generation complete!');
