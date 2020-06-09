import powerbiVisualsApi from "powerbi-visuals-api";
import IVisualHost = powerbiVisualsApi.extensibility.visual.IVisualHost;
import VisualObjectInstancesToPersist = powerbiVisualsApi.VisualObjectInstancesToPersist;


import capabilities from "../capabilities.json"
import { MapboxSettings } from "./settings"
import { constants } from "./constants"

export class StyleSelector implements mapboxgl.IControl {
    private host: IVisualHost;
    private map: mapboxgl.Map;
    private container: HTMLElement;
    private select: HTMLSelectElement;
    private added: boolean;

    constructor(host) {
        this.host = host;
        this.added = false;
    }

    public onAdd(map) {
        this.added = true;
        this.map = map;
        this.container = document.createElement('div');
        this.container.className = 'mapboxgl-ctrl mapboxgl-ctrl-group';

        this.select = this.createControl(this.getClass(), this.getTitle(),
            (e) => {
                this.select.className = this.getClass();
                this.select.title = this.getTitle();

                this.host.persistProperties(<VisualObjectInstancesToPersist>{
                    merge: [{
                        objectName: "api",
                        selector: null,
                        properties: {
                            style: e.value,
                        }
                    }]
                })
            });
        return this.container;
    }

    public onRemove() {
        this.added = false;
        this.container.parentNode.removeChild(this.container);
        this.map = undefined;
    }

    public getDefaultPosition() {
        return 'top-left';
    }

    public isAdded(): boolean {
        return this.added
    }

    public update(settings: MapboxSettings) {
        if (this.select) {
            this.select.value = settings.api.style;
        }
    }

    private createControl(className: string, ariaLabel: string, fn: (any) => any) {
        const select = this.createElement('select', className, this.container);
        select.setAttribute('aria-label', ariaLabel);
        select.title = ariaLabel;
        select.addEventListener('change', () => fn(select));

        capabilities.objects.api.properties.style.type.enumeration.filter( style => style.value !== "custom")
        .map ( style => {
            const option = this.createElement('option', '', select);
            option.value = style.value;
            option.innerText = style.displayName;
        });

        return select;
    }

    private createElement = function (tagName: any, className?: string, container?: HTMLElement) {
        const el = window.document.createElement(tagName);
        if (className) el.className = className;
        if (container) container.appendChild(el);
        return el;
    };

    private getClass() {
        let buttonClassName = constants.MAPBOX_CTRL_ICON_CLASS;
        return buttonClassName;
    }

    private getTitle() {
        let title = 'style';
        return title;
    }
}