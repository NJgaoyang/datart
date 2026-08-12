/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { SearchOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  TableColumnProps,
  Tag,
} from 'antd';
import useI18NPrefix from 'app/hooks/useI18NPrefix';
import dayjs, { Dayjs } from 'dayjs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import styled from 'styled-components';
import {
  BORDER_RADIUS,
  FONT_SIZE_TITLE,
  FONT_WEIGHT_MEDIUM,
  LINE_HEIGHT_TITLE,
  SPACE_LG,
  SPACE_MD,
} from 'styles/StyleConstants';
import { request2 } from 'utils/request';

interface AccessLogItem {
  id: string;
  user: string;
  resourceType: string;
  resourceId: string;
  resourceName: string;
  accessType: string;
  accessTime: string;
  duration: number;
}

interface AuditLogResult {
  data: AccessLogItem[];
  total: number;
  pageNo: number;
  pageSize: number;
}

const accessTypeColors: Record<string, string> = {
  READ: 'blue',
  CREATE: 'green',
  UPDATE: 'orange',
  DELETE: 'red',
  ARCHIVE: 'purple',
  UNARCHIVE: 'cyan',
  LOGIN: 'geekblue',
};

export function AuditLogPage() {
  const t = useI18NPrefix('auditLog');
  const [data, setData] = useState<AccessLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [pageNo, setPageNo] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [startTime, setStartTime] = useState<Dayjs | null>(
    dayjs().startOf('day'),
  );
  const [endTime, setEndTime] = useState<Dayjs | null>(dayjs());
  const [user, setUser] = useState<string>('');
  const [resourceType, setResourceType] = useState<string | undefined>(
    undefined,
  );

  const fetchData = useCallback(
    async (page: number, size: number) => {
      setLoading(true);
      try {
        const params: Record<string, string | number> = {
          pageNo: page,
          pageSize: size,
        };
        if (startTime) {
          params.startTime = startTime.format('YYYY-MM-DD HH:mm:ss');
        }
        if (endTime) {
          params.endTime = endTime.format('YYYY-MM-DD HH:mm:ss');
        }
        if (user) {
          params.user = user;
        }
        if (resourceType) {
          params.resourceType = resourceType;
        }
        const { data: result } = await request2<AuditLogResult>({
          url: '/audit-logs',
          method: 'GET',
          params,
        });
        setData(result.data || []);
        setTotal(result.total || 0);
      } catch (e) {
        setData([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [startTime, endTime, user, resourceType],
  );

  useEffect(() => {
    fetchData(1, pageSize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSearch = useCallback(() => {
    setPageNo(1);
    fetchData(1, pageSize);
  }, [fetchData, pageSize]);

  const columns: TableColumnProps<AccessLogItem>[] = useMemo(
    () => [
      {
        dataIndex: 'accessTime',
        title: t('accessTime'),
        width: 180,
        render: (_, record) =>
          record.accessTime
            ? dayjs(record.accessTime).format('YYYY-MM-DD HH:mm:ss')
            : '-',
      },
      {
        dataIndex: 'user',
        title: t('user'),
        width: 180,
      },
      {
        dataIndex: 'resourceType',
        title: t('resourceType'),
        width: 120,
        render: (_, record) => {
          const type = record.resourceType || '';
          return t(`resourceTypes.${type}`) || type;
        },
      },
      {
        dataIndex: 'accessType',
        title: t('accessType'),
        width: 100,
        render: (_, record) => {
          const type = record.accessType || '';
          const label = t(`accessTypes.${type}`) || type;
          return <Tag color={accessTypeColors[type] || 'default'}>{label}</Tag>;
        },
      },
      {
        dataIndex: 'resourceName',
        title: t('resource'),
        width: 280,
        ellipsis: true,
        render: (_, record) => record.resourceName || record.resourceId || '-',
      },
      {
        dataIndex: 'duration',
        title: t('duration'),
        width: 100,
        render: (val: number) => (val != null ? val : '-'),
      },
    ],
    [t],
  );

  const pagination = useMemo(
    () => ({
      current: pageNo,
      pageSize,
      total,
      showSizeChanger: true,
      pageSizeOptions: ['20', '50', '100'],
      showTotal: (totalNum: number) => t('total', false, { total: totalNum }),
      onChange: (p: number, s?: number) => {
        setPageNo(p);
        if (s) setPageSize(s);
        fetchData(p, s || pageSize);
      },
    }),
    [pageNo, pageSize, total, fetchData, t],
  );

  return (
    <Wrapper>
      <Card>
        <TableHeader>
          <h3>{t('title')}</h3>
        </TableHeader>
        <FilterBar>
          <Space style={{ width: '100%' }}>
            <span>{t('startTime')}:</span>
            <DatePicker
              showTime
              value={startTime}
              onChange={v => setStartTime(v)}
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: 180 }}
            />
            <span>{t('endTime')}:</span>
            <DatePicker
              showTime
              value={endTime}
              onChange={v => setEndTime(v)}
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: 180 }}
            />
            <span>{t('user')}:</span>
            <Input
              value={user}
              onChange={e => setUser(e.target.value)}
              placeholder={t('user')}
              style={{ width: 120 }}
              allowClear
            />
            <span>{t('resourceType')}:</span>
            <Select
              value={resourceType}
              onChange={v => setResourceType(v)}
              placeholder={t('resourceType')}
              style={{ width: 120 }}
              allowClear
            >
              <Select.Option value="SOURCE">{t('resourceTypes.SOURCE') || '数据源'}</Select.Option>
              <Select.Option value="VIEW">{t('resourceTypes.VIEW') || '数据视图'}</Select.Option>
              <Select.Option value="DATACHART">{t('resourceTypes.DATACHART') || '数据图表'}</Select.Option>
              <Select.Option value="WIDGET">{t('resourceTypes.WIDGET') || '组件'}</Select.Option>
              <Select.Option value="DASHBOARD">{t('resourceTypes.DASHBOARD') || '仪表板'}</Select.Option>
              <Select.Option value="FOLDER">{t('resourceTypes.FOLDER') || '目录'}</Select.Option>
              <Select.Option value="STORYBOARD">{t('resourceTypes.STORYBOARD') || '故事板'}</Select.Option>
              <Select.Option value="VIZ">{t('resourceTypes.VIZ') || '可视化'}</Select.Option>
              <Select.Option value="SCHEDULE">{t('resourceTypes.SCHEDULE') || '定时任务'}</Select.Option>
              <Select.Option value="ROLE">{t('resourceTypes.ROLE') || '角色'}</Select.Option>
              <Select.Option value="USER">{t('resourceTypes.USER') || '用户'}</Select.Option>
            </Select>
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleSearch}
            >
              {t('query')}
            </Button>
          </Space>
        </FilterBar>
        <Table
          rowKey="id"
          size="small"
          dataSource={data}
          columns={columns}
          loading={loading}
          pagination={pagination}
          scroll={{ x: 900 }}
          locale={{ emptyText: t('empty') }}
        />
      </Card>
    </Wrapper>
  );
}

const Wrapper = styled.div`
  flex: 1;
  padding: ${SPACE_LG};
  overflow: auto;

  .ant-card {
    background-color: ${p => p.theme.componentBackground};
    border-radius: ${BORDER_RADIUS};
    box-shadow: ${p => p.theme.shadow1};

    .ant-card-body {
      padding: 0 ${SPACE_LG};
    }
  }
`;

const TableHeader = styled.div`
  display: flex;
  align-items: center;
  padding: ${SPACE_MD} 0;

  h3 {
    flex: 1;
    font-size: ${FONT_SIZE_TITLE};
    font-weight: ${FONT_WEIGHT_MEDIUM};
    line-height: ${LINE_HEIGHT_TITLE};
  }
`;

const FilterBar = styled.div`
  padding-bottom: ${SPACE_MD};
  overflow-x: auto;
`;
