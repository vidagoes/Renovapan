
export type Condition = "ready" | "pending";
export type Stock = { ready: number; pending: number };
export type Commercial = "free" | "reserved" | "sold" | "archived";

const transitions: Record<string, { from: Commercial; to: Commercial }> = {
  reserve: { from: "free", to: "reserved" },
  sell: { from: "free", to: "sold" },
  confirm: { from: "reserved", to: "sold" },
  cancel: { from: "reserved", to: "free" },
  reverse_sale: { from: "sold", to: "free" },
  archive: { from: "free", to: "archived" },
  reopen: { from: "archived", to: "free" }
};

export class RequestError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function quantity(value: unknown, minimum = 0, maximum = 1000000): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new RequestError(400, "Informe um número inteiro dentro do limite permitido.");
  }
  return value;
}

export function unitTransition(status: unknown, action: unknown): Commercial {
  if (typeof action !== "string" || !Object.hasOwn(transitions, action)) {
    throw new RequestError(400, "Operação inválida.");
  }
  const transition = transitions[action];
  if (status !== transition.from) {
    throw new RequestError(409, "Operação incompatível com a situação atual da máquina.");
  }
  return transition.to;
}
