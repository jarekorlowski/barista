/**
 * @license
 * Copyright 2020 Dynatrace LLC
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { resetWindowSizeToDefault, waitForAngular } from '../../utils';
import {
  body,
  chartTypeDonut,
  chartTypePie,
  overlay,
  radialChart,
} from './radial-chart.po';

fixture('Radial chart')
  .page('http://localhost:4200/radial-chart')
  .beforeEach(async () => {
    await resetWindowSizeToDefault();
    await waitForAngular();
  });

test('should show overlay on hover', async (testController: TestController) => {
  await testController
    .hover(radialChart, { speed: 0.3, offsetX: 500, offsetY: 100 })
    .expect(overlay.exists)
    .ok()
    .expect(overlay.textContent)
    .match(/Chrome: 43 of 89/)
    .hover(body, { speed: 0.3, offsetX: 10, offsetY: 10 })
    .expect(overlay.exists)
    .notOk();
});

test('should not show an overlay in the middle of the circle when the chart type has been changed to a donut chart', async (testController: TestController) => {
  await testController
    .hover(radialChart, { speed: 0.3, offsetX: 600, offsetY: 300 })
    .expect(overlay.exists)
    .ok()
    .click(chartTypeDonut)
    .hover(radialChart, { speed: 0.3, offsetX: 600, offsetY: 300 })
    .expect(overlay.exists)
    .notOk()
    .click(chartTypePie)
    .hover(radialChart, { speed: 0.3, offsetX: 600, offsetY: 300 })
    .expect(overlay.exists)
    .ok();
});

test('should show correct overlay contents when hovering over pies', async (testController: TestController) => {
  await testController
    .hover(radialChart, { speed: 0.2, offsetX: 580, offsetY: 500 })
    .expect(overlay.textContent)
    .match(/Chrome: 43 of 89/)
    .hover(radialChart, { speed: 0.2, offsetX: 375, offsetY: 560 })
    .expect(overlay.textContent)
    .match(/Safari: 22 of 89/)
    .hover(radialChart, { speed: 0.2, offsetX: 190, offsetY: 350 })
    .expect(overlay.textContent)
    .match(/Firefox: 15 of 89/)
    .hover(radialChart, { speed: 0.2, offsetX: 370, offsetY: 150 })
    .expect(overlay.textContent)
    .match(/Microsoft Edge: 9 of 89/);
});
