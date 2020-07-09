import { MapboxSettings } from "./settings"

export class FormatFieldHelper implements mapboxgl.IControl {
    // private map: mapboxgl.Map;
    private container: HTMLElement;
    private helper: HTMLElement;
    private added: boolean;

    constructor() {
        // this.host = host;
        this.added = false;
    }

    public onAdd(map) {
        this.added = true;
        // this.map = map;
        if (!this.container) {
            this.container = document.createElement('div')
            this.container.className = 'mapboxgl-ctrl'
            this.container.id = "mapbox-formatFieldHelper-container"
            this.createControl()
        }

        return this.container;
    }

    public onRemove() {
        this.added = false;
        this.container.parentNode.removeChild(this.container);
        this.container = undefined;
        // this.map = undefined;

    }

    public getDefaultPosition() {
        return 'top-left';
    }

    public isAdded(): boolean {
        return this.added
    }

    public update(settings: MapboxSettings) {
        if (this.helper) {
            this.container.removeChild(this.helper)
            this.helper = undefined;
            this.createControl()
        }
    }

    private createControl() {
        const d = document;
        this.helper = d.createElement('div');
        this.helper.setAttribute("class", "mapbox-helper mapboxgl-ctrl-group");

        const colorFields = MapboxSettings.roleMap.getAll("color");
        console.log(colorFields)
        if (colorFields.length > 0) {
            const titleElement = d.createElement('div');
            const titleText = d.createTextNode("Color fields");
            titleElement.className = 'mapbox-helper-title';
            titleElement.appendChild(titleText);
            this.helper.appendChild(titleElement)

            colorFields.map((field, index) => {
                const item = d.createElement('div');
                const valueElement = d.createTextNode(`Field #${index + 1} - ${field.displayName}`);
                item.appendChild(valueElement);
                this.helper.appendChild(item)
            })
        }

        const sizeFields = MapboxSettings.roleMap.getAll("size");
        if (sizeFields.length > 0) {
            const titleElement = d.createElement('div');
            const titleText = d.createTextNode("Size fields");
            titleElement.className = 'mapbox-helper-title';
            titleElement.appendChild(titleText);
            this.helper.appendChild(titleElement)

            sizeFields.map((field, index) => {
                const item = d.createElement('div');
                const valueElement = d.createTextNode(`Field #${index + 1} - ${field.displayName}`);
                item.appendChild(valueElement);
                this.helper.appendChild(item)
            })
        }

        this.container.appendChild(this.helper)
    }
}
