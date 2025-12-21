#!/usr/bin/env bun
/**
 * Extract screens from JourneyMap.jsx and generate Mermaid DFD
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const JOURNEY_MAP_PATH = '/Users/nitinbagoriya/Downloads/journey-map-app/src/JourneyMap.jsx';
const SCREEN_DEFS_PATH = join(__dirname, 'screen-definitions.ts');
const DIAGRAM_OUTPUT_PATH = join(__dirname, '../../../docs/SCREEN_FLOW.md');

// Extract screens object from JourneyMap.jsx
function extractScreens(): string {
  const content = readFileSync(JOURNEY_MAP_PATH, 'utf-8');
  
  // Find the screens object (starts at "const screens = {" and ends at "};" before "const categories")
  const startMarker = 'const screens = {';
  const endMarker = '  };';
  
  const startIndex = content.indexOf(startMarker);
  if (startIndex === -1) throw new Error('Could not find screens object start');
  
  // Find the closing }; that belongs to screens
  let braceCount = 0;
  let inScreens = false;
  let endIndex = -1;
  
  for (let i = startIndex + startMarker.length; i < content.length; i++) {
    const char = content[i];
    
    if (char === '{') {
      braceCount++;
      inScreens = true;
    } else if (char === '}') {
      braceCount--;
      if (braceCount === 0 && inScreens) {
        endIndex = i + 1;
        break;
      }
    }
  }
  
  if (endIndex === -1) throw new Error('Could not find screens object end');
  
  const screensContent = content.substring(startIndex, endIndex + 1);
  return screensContent;
}

// Parse screens to extract structure
function parseScreens(screensCode: string): any {
  // Use eval to parse the object (safe since we control the source)
  const screensObj = eval(`(${screensCode.replace('const screens = ', '')})`);
  return screensObj;
}

// Generate Mermaid flowchart
function generateMermaidDiagram(screens: any): string {
  let mermaid = '```mermaid\nflowchart TD\n';
  
  // Create nodes for each screen
  Object.entries(screens).forEach(([key, screen]: [string, any]) => {
    const name = screen.name || key;
    const category = screen.category || 'Other';
    
    // Extract first line of telegram_ui as preview text
    const uiLines = screen.telegram_ui?.split('\\n') || [];
    const previewLine = uiLines
      .find((line: string) => line.includes('│') && line.trim().length > 3)
      ?.replace(/[│┌└─┐┘]/g, '')
      .trim()
      .substring(0, 30) || '';
    
    // Create node with screen name and preview
    const nodeLabel = `${name}<br/>${previewLine}${previewLine.length === 30 ? '...' : ''}`;
    mermaid += `    ${key}["${nodeLabel}"]\n`;
  });
  
  mermaid += '\n';
  
  // Create edges for navigation
  Object.entries(screens).forEach(([key, screen]: [string, any]) => {
    const navigation = screen.navigation || [];
    
    navigation.forEach((nav: any) => {
      const action = nav.action?.substring(0, 20) || 'Navigate';
      const target = nav.to;
      
      if (target && screens[target]) {
        mermaid += `    ${key} -->|"${action}"| ${target}\n`;
      }
    });
  });
  
  mermaid += '```\n';
  
  return mermaid;
}

// Main execution
try {
  console.log('📖 Reading JourneyMap.jsx...');
  const screensCode = extractScreens();
  
  console.log('💾 Writing screen-definitions.ts...');
  const tsContent = `/**
 * Telegram Bot Screen Definitions
 * Extracted from journey-map-app/src/JourneyMap.jsx
 * 
 * This file contains all screen definitions including:
 * - Screen names and descriptions
 * - Telegram UI layouts
 * - Navigation flows
 * - Data flow requirements
 * - API endpoints
 */

export const AGENTIFI_SCREENS = ${screensCode.replace('const screens = ', '')};

export type ScreenKey = keyof typeof AGENTIFI_SCREENS;
`;
  
  writeFileSync(SCREEN_DEFS_PATH, tsContent, 'utf-8');
  console.log('✅ Created:', SCREEN_DEFS_PATH);
  
  console.log('🔍 Parsing screens...');
  const screens = parseScreens(screensCode);
  const screenCount = Object.keys(screens).length;
  console.log(`📊 Found ${screenCount} screens`);
  
  console.log('🎨 Generating Mermaid diagram...');
  const mermaidDiagram = generateMermaidDiagram(screens);
  
  const markdownContent = `# Telegram Bot Screen Flow

This document visualizes the complete screen flow for the Telegram bot, extracted from the journey-map-app.

## Overview

- **Total Screens**: ${screenCount}
- **Categories**: Authentication, Overview, Trading, Advanced, Settings

## Screen Flow Diagram

The diagram below shows all screens, their names, preview text, and navigation CTAs (Call-to-Actions).

${mermaidDiagram}

## Screen Categories

${Object.entries(
  Object.entries(screens).reduce((acc: any, [key, screen]: [string, any]) => {
    const cat = screen.category || 'Other';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push({ key, name: screen.name });
    return acc;
  }, {})
).map(([category, items]: [string, any]) => `### ${category}
${items.map((item: any) => `- **${item.name}** (\`${item.key}\`)`).join('\\n')}
`).join('\\n')}

## Navigation Summary

Each screen has specific CTAs that navigate to other screens:

${Object.entries(screens).slice(0, 5).map(([key, screen]: [string, any]) => {
  const nav = screen.navigation || [];
  return `### ${screen.name} (\`${key}\`)
${nav.map((n: any) => `- ${n.action} → \`${n.to}\``).join('\\n') || '- No navigation defined'}
`;
}).join('\\n')}

*... and ${screenCount - 5} more screens*

---

Generated on: ${new Date().toISOString()}
`;
  
  writeFileSync(DIAGRAM_OUTPUT_PATH, markdownContent, 'utf-8');
  console.log('✅ Created:', DIAGRAM_OUTPUT_PATH);
  
  console.log('\\n🎉 Success! Files generated:');
  console.log('  1.', SCREEN_DEFS_PATH);
  console.log('  2.', DIAGRAM_OUTPUT_PATH);
  
} catch (error) {
  console.error('❌ Error:', error);
  process.exit(1);
}
