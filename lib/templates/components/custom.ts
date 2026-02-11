import type { CustomSection } from "../types";

export function renderCustom(section: CustomSection): string {
  return section.code;
}
