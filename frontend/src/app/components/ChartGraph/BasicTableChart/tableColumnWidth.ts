/**
 * Fit automatically measured column content without stretching it to the
 * dashboard widget width. Explicit user column widths are left unchanged.
 */
export function fitTableColumnWidth({
  desiredWidth,
  numeric,
  customWidth,
  useCustomWidth,
  isMobile,
}: {
  desiredWidth: number;
  numeric: boolean;
  customWidth?: number | string;
  useCustomWidth?: boolean;
  isMobile?: boolean;
}): number {
  const configured = Number(customWidth);
  const auto = Math.min(
    numeric ? 220 : 320,
    Math.max(numeric ? 112 : 88, Number.isFinite(desiredWidth) ? desiredWidth : 0),
  );
  const width = useCustomWidth
    ? Number.isFinite(configured) && configured > 0
      ? configured
      : 100
    : auto;
  return isMobile ? Math.min(144, Math.max(72, width)) : width;
}

/** Dataset row values are strings: never concatenate when measuring totals. */
export function sumNumericTableValues(values: Array<unknown>): number {
  return values.reduce<number>((sum, value) => {
    const number = Number(value);
    return Number.isFinite(number) ? sum + number : sum;
  }, 0);
}
