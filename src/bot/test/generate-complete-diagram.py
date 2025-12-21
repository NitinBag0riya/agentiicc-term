#!/usr/bin/env python3
"""Generate complete Mermaid diagram from screen-definitions.ts"""

import re
from pathlib import Path

SCREEN_DEFS_PATH = Path('/Users/nitinbagoriya/Documents/AgentiFi-dev/src/bot/test/screen-definitions.ts')
OUTPUT_PATH = Path('/Users/nitinbagoriya/Documents/AgentiFi-dev/docs/SCREEN_FLOW.md')

def extract_all_screens():
    """Extract all screens with their metadata"""
    content = SCREEN_DEFS_PATH.read_text()
    screens = {}
    
    # Find all screen keys at the correct indentation level
    lines = content.split('\n')
    i = 0
    
    while i < len(lines):
        line = lines[i]
        # Match screen key pattern: "    screenKey: {"
        match = re.match(r'^    (\w+):\s*\{', line)
        
        if match:
            screen_key = match.group(1)
            
            # Collect lines until we find the closing brace
            brace_count = 1
            screen_lines = []
            i += 1
            
            while i < len(lines) and brace_count > 0:
                current = lines[i]
                screen_lines.append(current)
                
                # Simple brace counting (works for most cases)
                for char in current:
                    if char == '{':
                        brace_count += 1
                    elif char == '}':
                        brace_count -= 1
                        if brace_count == 0:
                            break
                i += 1
            
            screen_block = '\n'.join(screen_lines)
            
            # Extract metadata
            cat_match = re.search(r"category:\s*['\"]([^'\"]+)['\"]", screen_block)
            name_match = re.search(r"name:\s*['\"]([^'\"]+)['\"]", screen_block)
            
            category = cat_match.group(1) if cat_match else 'Other'
            name = name_match.group(1) if name_match else screen_key.replace('_', ' ').title()
            
            # Extract navigation
            nav_match = re.search(r'navigation:\s*\[(.*?)\]', screen_block, re.DOTALL)
            navigations = []
            if nav_match:
                nav_items = re.findall(r"\{\s*action:\s*['\"]([^'\"]+)['\"],\s*to:\s*['\"]([^'\"]+)['\"]", nav_match.group(1))
                navigations = [{'action': action, 'to': to} for action, to in nav_items]
            
            # Extract UI preview
            ui_match = re.search(r'telegram_ui:\s*`([^`]+)`', screen_block, re.DOTALL)
            ui_preview = ''
            if ui_match:
                ui_text = ui_match.group(1)
                for ui_line in ui_text.split('\\n')[:20]:  # Check first 20 lines
                    if '│' in ui_line:
                        clean = ui_line.replace('│', '').replace('┌', '').replace('└', '').replace('─', '').replace('┐', '').replace('┘', '').strip()
                        if clean and not clean.startswith('━') and len(clean) > 2:
                            ui_preview = clean[:25]
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

def generate_mermaid_diagram(screens):
    """Generate Mermaid flowchart with all screens"""
    lines = ['```mermaid', 'flowchart TD']
    
    # Group screens by category for better organization
    categories = {}
    for key, screen in screens.items():
        cat = screen['category']
        if cat not in categories:
            categories[cat] = []
        categories[cat].append((key, screen))
    
    # Add nodes grouped by category
    for category, items in sorted(categories.items()):
        lines.append(f'\n    %% {category} Screens')
        for key, screen in items:
            name = screen['name']
            preview = screen['ui_preview'] if screen['ui_preview'] else name
            # Escape quotes and special chars
            label = f"{name}<br/>{preview}"
            label = label.replace('"', "'")
            lines.append(f'    {key}["{label}"]')
    
    lines.append('\n    %% Navigation Flows')
    
    # Add edges
    for key, screen in screens.items():
        for nav in screen['navigation']:
            action = nav['action'][:18].replace('"', "'")  # Shorten and escape
            target = nav['to']
            if target in screens:
                lines.append(f'    {key} -->|"{action}"| {target}')
    
    lines.append('```')
    return '\n'.join(lines)

def main():
    print('📖 Reading screen-definitions.ts...')
    screens = extract_all_screens()
    print(f'📊 Found {len(screens)} screens')
    
    # Group by category
    categories = {}
    for key, screen in screens.items():
        cat = screen['category']
        if cat not in categories:
            categories[cat] = []
        categories[cat].append({'key': key, 'name': screen['name']})
    
    print('🎨 Generating Mermaid diagram...')
    mermaid = generate_mermaid_diagram(screens)
    
    # Generate category summary
    cat_summary = '\n'.join([
        f"### {cat}\n" + '\n'.join([f"- **{s['name']}** (`{s['key']}`)" for s in items])
        for cat, items in sorted(categories.items())
    ])
    
    # Generate navigation summary (first 10 screens)
    nav_summary_list = []
    for key, screen in list(screens.items())[:10]:
        nav_items = [f"- {n['action']} → `{n['to']}`" for n in screen['navigation']]
        nav_text = '\n'.join(nav_items) if nav_items else '- No navigation defined'
        nav_summary_list.append(f"### {screen['name']} (`{key}`)\n{nav_text}")
    
    nav_summary = '\n\n'.join(nav_summary_list)
    
    markdown = f"""# Telegram Bot Screen Flow

Complete visualization of all {len(screens)} Telegram bot screens with navigation flows.

## Overview

- **Total Screens**: {len(screens)}
- **Categories**: {', '.join(sorted(categories.keys()))}
- **Total Navigation Links**: {sum(len(s['navigation']) for s in screens.values())}

## Complete Screen Flow Diagram

The diagram below shows all screens with their names, preview text, and navigation CTAs.

{mermaid}

## Screen Categories

{cat_summary}

## Navigation Examples

Sample navigation flows from key screens:

{nav_summary}

*... and {len(screens) - 10} more screens with their navigation flows*

## Usage

Import screens in your bot code:

```typescript
import {{ AGENTIFI_SCREENS, ScreenKey }} from './test/screen-definitions';

// Access any screen
const screen = AGENTIFI_SCREENS.welcome;
console.log(screen.name, screen.navigation);
```

---

**Generated**: {Path(__file__).stat().st_mtime}  
**Source**: `screen-definitions.ts`  
**Screens**: {len(screens)}  
**Categories**: {len(categories)}
"""
    
    OUTPUT_PATH.write_text(markdown)
    print(f'✅ Created: {OUTPUT_PATH}')
    print(f'\n🎉 Success! Generated diagram with {len(screens)} screens')
    print(f'   Categories: {", ".join(sorted(categories.keys()))}')

if __name__ == '__main__':
    main()
