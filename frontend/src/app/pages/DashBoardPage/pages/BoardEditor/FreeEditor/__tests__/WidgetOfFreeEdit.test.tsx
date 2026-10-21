import { configureStore } from '@reduxjs/toolkit';
import { fireEvent, render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { vi } from 'vitest';
import { WidgetContext } from 'app/pages/DashBoardPage/components/WidgetProvider/WidgetProvider';
import { WidgetActionContext } from 'app/pages/DashBoardPage/components/ActionProvider/WidgetActionProvider';
import { WIDGET_DRAG_HANDLE } from 'app/pages/DashBoardPage/constants';
import { WidgetOfFreeEdit } from '../WidgetOfFreeEdit';

vi.mock('app/pages/DashBoardPage/components/WidgetMapper/WidgetMapper', () => ({
  WidgetMapper: () => <div className={WIDGET_DRAG_HANDLE}>图表拖动区域</div>,
}));

function editor(lock = false) {
  const onEditFreeWidgetRect = vi.fn();
  const store = configureStore({
    reducer: (
      state = {
        editBoard: {
          widgetInfoRecord: {
            'chart-one': { id: 'chart-one', selected: true },
          },
        },
      },
    ) => state,
  });
  const widget = {
    id: 'chart-one',
    config: { rect: { x: 10, y: 20, width: 300, height: 200 }, lock },
  };
  const view = render(
    <Provider store={store}>
      <WidgetContext.Provider value={widget as any}>
        <WidgetActionContext.Provider value={{ onEditFreeWidgetRect } as any}>
          <WidgetOfFreeEdit />
        </WidgetActionContext.Provider>
      </WidgetContext.Provider>
    </Provider>,
  );
  return { ...view, onEditFreeWidgetRect };
}

describe('React 19 free dashboard editing', () => {
  it('mounts, drags, saves the new position and unmounts', () => {
    const { unmount, onEditFreeWidgetRect } = editor();
    fireEvent.mouseDown(screen.getByText('图表拖动区域'), {
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    fireEvent.mouseMove(document, { clientX: 40, clientY: 60 });
    fireEvent.mouseUp(document, { clientX: 40, clientY: 60 });
    expect(onEditFreeWidgetRect).toHaveBeenCalledWith(
      { x: 40, y: 60, width: 300, height: 200 },
      'chart-one',
      false,
    );
    expect(() => unmount()).not.toThrow();
  });

  it('keeps locked widgets immovable and prevents resizing', () => {
    const { container, onEditFreeWidgetRect } = editor(true);
    fireEvent.mouseDown(screen.getByText('图表拖动区域'), {
      button: 0,
      clientX: 10,
      clientY: 20,
    });
    fireEvent.mouseMove(document, { clientX: 40, clientY: 60 });
    fireEvent.mouseUp(document, { clientX: 40, clientY: 60 });
    fireEvent.mouseDown(
      container.querySelector('.react-resizable-handle-se')!,
      {
        button: 0,
        clientX: 300,
        clientY: 200,
      },
    );
    fireEvent.mouseMove(document, { clientX: 330, clientY: 240 });
    fireEvent.mouseUp(document, { clientX: 330, clientY: 240 });
    expect(onEditFreeWidgetRect).not.toHaveBeenCalled();
  });

  it('resizes with the existing handles and saves the new dimensions', () => {
    const { container, onEditFreeWidgetRect } = editor();
    fireEvent.mouseDown(
      container.querySelector('.react-resizable-handle-se')!,
      {
        button: 0,
        clientX: 300,
        clientY: 200,
      },
    );
    fireEvent.mouseMove(document, { clientX: 330, clientY: 240 });
    fireEvent.mouseUp(document, { clientX: 330, clientY: 240 });
    expect(onEditFreeWidgetRect).toHaveBeenCalledWith(
      { x: 10, y: 20, width: 330, height: 240 },
      'chart-one',
      false,
    );
  });
});
