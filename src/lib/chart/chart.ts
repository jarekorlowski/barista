import {
  Component,
  ViewChild,
  ElementRef,
  AfterViewInit,
  Input,
  ChangeDetectionStrategy,
  OnDestroy,
  EventEmitter,
  Output,
  Optional,
  SkipSelf,
  SimpleChanges,
  OnChanges,
  isDevMode,
  ViewEncapsulation,
  ChangeDetectorRef,
} from '@angular/core';
import { Options, IndividualSeriesOptions, ChartObject, chart } from 'highcharts';
import { Observable } from 'rxjs/Observable';
import { Subscription } from 'rxjs/Subscription';
import { ViewportResizer } from '@dynatrace/angular-components/core';
import { delay } from 'rxjs/operators/delay';
import { DtTheme, CHART_COLOR_PALETTES, ChartColorPalette } from '@dynatrace/angular-components/theming';
import { mergeOptions } from './chart-utils';
import { defaultTooltipFormatter } from './chart-tooltip';
import { configureLegendSymbols } from './highcharts-legend-overrides';

export type DtChartOptions = Options & { series?: undefined };
export type DtChartSeries = IndividualSeriesOptions[];
interface DtChartTooltip { (): string | boolean; iswrapped: boolean; }

const defaultChartColorPalette = 'turquoise';
const defaultChartOptions: DtChartOptions = {
  title: {
    text: null,
  },
  credits: {
    enabled: false,
  },
  tooltip: {
    useHTML: true,
    backgroundColor: 'transparent',
    borderWidth: 0,
    shadow: false,
  },
};

// Override Highcharts prototypes
configureLegendSymbols();

@Component({
  moduleId: module.id,
  selector: 'dt-chart',
  styleUrls: ['./chart.scss'],
  templateUrl: './chart.html',
  exportAs: 'dtChart',
  // disabled ViewEncapsulation because some html is generated by highcharts
  // so it does not get the classes from angular
  // tslint:disable-next-line: use-view-encapsulation
  encapsulation: ViewEncapsulation.None,
  preserveWhitespaces: false,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DtChart implements AfterViewInit, OnDestroy, OnChanges {
  @ViewChild('container') container: ElementRef;

  _loading = false;
  private _series: DtChartSeries | undefined;
  private _options: DtChartOptions;
  private _chartObject: ChartObject;
  private _dataSub: Subscription | null = null;
  private _colorPalette: ChartColorPalette;
  private _isTooltipWrapped = false;

  @Input()
  set options(options: DtChartOptions) {
    this._isTooltipWrapped = false;
    this._options = options;
  }
  get options(): DtChartOptions {
    return this._options;
  }

  @Input()
  set series(series: Observable<DtChartSeries> | DtChartSeries | undefined) {
    if (this._dataSub) {
      this._dataSub.unsubscribe();
      this._dataSub = null;
    }
    if (series instanceof Observable) {
      this._dataSub = series.subscribe((s: DtChartSeries) => {
        this._series = s;
        this._update();
        this._changeDetectorRef.markForCheck();
      });
    } else {
      this._series = series;
    }
    this._setLoading();
  }

  @Output() readonly updated: EventEmitter<void> = new EventEmitter();

  constructor(
    @Optional() private _viewportResizer: ViewportResizer,
    @Optional() @SkipSelf() private _theme: DtTheme,
    private _changeDetectorRef: ChangeDetectorRef
  ) {
    if (this._viewportResizer) {
      this._viewportResizer.change()
        .pipe(delay(0))// delay to postpone the reflow to the next change detection cycle
        .subscribe(() => {
          if (this._chartObject) {
            this._chartObject.reflow();
          }
        });
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes.series || changes._options) {
      this._update();
    }
  }

  ngAfterViewInit(): void {
    this._createChart();
  }

  ngOnDestroy(): void {
    if (this._chartObject) {
      this._chartObject.destroy();
    }
    if (this._dataSub) {
      this._dataSub.unsubscribe();
    }
  }

  /** returns the series data for the chart */
  getSeries(): DtChartSeries {
    return this._series || [];
  }

  /** returns an array of ids for the series data */
  getAllIds(): Array<string | undefined> | undefined {
    if (this._series) {

      return this._series.map((s: IndividualSeriesOptions) => s.id);
    }

    return undefined;
  }

  /**
   * applies the colors from the theme to the series if no color for the series is set
   */
  private _applyColors(): void {
    this._colorPalette = this._theme && this._theme.name ?
      CHART_COLOR_PALETTES[this._theme.name] : CHART_COLOR_PALETTES[defaultChartColorPalette];

    if (this._series) {
      this._series.forEach((s: IndividualSeriesOptions, index: number): void => {
        this._applySeriesColor(s, index);
      });
    }
  }

  /**
   * Applies a color to a series with the following rules
   * 1. leave color if its passed in the series
   * 2. if only one series is present choose the single color from the theme palette
   * 3. choose the color from the themepalette that matches the index of the series
   */
  private _applySeriesColor(s: IndividualSeriesOptions, index: number): void {
    // leave the color if there is already a color set
    if (s.color) {
      return;
    }
    // if there is one series apply the single property
    if (this._series && this._series.length === 1) {
      s.color = this._colorPalette.single;

      return;
    }
    if (index >= this._colorPalette.multi.length && isDevMode()) {
      // tslint:disable-next-line: no-console
      console.error(`The number of series exceeds the number of chart colors in the theme ${this._theme.name}.
        Please specify colors for your series.`);
    }
    // apply color for multi series
    s.color = this._colorPalette.multi[index];
  }

  /**
   * returns the combined highcharts options for the chart
   * combines series and options passed, merged with the defaultOptions
   */
  private _getHighchartsOptions(): Options {
    let highchartsOptions = mergeOptions(defaultChartOptions, this.options) as Options;
    highchartsOptions = this._wrapTooltip(highchartsOptions);
    highchartsOptions.series = this._series;

    return highchartsOptions;
  }

  /**
   * Wraps the options.tooltip.formatter function passed into a div.dt-chart-tooltip
   * to enable correct styling for the tooltip
   */
  private _wrapTooltip(highchartsOptions: Options): Options {

    if (!this._isTooltipWrapped) {
      let tooltipFormatterFunc = defaultTooltipFormatter;
      if (this.options.tooltip && this.options.tooltip.formatter) {
        tooltipFormatterFunc = this.options.tooltip.formatter;
      }

      highchartsOptions.tooltip!.formatter = function(): string | boolean {
        const tooltipFormatterFuncBound = tooltipFormatterFunc.bind(this);

        return `<div class="dt-chart-tooltip">${tooltipFormatterFuncBound()}</div>`;
      } as DtChartTooltip;

      this._isTooltipWrapped = true;
    }

    return highchartsOptions;
  }

  /**
   * Spins up the chart with correct colors applied
   */
  private _createChart(): void {
    this._applyColors();
    this._chartObject = chart(this.container.nativeElement, this._getHighchartsOptions());
    this._setLoading();
  }

  /**
   * Update function to apply new data to the chart
   */
  private _update(redraw: boolean = true, oneToOne: boolean = true): void {
    if (this._chartObject) {
      this._applyColors();
      this._setLoading();
      this._chartObject.update(this._getHighchartsOptions(), redraw, oneToOne);
      this.updated.emit();
    }
  }

  /** updates the loading status of the component */
  private _setLoading(): void {
    if (this.options) {
      this._loading = !this._series;
    }
  }
}
