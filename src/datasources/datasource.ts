import { BBox } from "@turf/helpers"
import { Limits } from "../mapboxUtils"
import { MapboxMap } from "../visual"

export abstract class Datasource {
    protected bounds: BBox;
    private references: Object;
    public ID: string;

    constructor(id) {
        this.references = {}
        this.ID = id
    }

    abstract addSources(map, settings);
    abstract removeSources(map);

    abstract getColorLimits(index: number) : Limits
    abstract getSizeLimits(index: number) : Limits

    addToMap(map, settings) {
        this.addSources(map, settings)
    }

    removeFromMap(map, layerId) {
        delete this.references[layerId]
        if (Object.keys(this.references).length == 0) {
            this.removeSources(map)
        }
    }

    ensure(map, layerId, settings): void {
        this.references[layerId] = true;
    }

    update(map: MapboxMap, features, roleMap, settings) {}
    getBounds() : BBox { return this.bounds }
    handleZoom(map, settings) : boolean {
        return false;
    }
    getData(map, settings) : any[] { return null }
}
