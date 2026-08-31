import { applyMobileChartOption } from '../mobileChartOption';

describe('applyMobileChartOption', () => {
  it('keeps desktop options unchanged', () => {
    const option: any = {
      grid: { left: 20 },
      xAxis: { axisLabel: { fontSize: 14 } },
    };

    expect(applyMobileChartOption(option, { isMobile: false })).toBe(option);
  });

  it('adapts chart spacing, legend, tooltip, and axes on mobile', () => {
    const option = {
      grid: { left: 20 },
      tooltip: { trigger: 'axis' },
      legend: { show: true },
      xAxis: { axisLabel: { show: true } },
      yAxis: [{ axisLabel: { show: true } }],
    };

    expect(applyMobileChartOption(option, { isMobile: true })).toMatchObject({
      grid: { left: 8, right: 8, top: 32, bottom: 24, containLabel: true },
      tooltip: { trigger: 'axis', confine: true },
      legend: { type: 'scroll', itemWidth: 10, itemHeight: 6 },
      xAxis: { axisLabel: { fontSize: 10, hideOverlap: true } },
      yAxis: [{ axisLabel: { fontSize: 10, hideOverlap: true } }],
    });
  });
});
