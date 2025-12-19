import Decimal from 'decimal.js';

export const formatters = {
  // PnL Percentage: (unRealizedProfit / margin) * 100
  pnlPercentage: (unRealizedProfit: string | number, margin: string | number): string => {
    if (!margin || !unRealizedProfit) return '0.00%';
    const m = new Decimal(margin);
    if (m.isZero() || m.isNaN()) return '0.00%';
    const pnl = new Decimal(unRealizedProfit);
    return `${pnl.div(m).times(100).toFixed(2)}%`;
  },

  // Side Detection: positionAmt > 0 ? "LONG" : "SHORT"
  side: (positionAmt: string | number): string => {
    const amt = new Decimal(positionAmt);
    return amt.greaterThan(0) ? 'LONG 🟢' : 'SHORT 🔴';
  },

  // Position Value: abs(positionAmt) * markPrice
  positionValue: (positionAmt: string | number, markPrice: string | number): string => {
    if (!positionAmt || !markPrice) return '$0.00';
    const amt = new Decimal(positionAmt).abs();
    const price = new Decimal(markPrice);
    if (amt.isNaN() || price.isNaN()) return '$0.00';
    return `$${amt.times(price).toFixed(2)}`;
  },

  // Change Dollar: lastPrice - openPrice
  changeDollars: (lastPrice: string | number, openPrice: string | number): string => {
    if (!lastPrice || !openPrice) return '$0.00';
    const last = new Decimal(lastPrice);
    const open = new Decimal(openPrice);
    if (last.isNaN() || open.isNaN()) return '$0.00';
    const diff = last.minus(open);
    const sign = diff.greaterThanOrEqualTo(0) ? '+' : '';
    return `${sign}$${diff.toFixed(2)}`;
  },

  // Volume Formatting: quoteVolume / 1,000,000
  volume: (quoteVolume: string | number): string => {
    if (!quoteVolume) return '0.0M USDT';
    const vol = new Decimal(quoteVolume);
    if (vol.isNaN()) return '0.0M USDT';
    return `${vol.div(1000000).toFixed(1)}M USDT`;
  },

  // Order Type Formatting: "LIMIT_MAKER" -> "Limit Maker"
  orderType: (type: string): string => {
    return type
      .split('_')
      .map(w => w.charAt(0) + w.slice(1).toLowerCase())
      .join(' ');
  },

  // Timestamp Formatting
  timestamp: (time: number | string): string => {
    return new Date(time).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  },

  // Order Value: origQty * price
  orderValue: (origQty: string | number, price: string | number): string => {
    if (!origQty || !price) return '$0.00 USDT';
    const qty = new Decimal(origQty);
    const p = new Decimal(price);
    if (qty.isNaN() || p.isNaN()) return '$0.00 USDT';
    return `$${qty.times(p).toFixed(2)} USDT`;
  },

  // Margin Management: currentMargin + (type === "ADD" ? amount : -amount)
  previewMargin: (currentMargin: string | number, amount: string | number, type: 'ADD' | 'REMOVE'): string => {
    if (!currentMargin || !amount) return '$0.00';
    const current = new Decimal(currentMargin);
    const amt = new Decimal(amount);
    if (current.isNaN() || amt.isNaN()) return '$0.00';
    const result = type === 'ADD' ? current.plus(amt) : current.minus(amt);
    return `$${result.toFixed(2)}`;
  },

  // PnL Value: Formats purely the PnL amount
  pnlValue: (pnl: string | number): string => {
      if (!pnl) return '$0.00';
      const val = new Decimal(pnl);
      if (val.isNaN()) return '$0.00';
      return `$${val.toFixed(2)}`;
  }
};
