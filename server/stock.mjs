import { RequestError } from "./inventory.mts";

const businessDateFormat = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" });
export const businessDay = (date = new Date()) => businessDateFormat.format(date);

export function dateOf(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new RequestError(400, "Informe uma data válida.");
  }
  const date = new Date(value + "T12:00:00Z");
  if (!Number.isFinite(+date) || date.toISOString().slice(0, 10) !== value || value > businessDay()) {
    throw new RequestError(400, "Informe uma data válida que não esteja no futuro.");
  }
  return value;
}
