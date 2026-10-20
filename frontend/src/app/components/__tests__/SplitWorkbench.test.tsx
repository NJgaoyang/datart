import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Split from '../Split';

describe('SQL workbench split geometry', () => {
  it('creates two independently sized vertical panes for SQL and results', () => {
    const { container } = render(
      <div style={{ height: 600 }}>
        <Split direction="vertical" sizes={[55, 45]} minSize={[160, 120]} gutterSize={0}>
          <div data-testid="sql-pane">Saved SQL is still in the editor</div>
          <div data-testid="result-pane">Query result pane</div>
        </Split>
      </div>,
    );
    const editor = screen.getByTestId('sql-pane');
    const results = screen.getByTestId('result-pane');
    expect(editor).toBeInTheDocument();
    expect(results).toBeInTheDocument();
    expect(container.querySelectorAll('.gutter-vertical')).toHaveLength(1);
    // split.js must set the sizes on BOTH panes. Flex rules must not override
    // this explicit geometry in the SQL Workbench and Outputs wrappers.
    expect(editor.style.height).toContain('55%');
    expect(results.style.height).toContain('45%');
  });
});
