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
            define('trivial-core', ['jquery', 'mustache'], factory);
        } else if (typeof exports === 'object') {
            // Node/CommonJS
            module.exports = factory(require('jquery'), require('mustache'));
        } else if (jQuery && !window.TrivialComponents) {
            // Define using browser globals otherwise
            // Prevent multiple instantiations if the script is loaded twice
            window.TrivialComponents = factory();
        }
    }(function () {

        var image2LinesTemplate = '<div class="tr-template-image-2-lines">' +
            '  <div class="img-wrapper" style="background-image: url({{imageUrl}})"></div>' +
            '  <div class="content-wrapper tr-editor-area"> ' +
            '    <div class="main-line">{{displayValue}}</div> ' +
            '    <div class="additional-info">{{additionalInfo}}</div>' +
            '  </div>' +
            '</div>';
        var roundImage2LinesColorBubbleTemplate = '<div class="tr-template-round-image-2-lines-color-bubble">' +
            '  {{#imageUrl}}<div class="img-wrapper" style="background-image: url({{imageUrl}})"></div>{{/imageUrl}}' +
            '  <div class="content-wrapper tr-editor-area"> ' +
            '    <div class="main-line">{{displayValue}}</div> ' +
            '    <div class="additional-info">{{#statusColor}}<span class="status-bubble" style="background-color: {{statusColor}}"></span>{{/statusColor}}{{additionalInfo}}</div>' +
            '  </div>' +
            '</div>';
        var icon2LinesTemplate = '<div class="tr-template-icon-2-lines">' +
            '  <div class="img-wrapper" style="background-image: url({{imageUrl}})"></div>' +
            '  <div class="content-wrapper tr-editor-area"> ' +
            '    <div class="main-line">{{displayValue}}</div> ' +
            '    <div class="additional-info">{{additionalInfo}}</div>' +
            '  </div>' +
            '</div>';
        var iconSingleLineTemplate = '<div class="tr-template-icon-single-line">' +
            '  <div class="img-wrapper" style="background-image: url({{imageUrl}})"></div>' +
            '  <div class="content-wrapper tr-editor-area">{{displayValue}}</div>' +
            '</div>';
        var singleLineTemplate = '<div class="tr-template-single-line">' +
            '  <div class="content-wrapper tr-editor-area"> ' +
            '    <div>{{displayValue}}</div> ' +
            '  </div>' +
            '</div>';
        var currencySingleLineShortTemplate = '<div class="tr-template-currency-single-line-short">' +
            '  <div class="content-wrapper tr-editor-area"> ' +
            '    <div>{{#symbol}}<span class="currency-symbol">{{symbol}}</span>{{/symbol}} {{#code}}<span class="currency-code">{{code}}</span>{{/code}}</div> ' +
            '  </div>' +
            '</div>';
        var currencySingleLineLongTemplate = '<div class="tr-template-currency-single-line-long">' +
            '  <div class="content-wrapper tr-editor-area"> ' +
            '    <div class="symbol-and-code">{{#code}}<span class="currency-code">{{code}}</span>{{/code}} {{#symbol}}<span class="currency-symbol">{{symbol}}</span>{{/symbol}}</div>' +
            '    <div class="currency-name">{{name}}</div>' +
            '  </div>' +
            '</div>';
        var currency2LineTemplate = '<div class="tr-template-currency-2-lines">' +
            '  <div class="content-wrapper tr-editor-area"> ' +
            '    <div class="main-line">' +
            '      <span class="currency-code">{{code}}</span>' +
            '      <span class="currency-name">{{name}}</span>' +
            '    </div> ' +
            '    <div class="additional-info">' +
            '      <span class="currency-symbol">{{symbol}}</span>&nbsp;' +
            '      {{#exchangeRate}}' +
            '      <div class="exchange">' +
            '        = ' +
            '        <span class="exchange-rate">{{exchangeRate}}</span>' +
            '        <span class="exchange-rate-base">{{exchangeRateBase}}</span>' +
            '      </div>' +
            '      {{/exchangeRate}}' +
            '    </div>' +
            '  </div>' +
            '</div>';

        function wrapEntryTemplateWithDefaultTagWrapperTemplate(entryTemplate) {
            return ('<div class="tr-tagbox-default-wrapper-template">' +
            '<div class="tr-tagbox-tag-content">##entryTemplate##</div>' +
            '<div class="tr-tagbox-tag-remove-button"></div>' +
            '</div>').replace("##entryTemplate##", entryTemplate);
        }

        var keyCodes = {
            backspace: 8,
            tab: 9,
            enter: 13,
            shift: 16,
            ctrl: 17,
            alt: 18,
            pause: 19,
            caps_lock: 20,
            escape: 27,
            space: 32,
            page_up: 33,
            page_down: 34,
            end: 35,
            home: 36,
            left_arrow: 37,
            up_arrow: 38,
            right_arrow: 39,
            down_arrow: 40,
            insert: 45,
            delete: 46,
            left_window_key: 91,
            right_window_key: 92,
            select_key: 93,
            num_lock: 144,
            scroll_lock: 145,
            specialKeys: [8, 9, 13, 16, 17, 18, 19, 20, 27, 33, 34, 35, 36, 37, 38, 39, 40, 45, 46, 91, 92, 93, 144, 145],
            numberKeys: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105],
            isSpecialKey: function(keyCode) {
                return this.specialKeys.indexOf(keyCode) != -1;
            },
            isDigitKey: function(keyCode) {
                return this.numberKeys.indexOf(keyCode) != -1;
            }
        };

        function isModifierKey(e) {
            return [keyCodes.shift, keyCodes.caps_lock, keyCodes.alt, keyCodes.ctrl, keyCodes.left_window_key, keyCodes.right_window_key]
                    .indexOf(e.which) != -1;
        }

        var defaultListQueryFunctionFactory = function (entries, matchingOptions) {
            function filterElements(queryString) {
                var visibleEntries = [];
                for (var i = 0; i < entries.length; i++) {
                    var entry = entries[i];
                    var $entryElement = entry._trEntryElement;
                    if (!queryString || $.trivialMatch($entryElement.text().trim().replace(/\s{2,}/g, ' '), queryString, matchingOptions).length > 0) {
                        visibleEntries.push(entry);
                    }
                }
                return visibleEntries;
            }

            return function (queryString, additionalQueryParameters, resultCallback) {
                resultCallback(filterElements(queryString));
            }
        };

        var createProxy = function(delegate) {
            var proxyConstructor = function () {
            };
            proxyConstructor.prototype = delegate;
            return new proxyConstructor();
        };

        var defaultTreeQueryFunctionFactory = function (topLevelEntries, entryTemplates, matchingOptions, childrenPropertyName, expandedPropertyName) {

            function findMatchingEntriesAndTheirAncestors(entry, queryString, nodeDepth) {
                var entryProxy = createProxy(entry);
                entryProxy[childrenPropertyName] = [];
                entryProxy[expandedPropertyName] = false;
                if (entry[childrenPropertyName]) {
                    for (var i = 0; i < entry[childrenPropertyName].length; i++) {
                        var child = entry[childrenPropertyName][i];
                        var childProxy = findMatchingEntriesAndTheirAncestors(child, queryString, nodeDepth + 1);
                        if (childProxy) {
                            entryProxy[childrenPropertyName].push(childProxy);
                            entryProxy[expandedPropertyName] = true;
                        }
                    }
                }
                var hasMatchingChildren = entryProxy[childrenPropertyName].length > 0;
                var matchesItself = entryMatches(entry, queryString, nodeDepth);
                if (matchesItself && !hasMatchingChildren) {
                    // still make it expandable!
                    entryProxy[childrenPropertyName] = entry[childrenPropertyName];
                }
                return matchesItself || hasMatchingChildren ? entryProxy : null;
            }

            function entryMatches(entry, queryString, nodeDepth) {
                if (!queryString) {
                    return true;
                } else {
                    var entryHtml = Mustache.render(entryTemplates[Math.min(entryTemplates.length - 1, nodeDepth)], entry);
                    entry._entryText = entryHtml.replace(/<.*?>/g, "").replace(/\s{2,}/g, ' ');
                    return $.trivialMatch(entry._entryText, queryString, matchingOptions).length > 0;
                }
            }

            return function (queryString, additionalQueryParameters, resultCallback) {
                if (!queryString) {
                    resultCallback(topLevelEntries);
                } else {
                    var matchingEntries = [];
                    for (var i = 0; i < topLevelEntries.length; i++) {
                        var topLevelEntry = topLevelEntries[i];
                        var entryProxy = findMatchingEntriesAndTheirAncestors(topLevelEntry, queryString, 0);
                        if (entryProxy) {
                            matchingEntries.push(entryProxy);
                        }
                    }
                    resultCallback(matchingEntries);
                }
            }
        };

        var customTreeQueryFunctionFactory = function (topLevelEntries, childrenPropertyName, expandedPropertyName, customNodeMatchingFunction) {

            function findMatchingEntriesAndTheirAncestors(entry, queryString, nodeDepth) {
                var entryProxy = createProxy(entry);
                entryProxy[childrenPropertyName] = [];
                entryProxy[expandedPropertyName] = false;
                if (entry[childrenPropertyName]) {
                    for (var i = 0; i < entry[childrenPropertyName].length; i++) {
                        var child = entry[childrenPropertyName][i];
                        var childProxy = findMatchingEntriesAndTheirAncestors(child, queryString, nodeDepth + 1);
                        if (childProxy) {
                            entryProxy[childrenPropertyName].push(childProxy);
                            entryProxy[expandedPropertyName] = true;
                        }
                    }
                }
                var hasMatchingChildren = entryProxy[childrenPropertyName].length > 0;
                var matchesItself = customNodeMatchingFunction(entry, queryString, nodeDepth);
                if (matchesItself && !hasMatchingChildren) {
                    // still make it expandable!
                    entryProxy[childrenPropertyName] = entry[childrenPropertyName];
                }
                return matchesItself || hasMatchingChildren ? entryProxy : null;
            }

            return function (queryString, additionalQueryParameters, resultCallback) {
                if (!queryString) {
                    resultCallback(topLevelEntries);
                } else {
                    var matchingEntries = [];
                    for (var i = 0; i < topLevelEntries.length; i++) {
                        var topLevelEntry = topLevelEntries[i];
                        var entryProxy = findMatchingEntriesAndTheirAncestors(topLevelEntry, queryString, 0);
                        if (entryProxy) {
                            matchingEntries.push(entryProxy);
                        }
                    }
                    resultCallback(matchingEntries);
                }
            }
        };


        function registerJqueryPlugin(componentConstructor, componentName, cssClass) {
            var jsApiName = componentName.charAt(0).toUpperCase() + componentName.slice(1);
            var plainJqueryName = componentName.toLowerCase();
            var domToJsObjectReferenceName = componentName.charAt(0).toLocaleLowerCase() + componentName.slice(1);

            $.fn[plainJqueryName] = function (options) {
                var $comboBoxes = [];
                this.each(function () {
                    var existingComboBoxWrapper = $(this).parents('.' + cssClass).addBack('.' + cssClass);
                    if (existingComboBoxWrapper.length > 0 && existingComboBoxWrapper[0][domToJsObjectReferenceName]) {
                        $comboBoxes.push(existingComboBoxWrapper[0][domToJsObjectReferenceName].$);
                    } else {
                        var comboBox = new componentConstructor(this, options);
                        $comboBoxes.push(comboBox.$);
                    }
                });
                return $($comboBoxes);
            };
            $.fn[jsApiName] = function (options) {
                var comboBoxes = [];
                this.each(function () {
                    var existingComboBoxWrapper = $(this).parents('.' + cssClass).addBack('.' + cssClass);
                    if (existingComboBoxWrapper.length > 0 && existingComboBoxWrapper[0][domToJsObjectReferenceName]) {
                        comboBoxes.push(existingComboBoxWrapper[0][domToJsObjectReferenceName]);
                    } else {
                        var comboBox = new componentConstructor(this, options);
                        comboBoxes.push(comboBox);
                    }
                });
                return comboBoxes.length == 1 ? comboBoxes[0] : comboBoxes;
            };
        }

        function selectElementContents(domElement, start, end) {
            domElement = domElement.firstChild || domElement;
            end = end || start;
            var range = document.createRange();
            //range.selectNodeContents(el);
            range.setStart(domElement, start);
            range.setEnd(domElement, end);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
        }

        function escapeSpecialRegexCharacter(s) {
            return s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
        }

        function Event() {
            var listeners = [];

            this.addListener = function (fn) {
                listeners.push(fn);
            };

            this.removeListener = function (fn) {
                var listenerIndex = listeners.indexOf(fn);
                if (listenerIndex != -1) {
                    listeners.splice(listenerIndex, 1);
                }
            };

            this.fire = function () {
                for (var i = 0; i < listeners.length; i++) {
                    listeners[i].apply(listeners[i], arguments);
                }
            };
        }

        // see http://stackoverflow.com/a/27014537/524913
        function objectEquals(x, y) {
            'use strict';
            if (x === null || x === undefined || y === null || y === undefined) { return x === y; }
            if (x.constructor !== y.constructor) { return false; }
            if (x instanceof Function) { return x === y; }
            if (x instanceof RegExp) { return x === y; }
            if (x === y || x.valueOf() === y.valueOf()) { return true; }
            if (Array.isArray(x) && x.length !== y.length) { return false; }
            if (x instanceof Date) { return false; }
            if (!(x instanceof Object)) { return false; }
            if (!(y instanceof Object)) { return false; }
            var p = Object.keys(x);
            return Object.keys(y).every(function (i) { return p.indexOf(i) !== -1; }) &&
                p.every(function (i) { return objectEquals(x[i], y[i]); });
        }

        return {
            image2LinesTemplate: image2LinesTemplate,
            roundImage2LinesColorBubbleTemplate: roundImage2LinesColorBubbleTemplate,
            icon2LinesTemplate: icon2LinesTemplate,
            iconSingleLineTemplate: iconSingleLineTemplate,
            singleLineTemplate: singleLineTemplate,
            currencySingleLineShortTemplate: currencySingleLineShortTemplate,
            currencySingleLineLongTemplate: currencySingleLineLongTemplate,
            currency2LineTemplate: currency2LineTemplate,
            defaultSpinnerTemplate: '<div class="tr-default-spinner"><div class="spinner"></div><div>Fetching data...</div></div>',
            defaultNoEntriesTemplate: '<div class="tr-default-no-data-display"><div>No matching entries...</div></div>',
            wrapEntryTemplateWithDefaultTagWrapperTemplate: wrapEntryTemplateWithDefaultTagWrapperTemplate,
            keyCodes: keyCodes,
            defaultListQueryFunctionFactory: defaultListQueryFunctionFactory,
            defaultTreeQueryFunctionFactory: defaultTreeQueryFunctionFactory,
            customTreeQueryFunctionFactory: customTreeQueryFunctionFactory,
            isModifierKey: isModifierKey,
            registerJqueryPlugin: registerJqueryPlugin,
            selectElementContents: selectElementContents,
            escapeSpecialRegexCharacter: escapeSpecialRegexCharacter,
            Event: Event,
            objectEquals: objectEquals,
            createProxy: createProxy

            //findTreeNodes: findTreeNodes,
            //findTreeNodeById: findTreeNodeById,
            //findParentTreeNode: findParentTreeNode
        };
    })
);