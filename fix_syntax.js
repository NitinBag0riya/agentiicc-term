const fs = require('fs');

const filePath = 'src/api/server.ts';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let newLines = [];
let insideRequireAuth = false;
let openBraceCount = 0;

for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    // Check if line starts an endpoint definition
    if (line.trim().startsWith('.get(') || line.trim().startsWith('.post(') || line.trim().startsWith('.put(') || line.trim().startsWith('.delete(')) {
        if (line.includes('requireAuth(')) {
            insideRequireAuth = true;
        } else {
            insideRequireAuth = false;
        }
    }

    // Check for closing of endpoint definition
    // Usually it's "    })" or "    }))"
    // We check if line is exactly "    })" or "    }))" (plus optional comma/semicolon)
    if (line.trim().startsWith('})')) {
        // If it's a top-level endpoint closure (indentation check is hard without parsing, 
        // but we can guess based on "    })" being the standard for these)
        
        // Strict check: if line is just whitespace + }) + optional chars
        if (/^\s+\}\)(\)|;|,)?$/.test(line)) {
            // Check indentation
            const whitespace = line.match(/^\s*/)[0];
            if (whitespace.length === 4) { // Assumes 4 space indent for endpoints
                if (insideRequireAuth) {
                    // Should be }))
                    if (line.includes('}))')) {
                        // Already good
                        newLines.push(line);
                    } else {
                        // Fix it: replace }) with }))
                        newLines.push(line.replace('})', '}))'));
                    }
                } else {
                    // Should be })
                    if (line.includes('}))')) {
                         // Fix it: replace })) with })
                         newLines.push(line.replace('}))', '})'));
                    } else {
                        // Already good
                        newLines.push(line);
                    }
                }
                // Reset flag after closing top-level endpoint
                insideRequireAuth = false; 
                continue;
            }
        }
    }
    
    newLines.push(line);
}

fs.writeFileSync(filePath, newLines.join('\n'));
console.log('Fixed syntax in ' + filePath);
