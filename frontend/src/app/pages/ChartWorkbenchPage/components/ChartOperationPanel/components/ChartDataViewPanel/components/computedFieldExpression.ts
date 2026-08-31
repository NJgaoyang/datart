export interface ComputedFieldDisplayName {
  name: string;
  label: string;
}

const replaceFieldNames = (
  expression: string | undefined,
  fieldNames: ComputedFieldDisplayName[],
  sourceKey: keyof ComputedFieldDisplayName,
  targetKey: keyof ComputedFieldDisplayName,
) => {
  const replacements = new Map(
    fieldNames.map(field => [field[sourceKey], field[targetKey]]),
  );

  return (expression || '').replace(/\[([^\]]+)]/g, (matched, fieldName) => {
    const replacement = replacements.get(fieldName);
    return replacement ? `[${replacement}]` : matched;
  });
};

export const toDisplayExpression = (
  expression: string | undefined,
  fieldNames: ComputedFieldDisplayName[],
) => replaceFieldNames(expression, fieldNames, 'name', 'label');

export const toQueryExpression = (
  expression: string | undefined,
  fieldNames: ComputedFieldDisplayName[],
) => replaceFieldNames(expression, fieldNames, 'label', 'name');
