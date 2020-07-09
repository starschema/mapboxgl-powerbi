import { RoleMap } from "./roleMap";

export class FormatFieldHelper implements mapboxgl.IControl {
    private container: HTMLElement;
    private helper: HTMLElement;
    private added: boolean;

    constructor() {
        this.added = false;
    }

    public onAdd(map): HTMLElement {
        this.added = true;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl'
        this.container.id = "mapbox-formatFieldHelper-container"
        return this.container;
    }

    public onRemove() {
        this.added = false;
        this.container.parentNode.removeChild(this.container);
        this.container = undefined;
    }

    public getDefaultPosition() {
        return 'top-left';
    }

    public isAdded(): boolean {
        return this.added
    }

    public update(roleMap: RoleMap) {
        if (this.added) {
            if (this.container.hasChildNodes()) {
                this.container.removeChild(this.helper);
            }
            this.helper = this.createControl(roleMap);
        }
    }

    private createControl(roleMap: RoleMap):HTMLElement {
        const d = document;
        const helper = this.createElement('div', 'mapbox-helper mapboxgl-ctrl-group', this.container);
        const colorFields = roleMap.getAll("color");
        if (colorFields.length > 0) {
            const titleElement = d.createElement('div');
            const titleText = d.createTextNode("Color fields");
            titleElement.className = 'mapbox-helper-title';
            titleElement.appendChild(titleText);
            helper.appendChild(titleElement)

            colorFields.map((field, index) => {
                const item = d.createElement('div');
                const valueElement = d.createTextNode(`Field #${index + 1} - ${field.displayName}`);
                item.appendChild(valueElement);
                helper.appendChild(item)
            })
        }

        const sizeFields = roleMap.getAll("size");
        if (sizeFields.length > 0) {
            const titleElement = d.createElement('div');
            const titleText = d.createTextNode("Size fields");
            titleElement.className = 'mapbox-helper-title';
            titleElement.appendChild(titleText);
            helper.appendChild(titleElement);

            sizeFields.map((field, index) => {
                const item = d.createElement('div');
                const valueElement = d.createTextNode(`Field #${index + 1} - ${field.displayName}`);
                item.appendChild(valueElement);
                helper.appendChild(item);
            })
        }

        return helper
    }

    private createElement = function (tagName: any, className?: string, container?: HTMLElement) {
        const el = document.createElement(tagName);
        if (className) el.className = className;
        if (container) container.appendChild(el);
        return el;
    };
}
