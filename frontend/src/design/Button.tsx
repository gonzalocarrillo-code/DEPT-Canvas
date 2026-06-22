export type ButtonTone = "primary" | "secondary" | "ghost" | "icon";

export interface ButtonProps {
  readonly label: string;
  readonly icon?: string;
  readonly tone?: ButtonTone;
  readonly pressed?: boolean;
  readonly disabled?: boolean;
}

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function Button({
  label,
  icon,
  tone = "secondary",
  pressed = false,
  disabled = false,
}: ButtonProps): string {
  const escapedLabel = escapeHtml(label);
  const iconMarkup = icon
    ? `<span class="dc-button__icon" aria-hidden="true">${escapeHtml(icon)}</span>`
    : "";
  const labelMarkup = tone === "icon" ? "" : `<span>${escapedLabel}</span>`;
  const pressedAttribute = pressed ? ' aria-pressed="true"' : "";
  const disabledAttribute = disabled ? " disabled" : "";

  return `<button class="dc-button dc-button--${tone}" type="button" aria-label="${escapedLabel}"${pressedAttribute}${disabledAttribute}>${iconMarkup}${labelMarkup}</button>`;
}
