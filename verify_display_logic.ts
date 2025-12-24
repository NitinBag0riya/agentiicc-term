
import { Client } from 'pg';
import 'dotenv/config';

// Mock function representing logic in src/composers/overview-menu.composer.ts
function getExchangesToFetch(linkedExchanges: string[]) {
    // Current logic:
    // const exchangesToFetch = linkedExchanges.length > 0 ? linkedExchanges : ['aster'];
    return linkedExchanges.length > 0 ? linkedExchanges : ['aster'];
}

async function main() {
  console.log('🧪 Verifying Citadel Display Logic...\n');
  
  // Scenarios
  const scenarios = [
      { name: 'Only Aster Linked', linked: ['aster'], expected: ['aster'] },
      { name: 'Only Hyperliquid Linked', linked: ['hyperliquid'], expected: ['hyperliquid'] },
      { name: 'Both Linked', linked: ['aster', 'hyperliquid'], expected: ['aster', 'hyperliquid'] },
      { name: 'None Linked', linked: [], expected: ['aster'] } // Edge case fallback? Wait, in code: if 0 linked -> SHOW WELCOME.
  ];

  // In the actual code:
  /*
    if (linkedExchanges.length === 0) {
      // Show Welcome Screen
      return; 
    }
    // ...
    const exchangesToFetch = linkedExchanges.length > 0 ? linkedExchanges : ['aster'];
  */

  scenarios.forEach(s => {
      console.log(`📍 Testing: ${s.name}`);
      console.log(`   DB Linked: ${JSON.stringify(s.linked)}`);
      
      if (s.linked.length === 0) {
          console.log(`   👉 Result: **WELCOME SCREEN** (Citadel Logic Skipped)`);
      } else {
          const toFetch = getExchangesToFetch(s.linked);
          console.log(`   👉 Result: **CITADEL SCREEN** showing sections: ${JSON.stringify(toFetch)}`);
          
          const isMatch = JSON.stringify(toFetch.sort()) === JSON.stringify(s.expected.sort());
          if (isMatch) console.log('   ✅ PASS');
          else console.log(`   ❌ FAIL (Expected ${s.expected}, Got ${toFetch})`);
      }
      console.log('');
  });
}

main();
