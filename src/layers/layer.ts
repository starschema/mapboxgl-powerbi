import powerbiVisualsApi from "powerbi-visuals-api";
import * as formatting from "powerbi-visuals-utils-formattingutils"
const valueFormatter = formatting.valueFormatter;
import * as tooltip from "powerbi-visuals-utils-tooltiputils"
import { BBox } from "@turf/helpers"
import * as chroma from "chroma-js"

import { ClassificationMethod, filterValues, getBreaks, getClassCount, Limits, calculateLabelPosition } from "../mapboxUtils"
import { RoleMap } from "../roleMap"
import { ColorStops, LegendControl } from "../legendControl"
import { MapboxSettings, CircleSettings, ChoroplethSettings, ClusterSettings, SymbolSettings } from "../settings"
import { Palette } from "../palette"
import { TooltipEventArgs } from "../tooltipServiceWrapper"
import { MapboxMap } from "../MapboxMap"
import { Datasource } from "../datasources/datasource"

export abstract class Layer {
    protected parent: MapboxMap;
    protected source: Datasource;
    public readonly id: string;
    protected prevLabelPositionSetting: string;

    protected colorStops: ColorStops;

    constructor(map: MapboxMap, id: string) {
        this.parent = map;
        this.id = id;
        const settings = map.getSettings();
        this.prevLabelPositionSetting = settings.api.labelPosition;
    }

    updateSource(features, roleMap, settings) {
        if (settings[this.id].show) {
            this.source.update(this.parent, features, roleMap, settings);
        }
    }

    getBounds(settings) : BBox {
        if (settings[this.id].show) {
            return this.source.getBounds();
        }
        return null;
    }

    layerIndex(): number { return -1 }

    getId() {
        return this.id
    }

    abstract getLayerIDs()

    updateSelection(features, roleMap) {
    }

    hoverHighLight(e) {
    }

    removeHighlight(roleMap) {
    }

    public getColorStops(): ColorStops {
        return this.colorStops;
    }

    static mapValuesToColorStops(colorInterval: string[], method: ClassificationMethod, classCount:number, values: number[]): ColorStops {
        if (!values || values.length == 0) {
            return []
        }

        if (values.length == 1) {
            const colorStop = values[0];
            const color = colorInterval[0];
            return [{colorStop, color}];
        }

        const domain: number[] = classCount ? getBreaks(values, method, classCount) : values;
        const colors = chroma.scale(colorInterval).colors(domain.length)
        return domain.map((colorStop, idx) => {
            const color = colors[idx].toString();
            return {colorStop, color};
        });
    }

    generateColorStops(settings: CircleSettings | ChoroplethSettings | ClusterSettings | SymbolSettings, isGradient: boolean, colorLimits: Limits, colorPalette: Palette): ColorStops {
        if (!isGradient) {
            return colorLimits.values.map(value => {
                const colorStop = value.toString();
                const color = colorPalette.getColor(colorStop);
                return { colorStop, color };
            });
        }

        if ( settings instanceof ClusterSettings || !settings.diverging) {
            const classCount = getClassCount(colorLimits.values);
            return Layer.mapValuesToColorStops([settings.minColor, settings.maxColor], this.getClassificationMethod(), classCount, colorLimits.values)
        }

        const { minValue, midValue, maxValue, minColor, midColor, maxColor} = settings

        const filteredValues = filterValues(colorLimits.values, minValue, maxValue)
        // Split the interval into two halves when there is a middle value
        if (midValue != null) {
            const lowerHalf = []
            const upperHalf = []

            if (minValue != null) {
                lowerHalf.push(minValue)
            }

            filteredValues.forEach(value => {
                if (value < midValue) {
                    lowerHalf.push(value)
                }
                else {
                    upperHalf.push(value)
                }
            })

            if (maxValue != null) {
                upperHalf.push(maxValue)
            }

            // Add midValue to both interval
            lowerHalf.push(midValue)
            upperHalf.unshift(midValue)

            // Divide the colorstops between the two intervals (halve them)
            const lowerHalfClassCount = getClassCount(lowerHalf) >> 1;
            const upperHalfClassCount = getClassCount(upperHalf) >> 1;

            const lowerColorStops = Layer.mapValuesToColorStops([minColor, midColor], this.getClassificationMethod(), lowerHalfClassCount, lowerHalf)
            const upperColorStops = Layer.mapValuesToColorStops([midColor, maxColor], this.getClassificationMethod(), upperHalfClassCount, upperHalf)

            // Make sure the midValue included only once
            lowerColorStops.pop()
            return lowerColorStops.concat(upperColorStops)
        }

        if (minValue != null) {
            filteredValues.push(minValue)
        }

        if (maxValue != null) {
            filteredValues.push(maxValue)
        }

        const classCount = getClassCount(filteredValues);
        return Layer.mapValuesToColorStops([minColor, midColor, maxColor], this.getClassificationMethod(), classCount, filteredValues)
    }

    getClassificationMethod(): ClassificationMethod {
        return ClassificationMethod.Quantile
    }

    applySettings(settings: MapboxSettings, roleMap: RoleMap, prevId: string): string {
        const map = this.parent.getMap();
        let lastId = prevId
        if (settings[this.id].show) {
            let firstSymbolId = calculateLabelPosition(settings, map)
            if (this.prevLabelPositionSetting === settings.api.labelPosition) {
                if (!this.layerExists()) {
                    if (this.id === 'choropleth') {
                        this.addLayer(settings, prevId, roleMap);
                    } else {
                        this.addLayer(settings, firstSymbolId, roleMap);
                    }
                }
            } else {
                this.moveLayer(prevId)
            }
            let ids = this.getLayerIDs()
            if (ids && ids.length > 0) { 
                lastId = ids[ids.length - 1]
            }
        } else {
            if (this.layerExists()) {
                this.removeLayer();
            }
        }
        if (this.prevLabelPositionSetting !== settings.api.labelPosition) {
            this.prevLabelPositionSetting = settings.api.labelPosition;
        }

        return lastId
    }

    abstract addLayer(settings, beforeLayerId: string, roleMap): string
    abstract moveLayer(beforeLayerId: string): string
    abstract removeLayer()

    layerExists() {
        const map = this.parent.getMap();
        const layer = map.getLayer(this.id);
        return layer != null;
    }

    getSource(settings) {
        if (settings[this.id].show) {
            this.source.ensure(this.parent.getMap(), this.id, settings);
            return this.source;
        }
        return null;
    }

    handleZoom(settings) : boolean {
        if (settings[this.id].show) {
            return this.source.handleZoom(this.parent.getMap(), settings);
        }
        return false;
    }

    hasTooltip(tooltips) {
        if (!tooltips) {
            // Do not show tooltip if no property is pulled into 'tooltips' data role
            return false;
        }
        return true;
    }

    getFormattedTooltipValue(roleMap, data): string {
        const displayName = data.displayName
        const tooltipData = roleMap.tooltips() ? roleMap.tooltips().find( column => column.displayName === displayName) : null;
        let value = data.value
        if (tooltipData && tooltipData.format) {
            const { format, type } = tooltipData
            if (type.dateTime) {
                value = new Date(data.value);
                if (isNaN(value)) {
                    // Print original text if the date string is invalid.
                    value = data.value;
                }
            } else if (type.numeric) {
                value = Number(data.value);
            }
            value = valueFormatter.format(value, format);
        }
        return value;
    }

    /*
    Override this method and implement the custom logic to show tooltips for a custom layer
    */
    handleTooltip(tooltipEvent: TooltipEventArgs<number>, roleMap, settings): any[] {
        return [];
    }

    static getTooltipData(value: any, ids?: any): any[] {
        if (!value) {
            return [];
        }
        // Flatten the multiple properties or multiple datapoints
        return [].concat.apply([], value.map((properties, i) => {
            // This mapping is needed to copy the value with the toString
            // call as otherwise some caching logic causes to be the same
            // tooltip displayed for all datapoints.
            return properties.map(prop => {
                return {
                    displayName: prop.key,
                    value: prop.value.toString(),
                    header: ids ? ids[i] : "",
                };
            });
        }));
    }

    showLegend(settings: MapboxSettings, roleMap: RoleMap) {
        return this.layerExists()
    }

    addLegend(
        legend: LegendControl,
        roleMap: RoleMap,
        settings: MapboxSettings,
    ): void
    {
        const id = this.getId();
        const title = roleMap.colorByColorField(settings[this.id].colorField)
        const colorStops = this.getColorStops();
        const format = roleMap.getColumn('color', this.getId()).format;
        legend.addLegend(id, title, colorStops, format);
    }
}
