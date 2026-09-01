import { InteractionMouseEvent } from 'app/components/FormGenerator/constants';
import useChartInteractions from 'app/hooks/useChartInteractions';
import useDisplayJumpVizDialog from 'app/pages/MainPage/pages/VizPage/hooks/useDisplayJumpVizDialog';
import useDisplayViewDetail from 'app/pages/MainPage/pages/VizPage/hooks/useDisplayViewDetail';
import { ChartMouseEventParams } from 'app/types/Chart';
import { ChartDataSectionField } from 'app/types/ChartConfig';
import {
  getColumnRenderName,
  toFormattedValue,
  transformToDataSet,
} from 'app/utils/chartHelper';
import { reconcileChartConfigFieldMeta } from 'app/utils/internalChartHelper';
import { useMemo, useCallback, useContext } from 'react';
import useModal from 'antd/lib/modal/useModal';
import styled from 'styled-components';
import { WidgetActionContext } from '../../ActionProvider/WidgetActionProvider';
import { BoardContext } from '../../BoardProvider/BoardProvider';
import { WidgetChartContext } from '../../WidgetProvider/WidgetChartProvider';
import { WidgetDataContext } from '../../WidgetProvider/WidgetDataProvider';
import { WidgetContext } from '../../WidgetProvider/WidgetProvider';
import { WidgetInfoContext } from '../../WidgetProvider/WidgetInfoProvider';
import { DataChartWidgetCore } from './DataChartWidgetCore';
import {
  getMobileTableFields,
  isMobileDimension,
  isMobileMeasure,
  isMobileRankField,
  resolveMobilePresentation,
} from '../../../mobile/MobilePresentationResolver';

const formatValue = (value: any, field: ChartDataSectionField) => {
  const formatted = toFormattedValue(value, field.format);
  if (value === null || value === undefined) return '-';
  const numericValue = typeof value === 'number' ? value : Number(value);
  if (field.format?.type || value === '' || !Number.isFinite(numericValue)) {
    return String(formatted ?? '-');
  }
  return new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(
    numericValue,
  );
};

const rowDataOf = row => row.convertToCaseSensitiveObject();
const fieldLabel = (field: ChartDataSectionField) => getColumnRenderName(field);

export const MobileTablePresentation: React.FC = () => {
  const { dataChart, chartDataView } = useContext(WidgetChartContext);
  const { data } = useContext(WidgetDataContext);
  const { loading } = useContext(WidgetInfoContext);
  const widget = useContext(WidgetContext);
  const { orgId, queryVariables } = useContext(BoardContext);
  const { onWidgetLinkEvent } = useContext(WidgetActionContext);
  const [openViewDetailPanel, viewDetailPanelContextHolder] =
    useDisplayViewDetail();
  const [openJumpVizDialogModal, openJumpVizDialogModalContextHolder] =
    useDisplayJumpVizDialog();
  const [jumpDialogModal, jumpDialogContextHolder] = useModal();
  const {
    getDrillThroughSetting,
    getCrossFilteringSetting,
    getViewDetailSetting,
    handleDrillThroughEvent,
    handleCrossFilteringEvent,
    handleViewDataEvent,
  } = useChartInteractions({
    openViewDetailPanel: openViewDetailPanel as Function,
    openJumpVizDialogModal: openJumpVizDialogModal as Function,
    openJumpUrlDialogModal: jumpDialogModal.info,
  });

  const chartConfig = useMemo(() => {
    const baseConfig = dataChart?.config?.chartConfig;
    if (!baseConfig) return undefined;
    return reconcileChartConfigFieldMeta(baseConfig, chartDataView?.meta || []);
  }, [dataChart?.config?.chartConfig, chartDataView?.meta]);
  const fields = useMemo(
    () => getMobileTableFields(chartConfig),
    [chartConfig],
  );
  const mode = useMemo(
    () => resolveMobilePresentation(data, chartConfig),
    [chartConfig, data],
  );
  const dataSet = useMemo(
    () => transformToDataSet(data?.rows, data?.columns, chartConfig?.datas),
    [chartConfig?.datas, data?.columns, data?.rows],
  );
  const dimensions = fields.filter(isMobileDimension);
  const measures = fields.filter(isMobileMeasure);
  const isAggregateKpi = mode === 'kpi-grid' && dataSet.length > 1;
  const kpiScope = isAggregateKpi
    ? `全部${dimensions[0] ? fieldLabel(dimensions[0]) : '城市'}合计`
    : dimensions[0] && dataSet[0]
    ? String(dataSet[0].getCell(dimensions[0]))
    : '';
  const getKpiValue = useCallback(
    (field: ChartDataSectionField) => {
      if (!isAggregateKpi) return dataSet[0]?.getCell(field);
      return dataSet.reduce((total, row) => {
        const value = Number(row.getCell(field));
        return Number.isFinite(value) ? total + value : total;
      }, 0);
    },
    [dataSet, isAggregateKpi],
  );

  const handleRowClick = useCallback(
    (row, field?: ChartDataSectionField) => {
      const rowData = rowDataOf(row);
      const clickParams: ChartMouseEventParams & { selectedItems: any[] } = {
        chartType: 'table',
        componentType: 'table',
        seriesName: field?.colName,
        name: field ? String(row.getCell(field)) : undefined,
        data: {
          name: field ? String(row.getCell(field)) : '',
          value: field ? row.getCell(field) : '',
          rowData,
        },
        selectedItems: [{ data: { rowData } }],
      };
      const drillThroughSetting = getDrillThroughSetting(
        chartConfig?.interactions,
        widget.config?.customConfig?.interactions,
      );
      const crossFilteringSetting = getCrossFilteringSetting(
        chartConfig?.interactions,
        widget.config?.customConfig?.interactions,
      );
      const viewDetailSetting = getViewDetailSetting(
        chartConfig?.interactions,
        widget.config?.customConfig?.interactions,
      );
      const interactionContext = {
        drillOption: undefined,
        clickEventParams: clickParams,
        targetEvent: InteractionMouseEvent.Left,
        orgId,
        view: chartDataView,
        queryVariables,
        computedFields: dataChart?.config?.computedFields,
        aggregation: dataChart?.config?.aggregation,
        chartConfig,
      };
      handleDrillThroughEvent({
        ...interactionContext,
        drillThroughSetting,
      });
      handleCrossFilteringEvent(
        { ...interactionContext, crossFilteringSetting },
        onWidgetLinkEvent(widget),
      );
      handleViewDataEvent({ ...interactionContext, viewDetailSetting });
    },
    [
      chartConfig,
      chartDataView,
      dataChart?.config?.aggregation,
      dataChart?.config?.computedFields,
      getCrossFilteringSetting,
      getDrillThroughSetting,
      getViewDetailSetting,
      handleCrossFilteringEvent,
      handleDrillThroughEvent,
      handleViewDataEvent,
      onWidgetLinkEvent,
      orgId,
      queryVariables,
      widget,
    ],
  );

  if (loading && !data?.rows?.length)
    return (
      <PresentationState className="mobile-table-presentation">
        加载中...
      </PresentationState>
    );
  if (!data?.rows?.length)
    return (
      <PresentationState className="mobile-table-presentation">
        暂无数据
      </PresentationState>
    );

  if (mode === 'table') return <DataChartWidgetCore />;

  if (mode === 'kpi-grid') {
    return (
      <>
        <KpiGrid className="mobile-table-presentation">
          {kpiScope && <KpiScope>{kpiScope}</KpiScope>}
          {measures.map(field => (
            <KpiCard key={field.uid || field.colName}>
              <KpiLabel>{fieldLabel(field)}</KpiLabel>
              <KpiValue>{formatValue(getKpiValue(field), field)}</KpiValue>
            </KpiCard>
          ))}
        </KpiGrid>
        {viewDetailPanelContextHolder}
        {jumpDialogContextHolder}
        {openJumpVizDialogModalContextHolder}
      </>
    );
  }

  if (mode === 'ranking-list') {
    const rankField = fields.find(field => isMobileRankField(field));
    const titleField =
      dimensions.find(field => field !== rankField) || dimensions[0];
    const valueField = measures[0];
    const values = dataSet.map(row => Number(row.getCell(valueField)) || 0);
    const maxValue = Math.max(...values.map(value => Math.abs(value)), 1);
    return (
      <PresentationList className="mobile-table-presentation">
        {dataSet.map((row, index) => {
          const value = Number(row.getCell(valueField)) || 0;
          return (
            <RankingCard
              key={index}
              onClick={() => handleRowClick(row, titleField)}
            >
              <RankingTopLine>
                <RankingIndex>
                  {rankField ? row.getCell(rankField) : index + 1}
                </RankingIndex>
                <RankingTitle>
                  {titleField ? row.getCell(titleField) : `第 ${index + 1} 项`}
                </RankingTitle>
                <RankingValue>
                  {formatValue(row.getCell(valueField), valueField)}
                </RankingValue>
              </RankingTopLine>
              <RankingBar>
                <RankingBarFill
                  style={{ width: `${(Math.abs(value) / maxValue) * 100}%` }}
                />
              </RankingBar>
            </RankingCard>
          );
        })}
        {viewDetailPanelContextHolder}
        {jumpDialogContextHolder}
        {openJumpVizDialogModalContextHolder}
      </PresentationList>
    );
  }

  return (
    <PresentationList className="mobile-table-presentation">
      {dataSet.map((row, index) => {
        const titleField = dimensions[0];
        const subtitleField = dimensions[1];
        const primaryField = measures[0];
        const secondaryFields = measures.slice(1, 5);
        return (
          <EntityCard
            key={index}
            onClick={() => handleRowClick(row, titleField)}
          >
            <EntityHeader>
              <EntityTitle>
                {titleField ? row.getCell(titleField) : `第 ${index + 1} 项`}
              </EntityTitle>
              {subtitleField && (
                <EntitySubtitle>{row.getCell(subtitleField)}</EntitySubtitle>
              )}
            </EntityHeader>
            {primaryField && (
              <PrimaryMetric>
                <PrimaryValue>
                  {formatValue(row.getCell(primaryField), primaryField)}
                </PrimaryValue>
                <PrimaryLabel>{fieldLabel(primaryField)}</PrimaryLabel>
              </PrimaryMetric>
            )}
            <SecondaryMetrics>
              {secondaryFields.map(field => (
                <SecondaryMetric key={field.uid || field.colName}>
                  <SecondaryLabel>{fieldLabel(field)}</SecondaryLabel>
                  <SecondaryValue>
                    {formatValue(row.getCell(field), field)}
                  </SecondaryValue>
                </SecondaryMetric>
              ))}
            </SecondaryMetrics>
          </EntityCard>
        );
      })}
      {viewDetailPanelContextHolder}
      {jumpDialogContextHolder}
      {openJumpVizDialogModalContextHolder}
    </PresentationList>
  );
};

const PresentationState = styled.div`
  box-sizing: border-box;
  display: flex;
  flex: 0 0 72px;
  align-items: center;
  align-self: flex-start;
  justify-content: center;
  width: 100%;
  height: 72px;
  padding: 8px;
  color: #8f959e;
`;

const PresentationList = styled.div`
  box-sizing: border-box;
  display: grid;
  gap: 8px;
  align-self: flex-start;
  width: 100%;
  height: auto;
  max-height: 100%;
  padding: 8px;
  overflow: auto;
`;

const KpiGrid = styled(PresentationList)`
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 4px;
  align-content: start;
  align-items: start;
  max-height: none;
  overflow: visible;
  overscroll-behavior: contain;
`;

const KpiScope = styled.div`
  grid-column: 1 / -1;
  padding: 0 2px;
  overflow: hidden;
  font-size: 11px;
  line-height: 16px;
  color: #8f959e;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const KpiCard = styled.div`
  min-height: 58px;
  padding: 6px;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 12px;
`;

const KpiLabel = styled.div`
  height: 32px;
  overflow: hidden;
  font-size: 11px;
  line-height: 16px;
  color: #8f959e;
  word-break: break-all;
`;

const KpiValue = styled.div`
  margin-top: 2px;
  overflow: hidden;
  font-size: 18px;
  font-weight: 600;
  line-height: 24px;
  color: #1f2329;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EntityCard = styled.div`
  padding: 12px;
  cursor: pointer;
  background: #fff;
  border: 1px solid rgba(0, 0, 0, 0.04);
  border-radius: 12px;
`;

const EntityHeader = styled.div`
  display: flex;
  gap: 8px;
  align-items: baseline;
  justify-content: space-between;
`;

const EntityTitle = styled.div`
  overflow: hidden;
  font-size: 15px;
  font-weight: 600;
  line-height: 22px;
  color: #1f2329;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const EntitySubtitle = styled.div`
  flex-shrink: 0;
  overflow: hidden;
  font-size: 12px;
  color: #8f959e;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const PrimaryMetric = styled.div`
  margin-top: 10px;
`;

const PrimaryValue = styled.div`
  font-size: 22px;
  font-weight: 600;
  line-height: 28px;
  color: #1f2329;
`;

const PrimaryLabel = styled.div`
  font-size: 11px;
  line-height: 16px;
  color: #8f959e;
`;

const SecondaryMetrics = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
  margin-top: 10px;
`;

const SecondaryMetric = styled.div`
  min-width: 0;
`;

const SecondaryLabel = styled.div`
  overflow: hidden;
  font-size: 11px;
  line-height: 16px;
  color: #8f959e;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const SecondaryValue = styled.div`
  overflow: hidden;
  font-size: 14px;
  line-height: 20px;
  color: #1f2329;
  text-overflow: ellipsis;
  white-space: nowrap;
`;

const RankingCard = styled(EntityCard)`
  padding: 10px 12px;
`;

const RankingTopLine = styled.div`
  display: flex;
  gap: 8px;
  align-items: center;
`;

const RankingIndex = styled.div`
  flex: 0 0 24px;
  font-size: 13px;
  color: #8f959e;
  text-align: center;
`;

const RankingTitle = styled(EntityTitle)`
  flex: 1;
`;

const RankingValue = styled.div`
  flex-shrink: 0;
  font-size: 14px;
  color: #1f2329;
`;

const RankingBar = styled.div`
  height: 4px;
  margin: 8px 0 0 32px;
  overflow: hidden;
  background: #edf0f3;
  border-radius: 2px;
`;

const RankingBarFill = styled.div`
  height: 100%;
  background: #3370ff;
  border-radius: inherit;
`;
