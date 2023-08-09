import {
    ChangeDetectionStrategy,
    ChangeDetectorRef,
    Component,
    ElementRef,
    EventEmitter,
    HostListener,
    OnDestroy,
    Renderer2,
    ViewChild,
    ViewContainerRef,
    ViewEncapsulation
} from "@angular/core";
//
import {NgxPopperjsOptions} from "../models/ngx-popperjs-options.model";
import {NgxPopperjsPlacements} from "../models/ngx-popperjs-placements.model";
import {NgxPopperjsTriggers} from "../models/ngx-popperjs-triggers.model";
//
import {createPopper as Popper, Options} from "@popperjs/core";
import {ArrowModifier} from "@popperjs/core/lib/modifiers/arrow";
import {Instance} from "@popperjs/core/lib/types";
import {PreventOverflowModifier} from "@popperjs/core/lib/modifiers/preventOverflow";
import {OffsetModifier} from "@popperjs/core/lib/modifiers/offset";
import {fromEvent, Subject, takeUntil} from "rxjs";

@Component({
    // tslint:disable-next-line:component-selector
    selector: "popper-content",
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: "./ngx-popperjs-content.component.html",
    styleUrls: ["./ngx-popperjs-content.component.scss"],
    exportAs: "ngxPopperjsContent"
})
export class NgxPopperjsContentComponent implements OnDestroy {

    static nextId: number = 0;

    ariaHidden: string;
    arrowColor: string | null = null;
    displayType: string;
    id: string = `ngx_poppperjs_${++NgxPopperjsContentComponent.nextId}`;
    isMouseOver: boolean = false;
    onHidden = new EventEmitter();
    onUpdate: () => any;
    opacity: number;
    popperInstance: Instance;
    popperOptions: NgxPopperjsOptions = {
        disableAnimation: false,
        disableDefaultStyling: false,
        placement: NgxPopperjsPlacements.AUTO,
        boundariesElement: "",
        trigger: NgxPopperjsTriggers.hover,
        positionFixed: false,
        appendToBody: false,
        popperModifiers: []
    } as NgxPopperjsOptions;
    @ViewChild("popperViewRef", {static: !0})
    popperViewRef: ElementRef;
    referenceObject: HTMLElement;
    state: boolean;
    text: string;

    protected readonly _baseModifiers: [OffsetModifier, ArrowModifier] = [
        {
            name: "offset",
            enabled: !0,
            options: {
                offset: [0, 8],
            }
        } as OffsetModifier,
        {
            name: "arrow",
            enabled: !0,
            options: {
                element: ".ngxp__arrow",
                padding: 3
            },
            requires: ["arrow"]
        } as ArrowModifier
    ];
    protected _destroy$: Subject<void> = new Subject<void>();
    protected _styleId = `${this.id}_style`;

    constructor(public elRef: ElementRef,
                protected _renderer: Renderer2,
                protected _viewRef: ViewContainerRef,
                protected _changeDetectorRef: ChangeDetectorRef) {
        this._toggleVisibility(!1);
    }

    clean() {
        this.toggleVisibility(false);
        if (!this.popperInstance) {
            return;
        }
        this.popperInstance.destroy();
    }

    extractAppliedClassListExpr(classList: string | string[] = []): object {
        const klassList = Array.isArray(classList) ? classList : typeof classList === typeof "" ? classList.replace(/ /, "").split(",") : [];

        return klassList.reduce((acc, klass) => {
            acc[klass] = !0;

            return acc;
        }, {});
    }

    hide(): void {
        if (this.popperInstance) {
            this.popperInstance.destroy();
        }
        this.toggleVisibility(false);
        this.onHidden.emit();
    }

    ngOnDestroy() {
        this._destroy$.next();
        this.clean();
        if (this.popperOptions.appendTo && this.elRef && this.elRef.nativeElement && this.elRef.nativeElement.parentNode) {
            this._viewRef.detach();
            this.elRef.nativeElement.parentNode.removeChild(this.elRef.nativeElement);
        }
    }

    onDocumentResize() {
        this.update();
    }

    @HostListener("mouseover")
    onMouseOver() {
        this.isMouseOver = true;
    }

    show(): void {
        if (!this.referenceObject) {
            return;
        }

        const appendToParent = this.popperOptions.appendTo && document.querySelector(this.popperOptions.appendTo);
        if (appendToParent && this.elRef.nativeElement.parentNode !== appendToParent) {
            this.elRef.nativeElement.parentNode && this.elRef.nativeElement.parentNode.removeChild(this.elRef.nativeElement);
            appendToParent.appendChild(this.elRef.nativeElement);
        }

        const popperOptions: Options = {
            strategy: this.popperOptions.positionFixed ? "fixed" : "absolute",
            placement: this.popperOptions.placement,
            modifiers: this._baseModifiers
        } as Options;
        if (this.onUpdate) {
            popperOptions.onFirstUpdate = this.onUpdate as any;
        }

        const boundariesElement = this.popperOptions.boundariesElement && document.querySelector(this.popperOptions.boundariesElement);

        if (popperOptions.modifiers && boundariesElement) {
            popperOptions.modifiers.push({
                name: "preventOverflow",
                enabled: this.popperOptions.preventOverflow,
                options: {
                    boundary: boundariesElement
                }
            } as PreventOverflowModifier);
        }
        if (popperOptions.modifiers) {
            const preventOverflowModifier = popperOptions.modifiers.find((v) => v.name === "preventOverflow");
            if (preventOverflowModifier && !preventOverflowModifier.enabled) {
                const hideModifier = popperOptions.modifiers.find((v) => v.name === "preventOverflow");
                hideModifier && (hideModifier.enabled = !1);
            }
        }
        this._determineArrowColor();
        popperOptions.modifiers = popperOptions.modifiers.concat(this.popperOptions.popperModifiers);
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
                this.popperInstance = Popper(
                    this.referenceObject,
                    this.popperViewRef.nativeElement,
                    popperOptions,
                );
            });
        });
        this.toggleVisibility(!0);
        fromEvent(document, "resize")
            .pipe(takeUntil(this._destroy$))
            .subscribe({
                next: () => this.onDocumentResize()
            });
    }

    @HostListener("mouseleave")
    showOnLeave() {
        this.isMouseOver = false;
        if (this.popperOptions.trigger !== NgxPopperjsTriggers.hover && !this.popperOptions.hideOnMouseLeave) {
            return;
        }
        this.hide();
    }

    // Toggle visibility and detect changes - Run only after ngOnInit!
    toggleVisibility(state: boolean): void {
        this._toggleVisibility(state);
        // tslint:disable-next-line:no-string-literal
        if (!this._changeDetectorRef["destroyed"]) {
            this._changeDetectorRef.detectChanges();
        }
    }

    update(): void {
        this.popperInstance && (this.popperInstance as any).update();
    }

    protected _createArrowSelector(): string {
        return `div#${this.id}.ngxp__container > .ngxp__arrow.ngxp__force-arrow`;
    }

    protected _determineArrowColor() {
        if (!this.popperOptions.styles || this.arrowColor) {

            return !1;
        }
        const ruleValue = this.popperOptions.styles["background-color"] || this.popperOptions.styles.backgroundColor;
        if (this.arrowColor === ruleValue) {
            return !1;
        }
        this.arrowColor = ruleValue;
        let $style = document.querySelector(`#${this._styleId}`) as HTMLStyleElement;
        const styleContent = this.arrowColor ?
            `${this._createArrowSelector()}:before { background-color: ${this.arrowColor}; }` : "";
        if (!$style) {
            $style = document.createElement("style") as HTMLStyleElement;
            $style.id = this._styleId;
            $style.setAttribute("type", "text/css");
            document.head.appendChild($style);
        }
        // tslint:disable-next-line:no-string-literal
        if ($style["styleSheet"]) {
            // tslint:disable-next-line:no-string-literal
            $style["styleSheet"].cssText = styleContent;
            // This is required for IE8 and below.
        }
        else {
            $style.innerHTML = styleContent;
        }
    }

    protected _toggleVisibility(state): void {
        this.displayType = ["none", "block"][+state];
        this.opacity = +state;
        this.ariaHidden = `${!state}`;
        this.state = state;
    }
}
