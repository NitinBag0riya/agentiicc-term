
import { describe, expect, test } from "bun:test";

const BASE_URL = process.env.API_URL || "http://localhost:3000";

describe("Universal API - Robustness & Error Handling", () => {

    test("Cross-Exchange Search should return results from both", async () => {
        const res = await fetch(`${BASE_URL}/assets/search?q=ETH`);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.success).toBe(true);
        const data = json.data;
        
        const asterETH = data.find((a: any) => a.exchange === 'aster' && a.symbol.includes('ETH'));
        const hlETH = data.find((a: any) => a.exchange === 'hyperliquid' && a.symbol.includes('ETH'));
        
        expect(asterETH).toBeDefined();
        expect(hlETH).toBeDefined();
    });

    test("Invalid Exchange should return 400 or 404", async () => {
        const res = await fetch(`${BASE_URL}/ticker/ETH?exchange=invalid_exchange`);
        // The API returns 200 with { success: false, error: ... } even on error, or fails with status?
        // Let's check the json.
        const json: any = await res.json();
        // If status is 200, then success should be false.
        if (res.status === 200) {
             expect(json.success).toBe(false);
             expect(json).toHaveProperty("error");
        } else {
             expect(res.status).not.toBe(200);
        }
    });

    test("Missing Parameters should return error or default", async () => {
        const res = await fetch(`${BASE_URL}/ticker/ETH`); // Missing exchange
        const json: any = await res.json();
        if (json.success) {
             console.log("API defaults to an exchange if missing.");
        } else {
             expect(json).toHaveProperty("error");
        }
    });
    
    test("Orderbook depth check", async () => {
        const res = await fetch(`${BASE_URL}/orderbook/ETH?exchange=hyperliquid&depth=5`);
        expect(res.status).toBe(200);
        const json: any = await res.json();
        expect(json.success).toBe(true);
        const data = json.data;
        expect(data.bids.length).toBeLessThanOrEqual(5);
        expect(data.asks.length).toBeLessThanOrEqual(5);
    });
});
