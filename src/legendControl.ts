import powerbiVisualsApi from "powerbi-visuals-api";
import IVisualHost = powerbiVisualsApi.extensibility.visual.IVisualHost;
import VisualObjectInstancesToPersist = powerbiVisualsApi.VisualObjectInstancesToPersist;
import * as formatting from "powerbi-visuals-utils-formattingutils"
import { dragElement } from "./mapboxUtils"
import { LegendContainer } from "./legendContainer"
import { LegendSettings, MapboxSettings } from "./settings";
import { constants } from "./constants"
const valueFormatter = formatting.valueFormatter;

export type ColorStops = { colorStop: number | string, color: string }[];

export class LegendControl {
    private map: mapboxgl.Map;
    private legendContainer: { [legendPosition: string]: LegendContainer } = {};
    private legends: { [legendPosition: string]: { [key: string]: HTMLElement } } = {};
    private opacity: number;
    private isNewLegendCreated: boolean;
    private positions: any[] = ["bottom-right", "bottom-left", "top-right", "top-left"];
    private orientation: string = "column";
    private legendHeight: number;
    private legendWidth: number;
    private host: IVisualHost;

    public static readonly DEFAULT_NUMBER_FORMAT = "0.##"

    constructor(map, host) {
        this.map = map;
        this.host = host
    }

    addControl(settings: LegendSettings) {
        this.positions.forEach(legendPosition => {
            this.legendContainer[legendPosition] = new LegendContainer(legendPosition)
            this.map.addControl(this.legendContainer[legendPosition], legendPosition)
        })
    }

    removeControl() {
        this.positions.forEach(legendPosition => {
            if (this.legendContainer[legendPosition]) {
                this.map.removeControl(this.legendContainer[legendPosition])
            }
        })
    }

    removeLegends() {
        this.positions.forEach(legendPosition => {
            if (this.legends[legendPosition]) {
                Object.keys(this.legends[legendPosition]).forEach(key => {
                    if (this.legends[legendPosition][key]) {
                        this.legendContainer[legendPosition].removeChild(this.legends[legendPosition][key])
                    }
                })
            }
        })
        this.legends = {}
    }

    addLegend(key: string, title: string, data: ColorStops, format: string, legendPosition: string, mapBoxSettings: MapboxSettings) {
        if (data) {
            if (!this.legends[legendPosition]) {
                this.legends[legendPosition] = {}
            }
            if (this.legends[legendPosition][key]) {
                while (this.legends[legendPosition][key].firstChild) {
                    this.legends[legendPosition][key].firstChild.remove()
                }
                this.isNewLegendCreated = false
                this.addValuesToLegend(title, data, format, this.legends[legendPosition][key], mapBoxSettings.legends)
            } else {
                this.isNewLegendCreated = true
                this.legends[legendPosition][key] = this.createLegendElement(title, data, format, mapBoxSettings.legends)
            }
        }
    }

    setLegends() {
        this.positions.forEach(legendPosition => {
            this.legendContainer[legendPosition].setLegends(this.legends[legendPosition], this.isNewLegendCreated)
        })
    }

    getDefaultOpacity(): number {
        return this.opacity
    }

    setOpacity(opacity: number) {
        this.opacity = opacity / 100
    }

    createLegendElement(title: string, data: ColorStops, format: string, settings: LegendSettings): HTMLElement {
        if (this.hasOrientationChanged(settings)) {
            this.persistSizeProperties(settings)
        }

        const d = document;
        const legend = d.createElement('div');
        legend.setAttribute("class", "mapbox-legend mapboxgl-ctrl-group");
        legend.setAttribute("style", `
            font-size: ${settings.fontSize}px;
            font-family: ${settings.font == "other" ? settings.customFont : settings.font};
            font-weight: ${settings.fontWeight};
            color: ${this.hexToRgb(settings.fontColor, settings.opacity / 100)};
            background-color: ${this.hexToRgb(settings.backgroundColor, settings.opacity / 100)};
            width: ${settings.legendWidth - 24}px;
            height: ${settings.legendHeight - 30}px;
            display: flex;
            flex-direction: ${settings.orientation};
            justify-content: space-around;
            border: ${settings.borderWidth}px solid ${this.hexToRgb(settings.borderColor, settings.borderOpacity / 100)};
            box-shadow: none;
            border-radius: ${settings.borderRadius}px;
            text-align: ${settings.alignment};
        `);

        this.orientation = settings.orientation
        const legendContainer = document.querySelector('.mapbox-legend-container') as HTMLElement;
        legendContainer.style.setProperty('--legendWidth', `${settings.legendWidth - 24}px`);

        dragElement(legend)
        this.addValuesToLegend(title, data, format, legend, settings)

        return legend
    }

    addValuesToLegend(title: string, data: ColorStops, format: string, legend: HTMLElement, settings: LegendSettings) {
        const d = document
        const titleElement = d.createElement('div');
        const titleText = d.createTextNode(title);
        titleElement.className = 'mapbox-legend-title';
        titleElement.appendChild(titleText);
        if (settings.orientation === 'column') {
            titleElement.removeAttribute("style")
        } else {
            titleElement.setAttribute("style", `
                display: flex;
                align-items: center;
            `);
        }
        legend.appendChild(titleElement)

        if (data.some(item => typeof item["colorStop"] === "string")) {
            data.sort((a, b) => this.compareStringValues(a, b, settings.order))
        }

        let minWidth = "unset"

        if (settings.alignment === 'center') {
            const colorStops = data.map(el => Number(el.colorStop).toFixed(2).toString().length);
            const longestValue = Math.max(...colorStops) + 1
            minWidth = (settings.fontSize/2) * longestValue + 'px'
        }

        data.sort((a, b) => settings.order === "asc" ? this.getColorStopValue(a) - this.getColorStopValue(b) :  this.getColorStopValue(b) - this.getColorStopValue(a))

        data.forEach(({colorStop, color}) => {
            // Create line item
            const item = d.createElement('div');
            item.setAttribute("style", `
                display: flex;
                flex-direction: ${settings.alignment === 'right' ? 'row-reverse' : 'row'};
                align-items: center;
                justify-content: ${settings.alignment === 'right' ? 'end' : settings.alignment === 'left' ? 'start' : 'center'};
            `);

            // Create color element and add to item
            const colorElement = d.createElement('span');
            colorElement.setAttribute("class", "mapbox-legend-color middle");
            colorElement.setAttribute("style", `
                background-color: ${this.hexToRgb(color, settings.opacity / 100)};
                width: ${settings.fontSize}px;
                height: ${settings.fontSize}px;
                margin-left: 5px;
            `);

            item.appendChild(colorElement);

            // Create value element and add to item
            const valueElement = document.createElement('span');
            valueElement.setAttribute("style", `
                min-width: ${minWidth};
            `);
            valueElement.setAttribute("class", "mapbox-legend-value middle");
            if (typeof colorStop === "number") {
                const valueText = d.createTextNode(valueFormatter.format(colorStop, format || LegendControl.DEFAULT_NUMBER_FORMAT));
                valueElement.appendChild(valueText);
            } else {
                const valueText = d.createTextNode(colorStop);
                valueElement.appendChild(valueText);
            }
            item.appendChild(valueElement);

            // Add line item to legend
            legend.appendChild(item)
        })
    }

    compareStringValues(a: object, b: object, order: string): number {
        const pattern = /^\d+/;
        const aNum = parseInt((a["colorStop"].match(pattern) ?? '0') as string);
        const bNum = parseInt((b["colorStop"].match(pattern) ?? '0') as string);
        return order === "asc" ? aNum - bNum : bNum - aNum;
      }

    getColorStopValue(obj: Object) {
        return Number(obj["colorStop"]) || 0;
      }

    hexToRgb(hex: string, op: number) {
        hex = hex.replace('#', '');

        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${op})`;
      };

    hasOrientationChanged(settings: LegendSettings): boolean  {
        return this.orientation !== settings.orientation
    }

    persistSizeProperties(settings: LegendSettings) {
        this.host.persistProperties(<VisualObjectInstancesToPersist>{
            merge: [{
                objectName: "legends",
                selector: null,
                properties: {
                    legendWidth: settings.orientation === "row" ? constants.DEFAULT_HOR_LEGEND_WIDTH : constants.DEFAULT_VER_LEGEND_WIDTH,
                    legendHeight: settings.orientation === "row" ? constants.DEFAULT_HOR_LEGEND_HEIGHT : constants.DEFAULT_VER_LEGEND_HEIGHT,
                }
            }]
        })
    }
}
