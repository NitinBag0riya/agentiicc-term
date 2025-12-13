
import { describe, expect, test, beforeAll } from "bun:test";

const BASE_URL = process.env.API_URL || "http://localhost:3000";

describe("Universal API - Basic Connectivity", () => {
    
    test("GET /health should return ok", async () => {
        const res = await fetch(`${BASE_URL}/health`);
        expect(res.status).toBe(200);
        const data: any = await res.json();
        expect(data.status).toBe("ok");
    });

    test("GET /assets?exchange=aster should return assets", async () => {
        const res = await fetch(`${BASE_URL}/assets?exchange=aster`);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.success).toBe(true);
        const data = json.data;
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
        expect(data[0]).toHaveProperty("symbol");
    });

    test("GET /assets?exchange=hyperliquid should return assets", async () => {
        const res = await fetch(`${BASE_URL}/assets?exchange=hyperliquid`);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.success).toBe(true);
        const data = json.data;
        expect(Array.isArray(data)).toBe(true);
        expect(data.length).toBeGreaterThan(0);
    });

    test("GET /ticker/ETHUSDT?exchange=aster should return ticker", async () => {
        const res = await fetch(`${BASE_URL}/ticker/ETHUSDT?exchange=aster`);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.success).toBe(true);
        const data = json.data;
        expect(data.symbol).toBe("ETHUSDT");
        expect(parseFloat(data.price)).toBeGreaterThan(0);
    });

     test("GET /ticker/ETH?exchange=hyperliquid should return ticker", async () => {
        const res = await fetch(`${BASE_URL}/ticker/ETH?exchange=hyperliquid`);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.success).toBe(true);
        const data = json.data;
        expect(data.symbol).toBe("ETH");
        expect(parseFloat(data.price)).toBeGreaterThan(0);
    });
});
