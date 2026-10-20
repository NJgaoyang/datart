/** Adapt pixel gutters to the measured width of an automatic dashboard.
 * Grid-unit widget coordinates stay unchanged when the container resizes.
 */
export const getResponsiveGridSpacing = ({
  width,
  cols,
  margin,
  containerPadding,
}: {
  width: number;
  cols: number;
  margin: readonly [number, number];
  containerPadding: readonly [number, number];
}): {
  margin: [number, number];
  containerPadding: [number, number];
} => {
  const scale =
    cols > 24 && width > 0
      ? Math.min(1, Math.max(0.35, width / 1440))
      : 1;
  const scaled = (values: readonly [number, number]): [number, number] => [
    Math.max(0, Math.round((Number(values[0]) || 0) * scale)),
    Math.max(0, Math.round(Number(values[1]) || 0)),
  ];

  const gridMargin = scaled(margin);
  const gridPadding = scaled(containerPadding);
  // Reserve at least one pixel for each column, including narrow embeds.
  const freeWidth = Math.max(0, width - 2 * gridPadding[0] - cols);
  gridMargin[0] = Math.min(
    gridMargin[0],
    Math.floor(freeWidth / Math.max(1, cols - 1)),
  );

  return { margin: gridMargin, containerPadding: gridPadding };
};
