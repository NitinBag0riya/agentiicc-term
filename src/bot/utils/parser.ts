export interface TradeIntent {
    symbol: string;
    exchange?: 'aster' | 'hyperliquid';
    side?: 'BUY' | 'SELL';
    type?: 'MARKET' | 'LIMIT';
    amount?: number;
    price?: number;
}

export function parseTradeCommand(text: string): TradeIntent | null {
    const tokens = text.trim().toLowerCase().split(/\s+/);
    
    let symbol: string | undefined;
    let exchange: 'aster' | 'hyperliquid' | undefined;
    let side: 'BUY' | 'SELL' | undefined;
    let type: 'MARKET' | 'LIMIT' | undefined;
    let amount: number | undefined;
    let price: number | undefined;

    // Keywords to exclude from being symbols
    const keywords = new Set(['long', 'short', 'buy', 'sell', 'market', 'limit', 'mkt', 'lmt', 'aster', 'hyperliquid', 'hl', 'hyper', 'adx', 'l', 's']);

    for (const token of tokens) {
        // Exchange
        if (['aster', 'adx'].includes(token)) exchange = 'aster';
        else if (['hyperliquid', 'hl', 'hyper'].includes(token)) exchange = 'hyperliquid';
        
        // Side
        else if (['long', 'buy', 'l'].includes(token)) side = 'BUY';
        else if (['short', 'sell', 's'].includes(token)) side = 'SELL';
        
        // Type
        else if (['market', 'mkt'].includes(token)) type = 'MARKET';
        else if (['limit', 'lmt'].includes(token)) type = 'LIMIT';
        
        // Numbers (Amount/Price)
        // Heuristic: Check if strict number
        else if (/^\d+(\.\d+)?$/.test(token)) {
            // First number is usually amount if not set? 
            // Or usually amount is "50". "3000" might be price.
            // Let's stick to: First valid number is Amount, unless we have amount, then Price.
            if (!amount) amount = parseFloat(token);
            else if (!price) price = parseFloat(token);
        }
        else if (token.startsWith('$')) {
            amount = parseFloat(token.substring(1));
        }
        
        // Symbol (Fallback)
        // Check if length is reasonable (2-10 chars) and NOT a keyword
        else if (!keywords.has(token) && token.length >= 2 && token.length <= 10 && !symbol) {
            symbol = token.toUpperCase();
        }
    }

    if (symbol) {
        return { symbol, exchange, side, type, amount, price };
    }
    return null;
}
