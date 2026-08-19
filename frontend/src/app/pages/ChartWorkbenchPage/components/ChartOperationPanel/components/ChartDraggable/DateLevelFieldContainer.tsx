import { CalendarOutlined } from '@ant-design/icons';
import { Row } from 'antd';
import { IW } from 'app/components/IconWrapper';
import { CHART_DRAG_ELEMENT_TYPE } from 'globalConstants';
import { useDrag } from 'react-dnd';
import styled from 'styled-components';
import { FONT_SIZE_TITLE, INFO } from 'styles/StyleConstants';
import { dateLevelFieldsProps } from '../../../../slice/types';
import { handleDateLevelsName } from '../../utils';

function DateLevelFieldContainer({
  onClearCheckedList,
  parentDisplayName,
  item,
}: {
  onClearCheckedList?: () => any;
  parentDisplayName?: string;
  item: dateLevelFieldsProps;
}) {
  const displayName = handleDateLevelsName(item, parentDisplayName);
  const [, drag] = useDrag(
    () => ({
      type: CHART_DRAG_ELEMENT_TYPE.DATASET_COLUMN,
      canDrag: true,
      item: {
        field: item.field,
        fieldId: item?.fieldId,
        colName: item?.name,
        type: item?.type,
        category: item?.category,
        expression: item?.expression,
        path: item?.path,
        displayName: item?.displayName,
        comment: item?.comment,
        isDisplayNameCustom: item?.isDisplayNameCustom,
      },
      collect: monitor => ({
        isDragging: monitor.isDragging(),
      }),
      end: onClearCheckedList,
    }),
    [item, onClearCheckedList],
  );

  return (
    <ItemWrapper ref={drag}>
      <Row>
        <IW fontSize={FONT_SIZE_TITLE}>
          {<CalendarOutlined style={{ color: INFO }} />}
        </IW>
        <p>{displayName}</p>
      </Row>
    </ItemWrapper>
  );
}
export default DateLevelFieldContainer;

const ItemWrapper = styled.div`
  color: ${p => p.theme.textColorSnd};
  width: max-content;
  min-width: 100%;
  white-space: nowrap;
`;
