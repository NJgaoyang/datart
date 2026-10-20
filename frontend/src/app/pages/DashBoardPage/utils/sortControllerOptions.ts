import { RelationFilterValue } from 'app/types/ChartConfig';
import { ControllerConfig } from '../pages/BoardEditor/components/ControllerWidgetPanel/types';

/** Sort a copy of flat options; tree and manual option order remain untouched by default. */
export function sortControllerOptions(
  options: RelationFilterValue[],
  mode: ControllerConfig['optionSort'],
  custom = false,
): RelationFilterValue[] {
  if (!mode || mode === 'original' || (custom && mode === 'auto')) return options;
  const value = (item: RelationFilterValue) => String(item.label ?? item.key ?? '').trim();
  const nonEmpty = options.map(value).filter(Boolean);
  if (!nonEmpty.length) return options;
  const datePattern = /^(\d{4})[-/](0?[1-9]|1[0-2])(?:[-/](0?[1-9]|[12]\d|3[01]))?(?:[ T]\d{2}:\d{2}(?::\d{2})?)?$/;
  const isDate = nonEmpty.every(item => datePattern.test(item));
  const isNumeric = !isDate && nonEmpty.every(item => /^[-+]?\d+(?:\.\d+)?$/.test(item));
  const collator = new Intl.Collator('zh-CN', { numeric: true });
  const direction = mode === 'desc' || (mode === 'auto' && isDate) ? -1 : 1;
  return [...options].sort((left, right) => {
    const a = value(left);
    const b = value(right);
    if (!a || !b) return a ? -1 : b ? 1 : 0;
    if (isNumeric) return direction * (Number(a) - Number(b));
    if (isDate) {
      const parts = (text: string) => text.match(/\d+/g)!.map(Number);
      const aa = parts(a);
      const bb = parts(b);
      for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
        const difference = (aa[i] || 0) - (bb[i] || 0);
        if (difference) return direction * difference;
      }
      return 0;
    }
    return direction * collator.compare(a, b);
  });
}
