// Pure formatting helpers (no internal dependencies).
export function formatPrice(value: number): string {
  return `$${value.toFixed(2)}`;
}

export function formatSymbol(symbol: string): string {
  return symbol.replace("USDT", "/USDT");
}
