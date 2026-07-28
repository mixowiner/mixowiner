export function formatMoney(amount: number): string {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}${formatted}`;
}

export function formatMultiplier(multiplier: number): string {
  return `${multiplier.toFixed(2)}×`;
}
