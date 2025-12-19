
import * as fs from 'fs';
import * as path from 'path';

// 1. Load Documentation
const docPath = path.join(__dirname, '../documentation.json');
const doc = JSON.parse(fs.readFileSync(docPath, 'utf8'));

// Target Files
const sceneFiles = {
    'citadel': 'bot/scenes/citadel.scene.ts',
    'trading': 'bot/scenes/trading.scene.ts',
    'settings': 'bot/scenes/settings.scene.ts',
    'link': 'bot/scenes/link.scene.ts',
    'unlink': 'bot/scenes/unlink.scene.ts'
};

const missingItems: string[] = [];
const foundItems: string[] = [];

// Helper to scan file for patterns
function scanFileForButtons(filePath: string): Set<string> {
    const fullPath = path.join(__dirname, '../src', filePath);
    if (!fs.existsSync(fullPath)) return new Set();
    
    const content = fs.readFileSync(fullPath, 'utf8');
    const buttons = new Set<string>();
    
    // Regex for: Markup.button.callback('Label', 'action_id')
    // We care mostly about the ACTION ID as the key, but label helps context.
    // Also scan for .action('action_id'...) handlers
    
    const actionRegex = /\.action\(['"]([^'"]+)['"]/g; // .action('foo'
    let match;
    while ((match = actionRegex.exec(content)) !== null) {
        buttons.add(match[1]);
    }
    
    // Also check direct button definitions
    const callbackRegex = /callback\(['"][^'"]+['"],\s*['"]([^'"]+)['"]\)/g;
    while ((match = callbackRegex.exec(content)) !== null) {
        buttons.add(match[1]);
    }
    
    return buttons;
}

console.log('🔍 Starting UI Gap Analysis...');

// 2. Iterate Flows
const flows = doc.navigation.flows;
for (const [flowName, flowData] of Object.entries(flows)) {
    console.log(`\n📂 Flow: ${flowName}`);
    
    // Map flow to likely file (heuristic)
    let targetFile = '';
    if (flowName === 'authentication') targetFile = 'link'; // approximately
    if (flowName === 'overview') targetFile = 'citadel';
    if (flowName === 'trading') targetFile = 'trading';
    if (flowName === 'advanced') targetFile = 'trading'; // advanced is part of trading scene usually
    if (flowName === 'settings') targetFile = 'settings';
    
    const implementedButtons = scanFileForButtons(sceneFiles[targetFile as keyof typeof sceneFiles] || '');
    
    // Also scan additional files if overlapped
    if (flowName === 'authentication') {
         // check unlink too
         const u = scanFileForButtons(sceneFiles['unlink']);
         u.forEach(b => implementedButtons.add(b));
    }

    const startButtons = new Set(implementedButtons);

    for (const [screenName, screenData] of Object.entries((flowData as any).screens)) {
        console.log(`  🖥️ Screen: ${screenName}`);
        const ctas = (screenData as any).ctas || [];
        
        for (const cta of ctas) {
            // Mapping Document Target/Action to Likely Code Action ID
            // Documentation targets are abstract (e.g. "target": "settings"). Code uses 'enter_settings' or 'settings' depending on impl.
            // We need a fuzzy matcher or check manual mapping.
            // But let's check if the *Label* or *Concept* exists.
            
            // Let's try to infer the likely action ID from the target or label
            // Ex: Label "Settings", Target "settings" -> likely 'settings' or 'enter_settings'
            
            const expectedTarget = cta.target;
            const expectedAction = cta.action; 
            
            // Check if ANY implemented button matches closely
            const match = Array.from(implementedButtons).find(b => 
                b === expectedTarget || 
                b === expectedAction || 
                b.includes(expectedTarget) ||
                (expectedAction && b.includes(expectedAction))
            );
            
            if (match) {
                console.log(`    ✅ Found CTA: "${cta.label}" -> Code Action: "${match}"`);
            } else {
                console.log(`    ❌ MISSING CTA: "${cta.label}" (Target: ${expectedTarget})`);
                missingItems.push(`${flowName}.${screenName}: ${cta.label} -> ${expectedTarget}`);
            }
        }
    }
}

console.log('\n📋 Summary of Potential Gaps:');
missingItems.forEach(m => console.log(`- ${m}`));
if (missingItems.length === 0) console.log('🎉 No gaps detected!');
