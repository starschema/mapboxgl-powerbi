import { Limits } from "../mapboxUtils"

export abstract class Datasource {
    protected bounds: any[];
    private references: Object;
    public ID: string;

    constructor(id) {
        this.references = {}
        this.ID = id
    }

    abstract addSources(map, settings);
    abstract removeSources(map);

    getColorLimits(index: number) : Limits {
        const limits = this.getLimits();
        return limits.colorLimits;
    }

    getSizeLimits(index: number) : Limits {
        const limits = this.getLimits();
        return limits.sizeLimits;
    }

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

    update(map, features, roleMap, settings) {}
    getBounds() : any[] { return this.bounds }
    getLimits() : any { return null }
    handleZoom(map, settings) : boolean {
        return false;
    }
    getData(map, settings) : any[] { return null }
}
