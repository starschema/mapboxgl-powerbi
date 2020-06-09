import { Datasource } from "./datasource"
import { Limits } from "../mapboxUtils"

export class Raster extends Datasource {
    constructor() {
        super('wms')
    }

    addSources(map, settings) {
        map.addSource('raster', {
            type: 'raster',
            tiles: [
                settings.raster.url
            ],
            tileSize: settings.raster.rasterTileSize
        }, );
        return map.getSource('raster');
    }

    removeSources(map) {
        map.removeSource('raster');
    }

    getColorLimits(index: number): Limits {
        return null
    }

    getSizeLimits(index: number): Limits {
        return null
    }

    ensure(map, layerId, settings): void {
        super.ensure(map, layerId, settings)
        const source: any = map.getSource('raster');
        if (!source) {
            this.addToMap(map, settings);
        }
    }

    update(visual, features, roleMap, settings) {
        super.update(visual, features, roleMap, settings)
        const map = visual.getMap()
        const source: any = map.getSource('raster');
    }
}
