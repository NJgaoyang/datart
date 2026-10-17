import { fitTableColumnWidth, sumNumericTableValues } from '../tableColumnWidth';

describe('table column content sizing', () => {
  it('sums numeric strings instead of concatenating rows into a huge width', () => {
    expect(sumNumericTableValues(['2043', '0', '27196', null, 'invalid'])).toBe(29239);
    expect(sumNumericTableValues(Array(1000).fill('98278'))).toBe(98278000);
  });

  it('fits short numeric values to the measured header, not the widget', () => {
    expect(fitTableColumnWidth({ desiredWidth: 135, numeric: true })).toBe(135);
    expect(fitTableColumnWidth({ desiredWidth: 400, numeric: true })).toBe(220);
    expect(fitTableColumnWidth({ desiredWidth: 54, numeric: true })).toBe(112);
    expect(fitTableColumnWidth({ desiredWidth: 125, numeric: false })).toBe(125);
    expect(fitTableColumnWidth({ desiredWidth: 900, numeric: false })).toBe(320);
  });

  it('respects saved manual widths and narrow mobile sizes', () => {
    expect(fitTableColumnWidth({
      desiredWidth: 100, numeric: true, customWidth: 410, useCustomWidth: true,
    })).toBe(410);
    expect(fitTableColumnWidth({
      desiredWidth: 100, numeric: true, customWidth: 410,
      useCustomWidth: true, isMobile: true,
    })).toBe(144);
    expect(fitTableColumnWidth({
      desiredWidth: 200, numeric: false, isMobile: true,
    })).toBe(144);
  });
});
