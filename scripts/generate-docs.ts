
import { join } from 'path';
import { readFileSync, writeFileSync, copyFileSync } from 'fs';

const COLLECTION_PATH = join(process.cwd(), 'Universal_API.postman_collection.json');
const OUTPUT_DIR = join(process.cwd(), 'docs');
const OUTPUT_HTML = join(OUTPUT_DIR, 'index.html');
const OUTPUT_COLLECTION = join(OUTPUT_DIR, 'Universal_API.postman_collection.json');

// Interface for Postman types (simplified)
interface PostmanItem {
    name: string;
    item?: PostmanItem[]; // Folder contains items
    request?: {
        method: string;
        url: any;
        description?: string;
        body?: {
            mode: string;
            raw: string;
        };
        header?: any[];
    };
    response?: any[];
}

function generateSidebar(items: PostmanItem[], depth = 0): string {
    let html = `<ul class="depth-${depth}">`;
    
    items.forEach((item, index) => {
        const id = item.name.replace(/\s+/g, '-').toLowerCase() + '-' + index;
        
        if (item.item) {
            // Folder
            html += `
                <li class="folder">
                    <span class="folder-name">${item.name}</span>
                    ${generateSidebar(item.item, depth + 1)}
                </li>
            `;
        } else {
            // Request
            const method = item.request?.method || 'GET';
            html += `
                <li>
                    <a href="#${id}" class="request-link">
                        <span class="method method-${method.toLowerCase()}">${method}</span>
                        <span class="req-name">${item.name}</span>
                    </a>
                </li>
            `;
        }
    });
    
    html += '</ul>';
    return html;
}

function generateContent(items: PostmanItem[], depth = 0): string {
    let html = '';
    
    items.forEach((item, index) => {
        const id = item.name.replace(/\s+/g, '-').toLowerCase() + '-' + index;
        
        if (item.item) {
            // Folder Section
            html += `
                <section class="folder-section">
                    <h2 class="folder-title depth-${depth}">${item.name}</h2>
                    ${generateContent(item.item, depth + 1)}
                </section>
                <hr class="folder-divider">
            `;
        } else {
            // Request Details
            const method = item.request?.method || 'GET';
            let url = '';
            if (typeof item.request?.url === 'string') {
                url = item.request.url;
            } else if (item.request?.url?.raw) {
                url = item.request.url.raw;
            }

            const body = item.request?.body?.raw ? JSON.stringify(JSON.parse(item.request.body.raw), null, 2) : '';
            const description = item.request?.description || '';

            html += `
                <div id="${id}" class="request-card">
                    <div class="request-header">
                        <span class="method-badge method-${method.toLowerCase()}">${method}</span>
                        <span class="request-url">${url}</span>
                    </div>
                    <h3 class="request-title">${item.name}</h3>
                    ${description ? `<p class="request-desc">${description}</p>` : ''}
                    
                    ${body ? `
                        <div class="code-block">
                            <div class="code-label">Request Body (JSON)</div>
                            <pre><code class="language-json">${body}</code></pre>
                        </div>
                    ` : ''}
                </div>
            `;
        }
    });
    
    return html;
}

function main() {
    console.log('📖 Reading Postman Collection...');
    const rawData = readFileSync(COLLECTION_PATH, 'utf-8');
    const collection = JSON.parse(rawData);

    console.log('⚙️ Generating HTML...');
    const styles = `
        :root {
            --bg-color: #0d1117;
            --sidebar-bg: #161b22;
            --text-color: #c9d1d9;
            --border-color: #30363d;
            --folder-color: #58a6ff;
            --accent: #1f6feb;
            
            --get: #238636;
            --post: #d29922;
            --put: #a371f7;
            --delete: #f85149;
        }
        * { box-sizing: border-box; }
        body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg-color); color: var(--text-color); display: flex; height: 100vh; overflow: hidden; }
        
        /* Sidebar */
        .sidebar { width: 300px; background: var(--sidebar-bg); border-right: 1px solid var(--border-color); display: flex; flex-direction: column; }
        .sidebar-header { padding: 20px; border-bottom: 1px solid var(--border-color); }
        .sidebar-title { margin: 0; font-size: 1.2rem; color: #fff; }
        .nav-scroll { flex: 1; overflow-y: auto; padding: 10px 0; }
        ul { list-style: none; padding: 0; margin: 0; }
        li { margin-bottom: 2px; }
        
        .folder-name { display: block; padding: 8px 20px; font-weight: 600; color: var(--folder-color); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 15px; }
        .request-link { display: flex; align-items: center; padding: 8px 20px; text-decoration: none; color: var(--text-color); font-size: 0.9rem; transition: background 0.2s; }
        .request-link:hover { background: #21262d; color: #fff; }
        
        .method { font-size: 0.7rem; font-weight: bold; width: 45px; text-align: center; border-radius: 3px; padding: 2px 0; margin-right: 10px; color: #fff; }
        .method-get { background: var(--get); }
        .method-post { background: var(--post); }
        .method-put { background: var(--put); }
        .method-delete { background: var(--delete); }

        /* Main Content */
        .main { flex: 1; padding: 40px; overflow-y: auto; scroll-behavior: smooth; }
        .container { max-width: 900px; margin: 0 auto; padding-bottom: 100px; }
        
        .header-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid var(--border-color); }
        .download-btn { background: var(--accent); color: white; text-decoration: none; padding: 10px 20px; border-radius: 6px; font-weight: 600; font-size: 0.9rem; transition: background 0.2s; }
        .download-btn:hover { background: #1158c7; }

        .folder-title { margin-top: 40px; margin-bottom: 20px; color: var(--folder-color); font-size: 1.5rem; border-bottom: 1px solid var(--border-color); padding-bottom: 10px; }
        .folder-divider { border: 0; border-top: 1px solid var(--border-color); margin: 40px 0; opacity: 0.5; }

        .request-card { background: #0d1117; border: 1px solid var(--border-color); border-radius: 6px; padding: 20px; margin-bottom: 30px; }
        .request-header { display: flex; align-items: center; margin-bottom: 15px; background: #161b22; padding: 10px; border-radius: 4px; border: 1px solid #30363d; font-family: monospace; }
        .method-badge { padding: 4px 8px; border-radius: 4px; font-weight: bold; color: white; margin-right: 15px; font-size: 0.8rem; }
        .request-url { color: #8b949e; word-break: break-all; }
        
        .request-title { margin: 0 0 10px 0; color: #fff; font-size: 1.1rem; }
        .request-desc { color: #8b949e; font-size: 0.95rem; line-height: 1.5; margin-bottom: 15px; }

        .code-block { background: #000; border-radius: 6px; padding: 15px; overflow-x: auto; border: 1px solid #30363d; margin-top: 15px; }
        .code-label { font-size: 0.75rem; color: #8b949e; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.5px; }
        pre { margin: 0; }
        code { font-family: "SFMono-Regular", Consolas, "Liberation Mono", Menlo, Courier, monospace; font-size: 0.9rem; color: #c9d1d9; }
    `;

    const sidebarContent = generateSidebar(collection.item);
    const mainContent = generateContent(collection.item);

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${collection.info.name} - API Docs</title>
    <style>${styles}</style>
</head>
<body>
    <aside class="sidebar">
        <div class="sidebar-header">
            <h1 class="sidebar-title">AgentiFi API</h1>
        </div>
        <nav class="nav-scroll">
            ${sidebarContent}
        </nav>
    </aside>
    <main class="main">
        <div class="container">
            <div class="header-actions">
                <h1>${collection.info.name}</h1>
                <a href="./Universal_API.postman_collection.json" download class="download-btn">📥 Download Collection</a>
            </div>
            <p>${collection.info.description || 'Welcome to the Universal Trading API documentation.'}</p>
            
            ${mainContent}
        </div>
    </main>
</body>
</html>
    `;

    writeFileSync(OUTPUT_HTML, html);
    console.log(`✅ Generated HTML at: ${OUTPUT_HTML}`);

    console.log('📋 Copying Postman Collection...');
    copyFileSync(COLLECTION_PATH, OUTPUT_COLLECTION);
    console.log(`✅ Copied Collection to: ${OUTPUT_COLLECTION}`);
}

main();
