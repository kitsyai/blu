import type { ComponentType, CSSProperties, ReactNode } from "react";
import type { ComponentMeta } from "@kitsy/blu-schema";

export interface StackProps {
  gap?: number | string;
  align?: CSSProperties["alignItems"];
  justify?: CSSProperties["justifyContent"];
  children?: ReactNode;
}

export interface RowProps extends StackProps {
  wrap?: CSSProperties["flexWrap"];
}

export interface RegistryEntry<TProps extends Record<string, unknown>> {
  urn: string;
  component: ComponentType<TProps>;
  meta: ComponentMeta;
}

export function Stack({
  gap = 12,
  align,
  justify,
  children,
}: StackProps): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap,
        alignItems: align,
        justifyContent: justify,
      }}
    >
      {children}
    </div>
  );
}

export function Row({
  gap = 12,
  align,
  justify,
  wrap = "nowrap",
  children,
}: RowProps): ReactNode {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap,
        flexWrap: wrap,
        alignItems: align,
        justifyContent: justify,
      }}
    >
      {children}
    </div>
  );
}

export const bluGridEntries: readonly RegistryEntry<Record<string, unknown>>[] =
  [
    {
      urn: "urn:blu:grid:stack",
      component: Stack as ComponentType<Record<string, unknown>>,
      meta: createMeta("urn:blu:grid:stack", "Stack"),
    },
    {
      urn: "urn:blu:grid:row",
      component: Row as ComponentType<Record<string, unknown>>,
      meta: createMeta("urn:blu:grid:row", "Row"),
    },
  ];

function createMeta(urn: string, displayName: string): ComponentMeta {
  return {
    urn,
    displayName,
    description: `${displayName} layout primitive`,
    category: "layout",
    version: "1.0.0",
    props: {
      type: "object",
      properties: {},
    },
  };
}
