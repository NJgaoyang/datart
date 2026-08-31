import { filterReadinessIssues, ReadinessIssue } from '..';

const issues: ReadinessIssue[] = [
  {
    resourceType: 'VIEW',
    resourceId: 'view-1',
    resourceName: '城市视图',
    severity: 'WARNING',
    code: 'VIEW_LEGACY_MODEL_METADATA',
    message: 'View model can be canonicalized',
  },
  {
    resourceType: 'DATACHART',
    resourceId: 'chart-1',
    resourceName: '城市图表',
    severity: 'BLOCKER',
    code: 'DATACHART_FIELD_NOT_FOUND',
    message: 'Datachart field cannot be resolved',
  },
];

describe('readiness issue filters', () => {
  test('filters by severity, scope, and free-text search', () => {
    expect(
      filterReadinessIssues(issues, {
        severity: 'BLOCKER',
        scope: 'DATACHART',
        search: 'FIELD_NOT_FOUND',
      }),
    ).toEqual([issues[1]]);
    expect(
      filterReadinessIssues(issues, {
        severity: 'ALL',
        scope: 'ALL',
        search: '城市视图',
      }),
    ).toEqual([issues[0]]);
  });
});
