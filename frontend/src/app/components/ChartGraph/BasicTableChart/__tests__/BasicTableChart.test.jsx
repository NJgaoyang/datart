/**
 * Datart
 *
 * Copyright 2021
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import BasicTableChart, {
  clampMobileTableColumnWidth,
} from '../BasicTableChart';

describe('<BasicTableChart />', () => {
  let component;
  beforeEach(() => {
    component = new BasicTableChart();
  });
  test('It should mount', () => {
    expect(component).toBeDatartChartModel();
  });

  test('It should keep mobile columns compact without collapsing content', () => {
    expect(clampMobileTableColumnWidth(40)).toBe(72);
    expect(clampMobileTableColumnWidth(100)).toBe(100);
    expect(clampMobileTableColumnWidth(300)).toBe(144);
  });
});
