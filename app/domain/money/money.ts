export const MAX_MONEY_CENTS = 100_000_000;

export function parseMoneyToCents(value: string) {
  const normalized = value.trim().replace(",", ".");
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) throw new Error("invalid_money");
  const [euros, decimals = ""] = normalized.split(".");
  const cents = Number(euros) * 100 + Number(decimals.padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents < 1 || cents > MAX_MONEY_CENTS)
    throw new Error("invalid_money");
  return cents;
}

export function formatMoney(cents: number, signed = false) {
  const formatted = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(
    cents / 100,
  );
  return signed && cents > 0 ? `+${formatted}` : formatted;
}
