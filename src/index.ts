import { createApiServer } from './api/server';

const port = parseInt(process.env.PORT || '3000');

console.log(`🚀 Starting Unified Server on port ${port}...`);

const app = createApiServer(port);

app.listen(port, () => {
    console.log(`✅ Unified Server (Bot + API + Mini-App) running at http://localhost:${port}`);
});

