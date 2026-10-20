/** Text-driven column widths for the structural view join editor.
 * Each connection row uses the maximum width from its JOIN so subsequent
 * rows and the action rail align regardless of hovered element.
 */
export const getJoinFieldWidth = (path?: string[]): number => {
  const label = path?.[path.length - 1] || '';
  const textWidth = Array.from(label).reduce(
    (total, char) => total + (char.charCodeAt(0) > 255 ? 14 : 8),
    0,
  );
  return Math.min(300, Math.max(112, textWidth + 52));
};

export const getJoinConditionWidths = (
  conditions: Array<{ left?: string[]; right?: string[] }> = [],
) =>
  conditions.reduce(
    (columns, condition) => ({
      left: Math.max(columns.left, getJoinFieldWidth(condition.left)),
      right: Math.max(columns.right, getJoinFieldWidth(condition.right)),
    }),
    { left: 112, right: 112 },
  );