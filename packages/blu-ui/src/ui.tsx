import type {
  ChangeEventHandler,
  ComponentType,
  CSSProperties,
  ReactNode,
} from "react";
import type { ComponentMeta } from "@kitsy/blu-schema";

export interface RegistryEntry<TProps extends Record<string, unknown>> {
  urn: string;
  component: ComponentType<TProps>;
  meta: ComponentMeta;
}

export interface ButtonProps {
  label?: string;
  onClick?: () => void;
}

export interface TextProps {
  value?: string | number | boolean | null;
  tone?: "default" | "muted" | "danger";
}

export interface InputProps {
  value?: string | number;
  placeholder?: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
}

export interface CardProps {
  children?: ReactNode;
}

export interface ModalContentProps {
  title?: string;
  children?: ReactNode;
}

export function Button({ label = "", onClick }: ButtonProps): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      style={baseSurface({
        cursor: "pointer",
        background: "var(--blu-button-bg, #111827)",
        color: "var(--blu-button-fg, #ffffff)",
      })}
    >
      {label}
    </button>
  );
}

export function Text({ value = "", tone = "default" }: TextProps): ReactNode {
  const color =
    tone === "muted"
      ? "var(--blu-text-muted, #6b7280)"
      : tone === "danger"
        ? "var(--blu-text-danger, #b91c1c)"
        : "var(--blu-text, #111827)";
  return <span style={{ color }}>{String(value ?? "")}</span>;
}

export function Input({
  value = "",
  placeholder,
  onChange,
}: InputProps): ReactNode {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={onChange}
      style={baseSurface({
        width: "100%",
        background: "var(--blu-input-bg, #ffffff)",
      })}
    />
  );
}

export function Card({ children }: CardProps): ReactNode {
  return (
    <section
      style={{
        ...baseSurface({
          background: "var(--blu-card-bg, #ffffff)",
        }),
        padding: 16,
      }}
    >
      {children}
    </section>
  );
}

export function ModalContent({
  title,
  children,
}: ModalContentProps): ReactNode {
  return (
    <div style={{ display: "grid", gap: 12 }}>
      {title !== undefined ? <h2>{title}</h2> : null}
      <div>{children}</div>
    </div>
  );
}

export const bluUiEntries: readonly RegistryEntry<Record<string, unknown>>[] = [
  {
    urn: "urn:blu:ui:button",
    component: Button as ComponentType<Record<string, unknown>>,
    meta: createMeta("urn:blu:ui:button", "Button", "ui"),
  },
  {
    urn: "urn:blu:ui:text",
    component: Text as ComponentType<Record<string, unknown>>,
    meta: createMeta("urn:blu:ui:text", "Text", "primitive"),
  },
  {
    urn: "urn:blu:ui:input",
    component: Input as ComponentType<Record<string, unknown>>,
    meta: createMeta("urn:blu:ui:input", "Input", "form"),
  },
  {
    urn: "urn:blu:ui:card",
    component: Card as ComponentType<Record<string, unknown>>,
    meta: createMeta("urn:blu:ui:card", "Card", "ui"),
  },
  {
    urn: "urn:blu:ui:modal-content",
    component: ModalContent as ComponentType<Record<string, unknown>>,
    meta: createMeta("urn:blu:ui:modal-content", "ModalContent", "block"),
  },
];

function createMeta(
  urn: string,
  displayName: string,
  category: ComponentMeta["category"],
): ComponentMeta {
  return {
    urn,
    displayName,
    description: `${displayName} UI primitive`,
    category,
    version: "1.0.0",
    props: {
      type: "object",
      properties: {},
    },
  };
}

function baseSurface(extra: CSSProperties): CSSProperties {
  return {
    border: "1px solid var(--blu-border, #d1d5db)",
    borderRadius: 12,
    padding: "10px 14px",
    font: "inherit",
    ...extra,
  };
}
