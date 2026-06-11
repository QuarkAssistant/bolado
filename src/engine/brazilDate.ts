const brazilTimeZone = "America/Sao_Paulo";

export function getBrazilDateId(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: brazilTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value;

  return `${part("year")}-${part("month")}-${part("day")}`;
}
