export interface ComputedFieldDisplayName {
  name: string;
  label: string;
  /** Physical source path. A SQL view output uses a single name segment. */
  path?: string[];
}

const fieldPath = (field: ComputedFieldDisplayName) =>
  field.path?.length ? field.path : [field.name];

export const formatComputedFieldIdentifier = (path: string[]) =>
  path.map(part => `[${part.replace(/]/g, ']]')}]`).join('.');

export const disambiguateComputedFieldNames = (
  fields: ComputedFieldDisplayName[],
) => {
  const counts = new Map<string, number>();
  fields.forEach(field =>
    counts.set(field.label, (counts.get(field.label) || 0) + 1),
  );
  return fields.map(field => ({
    ...field,
    label:
      counts.get(field.label)! > 1
        ? `${field.label}（${fieldPath(field).join('.')}）`
        : field.label,
  }));
};

export const findComputedFieldByKey = (
  fields: ComputedFieldDisplayName[],
  key: string | string[],
) => {
  const matches = fields.filter(field =>
    Array.isArray(key)
      ? JSON.stringify(fieldPath(field)) === JSON.stringify(key)
      : field.name === key,
  );
  return matches.length === 1 ? matches[0] : undefined;
};

type Replacements = Map<string, string | undefined>;

const addReplacement = (
  replacements: Replacements,
  path: string[],
  replacement: string,
) => {
  const key = JSON.stringify(path);
  // An ambiguous legacy bare name must never silently select a JOIN source.
  if (replacements.has(key) && replacements.get(key) !== replacement) {
    replacements.set(key, undefined);
  } else if (!replacements.has(key)) {
    replacements.set(key, replacement);
  }
};

const replaceIdentifiers = (
  expression: string | undefined,
  replacements: Replacements,
) => {
  // Treat a qualified [table].[column] as one token. Skip quoted literals and
  // comments so text such as '[城市]' does not become a field reference.
  const tokens = /'(?:''|\\.|[^'\\])*'|"(?:""|\\.|[^"\\])*"|`(?:``|\\.|[^`\\])*`|--[^\r\n]*|\/\*[\s\S]*?\*\/|(\[(?:[^\]]|\]\])*\](?:\s*\.\s*\[(?:[^\]]|\]\])*\])*)/g;
  return (expression || '').replace(tokens, (matched, identifier) => {
    if (!identifier) return matched;
    const parts = Array.from(
      (identifier as string).matchAll(/\[((?:[^\]]|\]\])*)\]/g),
      part => part[1].replace(/\]\]/g, ']'),
    );
    return replacements.get(JSON.stringify(parts)) ?? matched;
  });
};

export const toDisplayExpression = (
  expression: string | undefined,
  fieldNames: ComputedFieldDisplayName[],
) => {
  const replacements: Replacements = new Map();
  fieldNames.forEach(field => {
    const label = formatComputedFieldIdentifier([field.label]);
    addReplacement(replacements, fieldPath(field), label);
    // Existing single-table expressions can still use an unqualified name.
    addReplacement(replacements, [field.name], label);
  });
  return replaceIdentifiers(expression, replacements);
};

export const toQueryExpression = (
  expression: string | undefined,
  fieldNames: ComputedFieldDisplayName[],
) => {
  const replacements: Replacements = new Map();
  fieldNames.forEach(field =>
    addReplacement(
      replacements,
      [field.label],
      formatComputedFieldIdentifier(fieldPath(field)),
    ),
  );
  return replaceIdentifiers(expression, replacements);
};
