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
(function (factory) {
        "use strict";

        if (typeof define === 'function' && define.amd) {
            // Define as an AMD module if possible
            define('trivial-combobox', ['trivial-core', 'jquery', 'mustache'], factory);
        } else if (typeof exports === 'object') {
            // Node/CommonJS
            module.exports = factory(require('trivial-core'), require('jquery'), require('mustache'));
        } else if (jQuery && !jQuery.fn.trivialcombobox) {
            // Define using browser globals otherwise
            // Prevent multiple instantiations if the script is loaded twice
            factory(TrivialComponents, jQuery, Mustache);
        }
    }(function (TrivialComponents, $, Mustache) {

        var keyCodes = TrivialComponents.keyCodes;

        function TrivialComboBox(originalInput, options) {
            var me = this;

            options = options || {};
            var config = $.extend({
                valueProperty: null,
                inputTextProperty: 'displayValue',
                template: TrivialComponents.image2LinesTemplate,
                selectedEntryTemplate: options.template || TrivialComponents.image2LinesTemplate,
                selectedEntry: undefined,
                spinnerTemplate: TrivialComponents.defaultSpinnerTemplate,
                noEntriesTemplate: TrivialComponents.defaultNoEntriesTemplate,
                textHighlightingEntryLimit: 100,
                entries: null,
                emptyEntry: {},
                queryFunction: null, // defined below...
                autoComplete: true,
                autoCompleteDelay: 0,
                allowFreeText: false,
                freeTextEntryValues: {_isFreeTextEntry: true},
                showTrigger: true,
                matchingOptions: {
                    matchingMode: 'contains',
                    ignoreCase: true,
                    maxLevenshteinDistance: 2
                },
                editingMode: "editable" // one of 'editable', 'disabled' and 'readonly'
            }, options);

            config.queryFunction = config.queryFunction || TrivialComponents.defaultListQueryFunctionFactory(config.entries || [], config.matchingOptions);

            this.onSelectedEntryChanged = new TrivialComponents.Event();

            var listBox;
            var isDropDownOpen = false;
            var entries = config.entries;
            var selectedEntry = null;
            var blurCausedByClickInsideComponent = false;
            var autoCompleteTimeoutId = -1;
            var doNoAutoCompleteBecauseBackspaceWasPressed = false;

            var $spinners = $();
            var $originalInput = $(originalInput);
            var $comboBox = $('<div class="tr-combobox tr-input-wrapper"/>')
                .addClass(config.editingMode)
                .insertAfter($originalInput);
            var $selectedEntryWrapper = $('<div class="tr-combobox-selected-entry-wrapper"/>').appendTo($comboBox);
            if (config.showTrigger) {
                var $trigger = $('<div class="tr-trigger"><span class="tr-trigger-icon"/></div>').appendTo($comboBox);
                $trigger.mousedown(function () {
                    if (isDropDownOpen) {
                        showEditor();
                        closeDropDown();
                    } else {
                        setTimeout(function () { // TODO remove this when Chrome bug is fixed. Chrome scrolls to the top of the page if we do this synchronously. Maybe this has something to do with https://code.google.com/p/chromium/issues/detail?id=342307 .
                            showEditor();
                            $editor.select();
                            openDropDown();
                            if (entries == null) {
                                query();
                            }
                        });
                    }
                });
            }
            var $dropDown = $('<div class="tr-dropdown"></div>')
                .scroll(function (e) {
                    return false;
                });
            var dropdownNeeded = config.editingMode == 'editable' && (config.entries && config.entries.length > 0 || options.queryFunction || config.showTrigger);
            if (dropdownNeeded) {
                $dropDown.appendTo("body");
            }
            var $editor;
            if (config.valueProperty) {
                $originalInput.addClass("tr-original-input");
                $editor = $('<input type="text"/>');
            } else {
                $editor = $originalInput;
            }

            $editor.prependTo($comboBox).addClass("tr-combobox-editor tr-editor")
                .focus(function () {
                    if (blurCausedByClickInsideComponent) {
                        // do nothing!
                    } else {
                        $comboBox.addClass('focus');
                    }
                })
                .blur(function () {
                    if (blurCausedByClickInsideComponent) {
                        $editor.focus();
                    } else {
                        $comboBox.removeClass('focus');
                        clearEditorIfNotContainsFreeText();
                        hideEditorIfNotContainsFreeText();
                        closeDropDown();
                        fireChangeEvents(me.getSelectedEntry());
                    }
                })
                .keydown(function (e) {
                    if (TrivialComponents.isModifierKey(e)) {
                        return;
                    } else if (e.which == keyCodes.tab) {
                        var highlightedEntry = listBox.getHighlightedEntry();
                        if (isDropDownOpen && highlightedEntry) {
                            selectEntry(highlightedEntry);
                        }
                    } else if (e.which == keyCodes.left_arrow || e.which == keyCodes.right_arrow) {
                        showEditor();
                        return; // let the user navigate freely left and right...
                    }

                    if (e.which == keyCodes.backspace || e.which == keyCodes.delete) {
                        doNoAutoCompleteBecauseBackspaceWasPressed = true; // we want query results, but no autocomplete
                    }

                    if (e.which == keyCodes.up_arrow || e.which == keyCodes.down_arrow) {
                        showEditor();
                        openDropDown();
                        var direction = e.which == keyCodes.up_arrow ? -1 : 1;
                        if (entries != null) {
                            listBox.highlightNextEntry(direction);
                            autoCompleteIfPossible(config.autoCompleteDelay);
                            return false; // some browsers move the caret to the beginning on up key
                        } else {
                            query(direction);
                        }
                    } else if (isDropDownOpen && e.which == keyCodes.enter) {
                        e.preventDefault(); // do not submit form
                        selectEntry(listBox.getHighlightedEntry());
                        closeDropDown();
                        hideEditorIfNotContainsFreeText();
                        $editor.select();
                    } else if (e.which == keyCodes.escape) {
                        closeDropDown();
                        clearEditorIfNotContainsFreeText();
                        hideEditorIfNotContainsFreeText();
                    } else {
                        showEditor();
                        openDropDown();
                        query(1);
                    }
                })
                .keyup(function (e) {
                    if (!TrivialComponents.isModifierKey(e) && e.which != keyCodes.enter && isEntrySelected() && $editor.val() !== selectedEntry[config.inputTextProperty]) {
                        selectEntry(null);
                    } else if (e.which == keyCodes.tab) {
                        showEditor();
                    }
                })
                .mousedown(function () {
                    openDropDown();
                    if (entries == null) {
                        query();
                    }
                });

            if ($originalInput.attr("tabindex")) {
                $editor.attr("tabindex", $originalInput.attr("tabindex"));
            }
            if ($originalInput.attr("autofocus")) {
                $editor.focus();
            }

            $comboBox.add($dropDown).mousedown(function () {
                if ($editor.is(":focus")) {
                    blurCausedByClickInsideComponent = true;
                }
            }).mouseup(function () {
                if (blurCausedByClickInsideComponent) {
                    $editor.focus();
                    blurCausedByClickInsideComponent = false;
                }
            }).mouseout(function () {
                if (blurCausedByClickInsideComponent) {
                    $editor.focus();
                    blurCausedByClickInsideComponent = false;
                }
            });

            listBox = $dropDown.TrivialListBox(config);
            listBox.onSelectedEntryChanged.addListener(function (selectedEntry) {
                if (selectedEntry) {
                    selectEntry(selectedEntry);
                    listBox.selectEntry(null);
                    closeDropDown();
                }
                hideEditorIfNotContainsFreeText();
            });

            selectEntry(config.selectedEntry || null, true);

            $selectedEntryWrapper.click(function () {
                showEditor();
                $editor.select();
                openDropDown();
                if (entries == null) {
                    query();
                }
            });

            function query(highlightDirection) {
                var $spinner = $(config.spinnerTemplate).appendTo($dropDown);
                $spinners = $spinners.add($spinner);

                // call queryFunction asynchronously to be sure the input field has been updated before the result callback is called. Note: the query() method is called on keydown...
                setTimeout(function () {
                    config.queryFunction($editor.val(), function (newEntries) {
                        updateEntries(newEntries, highlightDirection);
                    });
                });
            }

            function fireChangeEvents(entry) {
                $originalInput.triggerHandler("change"); // do not bubble this event!
                me.onSelectedEntryChanged.fire(entry);
            }

            function selectEntry(entry, muteEvent) {
                if (entry == null) {
                    if (config.valueProperty) {
                        $originalInput.val("");
                    } // else the $originalInput IS the $editor
                    selectedEntry = null;
                    var $selectedEntry = $(Mustache.render(config.selectedEntryTemplate, config.emptyEntry))
                        .addClass("tr-combobox-entry")
                        .addClass("empty");
                    $selectedEntryWrapper.empty().append($selectedEntry);
                } else {
                    if (config.valueProperty) {
                        $originalInput.val(entry[config.valueProperty]);
                    } // else the $originalInput IS the $editor
                    selectedEntry = entry;
                    var $selectedEntry = $(Mustache.render(config.selectedEntryTemplate, entry))
                        .addClass("tr-combobox-entry");
                    $selectedEntryWrapper.empty().append($selectedEntry);
                    $editor.val(entry[config.inputTextProperty]);
                }
                if (!muteEvent) {
                    fireChangeEvents(entry);
                }
            }

            function isEntrySelected() {
                return selectedEntry != null && selectedEntry !== config.emptyEntry;
            }

            function showEditor() {
                var $editorArea = $selectedEntryWrapper.find(".editor-area");
                $editor
                    .css({
                        "width": $editorArea.width() + "px",
                        "height": ($editorArea.height()) + "px"
                    })
                    .position({
                        my: "left top",
                        at: "left top",
                        of: $editorArea
                    });
            }

            function clearEditorIfNotContainsFreeText() {
                if (!config.allowFreeText && !isEntrySelected() && ($originalInput.val().length > 0 || $editor.val().length > 0)) {
                    $originalInput.val("");
                    $editor.val("");
                    entries = null; // so we will query again when we combobox is re-focused
                    fireChangeEvents(null);
                }
            }

            function hideEditorIfNotContainsFreeText() {
                if (!(config.allowFreeText && $editor.val().length > 0 && !isEntrySelected())) {
                    hideEditor();
                }
            }

            function hideEditor() {
                $editor.width(0).height(0);
            }

            var repositionDropDown = function () {
                $dropDown
                    .show()
                    .position({
                        my: "left top",
                        at: "left bottom",
                        of: $comboBox,
                        collision: "flip",
                        using: function (calculatedPosition, info) {
                            if (info.vertical === "top") {
                                $comboBox.removeClass("dropdown-flipped");
                                $(this).removeClass("flipped");
                            } else {
                                $comboBox.addClass("dropdown-flipped");
                                $(this).addClass("flipped");
                            }
                            $(this).css({
                                left: calculatedPosition.left + 'px',
                                top: calculatedPosition.top + 'px'
                            });
                        }
                    })
                    .width($comboBox.width());
            };

            function openDropDown() {
                if (dropdownNeeded) {
                    $comboBox.addClass("open");
                    repositionDropDown();
                    isDropDownOpen = true;
                }
            }

            function closeDropDown() {
                $comboBox.removeClass("open");
                $dropDown.hide();
                isDropDownOpen = false;
            }

            function getNonSelectedEditorValue() {
                return $editor.val().substring(0, $editor[0].selectionStart);
            }

            function autoCompleteIfPossible(delay) {
                if (config.autoComplete) {
                    clearTimeout(autoCompleteTimeoutId);

                    var highlightedEntry = listBox.getHighlightedEntry();
                    if (highlightedEntry && !doNoAutoCompleteBecauseBackspaceWasPressed) {
                        var autoCompletingEntryDisplayValue = highlightedEntry[config.inputTextProperty];
                        autoCompleteTimeoutId = setTimeout(function () {
                            var oldEditorValue = getNonSelectedEditorValue();
                            var newEditorValue;
                            if (autoCompletingEntryDisplayValue.toLowerCase().indexOf(oldEditorValue.toLowerCase()) === 0) {
                                newEditorValue = oldEditorValue + autoCompletingEntryDisplayValue.substr(oldEditorValue.length);
                            } else {
                                newEditorValue = getNonSelectedEditorValue();
                            }
                            $editor.val(newEditorValue);
                            // $editor[0].offsetHeight;  // we need this to guarantee that the editor has been updated...
                            if ($editor.is(":focus")) {
                                $editor[0].setSelectionRange(oldEditorValue.length, newEditorValue.length);
                            }
                        }, delay || 0);
                    }
                    doNoAutoCompleteBecauseBackspaceWasPressed = false;
                }
            }

            this.$ = $comboBox;
            $comboBox[0].trivialComboBox = this;

            function updateEntries(newEntries, highlightDirection) {
                highlightDirection = highlightDirection === undefined ? 1 : highlightDirection;
                entries = newEntries;
                $spinners.remove();
                $spinners = $();
                listBox.updateEntries(newEntries);

                var nonSelectedEditorValue = getNonSelectedEditorValue();
                if (nonSelectedEditorValue.length > 0 && newEntries.length <= config.textHighlightingEntryLimit) {
                    listBox.highlightTextMatches(nonSelectedEditorValue);
                    listBox.highlightNextMatchingEntry(highlightDirection);
                } else {
                    listBox.highlightNextEntry(highlightDirection);
                }

                autoCompleteIfPossible(config.autoCompleteDelay);

                if (isDropDownOpen) {
                    openDropDown(); // only for repositioning!
                }
            }

            this.updateEntries = updateEntries;
            this.getSelectedEntry = function () {
                if (selectedEntry == null && (!config.allowFreeText || !$editor.val())) {
                    return null;
                } else if (selectedEntry == null && config.allowFreeText) {
                    var fakeEntry = $.extend({}, config.freeTextEntryValues);
                    fakeEntry[config.inputTextProperty] = $editor.val();
                    return fakeEntry;
                } else {
                    var selectedEntryToReturn = jQuery.extend({}, selectedEntry);
                    selectedEntryToReturn._trEntryElement = undefined;
                    return selectedEntryToReturn;
                }
            };
            this.selectEntry = selectEntry;
        }

        TrivialComponents.registerJqueryPlugin(TrivialComboBox, "TrivialComboBox", "tr-combobox");

        return $.fn.TrivialComboBox;
    })
);
