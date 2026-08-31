import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  InteractionFieldMapper,
  InteractionMouseEvent,
} from '../../../constants';
import ViewDetailPanel from '../ViewDetailPanel';

describe('<ViewDetailPanel />', () => {
  test('keeps the technical field value while displaying the dataset name', async () => {
    const user = userEvent.setup();

    render(
      <ViewDetailPanel
        ancestors={[]}
        data={
          {
            value: {
              event: InteractionMouseEvent.Left,
              mapper: InteractionFieldMapper.Customize,
              customize: ['city_name_std'],
            },
          } as any
        }
        context={{
          dataview: {
            meta: [
              {
                fieldId: 'field-city',
                name: 'city_name_std',
                originName: 'city_name_std',
                displayName: '城市',
              },
            ],
          },
        }}
      />,
    );

    await user.click(screen.getByRole('combobox'));

    expect(
      document.querySelector('.ant-select-item-option-content'),
    ).toHaveTextContent('城市');
    expect(
      document.querySelector('.ant-select-item-option-selected'),
    ).not.toBeNull();
  });
});
