#!/usr/bin/env python3
"""Extract screens from JourneyMap.jsx and generate Mermaid DFD"""

import re
from pathlib import Path
from datetime import datetime

JOURNEY_MAP_PATH = Path('/Users/nitinbagoriya/Downloads/journey-map-app/src/JourneyMap.jsx')
SCREEN_DEFS_PATH = Path('/Users/nitinbagoriya/Documents/AgentiFi-dev/src/bot/test/screen-definitions.ts')
DIAGRAM_OUTPUT_PATH = Path('/Users/nitinbagoriya/Documents/AgentiFi-dev/docs/SCREEN_FLOW.md')

def extract_screens():
    content = JOURNEY_MAP_PATH.read_text()
    start_marker = 'const screens = {'
    start_idx = content.find(start_marker)
    if start_idx == -1:
        raise ValueError('Could not find screens object')
    
    brace_count = 0
    in_screens = False
    end_idx = -1
    
    for i in range(start_idx + len(start_marker), len(content)):
        char = content[i]
        if char == '{':
            brace_count += 1
            in_screens = True
        elif char == '}':
            brace_count -= 1
            if brace_count == 0 and in_screens:
                end_idx = i + 1
                break
    
    if end_idx == -1:
        raise ValueError('Could not find end of screens object')
    
    return content[start_idx:end_idx + 1]

def parse_screen_structure(screens_code):
    screens = {}
    
    # Find all top-level screen keys by looking for pattern at specific indentation
    # Screens are at 4-space indentation level
    lines = screens_code.split('\n')
    
    i = 0
    while i < len(lines):
        line = lines[i]
        # Look for screen key pattern: "    screenKey: {"
        match = re.match(r'^    (\w+):\s*\{', line)
        if match:
            screen_key = match.group(1)
            
            # Count braces to find the end of this screen object
            brace_count = 1
            screen_lines = [line]
            i += 1
            
            while i < len(lines) and brace_count > 0:
                current_line = lines[i]
                screen_lines.append(current_line)
                
                # Count braces (simple counting, doesn't handle strings perfectly but good enough)
                brace_count += current_line.count('{') - current_line.count('}')
                i += 1
            
            screen_block = '\n'.join(screen_lines)
            
            # Extract category
            cat_match = re.search(r'category:\s*[\'"]([^\'"]+)[\'"]', screen_block)
            category = cat_match.group(1) if cat_match else 'Other'
            
            # Extract name
            name_match = re.search(r'name:\s*[\'"]([^\'"]+)[\'"]', screen_block)
            name = name_match.group(1) if name_match else screen_key.replace('_', ' ').title()
            
            # Extract navigation
            nav_match = re.search(r'navigation:\s*\[(.*?)\]', screen_block, re.DOTALL)
            navigations = []
            if nav_match:
                nav_items = re.findall(r'\{\s*action:\s*[\'"]([^\'"]+)[\'"],\s*to:\s*[\'"]([^\'"]+)[\'"]', nav_match.group(1))
                navigations = [{'action': action, 'to': to} for action, to in nav_items]
            
            # Extract UI preview - find first meaningful line
            ui_match = re.search(r'telegram_ui:\s*`([^`]+)`', screen_block, re.DOTALL)
            ui_preview = ''
            if ui_match:
                ui_text = ui_match.group(1)
                ui_lines = ui_text.split('\\n')
                for ui_line in ui_lines:
                    if '│' in ui_line:
                        clean = ui_line.replace('│', '').replace('┌', '').replace('└', '').replace('─', '').replace('┐', '').replace('┘', '').strip()
                        if clean and not clean.startswith('━') and len(clean) > 3:
                            ui_preview = clean[:30]
                            break
            
            screens[screen_key] = {
                'name': name,
                'category': category,
                'navigation': navigations,
                'ui_preview': ui_preview
            }
        else:
            i += 1
    
    return screens

def generate_mermaid(screens):
    lines = ['```mermaid', 'flowchart TD']
    for key, screen in screens.items():
        name = screen['name']
        preview = screen['ui_preview']
        label = f"{name}<br/>{preview}{'...' if len(preview) == 30 else ''}"
        lines.append(f'    {key}["{label}"]')
    lines.append('')
    for key, screen in screens.items():
        for nav in screen['navigation']:
            action = nav['action'][:20]
            target = nav['to']
            if target in screens:
                lines.append(f'    {key} -->|"{action}"| {target}')
    lines.append('```')
    return '\n'.join(lines)

def main():
    print('📖 Reading JourneyMap.jsx...')
    screens_code = extract_screens()
    
    print('💾 Writing screen-definitions.ts...')
    ts_content = f"""/**
 * Telegram Bot Screen Definitions
 * Extracted from journey-map-app/src/JourneyMap.jsx
 */

export const AGENTIFI_SCREENS = {screens_code.replace('const screens = ', '')};

export type ScreenKey = keyof typeof AGENTIFI_SCREENS;
"""
    SCREEN_DEFS_PATH.write_text(ts_content)
    print(f'✅ Created: {SCREEN_DEFS_PATH}')
    
    print('🔍 Parsing screens...')
    screens = parse_screen_structure(screens_code)
    print(f'📊 Found {len(screens)} screens')
    
    print('🎨 Generating Mermaid diagram...')
    mermaid = generate_mermaid(screens)
    
    categories = {}
    for key, screen in screens.items():
        cat = screen['category']
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({'key': key, 'name': screen['name']})
    
    cat_summary = '\n'.join([f"### {cat}\n" + '\n'.join([f"- **{s['name']}** (`{s['key']}`)" for s in items]) for cat, items in categories.items()])
    
    nav_summary_list = []
    for key, screen in list(screens.items())[:5]:
        nav_items = [f"- {n['action']} → `{n['to']}`" for n in screen['navigation']]
        nav_text = '\n'.join(nav_items) if nav_items else '- No navigation defined'
        nav_summary_list.append(f"### {screen['name']} (`{key}`)\n{nav_text}")
    
    nav_summary = '\n\n'.join(nav_summary_list)
    more_screens = len(screens) - 5
    
    markdown = f"""# Telegram Bot Screen Flow

This document visualizes the complete screen flow for the Telegram bot.

## Overview

- **Total Screens**: {len(screens)}
- **Categories**: {', '.join(categories.keys())}

## Screen Flow Diagram

The diagram below shows all screens, their names, preview text, and navigation CTAs.

{mermaid}

## Screen Categories

{cat_summary}

## Navigation Summary

Each screen has specific CTAs that navigate to other screens:

{nav_summary}

*... and {more_screens} more screens*

---

Generated on: {datetime.now().isoformat()}
"""
    
    DIAGRAM_OUTPUT_PATH.write_text(markdown)
    print(f'✅ Created: {DIAGRAM_OUTPUT_PATH}')
    print('\n🎉 Success! Files generated:')
    print(f'  1. {SCREEN_DEFS_PATH}')
    print(f'  2. {DIAGRAM_OUTPUT_PATH}')

if __name__ == '__main__':
    main()
