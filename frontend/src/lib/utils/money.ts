const formatter = new Intl.NumberFormat("es-ES", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMoney(amount: string, currency: string): string {
  const symbol = currency === "EUR" ? "€" : "$";
  return `${formatter.format(Number(amount))} ${symbol}`;
}