interface JoinDraft {
  leftViewId?: string;
  rightViewId?: string;
  joinType?: string;
  conditions?: Array<{ leftColumn?: string; rightColumn?: string }>;
}

/** A generated query is valid only for the exact join definition it used. */
export function getViewJoinSignature(values: JoinDraft = {}): string {
  return JSON.stringify([
    values.leftViewId,
    values.rightViewId,
    values.joinType,
    (values.conditions || []).map(condition => [
      condition?.leftColumn,
      condition?.rightColumn,
    ]),
  ]);
}
