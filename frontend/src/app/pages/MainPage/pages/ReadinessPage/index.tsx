import {
  ReloadOutlined,
  SearchOutlined,
} from '@ant-design/icons';
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Input,
  Modal,
  Progress,
  Row,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
} from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import styled from 'styled-components';
import { SPACE_MD, SPACE_SM } from 'styles/StyleConstants';
import { request2 } from 'utils/request';
import { MigrationMode } from 'app/types/View';
import { selectOrgId } from '../../slice/selectors';

export type ReadinessSeverity = 'BLOCKER' | 'WARNING';
export interface ReadinessIssue {
  resourceType: string;
  resourceId: string;
  resourceName?: string;
  severity: ReadinessSeverity;
  code: string;
  message: string;
}

export interface ReadinessScopeReport {
  total: number;
  ready: number;
  warnings: number;
  blockers: number;
}

export interface ReadinessReport {
  total: number;
  ready: number;
  warnings: number;
  blockers: number;
  readiness: number;
  strictEligible: boolean;
  issues: ReadinessIssue[];
  scopes: Record<string, ReadinessScopeReport>;
  chartFieldIdCoverage: number;
  resolvedChartFieldIdCoverage: number;
}

export interface MigrationModeStatus {
  orgId: string;
  mode: MigrationMode;
  readiness?: ReadinessReport;
}

export type ReadinessFilters = {
  severity: 'ALL' | ReadinessSeverity;
  scope: string;
  search: string;
};

export function filterReadinessIssues(
  issues: ReadinessIssue[],
  filters: ReadinessFilters,
) {
  const search = filters.search.trim().toLowerCase();
  return issues.filter(issue => {
    if (filters.severity !== 'ALL' && issue.severity !== filters.severity) {
      return false;
    }
    if (filters.scope !== 'ALL' && issue.resourceType !== filters.scope) {
      return false;
    }
    if (!search) return true;
    return [
      issue.resourceType,
      issue.resourceId,
      issue.resourceName,
      issue.code,
      issue.message,
    ]
      .filter(Boolean)
      .some(value => value!.toLowerCase().includes(search));
  });
}

const scopeNames: Record<string, string> = {
  views: 'VIEW',
  datacharts: 'DATACHART',
  dashboards: 'DASHBOARD',
};

const scopeKeys = Object.keys(scopeNames);

export function ReadinessPage() {
  const t = useI18NPrefix('readiness');
  const orgId = useSelector(selectOrgId);
  const [report, setReport] = useState<ReadinessReport>();
  const [mode, setMode] = useState<MigrationMode>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [filters, setFilters] = useState<ReadinessFilters>({
    severity: 'ALL',
    scope: 'ALL',
    search: '',
  });

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(false);
    try {
      const [scanResponse, modeResponse] = await Promise.all([
        request2<ReadinessReport>({
          url: '/admin/readiness/scan',
          method: 'GET',
          params: { orgId },
        }),
        request2<MigrationModeStatus>({
          url: '/admin/readiness/strict-status',
          method: 'GET',
          params: { orgId },
        }),
      ]);
      setReport(scanResponse.data);
      setMode(modeResponse.data.mode);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  const strictReady = Boolean(
    report &&
      report.blockers === 0 &&
      report.strictEligible &&
      report.readiness === 100 &&
      report.chartFieldIdCoverage === 100 &&
      report.resolvedChartFieldIdCoverage === 100,
  );

  const updateMode = (nextMode: MigrationMode) => {
    if (!orgId) return;
    const submit = async () => {
      setLoading(true);
      setError(false);
      try {
        await request2({
          url: '/admin/readiness/mode',
          method: 'PUT',
          data: { orgId, mode: nextMode },
        });
        await load();
      } catch {
        setError(true);
        setLoading(false);
      }
    };
    if (nextMode === 'STRICT') {
      Modal.confirm({
        title: t('strict.confirmTitle'),
        content: t('strict.confirmContent'),
        onOk: submit,
      });
    } else {
      submit();
    }
  };

  useEffect(() => {
    load();
  }, [load]);

  const issues = useMemo(
    () => filterReadinessIssues(report?.issues || [], filters),
    [filters, report?.issues],
  );

  const columns = useMemo(
    () => [
      {
        title: t('issue.severity'),
        dataIndex: 'severity',
        width: 120,
        render: (severity: ReadinessSeverity) => (
          <Tag color={severity === 'BLOCKER' ? 'error' : 'warning'}>
            {severity}
          </Tag>
        ),
      },
      { title: t('issue.resource'), dataIndex: 'resourceType', width: 140 },
      { title: t('issue.name'), dataIndex: 'resourceName', ellipsis: true },
      { title: t('issue.code'), dataIndex: 'code', width: 290 },
      { title: t('issue.message'), dataIndex: 'message', ellipsis: true },
    ],
    [t],
  );

  return (
    <Page>
      <Header>
        <h2>{t('title')}</h2>
        <HeaderActions>
          <Tag color={mode === 'STRICT' ? 'green' : 'blue'}>
            {t('strict.mode')}: {mode || 'COMPAT'}
          </Tag>
          {mode === 'STRICT' ? (
            <Button onClick={() => updateMode('COMPAT')} loading={loading}>
              {t('strict.disable')}
            </Button>
          ) : (
            <Button
              type="primary"
              disabled={!strictReady}
              onClick={() => updateMode('STRICT')}
              loading={loading}
            >
              {t('strict.enable')}
            </Button>
          )}
          <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
            {t('refresh')}
          </Button>
        </HeaderActions>
      </Header>

      {error && <Alert type="error" showIcon message={t('loadError')} />}
      {!report && loading && <Loading><Spin /></Loading>}
      {!report && !loading && !error && (
        <Empty description={t('empty')} />
      )}
      {report && (
        <>
          <Row gutter={[SPACE_MD, SPACE_MD]}>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title={t('readiness')} value={report.readiness} precision={1} suffix="%" /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title={t('strictEligible')} value={report.strictEligible ? t('yes') : t('no')} /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title={t('blockers')} value={report.blockers} /></Card>
            </Col>
            <Col xs={24} sm={12} lg={6}>
              <Card><Statistic title={t('warnings')} value={report.warnings} /></Card>
            </Col>
          </Row>

          <Card title={t('scopes')}>
            <Row gutter={[SPACE_MD, SPACE_MD]}>
              {scopeKeys.map(key => {
                const scope = report.scopes?.[key] || {
                  total: 0,
                  ready: 0,
                  warnings: 0,
                  blockers: 0,
                };
                return (
                  <Col xs={24} md={8} key={key}>
                    <ScopeCard size="small" title={t(`scope.${key}`)}>
                      <Progress
                        percent={scope.total ? (scope.ready * 100) / scope.total : 100}
                        format={percent => `${percent?.toFixed(1)}%`}
                      />
                      <ScopeStats>
                        <span>{t('ready')}: {scope.ready}</span>
                        <span>{t('warnings')}: {scope.warnings}</span>
                        <span>{t('blockers')}: {scope.blockers}</span>
                      </ScopeStats>
                    </ScopeCard>
                  </Col>
                );
              })}
            </Row>
          </Card>

          <Row gutter={[SPACE_MD, SPACE_MD]}>
            <Col xs={24} md={12}>
              <Card><Statistic title={t('chartFieldIdCoverage')} value={report.chartFieldIdCoverage} precision={1} suffix="%" /></Card>
            </Col>
            <Col xs={24} md={12}>
              <Card><Statistic title={t('resolvedChartFieldIdCoverage')} value={report.resolvedChartFieldIdCoverage} precision={1} suffix="%" /></Card>
            </Col>
          </Row>

          <Card title={t('issues')}>
            <Filters>
              <Select
                value={filters.severity}
                style={{ width: 150 }}
                onChange={severity => setFilters(current => ({ ...current, severity }))}
                options={[
                  { value: 'ALL', label: t('filter.all') },
                  { value: 'BLOCKER', label: 'BLOCKER' },
                  { value: 'WARNING', label: 'WARNING' },
                ]}
              />
              <Select
                value={filters.scope}
                style={{ width: 170 }}
                onChange={scope => setFilters(current => ({ ...current, scope }))}
                options={[
                  { value: 'ALL', label: t('filter.all') },
                  ...scopeKeys.map(key => ({
                    value: scopeNames[key],
                    label: t(`scope.${key}`),
                  })),
                ]}
              />
              <Input
                allowClear
                prefix={<SearchOutlined />}
                placeholder={t('filter.search')}
                value={filters.search}
                onChange={event => setFilters(current => ({ ...current, search: event.target.value }))}
              />
            </Filters>
            <Table
              rowKey={(issue: ReadinessIssue) => `${issue.resourceType}:${issue.resourceId}:${issue.code}`}
              loading={loading}
              dataSource={issues}
              columns={columns}
              locale={{ emptyText: t('noIssues') }}
              pagination={{ pageSize: 20, showSizeChanger: true }}
              scroll={{ x: 900 }}
            />
          </Card>
        </>
      )}
    </Page>
  );
}

const Page = styled.div`
  flex: 1;
  padding: ${SPACE_MD};
  overflow-y: auto;
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: ${SPACE_MD};
`;

const HeaderActions = styled.div`
  display: flex;
  gap: ${SPACE_SM};
  align-items: center;
`;

const Loading = styled.div`
  display: flex;
  justify-content: center;
  padding: ${SPACE_MD};
`;

const ScopeCard = styled(Card)`
  height: 100%;
`;

const ScopeStats = styled.div`
  display: flex;
  gap: ${SPACE_SM};
  justify-content: space-between;
  color: ${p => p.theme.textColorLight};
`;

const Filters = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${SPACE_SM};
  margin-bottom: ${SPACE_MD};
`;
