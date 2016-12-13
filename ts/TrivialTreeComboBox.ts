/*
 Trivial Components (https://github.com/trivial-components/trivial-components)

 Copyright 2015 Yann Massard (https://github.com/yamass) and other contributors

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
module TrivialComponents {

    export class TrivialTreeComboBox {

        private $: JQuery;
        private $treeComboBox: JQuery;
        private $dropDown: JQuery;
        private $dropDownTargetElement: JQuery;
        private config: any;
        private $editor: JQuery;
        private treeBox: TrivialTreeBox;
        private isDropDownOpen = false;
        private isEditorVisible = false;
        private lastQueryString: string = null;
        private lastCompleteInputQueryString: string = null;
        private selectedEntry: any = null;
        private lastCommittedValue: any = null;
        private blurCausedByClickInsideComponent = false;
        private autoCompleteTimeoutId = -1;
        private doNoAutoCompleteBecauseBackspaceWasPressed = false;
        private editingMode: EditingMode;
        private $originalInput: JQuery;
        private $selectedEntryWrapper: JQuery;
        private $clearButton: JQuery;
        private $trigger: JQuery;

        private $spinners = $();

        public readonly onSelectedEntryChanged = new TrivialEvent();
        public readonly onFocus = new TrivialEvent();
        public readonly onBlur = new TrivialEvent();

        constructor(originalInput: JQuery|Element|string, options: any = {}/*TODO config type*/) {
            this.config = $.extend({
                valueProperty: 'id',
                entryRenderingFunction: (entry: any, depth: number) => {
                    var defaultTemplates = [DEFAULT_TEMPLATES.icon2LinesTemplate, DEFAULT_TEMPLATES.iconSingleLineTemplate];
                    var template = entry.template || defaultTemplates[Math.min(depth, defaultTemplates.length - 1)];
                    return Mustache.render(template, entry);
                },
                selectedEntryRenderingFunction: (entry: any) => {
                    if (entry.selectedEntryTemplate) {
                        return Mustache.render(entry.selectedEntryTemplate, entry)
                    } else {
                        return this.config.entryRenderingFunction(entry, 0);
                    }
                },
                selectedEntry: null,
                spinnerTemplate: DEFAULT_TEMPLATES.defaultSpinnerTemplate,
                noEntriesTemplate: DEFAULT_TEMPLATES.defaultNoEntriesTemplate,
                textHighlightingEntryLimit: 100,
                entries: null,
                emptyEntry: {
                    _isEmptyEntry: true
                },
                queryFunction: null, // defined below...
                autoComplete: true,
                autoCompleteDelay: 0,
                entryToEditorTextFunction: (entry: any) => {
                    return entry["displayValue"];
                },
                autoCompleteFunction: (editorText: string, entry: any) => {
                    if (editorText) {
                        for (let propertyName in entry) {
                            var propertyValue = entry[propertyName];
                            if (propertyValue && propertyValue.toString().toLowerCase().indexOf(editorText.toLowerCase()) === 0) {
                                return propertyValue.toString();
                            }
                        }
                        return null;
                    } else {
                        return this.config.entryToEditorTextFunction(entry);
                    }
                },
                allowFreeText: false,
                freeTextEntryFactory: (freeText: string) => {
                    return {
                        displayValue: freeText,
                        _isFreeTextEntry: true
                    };
                },
                showClearButton: false,
                showTrigger: true,
                matchingOptions: {
                    matchingMode: 'contains',
                    ignoreCase: true,
                    maxLevenshteinDistance: 2
                },
                childrenProperty: "children",
                lazyChildrenFlagProperty: "hasLazyChildren",
                expandedProperty: 'expanded',
                editingMode: "editable", // one of 'editable', 'disabled' and 'readonly'
                showDropDownOnResultsOnly: false
            }, options);

            this.config.queryFunction = this.config.queryFunction || defaultTreeQueryFunctionFactory(this.config.entries
                    || [], defaultEntryMatchingFunctionFactory(["displayValue", "additionalInfo"], this.config.matchingOptions), this.config.childrenProperty, this.config.expandedProperty);

            this.$originalInput = $(originalInput);
            this.$treeComboBox = $('<div class="tr-treecombobox tr-combobox tr-input-wrapper"/>')
                .insertAfter(this.$originalInput);
            this.$selectedEntryWrapper = $('<div class="tr-combobox-selected-entry-wrapper"/>').appendTo(this.$treeComboBox);
            if (this.config.showClearButton) {
                this.$clearButton = $('<div class="tr-remove-button">').appendTo(this.$treeComboBox);
                this.$clearButton.mousedown(() => {
                    this.$editor.val("");
                    this.selectEntry(null, true);
                });
            }
            if (this.config.showTrigger) {
                this.$trigger = $('<div class="tr-trigger"><span class="tr-trigger-icon"/></div>').appendTo(this.$treeComboBox);
                this.$trigger.mousedown(() => {
                    if (this.isDropDownOpen) {
                        this.showEditor();
                        this.closeDropDown();
                    } else {
                        setTimeout(() => { // TODO remove this when Chrome bug is fixed. Chrome scrolls to the top of the page if we do this synchronously. Maybe this has something to do with https://code.google.com/p/chromium/issues/detail?id=342307 .
                            this.showEditor();
                            this.$editor.select();
                            this.openDropDown();
                            this.query();
                        });
                    }
                });
            }
            this.$dropDown = $('<div class="tr-dropdown"></div>')
                .scroll((e) => {
                    return false;
                });
            this.$dropDownTargetElement = $("body");
            this.setEditingMode(this.config.editingMode);
            this.$originalInput.addClass("tr-original-input");
            this.$editor = $('<input type="text" autocomplete="off"/>');

            this.$editor.prependTo(this.$treeComboBox).addClass("tr-combobox-editor tr-editor")
                .focus(() => {
                    if (this.blurCausedByClickInsideComponent) {
                        // do nothing!
                    } else {
                        this.$originalInput.triggerHandler('focus');
                        this.onFocus.fire();
                        this.$treeComboBox.addClass('focus');
                        this.showEditor();
                    }
                })
                .blur(() => {
                    if (this.blurCausedByClickInsideComponent) {
                        this.$editor.focus();
                    } else {
                        this.$originalInput.triggerHandler('blur');
                        this.onBlur.fire();
                        this.$treeComboBox.removeClass('focus');
                        if (this.editorContainsFreeText()) {
                            if (!objectEquals(this.getSelectedEntry(), this.lastCommittedValue)) {
                                this.selectEntry(this.getSelectedEntry(), true);
                            }
                        } else {
                            this.$editor.val("");
                            this.selectEntry(this.lastCommittedValue);
                        }
                        this.hideEditor();
                        this.closeDropDown();
                    }
                })
                .keydown((e: KeyboardEvent) => {
                    if (keyCodes.isModifierKey(e)) {
                        return;
                    } else if (e.which == keyCodes.tab) {
                        var highlightedEntry = this.treeBox.getHighlightedEntry();
                        if (this.isDropDownOpen && highlightedEntry) {
                            this.selectEntry(highlightedEntry, true);
                        } else if (!this.$editor.val()) {
                            this.selectEntry(null, true);
                        } else if (this.config.allowFreeText) {
                            this.selectEntry(this.getSelectedEntry(), true);
                        }
                        return;
                    } else if (e.which == keyCodes.left_arrow || e.which == keyCodes.right_arrow) {
                        if (this.isDropDownOpen) {
                            // expand the currently highlighted node.
                            var changedExpandedState = this.treeBox.setHighlightedNodeExpanded(e.which == keyCodes.right_arrow);
                            if (changedExpandedState) {
                                return false;
                            }
                        }
                        this.showEditor();
                        return; // let the user navigate freely left and right...
                    }

                    if (e.which == keyCodes.backspace || e.which == keyCodes.delete) {
                        this.doNoAutoCompleteBecauseBackspaceWasPressed = true; // we want query results, but no autocomplete
                    }

                    if (e.which == keyCodes.up_arrow || e.which == keyCodes.down_arrow) {
                        if (!this.isEditorVisible) {
                            this.$editor.select();
                            this.showEditor();
                        }
                        var direction = e.which == keyCodes.up_arrow ? -1 : 1;
                        if (!this.isDropDownOpen) {
                            this.query(direction);
                            if (!this.config.showDropDownOnResultsOnly) {
                                this.openDropDown();
                            }
                        } else {
                            this.treeBox.highlightNextEntry(direction);
                            this.autoCompleteIfPossible(this.config.autoCompleteDelay);
                        }
                        return false; // some browsers move the caret to the beginning on up key
                    } else if (e.which == keyCodes.enter) {
                        if (this.isEditorVisible || this.editorContainsFreeText()) {
                            e.preventDefault(); // do not submit form
                            var highlightedEntry = this.treeBox.getHighlightedEntry();
                            if (this.isDropDownOpen && highlightedEntry) {
                                this.selectEntry(highlightedEntry, true);
                            } else if (!this.$editor.val()) {
                                this.selectEntry(null, true);
                            } else if (this.config.allowFreeText) {
                                this.selectEntry(this.getSelectedEntry(), true);
                            }
                            this.closeDropDown();
                            this.hideEditor();
                        }
                    } else if (e.which == keyCodes.escape) {
                        e.preventDefault(); // prevent ie from doing its text field magic...
                        if (!(this.editorContainsFreeText() && this.isDropDownOpen)) { // TODO if list is empty, still reset, even if there is freetext.
                            this.hideEditor();
                            this.$editor.val("");
                            this.selectEntry(this.lastCommittedValue, false);
                        }
                        this.closeDropDown();
                    } else {
                        if (!this.isEditorVisible) {
                            this.showEditor();
                            this.$editor.select();
                        }
                        if (!this.config.showDropDownOnResultsOnly) {
                            this.openDropDown();
                        }

                        setTimeout(() => { // We need the new editor value (after the keydown event). Therefore setTimeout().
                            if (this.$editor.val()) {
                                this.query(1);
                            } else {
                                this.query(0);
                                this.treeBox.setHighlightedEntry(null);
                            }
                        })
                    }
                })
                .keyup((e: KeyboardEvent) => {
                    if (!keyCodes.isModifierKey(e) && [keyCodes.enter, keyCodes.escape, keyCodes.tab].indexOf(e.which) === -1 && this.isEntrySelected() && this.$editor.val() !== this.config.entryToEditorTextFunction(this.selectedEntry)) {
                        this.selectEntry(null, false);
                    }
                })
                .mousedown(() => {
                    if (!this.config.showDropDownOnResultsOnly) {
                        this.openDropDown();
                    }
                    this.query();
                });

            if (this.$originalInput.attr("tabindex")) {
                this.$editor.attr("tabindex", this.$originalInput.attr("tabindex"));
            }
            if (this.$originalInput.attr("autofocus")) {
                this.$editor.focus();
            }

            this.$treeComboBox.add(this.$dropDown)
                .mousedown(() => {
                    if (this.$editor.is(":focus")) {
                        this.blurCausedByClickInsideComponent = true;
                    }
                })
                .mouseup(() => {
                    if (this.blurCausedByClickInsideComponent) {
                        this.$editor.focus();
                        this.blurCausedByClickInsideComponent = false;
                    }
                })
                .mouseout(() => {
                    if (this.blurCausedByClickInsideComponent) {
                        this.$editor.focus();
                        this.blurCausedByClickInsideComponent = false;
                    }
                });

            this.treeBox = new TrivialTreeBox(this.$dropDown, this.config);
            this.treeBox.onSelectedEntryChanged.addListener((selectedEntry) => {
                if (selectedEntry) {
                    this.selectEntry(selectedEntry, true, objectEquals(selectedEntry, this.lastCommittedValue));
                    this.treeBox.setSelectedEntry(null);
                    this.closeDropDown();
                }
                this.hideEditor();
            });

            this.selectEntry(this.config.selectedEntry, true, true);

            this.$selectedEntryWrapper.click(() => {
                this.showEditor();
                this.$editor.select();
                if (!this.config.showDropDownOnResultsOnly) {
                    this.openDropDown();
                }
                this.query();
            });

            this.$ = this.$treeComboBox;
        }

        private query(highlightDirection?: HighlightDirection) {
            // call queryFunction asynchronously to be sure the input field has been updated before the result callback is called. Note: the query() method is called on keydown...
            setTimeout(() => {
                var queryString = this.getNonSelectedEditorValue();
                var completeInputString = this.$editor.val();
                if (this.lastQueryString !== queryString || this.lastCompleteInputQueryString !== completeInputString) {
                    if (this.$spinners.length === 0) {
                        var $spinner = $(this.config.spinnerTemplate).appendTo(this.$dropDown);
                        this.$spinners = this.$spinners.add($spinner);
                    }
                    this.config.queryFunction(queryString, (newEntries: any[]) => {
                        this.updateEntries(newEntries, highlightDirection);
                        if (this.config.showDropDownOnResultsOnly && newEntries && newEntries.length > 0 && this.$editor.is(":focus")) {
                            this.openDropDown();
                        }
                    });
                    this.lastQueryString = queryString;
                    this.lastCompleteInputQueryString = completeInputString;
                } else {
                    this.openDropDown();
                }
            }, 0);
        }

        private fireChangeEvents(entry: any) {
            this.$originalInput.trigger("change");
            this.onSelectedEntryChanged.fire(entry);
        }

        private selectEntry(entry: any, commit?: boolean, muteEvent?: boolean) {
            if (entry == null) {
                if (this.config.valueProperty) {
                    this.$originalInput.val("");
                }
                this.selectedEntry = null;
                var $selectedEntry = $(this.config.selectedEntryRenderingFunction(this.config.emptyEntry))
                    .addClass("tr-combobox-entry")
                    .addClass("empty");
                this.$selectedEntryWrapper.empty().append($selectedEntry);
            } else {
                if (this.config.valueProperty) {
                    this.$originalInput.val(entry[this.config.valueProperty]);
                }
                this.selectedEntry = entry;
                var $selectedEntry = $(this.config.selectedEntryRenderingFunction(entry))
                    .addClass("tr-combobox-entry");
                this.$selectedEntryWrapper.empty().append($selectedEntry);
                this.$editor.val(this.config.entryToEditorTextFunction(entry));
            }
            if (commit) {
                this.lastCommittedValue = entry;
                if (!muteEvent) {
                    this.fireChangeEvents(entry);
                }
            }
            if (this.$clearButton) {
                this.$clearButton.toggle(entry != null);
            }
            if (this.isEditorVisible) {
                this.showEditor(); // reposition editor
            }
            if (this.isDropDownOpen) {
                this.repositionDropDown();
            }
        }

        private isEntrySelected() {
            return this.selectedEntry != null && this.selectedEntry !== this.config.emptyEntry;
        }

        private showEditor() {
            var $editorArea = this.$selectedEntryWrapper.find(".tr-editor-area");
            if ($editorArea.length === 0) {
                $editorArea = this.$selectedEntryWrapper;
            }
            this.$editor
                .css({
                    "width": Math.min($editorArea[0].offsetWidth, this.$trigger ? this.$trigger[0].offsetLeft - $editorArea[0].offsetLeft : 99999999) + "px", // prevent the editor from surpassing the trigger!
                    "height": ($editorArea[0].offsetHeight) + "px"
                })
                .position({
                    my: "left top",
                    at: "left top",
                    of: $editorArea
                });
            this.isEditorVisible = true;
        }

        private editorContainsFreeText() {
            return this.config.allowFreeText && this.$editor.val().length > 0 && !this.isEntrySelected();
        };

        private hideEditor() {
            this.$editor.width(0).height(0);
            this.isEditorVisible = false;
        }

        private repositionDropDown() {
            this.$dropDown
                .show()
                .position({
                    my: "left top",
                    at: "left bottom",
                    of: this.$treeComboBox,
                    collision: "flip",
                    using: (calculatedPosition: {left: number, top: number}, info: {vertical: string}) => {
                        if (info.vertical === "top") {
                            this.$treeComboBox.removeClass("dropdown-flipped");
                            this.$dropDown.removeClass("flipped");
                        } else {
                            this.$treeComboBox.addClass("dropdown-flipped");
                            this.$dropDown.addClass("flipped");
                        }
                        this.$dropDown.css({
                            left: calculatedPosition.left + 'px',
                            top: calculatedPosition.top + 'px'
                        });
                    }
                })
                .width(this.$treeComboBox.width());
        };

        private openDropDown() {
            if (this.isDropDownNeeded()) {
                this.$treeComboBox.addClass("open");
                this.repositionDropDown();
                this.isDropDownOpen = true;
            }
        }

        private closeDropDown() {
            this.$treeComboBox.removeClass("open");
            this.$dropDown.hide();
            this.isDropDownOpen = false;
        }

        private getNonSelectedEditorValue() {
            return this.$editor.val().substring(0, (this.$editor[0] as any).selectionStart);
        }

        private autoCompleteIfPossible(delay: number) {
            if (this.config.autoComplete) {
                clearTimeout(this.autoCompleteTimeoutId);
                var highlightedEntry = this.treeBox.getHighlightedEntry();
                if (highlightedEntry && !this.doNoAutoCompleteBecauseBackspaceWasPressed) {
                    this.autoCompleteTimeoutId = setTimeout(() => {
                        var currentEditorValue = this.getNonSelectedEditorValue();
                        var autoCompleteString = this.config.autoCompleteFunction(currentEditorValue, highlightedEntry) || currentEditorValue;
                        this.$editor.val(currentEditorValue + autoCompleteString.substr(currentEditorValue.length));
                        if (this.$editor.is(":focus")) {
                            (this.$editor[0] as any).setSelectionRange(currentEditorValue.length, autoCompleteString.length);
                        }
                    }, delay || 0);
                }
                this.doNoAutoCompleteBecauseBackspaceWasPressed = false;
            }
        }


        private updateEntries(newEntries: any[], highlightDirection: HighlightDirection) {
            this.$spinners.remove();
            this.$spinners = $();
            this.treeBox.updateEntries(newEntries);

            var nonSelectedEditorValue = this.getNonSelectedEditorValue();

            this.treeBox.highlightTextMatches(newEntries.length <= this.config.textHighlightingEntryLimit ? nonSelectedEditorValue : null);

            if (highlightDirection == null) {
                if (this.selectedEntry) {
                    this.treeBox.setHighlightedEntry(null);
                } else {
                    if (nonSelectedEditorValue.length > 0) {
                        this.treeBox.highlightNextMatchingEntry(1);
                    } else {
                        this.treeBox.highlightNextEntry(1);
                    }
                }
            } else if (highlightDirection === 0) {
                this.treeBox.setHighlightedEntry(null)
            } else {
                if (nonSelectedEditorValue.length > 0) {
                    this.treeBox.highlightNextMatchingEntry(1);
                } else {
                    this.treeBox.highlightNextEntry(1);
                }
            }

            this.autoCompleteIfPossible(this.config.autoCompleteDelay);

            if (this.isDropDownOpen) {
                this.openDropDown(); // only for repositioning!
            }
        }

        private isDropDownNeeded() {
            return this.editingMode == 'editable' && (this.config.entries && this.config.entries.length > 0 || !this.config.queryFunction.isDefaultQueryFunction || this.config.showTrigger);
        }

        private setEditingMode(newEditingMode: EditingMode) {
            this.editingMode = newEditingMode;
            this.$treeComboBox.removeClass("editable readonly disabled").addClass(this.editingMode);
            if (this.isDropDownNeeded()) {
                this.$dropDown.appendTo(this.$dropDownTargetElement);
            }
        }

        public getSelectedEntry() {
            if (this.selectedEntry == null && (!this.config.allowFreeText || !this.$editor.val())) {
                return null;
            } else if (this.selectedEntry == null && this.config.allowFreeText) {
                return this.config.freeTextEntryFactory(this.$editor.val());
            } else {
                var selectedEntryToReturn = jQuery.extend({}, this.selectedEntry);
                selectedEntryToReturn._trEntryElement = undefined;
                return selectedEntryToReturn;
            }
        }

        public updateChildren(parentNodeId: any, children: any[]) {
            this.treeBox.updateChildren(parentNodeId, children);
        }

        public updateNode(node: any) {
            this.treeBox.updateNode(node);
        }

        public removeNode(nodeId: number) {
            this.treeBox.removeNode(nodeId);
        }

        public focus() {
            this.showEditor();
            this.$editor.select();
        };

        public getDropDown() {
            return this.$dropDown;
        };

        public destroy() {
            this.$originalInput.removeClass('tr-original-input').insertBefore(this.$treeComboBox);
            this.$treeComboBox.remove();
            this.$dropDown.remove();
        };
    }

}
