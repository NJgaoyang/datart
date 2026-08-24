import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

vi.mock('react-monaco-editor', () => ({
  default: ({ language, value }: { language?: string; value?: string }) => (
    <div data-testid="monaco-editor" data-language={language}>
      {value}
    </div>
  ),
}));

import ChartComputedFieldEditor from '../ChartComputedFieldEditor';

describe('ChartComputedFieldEditor', () => {
  it('renders an empty expression with the editor contract', () => {
    render(
      <ChartComputedFieldEditor value="" onChange={() => {}} />,
    );

    expect(screen.getByTestId('monaco-editor')).toHaveAttribute(
      'data-language',
      'dql',
    );
    expect(screen.getByTestId('monaco-editor')).toBeEmptyDOMElement();
  });
});
