import { render, screen } from '@testing-library/react';
import { Resizable, ResizableBox } from 'react-resizable';

describe('React 19 resizable mount compatibility', () => {
  it('mounts and unmounts a resizable box without the removed findDOMNode API', () => {
    // react-resizable 1.x mounts react-draggable DraggableCore without nodeRef.
    // It throws ReactDOM.findDOMNode is not a function before charts can render.
    const { unmount } = render(
      <ResizableBox width={300} height={200}>
        <div data-testid="resizable-widget">BI chart</div>
      </ResizableBox>,
    );
    expect(screen.getByTestId('resizable-widget')).not.toBeNull();
    expect(() => unmount()).not.toThrow();
  });

  it('mounts the low-level resize handle without a legacy ReactDOM lookup', () => {
    const { unmount } = render(
      <Resizable width={300} height={200} onResize={() => undefined}>
        <div data-testid="resizable-handle-widget">BI chart</div>
      </Resizable>,
    );
    expect(screen.getByTestId('resizable-handle-widget')).not.toBeNull();
    expect(() => unmount()).not.toThrow();
  });
});
