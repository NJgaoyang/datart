import { ReloadOutlined } from '@ant-design/icons';
import { Button, Card, Descriptions, Empty, Modal, Table, Tag } from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import dayjs from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import { TIME_FORMATTER } from 'globalConstants';
import { useSelector } from 'react-redux';
import { selectOrgId } from '../../slice/selectors';
import { request2 } from 'utils/request';

interface QueryTrace {
  id: string;
  sourceName?: string;
  reportName?: string;
  status?: string;
  elapsedMs?: number;
  sql?: string;
  sqlDigest?: string;
  startedAt?: number;
  endedAt?: number;
}

interface PoolStatus {
  sourceId: string;
  sourceName: string;
  initialized?: boolean;
  activeCount?: number;
  poolingCount?: number;
  maxActive?: number;
  waitThreadCount?: number;
  queryTimeout?: number;
}

interface MonitorResponse {
  sources: PoolStatus[];
  traces: QueryTrace[];
}

const statusColor: Record<string, string> = {
  RUNNING: 'processing',
  SUCCESS: 'success',
  ERROR: 'error',
};

export function MonitorPage() {
  const t = useI18NPrefix('monitor');
  const orgId = useSelector(selectOrgId);
  const [data, setData] = useState<MonitorResponse>({ sources: [], traces: [] });
  const [loading, setLoading] = useState(false);
  const [selectedTrace, setSelectedTrace] = useState<QueryTrace>();

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    try {
      const response = await request2<MonitorResponse>({
        url: '/data-provider/monitor',
        method: 'GET',
        params: { orgId },
      });
      setData(response.data || { sources: [], traces: [] });
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const columns = useMemo(
    () => [
      {
        title: t('reportName'),
        dataIndex: 'reportName',
        width: 220,
        ellipsis: true,
        render: (value: string, record: QueryTrace) =>
          value || record.sourceName || '-',
      },
      {
        title: t('status'),
        dataIndex: 'status',
        width: 100,
        render: (value: string) => (
          <Tag color={statusColor[value] || 'default'}>
            {value || '-'}
          </Tag>
        ),
      },
      {
        title: t('duration'),
        dataIndex: 'elapsedMs',
        width: 110,
        render: (value: number) => (value == null ? '-' : `${value} ms`),
      },
      {
        title: t('sql'),
        dataIndex: 'sql',
        width: 440,
        render: (value: string, record: QueryTrace) => {
          const summary = (value || record.sqlDigest || '-').replace(/\s+/g, ' ').trim();
          return (
            <SqlCell>
              <span title={summary}>{summary}</span>
              {value && (
                <Button type="link" size="small" onClick={() => setSelectedTrace(record)}>
                  {t('detail')}
                </Button>
              )}
            </SqlCell>
          );
        },
      },
      {
        title: t('startedAt'),
        dataIndex: 'startedAt',
        width: 180,
        render: (value: number) =>
          value ? dayjs(value).format(TIME_FORMATTER) : '-',
      },
      {
        title: t('endedAt'),
        dataIndex: 'endedAt',
        width: 180,
        render: (value: number) =>
          value ? dayjs(value).format(TIME_FORMATTER) : '-',
      },
    ],
    [t],
  );

  return (
    <Page>
      <Header>
        <h2>{t('title')}</h2>
        <Button icon={<ReloadOutlined />} loading={loading} onClick={load}>
          {t('refresh')}
        </Button>
      </Header>
      <Card title={t('poolTitle')}>
        {data.sources.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('emptyPool')} />
        ) : (
          <PoolGrid>
            {data.sources.map(source => (
              <Card key={source.sourceId} size="small" title={source.sourceName}>
                {!source.initialized ? (
                  <span>{t('notInitialized')}</span>
                ) : (
                  <Descriptions size="small" column={2}>
                    <Descriptions.Item label={t('active')}>
                      {source.activeCount ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('idle')}>
                      {source.poolingCount ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('maxActive')}>
                      {source.maxActive ?? '-'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('waiting')}>
                      {source.waitThreadCount ?? '-'}
                    </Descriptions.Item>
                  </Descriptions>
                )}
              </Card>
            ))}
          </PoolGrid>
        )}
      </Card>
      <Card title={t('queryTitle')}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={data.traces}
          columns={columns}
          scroll={{ x: 1230 }}
          pagination={{ pageSize: 20, showSizeChanger: true }}
          locale={{ emptyText: t('emptyQuery') }}
        />
      </Card>
      <Modal
        visible={Boolean(selectedTrace)}
        title={t('sqlDetail')}
        footer={null}
        width={900}
        onCancel={() => setSelectedTrace(undefined)}
      >
        <SqlPreview>{selectedTrace?.sql || '-'}</SqlPreview>
      </Modal>
    </Page>
  );
}

const Page = styled.div`
  flex: 1;
  padding: 24px;
  overflow: auto;

  > .ant-card + .ant-card {
    margin-top: 16px;
  }
`;

const Header = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;

  h2 {
    margin: 0;
  }
`;

const PoolGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 12px;
`;

const SqlCell = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;

  > span {
    flex: 1;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .ant-btn {
    flex-shrink: 0;
    padding: 0 4px;
  }
`;

const SqlPreview = styled.pre`
  max-height: 60vh;
  padding: 12px;
  margin: 0;
  overflow: auto;
  word-break: break-word;
  white-space: pre-wrap;
  background: #f5f5f5;
`;
