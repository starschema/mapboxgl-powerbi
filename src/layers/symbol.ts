import powerbiVisualsApi from "powerbi-visuals-api";
import { ClassificationMethod, Limits, decorateLayer, shouldUseGradient, getClassCount, getBreaks } from "../mapboxUtils"
import { Palette } from "../palette"
import { RoleMap } from "../roleMap"
import { Layer } from "./layer"
import { Filter } from "../filter"
import { MapboxSettings, SymbolSettings } from "../settings"
import { ColorStops } from "../legendControl"
import { Sources } from "../datasources/sources"
import { constants } from "../constants"
import { MapboxMap } from "../visual"

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

    getSource(settings) {
        this.settings = settings.symbol;
        return super.getSource(settings);
    }

    addLayer(settings, beforeLayerId, roleMap) {
        const map = this.parent.getMap();
        const latitude = roleMap.latitude()
        const layers = {};

        layers[Symbol.ID] = decorateLayer({
            id: Symbol.ID,
            source: 'data',
            type: 'symbol',
            layout: {
                'icon-image': 'symbol',
                'icon-size': 5
            }
        });

        const zeroFilter = ["==", latitude, ""]
        layers[Symbol.HighlightID] = decorateLayer({
            id: Symbol.HighlightID,
            type: 'symbol',
            source: 'data',
            filter: zeroFilter
        });

        Symbol.LayerOrder.forEach((layerId) => map.addLayer(layers[layerId], beforeLayerId));

        map.setPaintProperty(Symbol.HighlightID, 'icon-opacity', 1);
    }

    moveLayer(beforeLayerId: string) {
        const map = this.parent.getMap();
        Symbol.LayerOrder.forEach((layerId) => map.moveLayer(layerId, beforeLayerId));
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

    applySettings(settings: MapboxSettings, roleMap) {
        super.applySettings(settings, roleMap);
        const map = this.parent.getMap();
        map.loadImage(
            settings.symbol.url || "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAAXNSR0IArs4c6QAAAERlWElmTU0AKgAAAAgAAYdpAAQAAAABAAAAGgAAAAAAA6ABAAMAAAABAAEAAKACAAQAAAABAAAAEKADAAQAAAABAAAAEAAAAAA0VXHyAAAAyUlEQVQ4EYVSSw4CIQwFx8StcVZuvY0b7+I5PM6sPIvxIkajfZWSRy3YBGjfpzSElOLYCfx2K1TmAIVxFI1nRcpZ8n9myLsaPzLqLRwlPK+wjRN1Nc4a4HzJ4qkzFyxk852IifKaHiQLxysKcLjZ4iGJ6RW7EQDirOh3MyHOfcEXOQ1X6EkACB8eM7PieIOjd7ia38NRKRnJtxj2IxaAdeDzOlIFmDdWCd/WFVV1m6iX/8G15YfVpseehMAko8VT9/ok/izW7BKpP1obQQCwnRAcAAAAAElFTkSuQmCC",
            (error, image) => {
                if (error) {
                    console.error("Error while loading image: ", error)
                    return
                }

                if (map.hasImage('symbol')) {
                    map.removeImage('symbol', image)
                }

                map.addImage('symbol', image)
            }
        )
        console.log("symbol layer applySettings: ", settings.symbol.show)
        if (settings.symbol.show) {
            map.setLayerZoomRange(Symbol.ID, settings.symbol.minZoom, settings.symbol.maxZoom);
            map.setPaintProperty(Symbol.ID, 'icon-opacity', settings.symbol.opacity / 100);
        }
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
        return false; // TODO
    }
}
