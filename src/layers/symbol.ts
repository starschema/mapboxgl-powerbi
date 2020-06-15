import powerbiVisualsApi from "powerbi-visuals-api";
import { ClassificationMethod, Limits, decorateLayer, shouldUseGradient, getClassCount, getBreaks, getSizes, getColorStyle } from "../mapboxUtils"
import { Palette } from "../palette"
import { RoleMap } from "../roleMap"
import { Layer } from "./layer"
import { Filter } from "../filter"
import { MapboxSettings, SymbolSettings } from "../settings"
import { ColorStops } from "../legendControl"
import { Sources } from "../datasources/sources"
import { constants } from "../constants"
import { MapboxMap } from "../MapboxMap"

export class Symbol extends Layer {
    private filter: Filter;
    private palette: Palette;
    private settings: SymbolSettings;

    public static readonly ID = 'symbol';
    private static readonly HighlightID = 'symbol-highlight';

    private static readonly LayerOrder = [Symbol.ID, Symbol.HighlightID];

    constructor(map: MapboxMap, filter: Filter, palette: Palette) {
        super(map, Symbol.ID)
        this.filter = filter
        this.palette = palette
        this.source = Sources.Point
    }

    getLayerIDs() {
        return [ Symbol.ID ];
    }

    layerIndex() { return 4 }

    getSource(settings) {
        this.settings = settings.symbol;
        return super.getSource(settings);
    }

    addLayer(settings, beforeLayerId, roleMap): string {
        const map = this.parent.getMap();
        const latitude = roleMap.latitude()
        const layers = {};

        layers[Symbol.ID] = decorateLayer({
            id: Symbol.ID,
            source: 'data',
            type: 'symbol',
        });

        const zeroFilter = ["==", latitude, ""]
        layers[Symbol.HighlightID] = decorateLayer({
            id: Symbol.HighlightID,
            type: 'symbol',
            source: 'data',
            filter: zeroFilter,
        });

        const lastId = Symbol.LayerOrder.reduce((prevId, layerId) => {
            map.addLayer(layers[layerId], lastId)
            return layerId
        }, beforeLayerId);

        map.setPaintProperty(Symbol.HighlightID, 'icon-opacity', 1);
        map.setPaintProperty(Symbol.HighlightID, 'icon-color', settings.symbol.highlightColor)

        map.on('styleimagemissing', (e) => {
            map.loadImage(
                e.id,
                (error, image) => {
                    if (error) {
                        console.error("Error while loading image: ", error)
                        return
                    }

                    if (map.hasImage(e.id)) {
                        map.removeImage(e.id, image)
                    }

                    map.addImage(e.id, image, {sdf: settings.symbol.sdf})
                }
            )
        });


        return lastId
    }

    moveLayer(beforeLayerId: string): string {
        const map = this.parent.getMap();
        return Symbol.LayerOrder.reduce((prevId, layerId) => {
            map.moveLayer(layerId, prevId)
            return layerId
        }, beforeLayerId);
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
            this.parent.getMap().setFilter(Symbol.HighlightID, lngLatFilter);
        }
    }

    removeHighlight(roleMap) {
        if (!this.layerExists()) {
            return;
        }
        const latitude = roleMap.latitude()
        const map = this.parent.getMap();
        const zeroFilter = ["==", latitude, ""];
        map.setFilter(Symbol.HighlightID, zeroFilter);
        if (this.settings.opacity) {
            map.setPaintProperty(Symbol.ID, 'icon-opacity', this.settings.opacity / 100);
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

        map.setFilter(Symbol.HighlightID, lngLatFilter);

        const opacity = this.filter.getSelectionOpacity(this.settings.opacity)
        map.setPaintProperty(Symbol.ID, 'icon-opacity', opacity);
        return selectionIds
    }

    removeLayer() {
        const map = this.parent.getMap();
        Symbol.LayerOrder.forEach(layerId => map.removeLayer(layerId));
        this.source.removeFromMap(map, Symbol.ID);
    }

    applySettings(settings: MapboxSettings, roleMap: RoleMap, prevId: string): string {
        const lastId = super.applySettings(settings, roleMap, prevId);
        const map = this.parent.getMap();

        if (settings.symbol.show) {

            const sizeField = roleMap.get('size', settings.symbol.sizeField)
            const sizeLimits = this.source.getSizeLimits(settings.symbol.sizeField)
            const sizeFieldName = sizeField ? sizeField.displayName : ""
            const sizes = getSizes(sizeLimits, map, settings.symbol.size / 100, settings.symbol.scaleFactor, sizeFieldName);

            // Two coalesces as the inner one handles when roleMap.symbol is not set and hence it is empty string
            // and get empty string returns null
            // The outer one handles if neither symbol role nor settings.symbol.url are set in that
            // case a default symbol is displayed.
            const image = ["coalesce",
                ["image", ["coalesce", ["get", roleMap.symbol()], settings.symbol.url]],
                ["image", constants.MAPBOX_ICON_BIG],
            ]
            map.setLayoutProperty(Symbol.ID, 'icon-image', image);
            map.setLayoutProperty(Symbol.HighlightID, 'icon-image', image);
            map.setLayoutProperty(Symbol.ID, 'icon-size', sizes);
            map.setLayoutProperty(Symbol.HighlightID, 'icon-size', sizes);


            const colorField = roleMap.get('color', settings.symbol.colorField)
            const isGradient = shouldUseGradient(colorField);
            const colorLimits = this.source.getColorLimits(settings.symbol.colorField)
            this.colorStops = this.generateColorStops(settings.symbol, isGradient, colorLimits, this.palette)
            const colorFieldName = colorField ? colorField.displayName : ""
            let colorStyle = getColorStyle(isGradient, settings.symbol, colorFieldName, this.colorStops);
            map.setPaintProperty(Symbol.ID, 'icon-color', colorStyle)
            map.setPaintProperty(Symbol.HighlightID, 'icon-color', settings.symbol.highlightColor)

            map.setLayerZoomRange(Symbol.ID, settings.symbol.minZoom, settings.symbol.maxZoom);
            map.setLayerZoomRange(Symbol.HighlightID, settings.symbol.minZoom, settings.symbol.maxZoom);
            map.setLayoutProperty(Symbol.ID, 'icon-allow-overlap', settings.symbol.allowOverlap);
            map.setLayoutProperty(Symbol.HighlightID, 'icon-allow-overlap', settings.symbol.allowOverlap);
            map.setPaintProperty(Symbol.ID, 'icon-opacity', settings.symbol.opacity / 100);
        }

        return lastId
    }

    handleTooltip(tooltipEvent, roleMap, settings: MapboxSettings) {
        const tooltipData = Layer.getTooltipData(tooltipEvent.data, tooltipEvent.ids)
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
        return settings.symbol.legend && roleMap.color(this) && super.showLegend(settings, roleMap)
    }
}
