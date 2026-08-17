import { es } from "./es";

export type MessageKey = keyof typeof es;

export function t(key: MessageKey): string {
  return es[key];
}
