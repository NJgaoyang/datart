import { render } from '@testing-library/react';
import { useEffect } from 'react';
import { vi } from 'vitest';
import ChartComputedFieldSettingPanel from '../ChartComputedFieldSettingPanel';

vi.mock('react-monaco-editor', () => ({
  default: props => {
    useEffect(() => {
      const languages: Array<{ id: string }> = [];
      props.editorWillMount({
        languages: {
          getLanguages: () => languages,
          register: language => languages.push(language),
          setMonarchTokensProvider: vi.fn(),
        },
        editor: { defineTheme: vi.fn() },
      });
      props.editorDidMount(
        {
          getModel: () => ({
            getEOL: () => '\n',
            getWordAtPosition: vi.fn(),
          }),
          onDidChangeCursorPosition: vi.fn(),
        },
        {},
      );
    }, [props]);
    return (
      <div data-testid="computed-field-editor" data-value={props.value || ''} />
    );
  },
}));

describe('ChartComputedFieldSettingPanel', () => {
  it('renders a new field for a SQL data view', () => {
    const { getByTestId } = render(
      <ChartComputedFieldSettingPanel
        viewType="SQL"
        fields={[{ name: 'city', displayName: '城市' }]}
        variables={[]}
        onChange={vi.fn()}
      />,
    );

    expect(getByTestId('computed-field-editor')).toBeInTheDocument();
  });

  it('renders a new field for a structured data view', () => {
    const { getByTestId } = render(
      <ChartComputedFieldSettingPanel
        viewType="STRUCT"
        fields={[
          {
            title: 'report',
            key: ['report'],
            selectable: false,
            children: [{ title: '城市', key: ['report', 'city'] }],
          },
        ] as any}
        variables={[]}
        onChange={vi.fn()}
      />,
    );

    expect(getByTestId('computed-field-editor')).toBeInTheDocument();
  });

  it('restores a saved field when editing', () => {
    const computedField = {
      name: '月份文本',
      type: 'STRING' as any,
      expression: '[month_cn]',
    };
    const onChange = vi.fn();
    const { getByTestId } = render(
      <ChartComputedFieldSettingPanel
        viewType="SQL"
        computedField={computedField}
        fields={[{ name: 'month_cn', displayName: '中文月份' }]}
        variables={[]}
        onChange={onChange}
      />,
    );

    expect(getByTestId('computed-field-editor')).toHaveAttribute(
      'data-value',
      '[中文月份]',
    );
    expect(onChange).toHaveBeenCalledWith(computedField);
  });
});
