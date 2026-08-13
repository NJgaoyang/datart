import { render } from '@testing-library/react';

describe('ChartComputedFieldEditor browser integration', () => {
  it('renders an empty expression', async () => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: () => ({
        matches: false,
        media: '',
        onchange: null,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      }),
    });

    const { default: ChartComputedFieldEditor } = await import(
      '../ChartComputedFieldEditor'
    );
    const { container } = render(
      <ChartComputedFieldEditor value="" onChange={() => {}} />,
    );

    expect(
      container.querySelector('.react-monaco-editor-container'),
    ).not.toBeNull();
  });
});
