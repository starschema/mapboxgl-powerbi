import powerbiVisualsApi from "powerbi-visuals-api";
import { ClassificationMethod, Limits, decorateLayer, shouldUseGradient, getClassCount, getBreaks } from "../mapboxUtils"
import { Palette } from "../palette"
import { Filter } from "../filter"
import { RoleMap } from "../roleMap"
import { Layer } from "./layer"
import { MapboxSettings, CircleSettings } from "../settings"
import { ColorStops } from "../legendControl"
import { Sources } from "../datasources/sources"
import { constants } from "../constants"
import { MapboxMap } from "../visual"

export class Circle extends Layer {
    private filter: Filter;
    private palette: Palette;
    private settings: CircleSettings;

    public static readonly ID = 'circle';
    private static readonly HighlightID = 'circle-highlight';

    private static readonly LayerOrder = [Circle.ID, Circle.HighlightID];
    private static readonly requiredNumberOfParamsInCircleColor = 5;


    constructor(map: MapboxMap, filter: Filter, palette: Palette) {
        super(map, Circle.ID)
        this.filter = filter
        this.palette = palette
        this.source = Sources.Point
    }

    getLayerIDs() {
        return [ Circle.ID ];
    }

    getSource(settings) {
        this.settings = settings.circle;
        return super.getSource(settings);
    }

    addLayer(settings, beforeLayerId, roleMap) {
        const map = this.parent.getMap();
        const latitude = roleMap.latitude()
        const layers = {};

        layers[Circle.ID] = decorateLayer({
            id: Circle.ID,
            source: 'data',
            type: 'circle'
        });

        const zeroFilter = ["==", latitude, ""]
        layers[Circle.HighlightID] = decorateLayer({
            id: Circle.HighlightID,
            type: 'circle',
            source: 'data',
            filter: zeroFilter
        });

        Circle.LayerOrder.forEach((layerId) => map.addLayer(layers[layerId], beforeLayerId));

        map.setPaintProperty(Circle.HighlightID, 'circle-color', settings.circle.highlightColor);
        map.setPaintProperty(Circle.HighlightID, 'circle-opacity', 1);
        map.setPaintProperty(Circle.HighlightID, 'circle-stroke-width', 1);
        map.setPaintProperty(Circle.HighlightID, 'circle-stroke-color', 'black');
    }

    moveLayer(beforeLayerId: string) {
        const map = this.parent.getMap();
        Circle.LayerOrder.forEach((layerId) => map.moveLayer(layerId, beforeLayerId));
    }

    hoverHighLight(e) {
        if (!this.layerExists()) {
            return;
        }

        const roleMap = this.parent.getRoleMap();
        const latitude = roleMap.latitude()
        const longitude = roleMap.longitude()
        const eventProps = e.features[0].properties;
        if (eventProps[latitude] && eventProps[longitude]) {
            const lngLatFilter = ["all",
                ["==", latitude, eventProps[latitude]],
                ["==", longitude, eventProps[longitude]],
            ]
            this.parent.getMap().setFilter(Circle.HighlightID, lngLatFilter);
        }
    }

    removeHighlight(roleMap) {
        if (!this.layerExists()) {
            return;
        }
        const latitude = roleMap.latitude()
        const map = this.parent.getMap();
        const zeroFilter = ["==", latitude, ""];
        map.setFilter(Circle.HighlightID, zeroFilter);
        if (this.settings.opacity) {
            map.setPaintProperty(Circle.ID, 'circle-opacity', this.settings.opacity / 100);
        }
    }

    updateSelection(features, roleMap) {
        const map = this.parent.getMap();
        const latitude = roleMap.latitude()
        const longitude = roleMap.longitude()

        let lngLatFilter = [];
        lngLatFilter.push("any");
        let selectionIds = features
            .slice(0, constants.MAX_SELECTION_COUNT)
            .map( (feature, index) => {
                lngLatFilter.push(["all",
                    ["==", latitude, feature.properties[latitude]],
                    ["==", longitude, feature.properties[longitude]]]);
                return feature.id;
        });
        this.filter.addSelection(selectionIds)

        map.setFilter(Circle.HighlightID, lngLatFilter);

        const opacity = this.filter.getSelectionOpacity(this.settings.opacity)
        map.setPaintProperty(Circle.ID, 'circle-opacity', opacity);
        return selectionIds
    }

    removeLayer() {
        const map = this.parent.getMap();
        Circle.LayerOrder.forEach(layerId => map.removeLayer(layerId));
        this.source.removeFromMap(map, Circle.ID);
    }

    applySettings(settings: MapboxSettings, roleMap: RoleMap, prevId: string): string {
        const lastId = super.applySettings(settings, roleMap, prevId);
        const map = this.parent.getMap();
        if (settings.circle.show) {
            const colorField = roleMap.get('color', settings.circle.colorField - 1)
            const colorFieldName = colorField ? colorField.displayName : ""
            const isGradient = shouldUseGradient(colorField);
            const limits = this.source.getLimits(settings.circle.colorField - 1)
            const sizes = Circle.getSizes(limits.size, map, settings, roleMap.size());
            this.colorStops = this.generateColorStops(settings.circle, isGradient, limits.color, this.palette)
            let colorStyle = Circle.getColorStyle(isGradient, settings, colorFieldName, this.colorStops);

            map.setPaintProperty(Circle.ID, 'circle-radius', sizes);
            map.setPaintProperty(Circle.HighlightID, 'circle-radius', sizes);
            map.setPaintProperty(Circle.HighlightID, 'circle-color', settings.circle.highlightColor);
            map.setPaintProperty(Circle.ID, 'circle-color', colorStyle);
            map.setLayerZoomRange(Circle.ID, settings.circle.minZoom, settings.circle.maxZoom);
            map.setPaintProperty(Circle.ID, 'circle-blur', settings.circle.blur / 100);
            map.setPaintProperty(Circle.ID, 'circle-opacity', settings.circle.opacity / 100);
            map.setPaintProperty(Circle.ID, 'circle-stroke-width', settings.circle.strokeWidth);
            map.setPaintProperty(Circle.ID, 'circle-stroke-opacity', settings.circle.strokeOpacity / 100);
            map.setPaintProperty(Circle.ID, 'circle-stroke-color', settings.circle.strokeColor);
        }

        return lastId;
    }

    handleTooltip(tooltipEvent, roleMap, settings: MapboxSettings) {
        const tooltipData = Layer.getTooltipData(tooltipEvent.data)
            .filter((elem) => roleMap.tooltips().some( t => t.displayName === elem.displayName)); // Only show the fields that are added to the tooltips
        return tooltipData.sort( (a, b) => {
            const aIndex = roleMap.tooltips().findIndex( t => t.displayName === a.displayName)
            const bIndex = roleMap.tooltips().findIndex( t => t.displayName === b.displayName)
            return aIndex - bIndex;
        }).map(data => {
            data.value = this.getFormattedTooltipValue(roleMap, data)
            return data;
        })
    }

    showLegend(settings: MapboxSettings, roleMap: RoleMap) {
        return settings.circle.legend && roleMap.color(this) && super.showLegend(settings, roleMap)
    }

    private static getColorStyle(isGradient: boolean, settings: MapboxSettings, colorField: string, colorStops: ColorStops) {
        if (colorField === '') {
            return settings.circle.minColor;
        }

        if (isGradient) {
            // Set colors for continuous value
            const continuousStyle: any = ["interpolate", ["linear"], ["to-number", ['get', colorField]]]
            colorStops.forEach(({colorStop, color}) => {
                continuousStyle.push(colorStop);
                continuousStyle.push(color);
            });

            return continuousStyle;
        }

        // Set colors for categorical value
        let categoricalStyle: any = ['match', ['to-string', ['get', colorField]]];
        colorStops.forEach(({colorStop, color}) => {
            categoricalStyle.push(colorStop);
            categoricalStyle.push(color);
        });

        // Add transparent as default so that we only see regions
        // for which we have data values
        categoricalStyle = categoricalStyle.concat(Array(Math.max(1, this.requiredNumberOfParamsInCircleColor - categoricalStyle.length)).fill('rgba(255,0,0,255)'));

        return categoricalStyle;
    }

    private static getSizes(sizeLimits: Limits, map: any, settings: any, sizeField: string) {
        const classCount = getClassCount(sizeLimits.values);
        if (sizeField !== '' && sizeLimits && sizeLimits.min != null && sizeLimits.max != null && sizeLimits.min != sizeLimits.max && classCount > 0) {
            const style: any[] = [
                "interpolate", ["linear"],
                ["to-number", ['get', sizeField]]
            ]

            const sizeStops: any[] = getBreaks(sizeLimits.values, ClassificationMethod.Quantile, classCount);
            const sizeDelta = (settings.circle.radius * settings.circle.scaleFactor - settings.circle.radius) / classCount

            sizeStops.map((sizeStop, index) => {
                const size = settings.circle.radius + index * sizeDelta
                style.push(sizeStop);
                style.push(size);
            });
            return style;
        }
        else {
            return [
                'interpolate', ['linear'], ['zoom'],
                0, settings.circle.radius,
                18, settings.circle.radius * settings.circle.scaleFactor
            ];
        }
    }
}
