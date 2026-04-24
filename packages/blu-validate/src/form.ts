import type { FormDefinition } from "@kitsy/blu-schema";
import { ErrorCollector, err, ok, type Result } from "./result.js";
import { validateActionInto } from "./action.js";

const FIELD_TYPES = new Set([
  "text",
  "number",
  "boolean",
  "date",
  "select",
  "multiselect",
  "file",
]);

export function validateFormDefinition(form: unknown): Result<FormDefinition> {
  const c = new ErrorCollector("");
  validateFormDefinitionInto(form, c);
  if (c.hasErrors()) return err(c.errors());
  return ok(form as FormDefinition);
}

export function validateFormDefinitionInto(
  form: unknown,
  c: ErrorCollector,
): void {
  if (!isObject(form)) {
    c.push("form.shape.notObject", "FormDefinition must be an object");
    return;
  }
  if (typeof form.id !== "string" || form.id.length === 0) {
    c.push("form.missing.id", "FormDefinition.id is required", "id");
  }
  if (!isObject(form.fields)) {
    c.push(
      "form.missing.fields",
      "FormDefinition.fields must be an object",
      "fields",
    );
  } else {
    for (const [name, field] of Object.entries(form.fields)) {
      const fc = c.child("fields").child(name);
      if (!isObject(field)) {
        fc.push("form.field.shape.notObject", "FormField must be an object");
        continue;
      }
      if (typeof field.type !== "string" || !FIELD_TYPES.has(field.type)) {
        fc.push(
          "form.field.invalid.type",
          "FormField.type must be one of: text, number, boolean, date, select, multiselect, file",
          "type",
        );
      }
      if (
        (field.type === "select" || field.type === "multiselect") &&
        field.enum !== undefined
      ) {
        if (!Array.isArray(field.enum)) {
          fc.push(
            "form.field.invalid.enum",
            "FormField.enum must be an array when present",
            "enum",
          );
        } else {
          field.enum.forEach((entry, i) => {
            if (!isObject(entry) || typeof entry.label !== "string") {
              fc.child("enum").push(
                "form.field.invalid.enum.entry",
                "Each enum entry must be { value, label: string }",
                i,
              );
            }
          });
        }
      }
    }
  }
  if (form.submitAction !== undefined) {
    validateActionInto(form.submitAction, c.child("submitAction"));
  }
  if (form.validation !== undefined) {
    if (!Array.isArray(form.validation)) {
      c.push(
        "form.invalid.validation",
        "FormDefinition.validation must be an array when present",
        "validation",
      );
    } else {
      form.validation.forEach((rule, i) => {
        const rc = c.child("validation").child(i);
        if (!isObject(rule)) {
          rc.push(
            "form.validation.shape.notObject",
            "ValidationRule must be an object",
          );
          return;
        }
        if (typeof rule.id !== "string" || rule.id.length === 0) {
          rc.push(
            "form.validation.missing.id",
            "ValidationRule.id is required",
            "id",
          );
        }
        if (typeof rule.message !== "string" || rule.message.length === 0) {
          rc.push(
            "form.validation.missing.message",
            "ValidationRule.message is required",
            "message",
          );
        }
        if (rule.when === undefined) {
          rc.push(
            "form.validation.missing.when",
            "ValidationRule.when is required",
            "when",
          );
        }
      });
    }
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
