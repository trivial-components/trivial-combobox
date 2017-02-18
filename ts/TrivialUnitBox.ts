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
module TrivialComponents {

    export interface TrivialUnitBoxConfig<U> extends TrivialListBoxConfig<U> {
        unitValueProperty?: string,
        unitIdProperty?: string,
        decimalPrecision?: number,
        decimalSeparator?: string,
        thousandsSeparator?: string,
        unitDisplayPosition?: 'left' | 'right',
        allowNullAmount?: boolean,
        selectedEntryRenderingFunction?: (entry: U) => string,
        amount?: number,
        noEntriesTemplate?: string,
        emptyEntry?: U | any,
        queryFunction?: QueryFunction<U>,
        queryOnNonNumberCharacters?: boolean,
        openDropdownOnEditorClick?: boolean,
        showTrigger?: boolean,
        editingMode?: EditingMode
    }

    export type TrivialUnitBoxChangeEvent<U> = {
        unit: string,
        unitEntry: U,
        amount: number,
        amountAsFloatingPointNumber: number
    }

    export class TrivialUnitBox<U> implements TrivialComponent {

        private config: TrivialUnitBoxConfig<U>;

        public readonly onChange = new TrivialEvent<TrivialUnitBoxChangeEvent<U>>(this);
        public readonly onSelectedEntryChanged = new TrivialEvent<U>(this);

        private listBox: TrivialListBox<U>;
        private isDropDownOpen = false;
        private entries: U[];
        private selectedEntry: U;
        private blurCausedByClickInsideComponent = false;
        private numberRegex: RegExp;
        private $spinners: JQuery = $();
        private $originalInput: JQuery;
        private $editor: JQuery;
        private $dropDownTargetElement: JQuery;
        private $unitBox: JQuery;
        private $selectedEntryAndTriggerWrapper: JQuery;
        private $selectedEntryWrapper: JQuery;
        private $dropDown: JQuery;
        private editingMode: EditingMode;
        private usingDefaultQueryFunction: boolean;

        constructor(originalInput: JQuery|Element|string, options: TrivialUnitBoxConfig<U> = {}) {
            this.config = $.extend(<TrivialUnitBoxConfig<U>> {
                unitValueProperty: 'code',
                unitIdProperty: 'code',
                decimalPrecision: 2,
                decimalSeparator: '.',
                thousandsSeparator: ',',
                unitDisplayPosition: 'right', // right or left
                allowNullAmount: true,
                entryRenderingFunction: (entry: U) => {
                    const template = (entry as any).template || DEFAULT_TEMPLATES.currency2LineTemplate;
                    return Mustache.render(template, entry);
                },
                selectedEntryRenderingFunction: (entry: U) => {
                    const template = (entry as any).selectedEntryTemplate || DEFAULT_TEMPLATES.currencySingleLineShortTemplate;
                    return Mustache.render(template, entry);
                },
                amount: null,
                selectedEntry: undefined,
                spinnerTemplate: DEFAULT_TEMPLATES.defaultSpinnerTemplate,
                noEntriesTemplate: DEFAULT_TEMPLATES.defaultNoEntriesTemplate,
                entries: null,
                emptyEntry: {
                    code: '...'
                },
                queryFunction: null, // defined below...
                queryOnNonNumberCharacters: true,
                openDropdownOnEditorClick: false,
                showTrigger: true,
                matchingOptions: {
                    matchingMode: 'prefix-word',
                    ignoreCase: true,
                    maxLevenshteinDistance: 2
                },
                editingMode: 'editable', // one of 'editable', 'disabled' and 'readonly'
            }, options);

            if (!this.config.queryFunction) {
                this.config.queryFunction = defaultListQueryFunctionFactory(this.config.entries || [], this.config.matchingOptions);
                this.usingDefaultQueryFunction = true;
            }

            this.entries = this.config.entries;

            this.numberRegex = new RegExp('\\d*\\' + this.config.decimalSeparator + '?\\d*', 'g');

            this.$originalInput = $(originalInput).addClass("tr-original-input");
            this.$editor = $('<input type="text"/>');
            this.$unitBox = $('<div class="tr-unitbox tr-input-wrapper"/>').insertAfter(this.$originalInput)
                .addClass(this.config.unitDisplayPosition === 'left' ? 'unit-display-left' : 'unit-display-right');
            this.$originalInput.appendTo(this.$unitBox);
            this.$selectedEntryAndTriggerWrapper = $('<div class="tr-unitbox-selected-entry-and-trigger-wrapper"/>').appendTo(this.$unitBox);
            this.$selectedEntryWrapper = $('<div class="tr-unitbox-selected-entry-wrapper"/>').appendTo(this.$selectedEntryAndTriggerWrapper);
            if (this.config.showTrigger) {
                $('<div class="tr-trigger"><span class="tr-trigger-icon"/></div>').appendTo(this.$selectedEntryAndTriggerWrapper);
            }
            this.$selectedEntryAndTriggerWrapper.mousedown(() => {
                if (this.isDropDownOpen) {
                    this.closeDropDown();
                } else if (this.editingMode === "editable") {
                    setTimeout(() => { // TODO remove this when Chrome bug is fixed. Chrome scrolls to the top of the page if we do this synchronously. Maybe this has something to do with https://code.google.com/p/chromium/issues/detail?id=342307 .
                        this.openDropDown();
                        this.query();
                    });
                }
                this.$editor.focus();
            });
            this.$dropDown = $('<div class="tr-dropdown"></div>')
                .scroll(() => {
                    return false;
                });
            this.$dropDownTargetElement = $("body");
            this.setEditingMode(this.config.editingMode);

            this.$editor.prependTo(this.$unitBox).addClass("tr-unitbox-editor tr-editor")
                .focus(() => {
                    if (this.editingMode !== "editable") {
                        this.$editor.blur(); // must not get focus!
                        return false;
                    }
                    if (this.blurCausedByClickInsideComponent) {
                        // do nothing!
                    } else {
                        this.$unitBox.addClass('focus');
                        this.cleanupEditorValue();
                    }
                })
                .blur(() => {
                    if (this.blurCausedByClickInsideComponent) {
                        this.$editor.focus();
                    } else {
                        this.$unitBox.removeClass('focus');
                        this.formatEditorValue();
                        this.closeDropDown();
                    }
                })
                .keydown((e: KeyboardEvent) => {
                    if (keyCodes.isModifierKey(e)) {
                        return;
                    } else if (e.which == keyCodes.tab) {
                        const highlightedEntry = this.listBox.getHighlightedEntry();
                        if (this.isDropDownOpen && highlightedEntry) {
                            this.setSelectedEntry(highlightedEntry);
                        }
                    } else if (e.which == keyCodes.left_arrow || e.which == keyCodes.right_arrow) {
                        return; // let the user navigate freely left and right...
                    }

                    if (e.which == keyCodes.up_arrow || e.which == keyCodes.down_arrow) {
                        const direction = e.which == keyCodes.up_arrow ? -1 : 1;
                        if (this.isDropDownOpen) {
                            this.listBox.highlightNextEntry(direction);
                        } else {
                            this.openDropDown();
                            this.query(direction);
                        }
                        return false; // some browsers move the caret to the beginning on up key
                    } else if (this.isDropDownOpen && e.which == keyCodes.enter) {
                        e.preventDefault(); // do not submit form
                        this.setSelectedEntry(this.listBox.getHighlightedEntry());
                        this.closeDropDown();
                    } else if (e.which == keyCodes.escape) {
                        this.closeDropDown();
                        this.cleanupEditorValue();
                    } else if (!e.shiftKey && keyCodes.numberKeys.indexOf(e.which) != -1) {
                        const numberPart = this.getEditorValueNumberPart();
                        const numberPartDecimalSeparatorIndex = numberPart.indexOf(this.config.decimalSeparator);
                        const maxDecimalDigitsReached = numberPartDecimalSeparatorIndex != -1 && numberPart.length - (numberPartDecimalSeparatorIndex + 1) >= this.config.decimalPrecision;

                        const editorValue = this.$editor.val();
                        const decimalSeparatorIndex = editorValue.indexOf(this.config.decimalSeparator);
                        const selectionStart = (this.$editor[0] as any).selectionStart;
                        const selectionEnd = (this.$editor[0] as any).selectionEnd;
                        const wouldAddAnotherDigit = decimalSeparatorIndex !== -1 && selectionEnd > decimalSeparatorIndex && selectionStart === selectionEnd;
                        if (maxDecimalDigitsReached && wouldAddAnotherDigit) {
                            if (/^\d$/.test(editorValue[selectionEnd])) {
                                this.$editor.val(editorValue.substring(0, selectionEnd) + editorValue.substring(selectionEnd + 1)); // override the following digit

                                (this.$editor[0] as any).setSelectionRange(selectionEnd, selectionEnd);
                            } else {
                                return false; // cannot add another digit!
                            }
                        }
                    }
                })
                .keyup((e) => {
                    if (keyCodes.specialKeys.indexOf(e.which) != -1
                        && e.which != keyCodes.backspace
                        && e.which != keyCodes.delete) {
                        return; // ignore
                    }
                    const hasDoubleDecimalSeparator = new RegExp("(?:\\" + this.config.decimalSeparator + ".*)" + "\\" + this.config.decimalSeparator, "g").test(this.$editor.val());
                    if (hasDoubleDecimalSeparator) {
                        this.cleanupEditorValue();
                        (this.$editor[0] as any).setSelectionRange(this.$editor.val().length - this.config.decimalPrecision, this.$editor.val().length - this.config.decimalPrecision);
                    }
                    if (this.config.queryOnNonNumberCharacters) {
                        if (this.getQueryString().length > 0) {
                            this.openDropDown();
                            this.query(1);
                        } else {
                            this.closeDropDown();
                        }
                    }
                })
                .mousedown(() => {
                    if (this.config.openDropdownOnEditorClick) {
                        this.openDropDown();
                        if (this.entries == null) {
                            this.query();
                        }
                    }
                }).change(() => {
                    this.updateOriginalInputValue();
                    this.fireChangeEvents();
                }
            );

            this.$unitBox.add(this.$dropDown).mousedown(() => {
                if (this.$editor.is(":focus")) {
                    this.blurCausedByClickInsideComponent = true;
                }
            }).mouseup(() => {
                if (this.blurCausedByClickInsideComponent) {
                    this.$editor.focus();
                    this.blurCausedByClickInsideComponent = false;
                }
            }).mouseout(() => {
                if (this.blurCausedByClickInsideComponent) {
                    this.$editor.focus();
                    this.blurCausedByClickInsideComponent = false;
                }
            });

            this.listBox = new TrivialListBox(this.$dropDown, this.config);
            this.listBox.onSelectedEntryChanged.addListener((selectedEntry: U) => {
                if (selectedEntry) {
                    this.setSelectedEntry(selectedEntry, false);
                    this.listBox.setSelectedEntry(null);
                    this.closeDropDown();
                }
            });

            this.$editor.val(this.config.amount || this.$originalInput.val());
            this.formatEditorValue();
            this.setSelectedEntry(this.config.selectedEntry || null, true);
        }

        private getQueryString() {
            return this.$editor.val().replace(this.numberRegex, '');
        }

        private getEditorValueNumberPart(fillupDecimals?: boolean): string {
            const rawNumber = this.$editor.val().match(this.numberRegex).join('');
            const decimalDeparatorIndex = rawNumber.indexOf(this.config.decimalSeparator);

            let integerPart: string;
            let fractionalPart: string;
            if (decimalDeparatorIndex !== -1) {
                integerPart = rawNumber.substring(0, decimalDeparatorIndex);
                fractionalPart = rawNumber.substring(decimalDeparatorIndex + 1, rawNumber.length).replace(/\D/g, '');
            } else {
                integerPart = rawNumber;
                fractionalPart = "";
            }

            if (integerPart.length == 0 && fractionalPart.length == 0) {
                return "";
            } else {
                if (fillupDecimals) {
                    fractionalPart = (fractionalPart + new Array(this.config.decimalPrecision + 1).join("0")).substr(0, this.config.decimalPrecision);
                }
                return integerPart + this.config.decimalSeparator + fractionalPart;
            }
        }

        private query(highlightDirection?: HighlightDirection) {
            const $spinner = $(this.config.spinnerTemplate).appendTo(this.$dropDown);
            this.$spinners = this.$spinners.add($spinner);

            // call queryFunction asynchronously to be sure the input field has been updated before the result callback is called. Note: the query() method is called on keydown...
            setTimeout(() => {
                this.config.queryFunction(this.getQueryString(), (newEntries: U[]) => {
                    this.updateEntries(newEntries);

                    const queryString = this.getQueryString();
                    if (queryString.length > 0) {
                        this.listBox.highlightTextMatches(queryString);
                    }
                    this.listBox.highlightNextEntry(highlightDirection);

                    if (this.isDropDownOpen) {
                        this.openDropDown(); // only for repositioning!
                    }
                });
            });
        }

        private fireSelectedEntryChangedEvent() {
            this.onSelectedEntryChanged.fire(this.selectedEntry);
        }

        private fireChangeEvents() {
            this.$originalInput.trigger("change");
            this.onChange.fire({
                unit: this.selectedEntry != null ? this.selectedEntry[this.config.unitValueProperty] : null,
                unitEntry: this.selectedEntry,
                amount: this.getAmount(),
                amountAsFloatingPointNumber: parseFloat(this.formatAmount(this.getAmount(), this.config.decimalPrecision, this.config.decimalSeparator, this.config.thousandsSeparator))
            });
        }

        public setSelectedEntry(entry: U, doNotFireEvents?: boolean) {
            if (entry == null) {
                this.selectedEntry = null;
                const $selectedEntry = $(this.config.selectedEntryRenderingFunction(this.config.emptyEntry))
                    .addClass("tr-combobox-entry")
                    .addClass("empty");
                this.$selectedEntryWrapper.empty().append($selectedEntry);
            } else {
                this.selectedEntry = entry;
                const $selectedEntry = $(this.config.selectedEntryRenderingFunction(entry))
                    .addClass("tr-combobox-entry");
                this.$selectedEntryWrapper.empty().append($selectedEntry);
            }
            this.cleanupEditorValue();
            this.updateOriginalInputValue();
            if (!this.$editor.is(":focus")) {
                this.formatEditorValue();
            }
            if (!doNotFireEvents) {
                this.fireSelectedEntryChangedEvent();
            }
        }

        private formatEditorValue() {
            this.$editor.val(this.formatAmount(this.getAmount(), this.config.decimalPrecision, this.config.decimalSeparator, this.config.thousandsSeparator));
        }

        private cleanupEditorValue() {
            if (this.$editor.val()) {
                this.$editor.val(this.getEditorValueNumberPart(true));
            }
        }

        private formatAmount(integerNumber: number, precision: number, decimalSeparator: string, thousandsSeparator: string) {
            if (integerNumber == null || isNaN(integerNumber)) {
                return "";
            }
            const amountAsString = "" + integerNumber;
            if (amountAsString.length <= precision) {
                return 0 + decimalSeparator + new Array(precision - amountAsString.length + 1).join("0") + amountAsString;
            } else {
                const integerPart = amountAsString.substring(0, amountAsString.length - precision);
                const formattedIntegerPart = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, thousandsSeparator); // see http://stackoverflow.com/a/2901298/524913
                const fractionalPart = amountAsString.substr(amountAsString.length - precision, precision);
                return formattedIntegerPart + decimalSeparator + fractionalPart;
            }
        }

        private repositionDropDown() {
            this.$dropDown
                .show()
                .position({
                    my: "left top",
                    at: "left bottom",
                    of: this.$unitBox,
                    collision: "flip",
                    using: (calculatedPosition: {top: number, left: number}, info: {vertical: string}) => {
                        if (info.vertical === "top") {
                            this.$unitBox.removeClass("dropdown-flipped");
                            this.$dropDown.removeClass("flipped");
                        } else {
                            this.$unitBox.addClass("dropdown-flipped");
                            this.$dropDown.addClass("flipped");
                        }
                        this.$dropDown.css({
                            left: calculatedPosition.left + 'px',
                            top: calculatedPosition.top + 'px'
                        });
                    }
                })
                .width(this.$unitBox.width());
        };

        private openDropDown() {
            this.$unitBox.addClass("open");
            this.repositionDropDown();
            this.isDropDownOpen = true;
        }

        private closeDropDown() {
            this.$unitBox.removeClass("open");
            this.$dropDown.hide();
            this.isDropDownOpen = false;
        }

        private updateOriginalInputValue() {
            if (this.config.unitDisplayPosition === 'left') {
                this.$originalInput.val((this.selectedEntry ? this.selectedEntry[this.config.unitValueProperty] : '') + this.formatAmount(this.getAmount(), this.config.decimalPrecision, this.config.decimalSeparator, ''));
            } else {
                this.$originalInput.val(this.formatAmount(this.getAmount(), this.config.decimalPrecision, this.config.decimalSeparator, '') + (this.selectedEntry ? this.selectedEntry[this.config.unitValueProperty] : ''));
            }
        }

        public getAmount() {
            const editorValueNumberPart = this.getEditorValueNumberPart(false);
            if (editorValueNumberPart.length === 0 && this.config.allowNullAmount) {
                return null;
            } else {
                return parseInt(this.getEditorValueNumberPart(true).replace(/\D/g, ""));
            }
        }

        private isDropDownNeeded() {
            return this.editingMode == 'editable' && (this.config.entries && this.config.entries.length > 0 || !this.usingDefaultQueryFunction || this.config.showTrigger);
        }

        public setEditingMode(newEditingMode: EditingMode) {
            this.editingMode = newEditingMode;
            this.$unitBox.removeClass("editable readonly disabled").addClass(this.editingMode);
            this.$editor.prop("readonly", newEditingMode !== "editable");
            this.$editor.attr("tabindex", newEditingMode === "editable" ? <string> this.$originalInput.attr("tabindex") : "-1");
            if (this.isDropDownNeeded()) {
                this.$dropDown.appendTo(this.$dropDownTargetElement);
            }
        }

        private selectUnit(unitIdentifier: string) {
            this.setSelectedEntry(this.entries.filter((entry: U) => {
                return entry[this.config.unitIdProperty] === unitIdentifier;
            })[0], true);
        }


        public updateEntries(newEntries: U[]) {
            this.entries = newEntries;
            this.$spinners.remove();
            this.$spinners = $();
            this.listBox.updateEntries(newEntries);
        }

        public getSelectedEntry(): U {
            if (this.selectedEntry == null) {
                return null;
            } else {
                const selectedEntryToReturn = jQuery.extend({}, this.selectedEntry);
                selectedEntryToReturn._trEntryElement = undefined;
                return selectedEntryToReturn;
            }
        }

        public setAmount(amount: number) {
            if (amount != null && amount !== Math.floor(amount)) {
                throw "TrivialUnitBox: You must specify an integer amount!";
            }
            if (amount == null) {
                if (this.config.allowNullAmount) {
                    this.$editor.val("");
                } else {
                    this.$editor.val(this.formatAmount(0, this.config.decimalPrecision, this.config.decimalSeparator, ''));
                }
            } else if (this.$editor.is(":focus")) {
                this.$editor.val(this.formatAmount(amount, this.config.decimalPrecision, this.config.decimalSeparator, ''));
            } else {
                this.$editor.val(this.formatAmount(amount, this.config.decimalPrecision, this.config.decimalSeparator, this.config.thousandsSeparator));
            }
        };

        public focus() {
            this.$editor.select();
        };

        public destroy() {
            this.$originalInput.removeClass('tr-original-input').insertBefore(this.$unitBox);
            this.$unitBox.remove();
            this.$dropDown.remove();
        };

        getMainDomElement(): Element {
            return this.$unitBox[0];
        }
    }
}