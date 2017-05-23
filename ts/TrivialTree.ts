/*!
Trivial Components (https://github.com/trivial-components/trivial-components)

Copyright 2016 Yann Massard (https://github.com/yamass) and other contributors

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import * as $ from "jquery";
import * as Mustache from "mustache";
import {TrivialTreeBox, TrivialTreeBoxConfig} from "./TrivialTreeBox";
import {DEFAULT_TEMPLATES, defaultEntryMatchingFunctionFactory, defaultTreeQueryFunctionFactory, HighlightDirection, QueryFunction, TrivialComponent, keyCodes} from "./TrivialCore";
import {TrivialEvent} from "./TrivialEvent";
export type SearchBarMode = 'none' | 'show-if-filled' | 'always-visible';

export interface TrivialTreeConfig<E> extends TrivialTreeBoxConfig<E> {
    queryFunction?: QueryFunction<E>,
    searchBarMode?: SearchBarMode,
    directSelectionViaArrowKeys?: boolean,
    performanceOptimizationSettings?: {
        toManyVisibleItemsRenderDelay: number,
        toManyVisibleItemsThreshold: number
    }
}

export class TrivialTree<E> implements TrivialComponent{

    private config: TrivialTreeConfig<E>;

    public readonly onSelectedEntryChanged = new TrivialEvent<E>(this);
    public readonly onNodeExpansionStateChanged = new TrivialEvent<E>(this);

    private treeBox: TrivialTreeBox<E>;
    private entries: E[];
    private selectedEntryId: any;

    private $spinners = $();
    private $originalInput: JQuery;
    private $componentWrapper: JQuery;
    private $editor: JQuery;
    private processUpdateTimer: number;

    constructor(originalInput: JQuery|Element|string, options: TrivialTreeConfig<E> = {}) {
        this.config = $.extend(<TrivialTreeConfig<E>> {
            valueFunction: (entry:E) => entry ? "" + (entry as any).id : null,
            childrenProperty: "children",
            lazyChildrenFlagProperty: "hasLazyChildren",
            searchBarMode: 'show-if-filled',
            lazyChildrenQueryFunction: (node: E, resultCallback: Function) => {
                resultCallback([])
            },
            expandedProperty: 'expanded',
            entryRenderingFunction: (entry: E, depth: number) => {
                const defaultTemplates = [DEFAULT_TEMPLATES.icon2LinesTemplate, DEFAULT_TEMPLATES.iconSingleLineTemplate];
                const template = (entry as any).template || defaultTemplates[Math.min(depth, defaultTemplates.length - 1)];
                return Mustache.render(template, entry);
            },
            spinnerTemplate: DEFAULT_TEMPLATES.defaultSpinnerTemplate,
            noEntriesTemplate: DEFAULT_TEMPLATES.defaultNoEntriesTemplate,
            entries: null,
            queryFunction: null, // defined below...
            selectedEntryId: null,
            matchingOptions: {
                matchingMode: 'contains',
                ignoreCase: true,
                maxLevenshteinDistance: 2
            },
            directSelectionViaArrowKeys: false,
            performanceOptimizationSettings: {
                toManyVisibleItemsRenderDelay: 750,
                toManyVisibleItemsThreshold: 75
            }
        }, options);

        if (!this.config.queryFunction) {
            this.config.queryFunction = defaultTreeQueryFunctionFactory(
                this.config.entries || [],
                defaultEntryMatchingFunctionFactory(["displayValue", "additionalInfo"], this.config.matchingOptions),
                this.config.childrenProperty,
                this.config.expandedProperty
            );
        }

        this.entries = this.config.entries;

        this.$originalInput = $(originalInput).addClass("tr-original-input");
        this.$componentWrapper = $('<div class="tr-tree" tabindex="0"/>').insertAfter(this.$originalInput);
        if (this.config.searchBarMode !== 'always-visible') {
            this.$componentWrapper.addClass("hide-searchfield");
        }
        this.$componentWrapper.keydown((e:KeyboardEvent) => {
            if (e.which == keyCodes.tab || keyCodes.isModifierKey(e)) {
                return; // tab or modifier key was pressed...
            }
            if (this.$editor.is(':visible') && keyCodes.specialKeys.indexOf(e.which) === -1) {
                this.$editor.focus();
            }
            if (e.which == keyCodes.up_arrow || e.which == keyCodes.down_arrow) {
                const direction = e.which == keyCodes.up_arrow ? -1 : 1;
                if (this.entries != null) {
                    if (this.config.directSelectionViaArrowKeys) {
                        this.treeBox.selectNextEntry(direction, e);
                    } else {
                        this.treeBox.highlightNextEntry(direction);
                    }
                    return false; // some browsers move the caret to the beginning on up key
                }
            } else if (e.which == keyCodes.left_arrow || e.which == keyCodes.right_arrow) {
                this.treeBox.setHighlightedNodeExpanded(e.which == keyCodes.right_arrow);
            } else if (e.which == keyCodes.enter) {
                this.treeBox.setSelectedEntry(this.treeBox.getHighlightedEntry(), e);
            } else if (e.which == keyCodes.escape) {
                this.$editor.val("");
                this.query();
                this.$componentWrapper.focus();
            } else {
                this.query(1);
            }
        });
        this.$editor = $('<input type="text" class="tr-tree-editor tr-editor"/>')
            .prependTo(this.$componentWrapper)
            .attr("tabindex", this.$originalInput.attr("-1"))
            .focus(() => {
                this.$componentWrapper.addClass('focus');
            })
            .blur(() => {
                this.$componentWrapper.removeClass('focus');
            })
            .keydown((e) => {
                if (e.which == keyCodes.left_arrow || e.which == keyCodes.right_arrow) {
                    // expand the currently highlighted node.
                    const changedExpandedState = this.treeBox.setHighlightedNodeExpanded(e.which == keyCodes.right_arrow);
                    if (changedExpandedState) {
                        return false;
                    } else {
                        return; // let the user navigate freely left and right...
                    }
                }
            })
            .on('keyup change', () => {
                if (this.config.searchBarMode === 'show-if-filled') {
                    if (this.$editor.val()) {
                        this.$componentWrapper.removeClass('hide-searchfield');
                    } else {
                        this.$componentWrapper.addClass('hide-searchfield');
                    }
                }
            });
        if (this.config.searchBarMode === 'none') {
            this.$editor.css("display", "none");
        }

        if (this.$originalInput.attr("placeholder")) {
            this.$editor.attr("placeholder", this.$originalInput.attr("placeholder"));
        }
        if (this.$originalInput.attr("tabindex")) {
            this.$componentWrapper.attr("tabindex", this.$originalInput.attr("tabindex"));
        }
        if (this.$originalInput.attr("autofocus")) {
            this.$componentWrapper.focus();
        }

        this.treeBox = new TrivialTreeBox(this.$componentWrapper, this.config);
        this.treeBox.onNodeExpansionStateChanged.addListener((node: E)=> {
            this.onNodeExpansionStateChanged.fire(node);
        });
        this.treeBox.onSelectedEntryChanged.addListener(() => {
            const selectedTreeBoxEntry = this.treeBox.getSelectedEntry();
            if (selectedTreeBoxEntry) {
                this.setSelectedEntry(selectedTreeBoxEntry);
            }
        });

        this.setSelectedEntry((this.config.selectedEntryId !== undefined && this.config.selectedEntryId !== null) ? this.findEntryById(this.config.selectedEntryId) : null);
    }

    public updateEntries(newEntries: E[]) {
        this.entries = newEntries;
        this.$spinners.remove();
        this.$spinners = $();
        this.treeBox.updateEntries(newEntries);
    }


    private query(highlightDirection?: HighlightDirection) {
        if (this.config.searchBarMode === 'always-visible' || this.config.searchBarMode === 'show-if-filled') {
            const $spinner = $(this.config.spinnerTemplate).appendTo(this.treeBox.getMainDomElement());
            this.$spinners = this.$spinners.add($spinner);

            // call queryFunction asynchronously to be sure the input field has been updated before the result callback is called. Note: the query() method is called on keydown...
            setTimeout(() => {
                this.config.queryFunction(this.$editor.val(), (newEntries: E[]) => {
                    let processUpdate = () => {
                        this.updateEntries(newEntries);
                        if (this.$editor.val().length > 0) {
                            this.treeBox.highlightTextMatches(this.$editor.val());
                            if (!this.config.directSelectionViaArrowKeys) {
                                this.treeBox.highlightNextMatchingEntry(highlightDirection);
                            }
                        }
                        this.treeBox.revealSelectedEntry();
                    };

                    clearTimeout(this.processUpdateTimer);
                    if (this.countVisibleEntries(newEntries) < this.config.performanceOptimizationSettings.toManyVisibleItemsThreshold) {
                        processUpdate();
                    } else {
                        this.processUpdateTimer = window.setTimeout(processUpdate, this.config.performanceOptimizationSettings.toManyVisibleItemsRenderDelay);
                    }
                });
            }, 0);
        }
    }

    private countVisibleEntries(entries: E[]) {
        let countVisibleChildrenAndSelf = (node: E) => {
            if ((node as any)[this.config.expandedProperty] && (node as any)[this.config.childrenProperty]) {
                return (node as any)[this.config.childrenProperty].map((entry: E) => {
                        return countVisibleChildrenAndSelf(entry);
                    }).reduce((a:number, b:number) => {
                        return a + b;
                    }, 0) + 1;
            } else {
                return 1;
            }
        };

        return entries.map((entry: E) => {
            return countVisibleChildrenAndSelf(entry);
        }).reduce((a, b) => {
            return a + b;
        }, 0);
    }

    private findEntries(filterFunction: ((node: E) => boolean)) {
        let findEntriesInSubTree = (node: E, listOfFoundEntries: E[]) => {
            if (filterFunction.call(this, node)) {
                listOfFoundEntries.push(node);
            }
            if ((node as any)[this.config.childrenProperty]) {
                for (let i = 0; i < (node as any)[this.config.childrenProperty].length; i++) {
                    const child = (node as any)[this.config.childrenProperty][i];
                    findEntriesInSubTree(child, listOfFoundEntries);
                }
            }
        };

        const matchingEntries: E[] = [];
        for (let i = 0; i < this.entries.length; i++) {
            const rootEntry = this.entries[i];
            findEntriesInSubTree(rootEntry, matchingEntries);
        }
        return matchingEntries;
    }

    private findEntryById(id:number) {
        return this.findEntries((entry: E) => {
            return this.config.valueFunction(entry) === id.toString()
        })[0];
    }

    private setSelectedEntry(entry: E) {
        this.selectedEntryId = entry ? this.config.valueFunction(entry) : null;
        this.$originalInput.val(entry ? this.config.valueFunction(entry) : null);
        this.fireChangeEvents(entry);
    }

    private fireChangeEvents(entry: E) {
        this.$originalInput.trigger("change");
        this.$componentWrapper.trigger("change");
        this.onSelectedEntryChanged.fire(entry);
    }

    public getSelectedEntry() {
        this.treeBox.getSelectedEntry()
    };

    public updateChildren(parentNodeId: any, children: E[]) {
        this.treeBox.updateChildren(parentNodeId, children)
    };

    public updateNode(node: E) {
        this.treeBox.updateNode(node)
    };

    public removeNode(nodeId: string) {
        this.treeBox.removeNode(nodeId)
    };

    public addNode(parentNodeId: number, node: E) {
        this.treeBox.addNode(parentNodeId, node)
    };

    public selectNodeById(nodeId: any) {
        this.treeBox.setSelectedEntryById(nodeId);
    };

    public getEditor(): Element {
        return this.$editor[0];
    }

    public destroy() {
        this.$originalInput.removeClass('tr-original-input').insertBefore(this.$componentWrapper);
        this.$componentWrapper.remove();
    };

    getMainDomElement(): Element {
        return this.$componentWrapper[0];
    }
}
