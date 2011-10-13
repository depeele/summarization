/**
 * @license Serializer module for Rangy.
 * Serializes Ranges and Selections. An example use would be to store a user's selection on a particular page in a
 * cookie or local storage and restore it on the user's next visit to the same page.
 *
 * Part of Rangy, a cross-browser JavaScript range and selection library
 * http://code.google.com/p/rangy/
 *
 * Depends on Rangy core.
 *
 * Copyright 2011, Tim Down
 * Licensed under the MIT license.
 * Version: 1.2
 * Build date: 22 August 2011
 */
rangy.createModule("Serializer", function(api, module) {
    api.requireModules( ["WrappedSelection", "WrappedRange"] );
    var UNDEF = "undefined";

    // encodeURIComponent and decodeURIComponent are required for cookie handling
    if (typeof encodeURIComponent == UNDEF || typeof decodeURIComponent == UNDEF) {
        module.fail("Global object is missing encodeURIComponent and/or decodeURIComponent method");
    }

    // Checksum for checking whether range can be serialized
    var crc32 = (function() {
        function utf8encode(str) {
            var utf8CharCodes = [];

            for (var i = 0, len = str.length, c; i < len; ++i) {
                c = str.charCodeAt(i);
                if (c < 128) {
                    utf8CharCodes.push(c);
                } else if (c < 2048) {
                    utf8CharCodes.push((c >> 6) | 192, (c & 63) | 128);
                } else {
                    utf8CharCodes.push((c >> 12) | 224, ((c >> 6) & 63) | 128, (c & 63) | 128);
                }
            }
            return utf8CharCodes;
        }

        var cachedCrcTable = null;

        function buildCRCTable() {
            var table = [];
            for (var i = 0, j, crc; i < 256; ++i) {
                crc = i;
                j = 8;
                while (j--) {
                    if ((crc & 1) == 1) {
                        crc = (crc >>> 1) ^ 0xEDB88320;
                    } else {
                        crc >>>= 1;
                    }
                }
                table[i] = crc >>> 0;
            }
            return table;
        }

        function getCrcTable() {
            if (!cachedCrcTable) {
                cachedCrcTable = buildCRCTable();
            }
            return cachedCrcTable;
        }

        return function(str) {
            var utf8CharCodes = utf8encode(str), crc = -1, crcTable = getCrcTable();
            for (var i = 0, len = utf8CharCodes.length, y; i < len; ++i) {
                y = (crc ^ utf8CharCodes[i]) & 0xFF;
                crc = (crc >>> 8) ^ crcTable[y];
            }
            return (crc ^ -1) >>> 0;
        };
    })();

    var dom = api.dom;

    function escapeTextForHtml(str) {
        return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    function nodeToInfoString(node, infoParts) {
        infoParts = infoParts || [];
        var nodeType = node.nodeType, children = node.childNodes, childCount = children.length;
        var nodeInfo = [nodeType, node.nodeName, childCount].join(":");
        var start = "", end = "";
        switch (nodeType) {
            case 3: // Text node
                start = escapeTextForHtml(node.nodeValue);
                break;
            case 8: // Comment
                start = "<!--" + escapeTextForHtml(node.nodeValue) + "-->";
                break;
            default:
                start = "<" + nodeInfo + ">";
                end = "</>";
                break;
        }
        if (start) {
            infoParts.push(start);
        }
        for (var i = 0; i < childCount; ++i) {
            nodeToInfoString(children[i], infoParts);
        }
        if (end) {
            infoParts.push(end);
        }
        return infoParts;
    }

    // Creates a string representation of the specified element's contents that is similar to innerHTML but omits all
    // attributes and comments and includes child node counts. This is done instead of using innerHTML to work around
    // IE <= 8's policy of including element properties in attributes, which ruins things by changing an element's
    // innerHTML whenever the user changes an input within the element.
    function getElementChecksum(el) {
        var info = nodeToInfoString(el).join("");
        return crc32(info).toString(16);
    }

    function serializePosition(node, offset, rootNode) {
        var pathBits = [], n = node;
        rootNode = rootNode || dom.getDocument(node).documentElement;
        while (n && n != rootNode) {
            pathBits.push(dom.getNodeIndex(n, true));
            n = n.parentNode;
        }
        return pathBits.join("/") + ":" + offset;
    }

    function deserializePosition(serialized, rootNode, doc) {
        if (rootNode) {
            doc = doc || dom.getDocument(rootNode);
        } else {
            doc = doc || document;
            rootNode = doc.documentElement;
        }
        var bits = serialized.split(":");
        var node = rootNode;
        var nodeIndices = bits[0] ? bits[0].split("/") : [], i = nodeIndices.length, nodeIndex;

        while (i--) {
            nodeIndex = parseInt(nodeIndices[i], 10);
            if (nodeIndex < node.childNodes.length) {
                node = node.childNodes[parseInt(nodeIndices[i], 10)];
            } else {
                throw module.createError("deserializePosition failed: node " + dom.inspectNode(node) +
                        " has no child with index " + nodeIndex + ", " + i);
            }
        }

        return new dom.DomPosition(node, parseInt(bits[1], 10));
    }

    function serializeRange(range, omitChecksum, rootNode) {
        rootNode = rootNode || api.DomRange.getRangeDocument(range).documentElement;
        if (!dom.isAncestorOf(rootNode, range.commonAncestorContainer, true)) {
            throw new Error("serializeRange: range is not wholly contained within specified root node");
        }
        var serialized = serializePosition(range.startContainer, range.startOffset, rootNode) + "," +
            serializePosition(range.endContainer, range.endOffset, rootNode);
        if (!omitChecksum) {
            serialized += "{" + getElementChecksum(rootNode) + "}";
        }
        return serialized;
    }

    function deserializeRange(serialized, rootNode, doc) {
        if (rootNode) {
            doc = doc || dom.getDocument(rootNode);
        } else {
            doc = doc || document;
            rootNode = doc.documentElement;
        }
        var result = /^([^,]+),([^,\{]+)({([^}]+)})?$/.exec(serialized);
        var checksum = result[4], rootNodeChecksum = getElementChecksum(rootNode);
        if (checksum && checksum !== getElementChecksum(rootNode)) {
            throw new Error("deserializeRange: checksums of serialized range root node (" + checksum +
                    ") and target root node (" + rootNodeChecksum + ") do not match");
        }
        var start = deserializePosition(result[1], rootNode, doc), end = deserializePosition(result[2], rootNode, doc);
        var range = api.createRange(doc);
        range.setStart(start.node, start.offset);
        range.setEnd(end.node, end.offset);
        return range;
    }

    function canDeserializeRange(serialized, rootNode, doc) {
        if (rootNode) {
            doc = doc || dom.getDocument(rootNode);
        } else {
            doc = doc || document;
            rootNode = doc.documentElement;
        }
        var result = /^([^,]+),([^,]+)({([^}]+)})?$/.exec(serialized);
        var checksum = result[3];
        return !checksum || checksum === getElementChecksum(rootNode);
    }

    function serializeSelection(selection, omitChecksum, rootNode) {
        selection = selection || api.getSelection();
        var ranges = selection.getAllRanges(), serializedRanges = [];
        for (var i = 0, len = ranges.length; i < len; ++i) {
            serializedRanges[i] = serializeRange(ranges[i], omitChecksum, rootNode);
        }
        return serializedRanges.join("|");
    }

    function deserializeSelection(serialized, rootNode, win) {
        if (rootNode) {
            win = win || dom.getWindow(rootNode);
        } else {
            win = win || window;
            rootNode = win.document.documentElement;
        }
        var serializedRanges = serialized.split("|");
        var sel = api.getSelection(win);
        var ranges = [];

        for (var i = 0, len = serializedRanges.length; i < len; ++i) {
            ranges[i] = deserializeRange(serializedRanges[i], rootNode, win.document);
        }
        sel.setRanges(ranges);

        return sel;
    }

    function canDeserializeSelection(serialized, rootNode, win) {
        var doc;
        if (rootNode) {
            doc = win ? win.document : dom.getDocument(rootNode);
        } else {
            win = win || window;
            rootNode = win.document.documentElement;
        }
        var serializedRanges = serialized.split("|");

        for (var i = 0, len = serializedRanges.length; i < len; ++i) {
            if (!canDeserializeRange(serializedRanges[i], rootNode, doc)) {
                return false;
            }
        }

        return true;
    }


    var cookieName = "rangySerializedSelection";

    function getSerializedSelectionFromCookie(cookie) {
        var parts = cookie.split(/[;,]/);
        for (var i = 0, len = parts.length, nameVal, val; i < len; ++i) {
            nameVal = parts[i].split("=");
            if (nameVal[0].replace(/^\s+/, "") == cookieName) {
                val = nameVal[1];
                if (val) {
                    return decodeURIComponent(val.replace(/\s+$/, ""));
                }
            }
        }
        return null;
    }

    function restoreSelectionFromCookie(win) {
        win = win || window;
        var serialized = getSerializedSelectionFromCookie(win.document.cookie);
        if (serialized) {
            deserializeSelection(serialized, win.doc)
        }
    }

    function saveSelectionCookie(win, props) {
        win = win || window;
        props = (typeof props == "object") ? props : {};
        var expires = props.expires ? ";expires=" + props.expires.toUTCString() : "";
        var path = props.path ? ";path=" + props.path : "";
        var domain = props.domain ? ";domain=" + props.domain : "";
        var secure = props.secure ? ";secure" : "";
        var serialized = serializeSelection(api.getSelection(win));
        win.document.cookie = encodeURIComponent(cookieName) + "=" + encodeURIComponent(serialized) + expires + path + domain + secure;
    }

    api.serializePosition = serializePosition;
    api.deserializePosition = deserializePosition;

    api.serializeRange = serializeRange;
    api.deserializeRange = deserializeRange;
    api.canDeserializeRange = canDeserializeRange;

    api.serializeSelection = serializeSelection;
    api.deserializeSelection = deserializeSelection;
    api.canDeserializeSelection = canDeserializeSelection;

    api.restoreSelectionFromCookie = restoreSelectionFromCookie;
    api.saveSelectionCookie = saveSelectionCookie;

    api.getElementChecksum = getElementChecksum;
});
/**
 * @license CSS Class Applier module for Rangy.
 * Adds, removes and toggles CSS classes on Ranges and Selections
 *
 * Part of Rangy, a cross-browser JavaScript range and selection library
 * http://code.google.com/p/rangy/
 *
 * Depends on Rangy core.
 *
 * Copyright 2011, Tim Down
 * Licensed under the MIT license.
 * Version: 1.2
 * Build date: 22 August 2011
 */
rangy.createModule("CssClassApplier", function(api, module) {
    api.requireModules( ["WrappedSelection", "WrappedRange"] );

    var dom = api.dom;



    var defaultTagName = "span";

    function trim(str) {
        return str.replace(/^\s\s*/, "").replace(/\s\s*$/, "");
    }

    function hasClass(el, cssClass) {
        return el.className && new RegExp("(?:^|\\s)" + cssClass + "(?:\\s|$)").test(el.className);
    }

    function addClass(el, cssClass) {
        if (el.className) {
            if (!hasClass(el, cssClass)) {
                el.className += " " + cssClass;
            }
        } else {
            el.className = cssClass;
        }
    }

    var removeClass = (function() {
        function replacer(matched, whiteSpaceBefore, whiteSpaceAfter) {
            return (whiteSpaceBefore && whiteSpaceAfter) ? " " : "";
        }

        return function(el, cssClass) {
            if (el.className) {
                el.className = el.className.replace(new RegExp("(?:^|\\s)" + cssClass + "(?:\\s|$)"), replacer);
            }
        };
    })();

    function sortClassName(className) {
        return className.split(/\s+/).sort().join(" ");
    }

    function getSortedClassName(el) {
        return sortClassName(el.className);
    }

    function haveSameClasses(el1, el2) {
        return getSortedClassName(el1) == getSortedClassName(el2);
    }

    function replaceWithOwnChildren(el) {

        var parent = el.parentNode;
        while (el.hasChildNodes()) {
            parent.insertBefore(el.firstChild, el);
        }
        parent.removeChild(el);
    }

    function rangeSelectsAnyText(range, textNode) {
        var textRange = range.cloneRange();
        textRange.selectNodeContents(textNode);

        var intersectionRange = textRange.intersection(range);
        var text = intersectionRange ? intersectionRange.toString() : "";
        textRange.detach();

        return text != "";
    }

    function getEffectiveTextNodes(range) {
        return range.getNodes([3], function(textNode) {
            return rangeSelectsAnyText(range, textNode);
        });
    }

    function elementsHaveSameNonClassAttributes(el1, el2) {
        if (el1.attributes.length != el2.attributes.length) return false;
        for (var i = 0, len = el1.attributes.length, attr1, attr2, name; i < len; ++i) {
            attr1 = el1.attributes[i];
            name = attr1.name;
            if (name != "class") {
                attr2 = el2.attributes.getNamedItem(name);
                if (attr1.specified != attr2.specified) return false;
                if (attr1.specified && attr1.nodeValue !== attr2.nodeValue) return false;
            }
        }
        return true;
    }

    function elementHasNonClassAttributes(el, exceptions) {
        for (var i = 0, len = el.attributes.length, attrName; i < len; ++i) {
            attrName = el.attributes[i].name;
            if ( !(exceptions && dom.arrayContains(exceptions, attrName)) && el.attributes[i].specified && attrName != "class") {
                return true;
            }
        }
        return false;
    }

    function elementHasProps(el, props) {
        for (var p in props) {
            if (props.hasOwnProperty(p) && el[p] !== props[p]) {
                return false;
            }
        }
        return true;
    }

    var getComputedStyleProperty;

    if (typeof window.getComputedStyle != "undefined") {
        getComputedStyleProperty = function(el, propName) {
            return dom.getWindow(el).getComputedStyle(el, null)[propName];
        };
    } else if (typeof document.documentElement.currentStyle != "undefined") {
        getComputedStyleProperty = function(el, propName) {
            return el.currentStyle[propName];
        };
    } else {
        module.fail("No means of obtaining computed style properties found");
    }

    var isEditableElement;

    (function() {
        var testEl = document.createElement("div");
        if (typeof testEl.isContentEditable == "boolean") {
            isEditableElement = function(node) {
                return node && node.nodeType == 1 && node.isContentEditable;
            };
        } else {
            isEditableElement = function(node) {
                if (!node || node.nodeType != 1 || node.contentEditable == "false") {
                    return false;
                }
                return node.contentEditable == "true" || isEditableElement(node.parentNode);
            };
        }
    })();

    function isEditingHost(node) {
        var parent;
        return node && node.nodeType == 1
            && (( (parent = node.parentNode) && parent.nodeType == 9 && parent.designMode == "on")
            || (isEditableElement(node) && !isEditableElement(node.parentNode)));
    }

    function isEditable(node) {
        return (isEditableElement(node) || (node.nodeType != 1 && isEditableElement(node.parentNode))) && !isEditingHost(node);
    }

    var inlineDisplayRegex = /^inline(-block|-table)?$/i;

    function isNonInlineElement(node) {
        return node && node.nodeType == 1 && !inlineDisplayRegex.test(getComputedStyleProperty(node, "display"));
    }

    // White space characters as defined by HTML 4 (http://www.w3.org/TR/html401/struct/text.html)
    var htmlNonWhiteSpaceRegex = /[^\r\n\t\f \u200B]/;

    function isUnrenderedWhiteSpaceNode(node) {
        if (node.data.length == 0) {
            return true;
        }
        if (htmlNonWhiteSpaceRegex.test(node.data)) {
            return false;
        }
        var cssWhiteSpace = getComputedStyleProperty(node.parentNode, "whiteSpace");
        switch (cssWhiteSpace) {
            case "pre":
            case "pre-wrap":
            case "-moz-pre-wrap":
                return false;
            case "pre-line":
                if (/[\r\n]/.test(node.data)) {
                    return false;
                }
        }

        // We now have a whitespace-only text node that may be rendered depending on its context. If it is adjacent to a
        // non-inline element, it will not be rendered. This seems to be a good enough definition.
        return isNonInlineElement(node.previousSibling) || isNonInlineElement(node.nextSibling);
    }

    function isSplitPoint(node, offset) {
        if (dom.isCharacterDataNode(node)) {
            if (offset == 0) {
                return !!node.previousSibling;
            } else if (offset == node.length) {
                return !!node.nextSibling;
            } else {
                return true;
            }
        }

        return offset > 0 && offset < node.childNodes.length;
    }

    function splitNodeAt(node, descendantNode, descendantOffset, rangesToPreserve) {
        var newNode;
        var splitAtStart = (descendantOffset == 0);

        if (dom.isAncestorOf(descendantNode, node)) {
            throw module.createError("descendant is ancestor of node");
        }

        if (dom.isCharacterDataNode(descendantNode)) {
            if (descendantOffset == 0) {
                descendantOffset = dom.getNodeIndex(descendantNode);
                descendantNode = descendantNode.parentNode;
            } else if (descendantOffset == descendantNode.length) {
                descendantOffset = dom.getNodeIndex(descendantNode) + 1;
                descendantNode = descendantNode.parentNode;
            } else {
                throw module.createError("splitNodeAt should not be called with offset in the middle of a data node ("
                    + descendantOffset + " in " + descendantNode.data);
            }
        }

        if (isSplitPoint(descendantNode, descendantOffset)) {
            if (!newNode) {
                newNode = descendantNode.cloneNode(false);
                if (newNode.id) {
                    newNode.removeAttribute("id");
                }
                var child;
                while ((child = descendantNode.childNodes[descendantOffset])) {
                    newNode.appendChild(child);
                }
                dom.insertAfter(newNode, descendantNode);
            }
            return (descendantNode == node) ? newNode : splitNodeAt(node, newNode.parentNode, dom.getNodeIndex(newNode), rangesToPreserve);
        } else if (node != descendantNode) {
            newNode = descendantNode.parentNode;

            // Work out a new split point in the parent node
            var newNodeIndex = dom.getNodeIndex(descendantNode);

            if (!splitAtStart) {
                newNodeIndex++;
            }
            return splitNodeAt(node, newNode, newNodeIndex, rangesToPreserve);
        }
        return node;
    }

    function areElementsMergeable(el1, el2) {
        return el1.tagName == el2.tagName && haveSameClasses(el1, el2) && elementsHaveSameNonClassAttributes(el1, el2);
    }

    function createAdjacentMergeableTextNodeGetter(forward) {
        var propName = forward ? "nextSibling" : "previousSibling";

        return function(textNode, checkParentElement) {
            var el = textNode.parentNode;
            var adjacentNode = textNode[propName];
            if (adjacentNode) {
                // Can merge if the node's previous/next sibling is a text node
                if (adjacentNode && adjacentNode.nodeType == 3) {
                    return adjacentNode;
                }
            } else if (checkParentElement) {
                // Compare text node parent element with its sibling
                adjacentNode = el[propName];

                if (adjacentNode && adjacentNode.nodeType == 1 && areElementsMergeable(el, adjacentNode)) {
                    return adjacentNode[forward ? "firstChild" : "lastChild"];
                }
            }
            return null;
        }
    }

    var getPreviousMergeableTextNode = createAdjacentMergeableTextNodeGetter(false),
        getNextMergeableTextNode = createAdjacentMergeableTextNodeGetter(true);


    function Merge(firstNode) {
        this.isElementMerge = (firstNode.nodeType == 1);
        this.firstTextNode = this.isElementMerge ? firstNode.lastChild : firstNode;
        this.textNodes = [this.firstTextNode];
    }

    Merge.prototype = {
        doMerge: function() {
            var textBits = [], textNode, parent, text;
            for (var i = 0, len = this.textNodes.length; i < len; ++i) {
                textNode = this.textNodes[i];
                parent = textNode.parentNode;
                textBits[i] = textNode.data;
                if (i) {
                    parent.removeChild(textNode);
                    if (!parent.hasChildNodes()) {
                        parent.parentNode.removeChild(parent);
                    }
                }
            }
            this.firstTextNode.data = text = textBits.join("");
            return text;
        },

        getLength: function() {
            var i = this.textNodes.length, len = 0;
            while (i--) {
                len += this.textNodes[i].length;
            }
            return len;
        },

        toString: function() {
            var textBits = [];
            for (var i = 0, len = this.textNodes.length; i < len; ++i) {
                textBits[i] = "'" + this.textNodes[i].data + "'";
            }
            return "[Merge(" + textBits.join(",") + ")]";
        }
    };

    var optionProperties = ["elementTagName", "ignoreWhiteSpace", "applyToEditableOnly"];

    // Allow "class" as a property name in object properties
    var mappedPropertyNames = {"class" : "className"};

    function CssClassApplier(cssClass, options, tagNames) {
        this.cssClass = cssClass;
        var normalize, i, len, propName;

        var elementPropertiesFromOptions = null;

        // Initialize from options object
        if (typeof options == "object" && options !== null) {
            tagNames = options.tagNames;
            elementPropertiesFromOptions = options.elementProperties;

            for (i = 0; propName = optionProperties[i++]; ) {
                if (options.hasOwnProperty(propName)) {
                    this[propName] = options[propName];
                }
            }
            normalize = options.normalize;
        } else {
            normalize = options;
        }

        // Backwards compatibility: the second parameter can also be a Boolean indicating whether normalization
        this.normalize = (typeof normalize == "undefined") ? true : normalize;

        // Initialize element properties and attribute exceptions
        this.attrExceptions = [];
        var el = document.createElement(this.elementTagName);
        this.elementProperties = {};
        for (var p in elementPropertiesFromOptions) {
            if (elementPropertiesFromOptions.hasOwnProperty(p)) {
                // Map "class" to "className"
                if (mappedPropertyNames.hasOwnProperty(p)) {
                    p = mappedPropertyNames[p];
                }
                el[p] = elementPropertiesFromOptions[p];

                // Copy the property back from the dummy element so that later comparisons to check whether elements
                // may be removed are checking against the right value. For example, the href property of an element
                // returns a fully qualified URL even if it was previously assigned a relative URL.
                this.elementProperties[p] = el[p];
                this.attrExceptions.push(p);
            }
        }

        this.elementSortedClassName = this.elementProperties.hasOwnProperty("className") ?
            sortClassName(this.elementProperties.className + " " + cssClass) : cssClass;

        // Initialize tag names
        this.applyToAnyTagName = false;
        var type = typeof tagNames;
        if (type == "string") {
            if (tagNames == "*") {
                this.applyToAnyTagName = true;
            } else {
                this.tagNames = trim(tagNames.toLowerCase()).split(/\s*,\s*/);
            }
        } else if (type == "object" && typeof tagNames.length == "number") {
            this.tagNames = [];
            for (i = 0, len = tagNames.length; i < len; ++i) {
                if (tagNames[i] == "*") {
                    this.applyToAnyTagName = true;
                } else {
                    this.tagNames.push(tagNames[i].toLowerCase());
                }
            }
        } else {
            this.tagNames = [this.elementTagName];
        }
    }

    CssClassApplier.prototype = {
        elementTagName: defaultTagName,
        elementProperties: {},
        ignoreWhiteSpace: true,
        applyToEditableOnly: false,

        hasClass: function(node) {
            return node.nodeType == 1 && dom.arrayContains(this.tagNames, node.tagName.toLowerCase()) && hasClass(node, this.cssClass);
        },

        getSelfOrAncestorWithClass: function(node) {
            while (node) {
                if (this.hasClass(node, this.cssClass)) {
                    return node;
                }
                node = node.parentNode;
            }
            return null;
        },

        isModifiable: function(node) {
            return !this.applyToEditableOnly || isEditable(node);
        },

        // White space adjacent to an unwrappable node can be ignored for wrapping
        isIgnorableWhiteSpaceNode: function(node) {
            return this.ignoreWhiteSpace && node && node.nodeType == 3 && isUnrenderedWhiteSpaceNode(node);
        },

        // Normalizes nodes after applying a CSS class to a Range.
        postApply: function(textNodes, range, isUndo) {

            var firstNode = textNodes[0], lastNode = textNodes[textNodes.length - 1];

            var merges = [], currentMerge;

            var rangeStartNode = firstNode, rangeEndNode = lastNode;
            var rangeStartOffset = 0, rangeEndOffset = lastNode.length;

            var textNode, precedingTextNode;

            for (var i = 0, len = textNodes.length; i < len; ++i) {
                textNode = textNodes[i];
                precedingTextNode = getPreviousMergeableTextNode(textNode, !isUndo);

                if (precedingTextNode) {
                    if (!currentMerge) {
                        currentMerge = new Merge(precedingTextNode);
                        merges.push(currentMerge);
                    }
                    currentMerge.textNodes.push(textNode);
                    if (textNode === firstNode) {
                        rangeStartNode = currentMerge.firstTextNode;
                        rangeStartOffset = rangeStartNode.length;
                    }
                    if (textNode === lastNode) {
                        rangeEndNode = currentMerge.firstTextNode;
                        rangeEndOffset = currentMerge.getLength();
                    }
                } else {
                    currentMerge = null;
                }
            }

            // Test whether the first node after the range needs merging
            var nextTextNode = getNextMergeableTextNode(lastNode, !isUndo);

            if (nextTextNode) {
                if (!currentMerge) {
                    currentMerge = new Merge(lastNode);
                    merges.push(currentMerge);
                }
                currentMerge.textNodes.push(nextTextNode);
            }

            // Do the merges
            if (merges.length) {

                for (i = 0, len = merges.length; i < len; ++i) {
                    merges[i].doMerge();
                }


                // Set the range boundaries
                range.setStart(rangeStartNode, rangeStartOffset);
                range.setEnd(rangeEndNode, rangeEndOffset);
            }

        },

        createContainer: function(doc) {
            var el = doc.createElement(this.elementTagName);
            api.util.extend(el, this.elementProperties);
            addClass(el, this.cssClass);
            return el;
        },

        applyToTextNode: function(textNode) {


            var parent = textNode.parentNode;
            if (parent.childNodes.length == 1 && dom.arrayContains(this.tagNames, parent.tagName.toLowerCase())) {
                addClass(parent, this.cssClass);
            } else {
                var el = this.createContainer(dom.getDocument(textNode));
                textNode.parentNode.insertBefore(el, textNode);
                el.appendChild(textNode);
            }

        },

        isRemovable: function(el) {
            return el.tagName.toLowerCase() == this.elementTagName
                    && getSortedClassName(el) == this.elementSortedClassName
                    && elementHasProps(el, this.elementProperties)
                    && !elementHasNonClassAttributes(el, this.attrExceptions)
                    && this.isModifiable(el);
        },

        undoToTextNode: function(textNode, range, ancestorWithClass) {

            if (!range.containsNode(ancestorWithClass)) {
                // Split out the portion of the ancestor from which we can remove the CSS class
                //var parent = ancestorWithClass.parentNode, index = dom.getNodeIndex(ancestorWithClass);
                var ancestorRange = range.cloneRange();
                ancestorRange.selectNode(ancestorWithClass);

                if (ancestorRange.isPointInRange(range.endContainer, range.endOffset)/* && isSplitPoint(range.endContainer, range.endOffset)*/) {
                    splitNodeAt(ancestorWithClass, range.endContainer, range.endOffset, [range]);
                    range.setEndAfter(ancestorWithClass);
                }
                if (ancestorRange.isPointInRange(range.startContainer, range.startOffset)/* && isSplitPoint(range.startContainer, range.startOffset)*/) {
                    ancestorWithClass = splitNodeAt(ancestorWithClass, range.startContainer, range.startOffset, [range]);
                }
            }

            if (this.isRemovable(ancestorWithClass)) {
                replaceWithOwnChildren(ancestorWithClass);
            } else {
                removeClass(ancestorWithClass, this.cssClass);
            }
        },

        applyToRange: function(range) {
            range.splitBoundaries();
            var textNodes = getEffectiveTextNodes(range);

            if (textNodes.length) {
                var textNode;

                for (var i = 0, len = textNodes.length; i < len; ++i) {
                    textNode = textNodes[i];

                    if (!this.isIgnorableWhiteSpaceNode(textNode) && !this.getSelfOrAncestorWithClass(textNode)
                            && this.isModifiable(textNode)) {
                        this.applyToTextNode(textNode);
                    }
                }
                range.setStart(textNodes[0], 0);
                textNode = textNodes[textNodes.length - 1];
                range.setEnd(textNode, textNode.length);
                if (this.normalize) {
                    this.postApply(textNodes, range, false);
                }
            }
        },

        applyToSelection: function(win) {

            win = win || window;
            var sel = api.getSelection(win);

            var range, ranges = sel.getAllRanges();
            sel.removeAllRanges();
            var i = ranges.length;
            while (i--) {
                range = ranges[i];
                this.applyToRange(range);
                sel.addRange(range);
            }

        },

        undoToRange: function(range) {

            range.splitBoundaries();
            var textNodes = getEffectiveTextNodes(range);
            var textNode, ancestorWithClass;
            var lastTextNode = textNodes[textNodes.length - 1];

            if (textNodes.length) {
                for (var i = 0, len = textNodes.length; i < len; ++i) {
                    textNode = textNodes[i];
                    ancestorWithClass = this.getSelfOrAncestorWithClass(textNode);
                    if (ancestorWithClass && this.isModifiable(textNode)) {
                        this.undoToTextNode(textNode, range, ancestorWithClass);
                    }

                    // Ensure the range is still valid
                    range.setStart(textNodes[0], 0);
                    range.setEnd(lastTextNode, lastTextNode.length);
                }



                if (this.normalize) {
                    this.postApply(textNodes, range, true);
                }
            }
        },

        undoToSelection: function(win) {
            win = win || window;
            var sel = api.getSelection(win);
            var ranges = sel.getAllRanges(), range;
            sel.removeAllRanges();
            for (var i = 0, len = ranges.length; i < len; ++i) {
                range = ranges[i];
                this.undoToRange(range);
                sel.addRange(range);
            }
        },

        getTextSelectedByRange: function(textNode, range) {
            var textRange = range.cloneRange();
            textRange.selectNodeContents(textNode);

            var intersectionRange = textRange.intersection(range);
            var text = intersectionRange ? intersectionRange.toString() : "";
            textRange.detach();

            return text;
        },

        isAppliedToRange: function(range) {
            if (range.collapsed) {
                return !!this.getSelfOrAncestorWithClass(range.commonAncestorContainer);
            } else {
                var textNodes = range.getNodes( [3] );
                for (var i = 0, textNode; textNode = textNodes[i++]; ) {
                    if (!this.isIgnorableWhiteSpaceNode(textNode) && rangeSelectsAnyText(range, textNode)
                            && this.isModifiable(textNode) && !this.getSelfOrAncestorWithClass(textNode)) {
                        return false;
                    }
                }
                return true;
            }
        },

        isAppliedToSelection: function(win) {
            win = win || window;
            var sel = api.getSelection(win);
            var ranges = sel.getAllRanges();
            var i = ranges.length;
            while (i--) {
                if (!this.isAppliedToRange(ranges[i])) {
                    return false;
                }
            }

            return true;
        },

        toggleRange: function(range) {
            if (this.isAppliedToRange(range)) {
                this.undoToRange(range);
            } else {
                this.applyToRange(range);
            }
        },

        toggleSelection: function(win) {
            if (this.isAppliedToSelection(win)) {
                this.undoToSelection(win);
            } else {
                this.applyToSelection(win);
            }
        },

        detach: function() {}
    };

    function createCssClassApplier(cssClass, options, tagNames) {
        return new CssClassApplier(cssClass, options, tagNames);
    }

    CssClassApplier.util = {
        hasClass: hasClass,
        addClass: addClass,
        removeClass: removeClass,
        hasSameClasses: haveSameClasses,
        replaceWithOwnChildren: replaceWithOwnChildren,
        elementsHaveSameNonClassAttributes: elementsHaveSameNonClassAttributes,
        elementHasNonClassAttributes: elementHasNonClassAttributes,
        splitNodeAt: splitNodeAt,
        isEditableElement: isEditableElement,
        isEditingHost: isEditingHost,
        isEditable: isEditable
    };

    api.CssClassApplier = CssClassApplier;
    api.createCssClassApplier = createCssClassApplier;
});
/*!
 * jQuery Templates Plugin 1.0.0pre
 * http://github.com/jquery/jquery-tmpl
 * Requires jQuery 1.4.2
 *
 * Copyright Software Freedom Conservancy, Inc.
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 */
(function( jQuery, undefined ){
	var oldManip = jQuery.fn.domManip, tmplItmAtt = "_tmplitem", htmlExpr = /^[^<]*(<[\w\W]+>)[^>]*$|\{\{\! /,
		newTmplItems = {}, wrappedItems = {}, appendToTmplItems, topTmplItem = { key: 0, data: {} }, itemKey = 0, cloneIndex = 0, stack = [];

	function newTmplItem( options, parentItem, fn, data ) {
		// Returns a template item data structure for a new rendered instance of a template (a 'template item').
		// The content field is a hierarchical array of strings and nested items (to be
		// removed and replaced by nodes field of dom elements, once inserted in DOM).
		var newItem = {
			data: data || (data === 0 || data === false) ? data : (parentItem ? parentItem.data : {}),
			_wrap: parentItem ? parentItem._wrap : null,
			tmpl: null,
			parent: parentItem || null,
			nodes: [],
			calls: tiCalls,
			nest: tiNest,
			wrap: tiWrap,
			html: tiHtml,
			update: tiUpdate
		};
		if ( options ) {
			jQuery.extend( newItem, options, { nodes: [], parent: parentItem });
		}
		if ( fn ) {
			// Build the hierarchical content to be used during insertion into DOM
			newItem.tmpl = fn;
			newItem._ctnt = newItem._ctnt || newItem.tmpl( jQuery, newItem );
			newItem.key = ++itemKey;
			// Keep track of new template item, until it is stored as jQuery Data on DOM element
			(stack.length ? wrappedItems : newTmplItems)[itemKey] = newItem;
		}
		return newItem;
	}

	// Override appendTo etc., in order to provide support for targeting multiple elements. (This code would disappear if integrated in jquery core).
	jQuery.each({
		appendTo: "append",
		prependTo: "prepend",
		insertBefore: "before",
		insertAfter: "after",
		replaceAll: "replaceWith"
	}, function( name, original ) {
		jQuery.fn[ name ] = function( selector ) {
			var ret = [], insert = jQuery( selector ), elems, i, l, tmplItems,
				parent = this.length === 1 && this[0].parentNode;

			appendToTmplItems = newTmplItems || {};
			if ( parent && parent.nodeType === 11 && parent.childNodes.length === 1 && insert.length === 1 ) {
				insert[ original ]( this[0] );
				ret = this;
			} else {
				for ( i = 0, l = insert.length; i < l; i++ ) {
					cloneIndex = i;
					elems = (i > 0 ? this.clone(true) : this).get();
					jQuery( insert[i] )[ original ]( elems );
					ret = ret.concat( elems );
				}
				cloneIndex = 0;
				ret = this.pushStack( ret, name, insert.selector );
			}
			tmplItems = appendToTmplItems;
			appendToTmplItems = null;
			jQuery.tmpl.complete( tmplItems );
			return ret;
		};
	});

	jQuery.fn.extend({
		// Use first wrapped element as template markup.
		// Return wrapped set of template items, obtained by rendering template against data.
		tmpl: function( data, options, parentItem ) {
			return jQuery.tmpl( this[0], data, options, parentItem );
		},

		// Find which rendered template item the first wrapped DOM element belongs to
		tmplItem: function() {
			return jQuery.tmplItem( this[0] );
		},

		// Consider the first wrapped element as a template declaration, and get the compiled template or store it as a named template.
		template: function( name ) {
			return jQuery.template( name, this[0] );
		},

		domManip: function( args, table, callback, options ) {
			if ( args[0] && jQuery.isArray( args[0] )) {
				var dmArgs = jQuery.makeArray( arguments ), elems = args[0], elemsLength = elems.length, i = 0, tmplItem;
				while ( i < elemsLength && !(tmplItem = jQuery.data( elems[i++], "tmplItem" ))) {}
				if ( tmplItem && cloneIndex ) {
					dmArgs[2] = function( fragClone ) {
						// Handler called by oldManip when rendered template has been inserted into DOM.
						jQuery.tmpl.afterManip( this, fragClone, callback );
					};
				}
				oldManip.apply( this, dmArgs );
			} else {
				oldManip.apply( this, arguments );
			}
			cloneIndex = 0;
			if ( !appendToTmplItems ) {
				jQuery.tmpl.complete( newTmplItems );
			}
			return this;
		}
	});

	jQuery.extend({
		// Return wrapped set of template items, obtained by rendering template against data.
		tmpl: function( tmpl, data, options, parentItem ) {
			var ret, topLevel = !parentItem;
			if ( topLevel ) {
				// This is a top-level tmpl call (not from a nested template using {{tmpl}})
				parentItem = topTmplItem;
				tmpl = jQuery.template[tmpl] || jQuery.template( null, tmpl );
				wrappedItems = {}; // Any wrapped items will be rebuilt, since this is top level
			} else if ( !tmpl ) {
				// The template item is already associated with DOM - this is a refresh.
				// Re-evaluate rendered template for the parentItem
				tmpl = parentItem.tmpl;
				newTmplItems[parentItem.key] = parentItem;
				parentItem.nodes = [];
				if ( parentItem.wrapped ) {
					updateWrapped( parentItem, parentItem.wrapped );
				}
				// Rebuild, without creating a new template item
				return jQuery( build( parentItem, null, parentItem.tmpl( jQuery, parentItem ) ));
			}
			if ( !tmpl ) {
				return []; // Could throw...
			}
			if ( typeof data === "function" ) {
				data = data.call( parentItem || {} );
			}
			if ( options && options.wrapped ) {
				updateWrapped( options, options.wrapped );
			}
			ret = jQuery.isArray( data ) ?
				jQuery.map( data, function( dataItem ) {
					return dataItem ? newTmplItem( options, parentItem, tmpl, dataItem ) : null;
				}) :
				[ newTmplItem( options, parentItem, tmpl, data ) ];
			return topLevel ? jQuery( build( parentItem, null, ret ) ) : ret;
		},

		// Return rendered template item for an element.
		tmplItem: function( elem ) {
			var tmplItem;
			if ( elem instanceof jQuery ) {
				elem = elem[0];
			}
			while ( elem && elem.nodeType === 1 && !(tmplItem = jQuery.data( elem, "tmplItem" )) && (elem = elem.parentNode) ) {}
			return tmplItem || topTmplItem;
		},

		// Set:
		// Use $.template( name, tmpl ) to cache a named template,
		// where tmpl is a template string, a script element or a jQuery instance wrapping a script element, etc.
		// Use $( "selector" ).template( name ) to provide access by name to a script block template declaration.

		// Get:
		// Use $.template( name ) to access a cached template.
		// Also $( selectorToScriptBlock ).template(), or $.template( null, templateString )
		// will return the compiled template, without adding a name reference.
		// If templateString includes at least one HTML tag, $.template( templateString ) is equivalent
		// to $.template( null, templateString )
		template: function( name, tmpl ) {
			if (tmpl) {
				// Compile template and associate with name
				if ( typeof tmpl === "string" ) {
					// This is an HTML string being passed directly in.
					tmpl = buildTmplFn( tmpl );
				} else if ( tmpl instanceof jQuery ) {
					tmpl = tmpl[0] || {};
				}
				if ( tmpl.nodeType ) {
					// If this is a template block, use cached copy, or generate tmpl function and cache.
					tmpl = jQuery.data( tmpl, "tmpl" ) || jQuery.data( tmpl, "tmpl", buildTmplFn( tmpl.innerHTML ));
					// Issue: In IE, if the container element is not a script block, the innerHTML will remove quotes from attribute values whenever the value does not include white space.
					// This means that foo="${x}" will not work if the value of x includes white space: foo="${x}" -> foo=value of x.
					// To correct this, include space in tag: foo="${ x }" -> foo="value of x"
				}
				return typeof name === "string" ? (jQuery.template[name] = tmpl) : tmpl;
			}
			// Return named compiled template
			return name ? (typeof name !== "string" ? jQuery.template( null, name ):
				(jQuery.template[name] ||
					// If not in map, and not containing at least on HTML tag, treat as a selector.
					// (If integrated with core, use quickExpr.exec)
					jQuery.template( null, htmlExpr.test( name ) ? name : jQuery( name )))) : null;
		},

		encode: function( text ) {
			// Do HTML encoding replacing < > & and ' and " by corresponding entities.
			return ("" + text).split("<").join("&lt;").split(">").join("&gt;").split('"').join("&#34;").split("'").join("&#39;");
		}
	});

	jQuery.extend( jQuery.tmpl, {
		tag: {
			"tmpl": {
				_default: { $2: "null" },
				open: "if($notnull_1){__=__.concat($item.nest($1,$2));}"
				// tmpl target parameter can be of type function, so use $1, not $1a (so not auto detection of functions)
				// This means that {{tmpl foo}} treats foo as a template (which IS a function).
				// Explicit parens can be used if foo is a function that returns a template: {{tmpl foo()}}.
			},
			"wrap": {
				_default: { $2: "null" },
				open: "$item.calls(__,$1,$2);__=[];",
				close: "call=$item.calls();__=call._.concat($item.wrap(call,__));"
			},
			"each": {
				_default: { $2: "$index, $value" },
				open: "if($notnull_1){$.each($1a,function($2){with(this){",
				close: "}});}"
			},
			"if": {
				open: "if(($notnull_1) && $1a){",
				close: "}"
			},
			"else": {
				_default: { $1: "true" },
				open: "}else if(($notnull_1) && $1a){"
			},
			"html": {
				// Unecoded expression evaluation.
				open: "if($notnull_1){__.push($1a);}"
			},
			"=": {
				// Encoded expression evaluation. Abbreviated form is ${}.
				_default: { $1: "$data" },
				open: "if($notnull_1){__.push($.encode($1a));}"
			},
			"!": {
				// Comment tag. Skipped by parser
				open: ""
			}
		},

		// This stub can be overridden, e.g. in jquery.tmplPlus for providing rendered events
		complete: function( items ) {
			newTmplItems = {};
		},

		// Call this from code which overrides domManip, or equivalent
		// Manage cloning/storing template items etc.
		afterManip: function afterManip( elem, fragClone, callback ) {
			// Provides cloned fragment ready for fixup prior to and after insertion into DOM
			var content = fragClone.nodeType === 11 ?
				jQuery.makeArray(fragClone.childNodes) :
				fragClone.nodeType === 1 ? [fragClone] : [];

			// Return fragment to original caller (e.g. append) for DOM insertion
			callback.call( elem, fragClone );

			// Fragment has been inserted:- Add inserted nodes to tmplItem data structure. Replace inserted element annotations by jQuery.data.
			storeTmplItems( content );
			cloneIndex++;
		}
	});

	//========================== Private helper functions, used by code above ==========================

	function build( tmplItem, nested, content ) {
		// Convert hierarchical content into flat string array
		// and finally return array of fragments ready for DOM insertion
		var frag, ret = content ? jQuery.map( content, function( item ) {
			return (typeof item === "string") ?
				// Insert template item annotations, to be converted to jQuery.data( "tmplItem" ) when elems are inserted into DOM.
				(tmplItem.key ? item.replace( /(<\w+)(?=[\s>])(?![^>]*_tmplitem)([^>]*)/g, "$1 " + tmplItmAtt + "=\"" + tmplItem.key + "\" $2" ) : item) :
				// This is a child template item. Build nested template.
				build( item, tmplItem, item._ctnt );
		}) :
		// If content is not defined, insert tmplItem directly. Not a template item. May be a string, or a string array, e.g. from {{html $item.html()}}.
		tmplItem;
		if ( nested ) {
			return ret;
		}

		// top-level template
		ret = ret.join("");

		// Support templates which have initial or final text nodes, or consist only of text
		// Also support HTML entities within the HTML markup.
		ret.replace( /^\s*([^<\s][^<]*)?(<[\w\W]+>)([^>]*[^>\s])?\s*$/, function( all, before, middle, after) {
			frag = jQuery( middle ).get();

			storeTmplItems( frag );
			if ( before ) {
				frag = unencode( before ).concat(frag);
			}
			if ( after ) {
				frag = frag.concat(unencode( after ));
			}
		});
		return frag ? frag : unencode( ret );
	}

	function unencode( text ) {
		// Use createElement, since createTextNode will not render HTML entities correctly
		var el = document.createElement( "div" );
		el.innerHTML = text;
		return jQuery.makeArray(el.childNodes);
	}

	// Generate a reusable function that will serve to render a template against data
	function buildTmplFn( markup ) {
		return new Function("jQuery","$item",
			// Use the variable __ to hold a string array while building the compiled template. (See https://github.com/jquery/jquery-tmpl/issues#issue/10).
			"var $=jQuery,call,__=[],$data=$item.data;" +

			// Introduce the data as local variables using with(){}
			"with($data){__.push('" +

			// Convert the template into pure JavaScript
			jQuery.trim(markup)
				.replace( /([\\'])/g, "\\$1" )
				.replace( /[\r\t\n]/g, " " )
				.replace( /\$\{([^\}]*)\}/g, "{{= $1}}" )
				.replace( /\{\{(\/?)(\w+|.)(?:\(((?:[^\}]|\}(?!\}))*?)?\))?(?:\s+(.*?)?)?(\(((?:[^\}]|\}(?!\}))*?)\))?\s*\}\}/g,
				function( all, slash, type, fnargs, target, parens, args ) {
					var tag = jQuery.tmpl.tag[ type ], def, expr, exprAutoFnDetect;
					if ( !tag ) {
						throw "Unknown template tag: " + type;
					}
					def = tag._default || [];
					if ( parens && !/\w$/.test(target)) {
						target += parens;
						parens = "";
					}
					if ( target ) {
						target = unescape( target );
						args = args ? ("," + unescape( args ) + ")") : (parens ? ")" : "");
						// Support for target being things like a.toLowerCase();
						// In that case don't call with template item as 'this' pointer. Just evaluate...
						expr = parens ? (target.indexOf(".") > -1 ? target + unescape( parens ) : ("(" + target + ").call($item" + args)) : target;
						exprAutoFnDetect = parens ? expr : "(typeof(" + target + ")==='function'?(" + target + ").call($item):(" + target + "))";
					} else {
						exprAutoFnDetect = expr = def.$1 || "null";
					}
					fnargs = unescape( fnargs );
					return "');" +
						tag[ slash ? "close" : "open" ]
							.split( "$notnull_1" ).join( target ? "typeof(" + target + ")!=='undefined' && (" + target + ")!=null" : "true" )
							.split( "$1a" ).join( exprAutoFnDetect )
							.split( "$1" ).join( expr )
							.split( "$2" ).join( fnargs || def.$2 || "" ) +
						"__.push('";
				}) +
			"');}return __;"
		);
	}
	function updateWrapped( options, wrapped ) {
		// Build the wrapped content.
		options._wrap = build( options, true,
			// Suport imperative scenario in which options.wrapped can be set to a selector or an HTML string.
			jQuery.isArray( wrapped ) ? wrapped : [htmlExpr.test( wrapped ) ? wrapped : jQuery( wrapped ).html()]
		).join("");
	}

	function unescape( args ) {
		return args ? args.replace( /\\'/g, "'").replace(/\\\\/g, "\\" ) : null;
	}
	function outerHtml( elem ) {
		var div = document.createElement("div");
		div.appendChild( elem.cloneNode(true) );
		return div.innerHTML;
	}

	// Store template items in jQuery.data(), ensuring a unique tmplItem data data structure for each rendered template instance.
	function storeTmplItems( content ) {
		var keySuffix = "_" + cloneIndex, elem, elems, newClonedItems = {}, i, l, m;
		for ( i = 0, l = content.length; i < l; i++ ) {
			if ( (elem = content[i]).nodeType !== 1 ) {
				continue;
			}
			elems = elem.getElementsByTagName("*");
			for ( m = elems.length - 1; m >= 0; m-- ) {
				processItemKey( elems[m] );
			}
			processItemKey( elem );
		}
		function processItemKey( el ) {
			var pntKey, pntNode = el, pntItem, tmplItem, key;
			// Ensure that each rendered template inserted into the DOM has its own template item,
			if ( (key = el.getAttribute( tmplItmAtt ))) {
				while ( pntNode.parentNode && (pntNode = pntNode.parentNode).nodeType === 1 && !(pntKey = pntNode.getAttribute( tmplItmAtt ))) { }
				if ( pntKey !== key ) {
					// The next ancestor with a _tmplitem expando is on a different key than this one.
					// So this is a top-level element within this template item
					// Set pntNode to the key of the parentNode, or to 0 if pntNode.parentNode is null, or pntNode is a fragment.
					pntNode = pntNode.parentNode ? (pntNode.nodeType === 11 ? 0 : (pntNode.getAttribute( tmplItmAtt ) || 0)) : 0;
					if ( !(tmplItem = newTmplItems[key]) ) {
						// The item is for wrapped content, and was copied from the temporary parent wrappedItem.
						tmplItem = wrappedItems[key];
						tmplItem = newTmplItem( tmplItem, newTmplItems[pntNode]||wrappedItems[pntNode] );
						tmplItem.key = ++itemKey;
						newTmplItems[itemKey] = tmplItem;
					}
					if ( cloneIndex ) {
						cloneTmplItem( key );
					}
				}
				el.removeAttribute( tmplItmAtt );
			} else if ( cloneIndex && (tmplItem = jQuery.data( el, "tmplItem" )) ) {
				// This was a rendered element, cloned during append or appendTo etc.
				// TmplItem stored in jQuery data has already been cloned in cloneCopyEvent. We must replace it with a fresh cloned tmplItem.
				cloneTmplItem( tmplItem.key );
				newTmplItems[tmplItem.key] = tmplItem;
				pntNode = jQuery.data( el.parentNode, "tmplItem" );
				pntNode = pntNode ? pntNode.key : 0;
			}
			if ( tmplItem ) {
				pntItem = tmplItem;
				// Find the template item of the parent element.
				// (Using !=, not !==, since pntItem.key is number, and pntNode may be a string)
				while ( pntItem && pntItem.key != pntNode ) {
					// Add this element as a top-level node for this rendered template item, as well as for any
					// ancestor items between this item and the item of its parent element
					pntItem.nodes.push( el );
					pntItem = pntItem.parent;
				}
				// Delete content built during rendering - reduce API surface area and memory use, and avoid exposing of stale data after rendering...
				delete tmplItem._ctnt;
				delete tmplItem._wrap;
				// Store template item as jQuery data on the element
				jQuery.data( el, "tmplItem", tmplItem );
			}
			function cloneTmplItem( key ) {
				key = key + keySuffix;
				tmplItem = newClonedItems[key] =
					(newClonedItems[key] || newTmplItem( tmplItem, newTmplItems[tmplItem.parent.key + keySuffix] || tmplItem.parent ));
			}
		}
	}

	//---- Helper functions for template item ----

	function tiCalls( content, tmpl, data, options ) {
		if ( !content ) {
			return stack.pop();
		}
		stack.push({ _: content, tmpl: tmpl, item:this, data: data, options: options });
	}

	function tiNest( tmpl, data, options ) {
		// nested template, using {{tmpl}} tag
		return jQuery.tmpl( jQuery.template( tmpl ), data, options, this );
	}

	function tiWrap( call, wrapped ) {
		// nested template, using {{wrap}} tag
		var options = call.options || {};
		options.wrapped = wrapped;
		// Apply the template, which may incorporate wrapped content,
		return jQuery.tmpl( jQuery.template( call.tmpl ), call.data, options, call.item );
	}

	function tiHtml( filter, textOnly ) {
		var wrapped = this._wrap;
		return jQuery.map(
			jQuery( jQuery.isArray( wrapped ) ? wrapped.join("") : wrapped ).filter( filter || "*" ),
			function(e) {
				return textOnly ?
					e.innerText || e.textContent :
					e.outerHTML || outerHtml(e);
			});
	}

	function tiUpdate() {
		var coll = this.nodes;
		jQuery.tmpl( null, null, null, this).insertBefore( coll[0] );
		jQuery( coll ).remove();
	}
})( jQuery );
/*
 * jQuery JSON Plugin
 * version: 2.1 (2009-08-14)
 *
 * This document is licensed as free software under the terms of the
 * MIT License: http://www.opensource.org/licenses/mit-license.php
 *
 * Brantley Harris wrote this plugin. It is based somewhat on the JSON.org 
 * website's http://www.json.org/json2.js, which proclaims:
 * "NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.", a sentiment that
 * I uphold.
 *
 * It is also influenced heavily by MochiKit's serializeJSON, which is 
 * copyrighted 2005 by Bob Ippolito.
 */
 
(function($) {
    /** jQuery.toJSON( json-serializble )
        Converts the given argument into a JSON respresentation.

        If an object has a "toJSON" function, that will be used to get the representation.
        Non-integer/string keys are skipped in the object, as are keys that point to a function.

        json-serializble:
            The *thing* to be converted.
     **/
    $.toJSON = function(o)
    {
        if (typeof(JSON) == 'object' && JSON.stringify)
            return JSON.stringify(o);
        
        var type = typeof(o);
    
        if (o === null)
            return "null";
    
        if (type == "undefined")
            return undefined;
        
        if (type == "number" || type == "boolean")
            return o + "";
    
        if (type == "string")
            return $.quoteString(o);
    
        if (type == 'object')
        {
            if (typeof o.toJSON == "function") 
                return $.toJSON( o.toJSON() );
            
            if (o.constructor === Date)
            {
                var month = o.getUTCMonth() + 1;
                if (month < 10) month = '0' + month;

                var day = o.getUTCDate();
                if (day < 10) day = '0' + day;

                var year = o.getUTCFullYear();
                
                var hours = o.getUTCHours();
                if (hours < 10) hours = '0' + hours;
                
                var minutes = o.getUTCMinutes();
                if (minutes < 10) minutes = '0' + minutes;
                
                var seconds = o.getUTCSeconds();
                if (seconds < 10) seconds = '0' + seconds;
                
                var milli = o.getUTCMilliseconds();
                if (milli < 100) milli = '0' + milli;
                if (milli < 10) milli = '0' + milli;

                return '"' + year + '-' + month + '-' + day + 'T' +
                             hours + ':' + minutes + ':' + seconds + 
                             '.' + milli + 'Z"'; 
            }

            if (o.constructor === Array) 
            {
                var ret = [];
                for (var i = 0; i < o.length; i++)
                    ret.push( $.toJSON(o[i]) || "null" );

                return "[" + ret.join(",") + "]";
            }
        
            var pairs = [];
            for (var k in o) {
                var name;
                var type = typeof k;

                if (type == "number")
                    name = '"' + k + '"';
                else if (type == "string")
                    name = $.quoteString(k);
                else
                    continue;  //skip non-string or number keys
            
                if (typeof o[k] == "function") 
                    continue;  //skip pairs where the value is a function.
            
                var val = $.toJSON(o[k]);
            
                pairs.push(name + ":" + val);
            }

            return "{" + pairs.join(", ") + "}";
        }
    };

    /** jQuery.evalJSON(src)
        Evaluates a given piece of json source.
     **/
    $.evalJSON = function(src)
    {
        if (typeof(JSON) == 'object' && JSON.parse)
            return JSON.parse(src);
        return eval("(" + src + ")");
    };
    
    /** jQuery.secureEvalJSON(src)
        Evals JSON in a way that is *more* secure.
    **/
    $.secureEvalJSON = function(src)
    {
        if (typeof(JSON) == 'object' && JSON.parse)
            return JSON.parse(src);
        
        var filtered = src;
        filtered = filtered.replace(/\\["\\\/bfnrtu]/g, '@');
        filtered = filtered.replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']');
        filtered = filtered.replace(/(?:^|:|,)(?:\s*\[)+/g, '');
        
        if (/^[\],:{}\s]*$/.test(filtered))
            return eval("(" + src + ")");
        else
            throw new SyntaxError("Error parsing JSON, source is not valid.");
    };

    /** jQuery.quoteString(string)
        Returns a string-repr of a string, escaping quotes intelligently.  
        Mostly a support function for toJSON.
    
        Examples:
            >>> jQuery.quoteString("apple")
            "apple"
        
            >>> jQuery.quoteString('"Where are we going?", she asked.')
            "\"Where are we going?\", she asked."
     **/
    $.quoteString = function(string)
    {
        if (string.match(_escapeable))
        {
            return '"' + string.replace(_escapeable, function (a) 
            {
                var c = _meta[a];
                if (typeof c === 'string') return c;
                c = a.charCodeAt();
                return '\\u00' + Math.floor(c / 16).toString(16) + (c % 16).toString(16);
            }) + '"';
        }
        return '"' + string + '"';
    };
    
    var _escapeable = /["\\\x00-\x1f\x7f-\x9f]/g;
    
    var _meta = {
        '\b': '\\b',
        '\t': '\\t',
        '\n': '\\n',
        '\f': '\\f',
        '\r': '\\r',
        '"' : '\\"',
        '\\': '\\\\'
    };
})(jQuery);
/*
 * ----------------------------- JSTORAGE -------------------------------------
 * Simple local storage wrapper to save data on the browser side, supporting
 * all major browsers - IE6+, Firefox2+, Safari4+, Chrome4+ and Opera 10.5+
 *
 * Copyright (c) 2010 Andris Reinman, andris.reinman@gmail.com
 * Project homepage: www.jstorage.info
 *
 * Licensed under MIT-style license:
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * $.jStorage
 * 
 * USAGE:
 *
 * jStorage requires Prototype, MooTools or jQuery! If jQuery is used, then
 * jQuery-JSON (http://code.google.com/p/jquery-json/) is also needed.
 * (jQuery-JSON needs to be loaded BEFORE jStorage!)
 *
 * Methods:
 *
 * -set(key, value)
 * $.jStorage.set(key, value) -> saves a value
 *
 * -get(key[, default])
 * value = $.jStorage.get(key [, default]) ->
 *    retrieves value if key exists, or default if it doesn't
 *
 * -deleteKey(key)
 * $.jStorage.deleteKey(key) -> removes a key from the storage
 *
 * -flush()
 * $.jStorage.flush() -> clears the cache
 * 
 * -storageObj()
 * $.jStorage.storageObj() -> returns a read-ony copy of the actual storage
 * 
 * -storageSize()
 * $.jStorage.storageSize() -> returns the size of the storage in bytes
 *
 * -index()
 * $.jStorage.index() -> returns the used keys as an array
 * 
 * -storageAvailable()
 * $.jStorage.storageAvailable() -> returns true if storage is available
 * 
 * -reInit()
 * $.jStorage.reInit() -> reloads the data from browser storage
 * 
 * <value> can be any JSON-able value, including objects and arrays.
 *
 **/

(function($){
    if(!$ || !($.toJSON || Object.toJSON || window.JSON)){
        throw new Error("jQuery, MooTools or Prototype needs to be loaded before jStorage!");
    }
    
    var
        /* This is the object, that holds the cached values */ 
        _storage = {},

        /* Actual browser storage (localStorage or globalStorage['domain']) */
        _storage_service = {jStorage:"{}"},

        /* DOM element for older IE versions, holds userData behavior */
        _storage_elm = null,
        
        /* How much space does the storage take */
        _storage_size = 0,

        /* function to encode objects to JSON strings */
        json_encode = $.toJSON || Object.toJSON || (window.JSON && (JSON.encode || JSON.stringify)),

        /* function to decode objects from JSON strings */
        json_decode = $.evalJSON || (window.JSON && (JSON.decode || JSON.parse)) || function(str){
            return String(str).evalJSON();
        },
        
        /* which backend is currently used */
        _backend = false;
        
        /**
         * XML encoding and decoding as XML nodes can't be JSON'ized
         * XML nodes are encoded and decoded if the node is the value to be saved
         * but not if it's as a property of another object
         * Eg. -
         *   $.jStorage.set("key", xmlNode);        // IS OK
         *   $.jStorage.set("key", {xml: xmlNode}); // NOT OK
         */
        _XMLService = {
            
            /**
             * Validates a XML node to be XML
             * based on jQuery.isXML function
             */
            isXML: function(elm){
                var documentElement = (elm ? elm.ownerDocument || elm : 0).documentElement;
                return documentElement ? documentElement.nodeName !== "HTML" : false;
            },
            
            /**
             * Encodes a XML node to string
             * based on http://www.mercurytide.co.uk/news/article/issues-when-working-ajax/
             */
            encode: function(xmlNode) {
                if(!this.isXML(xmlNode)){
                    return false;
                }
                try{ // Mozilla, Webkit, Opera
                    return new XMLSerializer().serializeToString(xmlNode);
                }catch(E1) {
                    try {  // IE
                        return xmlNode.xml;
                    }catch(E2){}
                }
                return false;
            },
            
            /**
             * Decodes a XML node from string
             * loosely based on http://outwestmedia.com/jquery-plugins/xmldom/
             */
            decode: function(xmlString){
                var dom_parser = ("DOMParser" in window && (new DOMParser()).parseFromString) ||
                        (window.ActiveXObject && function(_xmlString) {
                    var xml_doc = new ActiveXObject('Microsoft.XMLDOM');
                    xml_doc.async = 'false';
                    xml_doc.loadXML(_xmlString);
                    return xml_doc;
                }),
                resultXML;
                if(!dom_parser){
                    return false;
                }
                resultXML = dom_parser.call("DOMParser" in window && (new DOMParser()) || window, xmlString, 'text/xml');
                return this.isXML(resultXML)?resultXML:false;
            }
        };

    ////////////////////////// PRIVATE METHODS ////////////////////////

    /**
     * Initialization function. Detects if the browser supports DOM Storage
     * or userData behavior and behaves accordingly.
     * @returns undefined
     */
    function _init(){
        /* Check if browser supports localStorage */
        if("localStorage" in window){
            try {
                if(window.localStorage) {
                    _storage_service = window.localStorage;
                    _backend = "localStorage";
                }
            } catch(E3) {/* Firefox fails when touching localStorage and cookies are disabled */}
        }
        /* Check if browser supports globalStorage */
        else if("globalStorage" in window){
            try {
                if(window.globalStorage) {
                    _storage_service = window.globalStorage[window.location.hostname];
                    _backend = "globalStorage";
                }
            } catch(E4) {/* Firefox fails when touching localStorage and cookies are disabled */}
        }
        /* Check if browser supports userData behavior */
        else {
            _storage_elm = document.createElement('link');
            if(_storage_elm.addBehavior){

                /* Use a DOM element to act as userData storage */
                _storage_elm.style.behavior = 'url(#default#userData)';

                /* userData element needs to be inserted into the DOM! */
                document.getElementsByTagName('head')[0].appendChild(_storage_elm);

                _storage_elm.load("jStorage");
                var data = "{}";
                try{
                    data = _storage_elm.getAttribute("jStorage");
                }catch(E5){}
                _storage_service.jStorage = data;
                _backend = "userDataBehavior";
            }else{
                _storage_elm = null;
                return;
            }
        }

        _load_storage();
    }
    
    /**
     * Loads the data from the storage based on the supported mechanism
     * @returns undefined
     */
    function _load_storage(){
        /* if jStorage string is retrieved, then decode it */
        if(_storage_service.jStorage){
            try{
                _storage = json_decode(String(_storage_service.jStorage));
            }catch(E6){_storage_service.jStorage = "{}";}
        }else{
            _storage_service.jStorage = "{}";
        }
        _storage_size = _storage_service.jStorage?String(_storage_service.jStorage).length:0;    
    }

    /**
     * This functions provides the "save" mechanism to store the jStorage object
     * @returns undefined
     */
    function _save(){
        try{
            _storage_service.jStorage = json_encode(_storage);
            // If userData is used as the storage engine, additional
            if(_storage_elm) {
                _storage_elm.setAttribute("jStorage",_storage_service.jStorage);
                _storage_elm.save("jStorage");
            }
            _storage_size = _storage_service.jStorage?String(_storage_service.jStorage).length:0;
        }catch(E7){/* probably cache is full, nothing is saved this way*/}
    }

    /**
     * Function checks if a key is set and is string or numberic
     */
    function _checkKey(key){
        if(!key || (typeof key != "string" && typeof key != "number")){
            throw new TypeError('Key name must be string or numeric');
        }
        return true;
    }

    ////////////////////////// PUBLIC INTERFACE /////////////////////////

    $.jStorage = {
        /* Version number */
        version: "0.1.5.2",

        /**
         * Sets a key's value.
         * 
         * @param {String} key - Key to set. If this value is not set or not
         *              a string an exception is raised.
         * @param value - Value to set. This can be any value that is JSON
         *              compatible (Numbers, Strings, Objects etc.).
         * @returns the used value
         */
        set: function(key, value){
            _checkKey(key);
            if(_XMLService.isXML(value)){
                value = {_is_xml:true,xml:_XMLService.encode(value)};
            }
            _storage[key] = value;
            _save();
            return value;
        },
        
        /**
         * Looks up a key in cache
         * 
         * @param {String} key - Key to look up.
         * @param {mixed} def - Default value to return, if key didn't exist.
         * @returns the key value, default value or <null>
         */
        get: function(key, def){
            _checkKey(key);
            if(key in _storage){
                if(_storage[key] && typeof _storage[key] == "object" &&
                        _storage[key]._is_xml &&
                            _storage[key]._is_xml){
                    return _XMLService.decode(_storage[key].xml);
                }else{
                    return _storage[key];
                }
            }
            return typeof(def) == 'undefined' ? null : def;
        },
        
        /**
         * Deletes a key from cache.
         * 
         * @param {String} key - Key to delete.
         * @returns true if key existed or false if it didn't
         */
        deleteKey: function(key){
            _checkKey(key);
            if(key in _storage){
                delete _storage[key];
                _save();
                return true;
            }
            return false;
        },

        /**
         * Deletes everything in cache.
         * 
         * @returns true
         */
        flush: function(){
            _storage = {};
            _save();
            return true;
        },
        
        /**
         * Returns a read-only copy of _storage
         * 
         * @returns Object
        */
        storageObj: function(){
            function F() {}
            F.prototype = _storage;
            return new F();
        },
        
        /**
         * Returns an index of all used keys as an array
         * ['key1', 'key2',..'keyN']
         * 
         * @returns Array
        */
        index: function(){
            var index = [], i;
            for(i in _storage){
                if(_storage.hasOwnProperty(i)){
                    index.push(i);
                }
            }
            return index;
        },
        
        /**
         * How much space in bytes does the storage take?
         * 
         * @returns Number
         */
        storageSize: function(){
            return _storage_size;
        },
        
        /**
         * Which backend is currently in use?
         * 
         * @returns String
         */
        currentBackend: function(){
            return _backend;
        },
        
        /**
         * Test if storage is available
         * 
         * @returns Boolean
         */
        storageAvailable: function(){
            return !!_backend;
        },
        
        /**
         * Reloads the data from browser storage
         * 
         * @returns undefined
         */
        reInit: function(){
            var new_storage_elm, data;
            if(_storage_elm && _storage_elm.addBehavior){
                new_storage_elm = document.createElement('link');
                
                _storage_elm.parentNode.replaceChild(new_storage_elm, _storage_elm);
                _storage_elm = new_storage_elm;
                
                /* Use a DOM element to act as userData storage */
                _storage_elm.style.behavior = 'url(#default#userData)';

                /* userData element needs to be inserted into the DOM! */
                document.getElementsByTagName('head')[0].appendChild(_storage_elm);

                _storage_elm.load("jStorage");
                data = "{}";
                try{
                    data = _storage_elm.getAttribute("jStorage");
                }catch(E5){}
                _storage_service.jStorage = data;
                _backend = "userDataBehavior";
            }
            
            _load_storage();
        }
    };

    // Initialize jStorage
    _init();

})(window.jQuery || window.$);/**
* hoverIntent is similar to jQuery's built-in "hover" function except that
* instead of firing the onMouseOver event immediately, hoverIntent checks
* to see if the user's mouse has slowed down (beneath the sensitivity
* threshold) before firing the onMouseOver event.
* 
* hoverIntent r6 // 2011.02.26 // jQuery 1.5.1+
* <http://cherne.net/brian/resources/jquery.hoverIntent.html>
* 
* hoverIntent is currently available for use in all personal or commercial 
* projects under both MIT and GPL licenses. This means that you can choose 
* the license that best suits your project, and use it accordingly.
* 
* // basic usage (just like .hover) receives onMouseOver and onMouseOut functions
* $("ul li").hoverIntent( showNav , hideNav );
* 
* // advanced usage receives configuration object only
* $("ul li").hoverIntent({
*	sensitivity:    7,          // number   = sensitivity threshold (>= 1)
*	interval:       100,        // number   = milliseconds of polling interval
*	timeout:        0,          // number   = milliseconds delay before
*	                            //            onMouseOut function call
*	over:           showNav,    // function = onMouseOver callback (required)
*	out:            hideNav     // function = onMouseOut callback (required)
* });
* 
* @param  over  onMouseOver function || An object with configuration options
* @param  out   onMouseOut function  || Nothing
*                                       (use configuration object)
*
* @author    Brian Cherne brian(at)cherne(dot)net
*/
(function($) {
	$.fn.hoverIntent = function(over,out) {
		// default configuration options
		var cfg = {
			sensitivity: 7,
			interval: 100,
			timeout: 0
		};
		// override configuration options with user supplied object
		cfg = $.extend(true, cfg, { over: over, out: (out ? out : over) });

		/* instantiate variables
         * cX, cY = current X and Y position of mouse, updated by mousemove
         *          event
         *
         * pX, pY = previous X and Y position of mouse, set by mouseover and
         *          polling interval
         */
		var cX, cY, pX, pY;

		// A private function for getting mouse position
		var track = function(ev) {
			cX = ev.pageX;
			cY = ev.pageY;
		};

		// A private function for comparing current and previous mouse position
		var compare = function(ev,ob) {
			ob.hoverIntent_t = clearTimeout(ob.hoverIntent_t);
			// compare mouse positions to see if they've crossed the threshold
			if ( ( Math.abs(pX-cX) + Math.abs(pY-cY) ) < cfg.sensitivity ) {
				$(ob).unbind("mousemove",track);
				// set hoverIntent state to true (so mouseOut can be called)
				ob.hoverIntent_s = 1;
				return cfg.over.apply(ob,[ev]);
			} else {
				// set previous coordinates for next time
				pX = cX; pY = cY;
                /* use self-calling timeout, guarantees intervals are spaced
                 * out properly (avoids JavaScript timer bugs)
                 */
				ob.hoverIntent_t = setTimeout( function(){compare(ev, ob);},
                                               cfg.interval );
			}
		};

		// A private function for delaying the mouseOut function
		var delay = function(ev,ob) {
			ob.hoverIntent_t = clearTimeout(ob.hoverIntent_t);
			ob.hoverIntent_s = 0;
			return cfg.out.apply(ob,[ev]);
		};

		// A private function for handling mouse 'hovering'
		var handleHover = function(e) {
            /* copy objects to be passed into t (required for event object to
             * be passed in IE)
             */
			var ev = jQuery.extend({},e);
			var ob = this;

			// cancel hoverIntent timer if it exists
			if (ob.hoverIntent_t) {
                ob.hoverIntent_t = clearTimeout(ob.hoverIntent_t);
            }

			// if e.type == "mouseenter"
			if (e.type == "mouseenter") {
				// set "previous" X and Y position based on initial entry point
				pX = ev.pageX; pY = ev.pageY;
				// update "current" X and Y position based on mousemove
				$(ob).bind("mousemove",track);
                /* start polling interval (self-calling timeout) to compare
                 * mouse coordinates over time
                 */
				if (ob.hoverIntent_s != 1) {
                    ob.hoverIntent_t = setTimeout( function(){compare(ev,ob);},
                                                   cfg.interval );
                }

			// else e.type == "mouseleave"
			} else {
				// unbind expensive mousemove event
				$(ob).unbind("mousemove",track);

                /* if hoverIntent state is true, then call the mouseOut
                 * function after the specified delay
                 */
				if (ob.hoverIntent_s == 1) {
                    ob.hoverIntent_t = setTimeout( function(){delay(ev,ob);},
                                                   cfg.timeout );
                }
			}
		};

		// bind the function to the two event listeners
		return this.bind('mouseenter.hoverIntent',handleHover)
                   .bind('mouseleave.hoverIntent',handleHover);
	};

	$.fn.unhoverIntent = function() {
        return this.unbind('.hoverIntent');
    };

})(jQuery);
/** @file
 *
 *  A simple, hover intent delegate.
 *
 *  Requires:
 *      jquery.js
 */
(function($) {

/** @brief  Create a hoverIntent delegate for the source element.
 *  @param  sel     The selection to use for the delegate;
 *  @param  cb      If provided, the callback to invoke on hover in/out;
 *
 *  Triggers an event of type 'hover-in' or 'hover-out' on the source element.
 *
 *  If the callback is provided, will also provide a proxy for the 'hover-in'
 *  and 'hover-out' events and pass them directly to the callback.
 */
$.fn.delegateHoverIntent = function(sel, cb) {
    var $self   = this;

    // Set up the mouseenter/leave delegate
    $self.delegate(sel, 'mouseenter mouseleave', function(e) {
        var $el     = $(this);
        var timer   = $el.data('hoverIntentTimer');
        var hoverE  = $.Event( e ); // Make the originalEvent available

        //console.log('delegateHoverIntent mouse: '+ e.type);

        if (e.type === 'mouseleave')
        {
            // event: mouseleave
            if (timer)
            {
                // Just cancel the pending change
                /*
                console.log('delegateHoverIntent mouse: '+ e.type
                            +' -- cancel timer');
                // */

                clearTimeout(timer);
                return;
            }


            /*
            console.log('delegateHoverIntent mouse: '+ e.type
                        +' -- trigger "hover-out"');
            // */
            hoverE.type = 'hover-out';
            $el.trigger( hoverE );

            return;
        }

        /*
        console.log('delegateHoverIntent mouse: '+ e.type
                    + ' -- set timer...');
        // */

        // event: mouseenter
        timer = setTimeout(function() {
            $el.removeData('hoverIntentTimer');

            /*
            console.log('delegateHoverIntent mouse: '+ e.type
                        +' -- trigger "hover-in"');
            // */

            hoverE.type = 'hover-in';
            $el.trigger( hoverE );
        }, 250);
        $el.data('hoverIntentTimer', timer);
    });

    if (cb)
    {
        /* Set up a 'hover-in'/'hover-out' delegate to invoke the provide
         * callback.
         */
        $self.delegate(sel, 'hover-in hover-out', function(e) {
            cb.call(this, e);
        });
    }
};

/** @brief  Remove a hoverIntent delegate for the source element.
 *  @param  sel     The selection to use for the delegate;
 */
$.fn.undelegateHoverIntent = function(sel) {
    var $self   = this;

    // Set up the mouseenter/leave delegate
    $self.undelegate(sel, 'mouseenter mouseleave');
    $self.undelegate(sel, 'hover-in hover-out');
};


}(jQuery));
/** @file
 *
 *  A jQuery class/object representing a uniquely identifiable user.
 *
 *  Requires:
 *      jquery.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global jQuery:false */
(function($) {

/** @brief  A single, uniquely identifiable user.
 *  @param  props   The properties of this user:
 *                      id:         The Unique ID of the user;
 *                      name:       The user name;
 *                      fullName:   The user's full name;
 *                      avatarUrl:  The URL to the user's avatar image;
 */
$.User  = function(props) {
    var defaults    = {
        id:         null,
        name:       'anonymous',
        fullName:   'Anonymous',
        avatarUrl:  'images/avatar.jpg'
    };

    return this.init( $.extend(defaults, true, props || {}) );
};

$.User.prototype = {
    /** @brief  Initialize a new User instance.
     *  @param  props   The properties of this note:
     *                      id:         The Unique ID of the user;
     *                      name:       The user name;
     *                      fullName:   The user's full name;
     */
    init: function(props) {
        this.props = props;

        return this;
    },

    getId:          function() { return this.props.id; },
    getName:        function() { return this.props.name; },
    getFullName:    function() { return this.props.fullName; },
    getAvatarUrl:   function() { return this.props.avatarUrl; },

    serialize: function() {
        return this.props;
    },

    destroy: function() {
        var self    = this;
        var props   = self.props;

        delete props.id;
        delete props.name;
        delete props.fullName;
    }
};

 }(jQuery));
/*!
 * jQuery UI 1.8.16
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI
 */
(function( $, undefined ) {

// prevent duplicate loading
// this is only a problem because we proxy existing functions
// and we don't want to double proxy them
$.ui = $.ui || {};
if ( $.ui.version ) {
	return;
}

$.extend( $.ui, {
	version: "1.8.16",

	keyCode: {
		ALT: 18,
		BACKSPACE: 8,
		CAPS_LOCK: 20,
		COMMA: 188,
		COMMAND: 91,
		COMMAND_LEFT: 91, // COMMAND
		COMMAND_RIGHT: 93,
		CONTROL: 17,
		DELETE: 46,
		DOWN: 40,
		END: 35,
		ENTER: 13,
		ESCAPE: 27,
		HOME: 36,
		INSERT: 45,
		LEFT: 37,
		MENU: 93, // COMMAND_RIGHT
		NUMPAD_ADD: 107,
		NUMPAD_DECIMAL: 110,
		NUMPAD_DIVIDE: 111,
		NUMPAD_ENTER: 108,
		NUMPAD_MULTIPLY: 106,
		NUMPAD_SUBTRACT: 109,
		PAGE_DOWN: 34,
		PAGE_UP: 33,
		PERIOD: 190,
		RIGHT: 39,
		SHIFT: 16,
		SPACE: 32,
		TAB: 9,
		UP: 38,
		WINDOWS: 91 // COMMAND
	}
});

// plugins
$.fn.extend({
	propAttr: $.fn.prop || $.fn.attr,

	_focus: $.fn.focus,
	focus: function( delay, fn ) {
		return typeof delay === "number" ?
			this.each(function() {
				var elem = this;
				setTimeout(function() {
					$( elem ).focus();
					if ( fn ) {
						fn.call( elem );
					}
				}, delay );
			}) :
			this._focus.apply( this, arguments );
	},

	scrollParent: function() {
		var scrollParent;
		if (($.browser.msie && (/(static|relative)/).test(this.css('position'))) || (/absolute/).test(this.css('position'))) {
			scrollParent = this.parents().filter(function() {
				return (/(relative|absolute|fixed)/).test($.curCSS(this,'position',1)) && (/(auto|scroll)/).test($.curCSS(this,'overflow',1)+$.curCSS(this,'overflow-y',1)+$.curCSS(this,'overflow-x',1));
			}).eq(0);
		} else {
			scrollParent = this.parents().filter(function() {
				return (/(auto|scroll)/).test($.curCSS(this,'overflow',1)+$.curCSS(this,'overflow-y',1)+$.curCSS(this,'overflow-x',1));
			}).eq(0);
		}

		return (/fixed/).test(this.css('position')) || !scrollParent.length ? $(document) : scrollParent;
	},

	zIndex: function( zIndex ) {
		if ( zIndex !== undefined ) {
			return this.css( "zIndex", zIndex );
		}

		if ( this.length ) {
			var elem = $( this[ 0 ] ), position, value;
			while ( elem.length && elem[ 0 ] !== document ) {
				// Ignore z-index if position is set to a value where z-index is ignored by the browser
				// This makes behavior of this function consistent across browsers
				// WebKit always returns auto if the element is positioned
				position = elem.css( "position" );
				if ( position === "absolute" || position === "relative" || position === "fixed" ) {
					// IE returns 0 when zIndex is not specified
					// other browsers return a string
					// we ignore the case of nested elements with an explicit value of 0
					// <div style="z-index: -10;"><div style="z-index: 0;"></div></div>
					value = parseInt( elem.css( "zIndex" ), 10 );
					if ( !isNaN( value ) && value !== 0 ) {
						return value;
					}
				}
				elem = elem.parent();
			}
		}

		return 0;
	},

	disableSelection: function() {
		return this.bind( ( $.support.selectstart ? "selectstart" : "mousedown" ) +
			".ui-disableSelection", function( event ) {
				event.preventDefault();
			});
	},

	enableSelection: function() {
		return this.unbind( ".ui-disableSelection" );
	}
});

$.each( [ "Width", "Height" ], function( i, name ) {
	var side = name === "Width" ? [ "Left", "Right" ] : [ "Top", "Bottom" ],
		type = name.toLowerCase(),
		orig = {
			innerWidth: $.fn.innerWidth,
			innerHeight: $.fn.innerHeight,
			outerWidth: $.fn.outerWidth,
			outerHeight: $.fn.outerHeight
		};

	function reduce( elem, size, border, margin ) {
		$.each( side, function() {
			size -= parseFloat( $.curCSS( elem, "padding" + this, true) ) || 0;
			if ( border ) {
				size -= parseFloat( $.curCSS( elem, "border" + this + "Width", true) ) || 0;
			}
			if ( margin ) {
				size -= parseFloat( $.curCSS( elem, "margin" + this, true) ) || 0;
			}
		});
		return size;
	}

	$.fn[ "inner" + name ] = function( size ) {
		if ( size === undefined ) {
			return orig[ "inner" + name ].call( this );
		}

		return this.each(function() {
			$( this ).css( type, reduce( this, size ) + "px" );
		});
	};

	$.fn[ "outer" + name] = function( size, margin ) {
		if ( typeof size !== "number" ) {
			return orig[ "outer" + name ].call( this, size );
		}

		return this.each(function() {
			$( this).css( type, reduce( this, size, true, margin ) + "px" );
		});
	};
});

// selectors
function focusable( element, isTabIndexNotNaN ) {
	var nodeName = element.nodeName.toLowerCase();
	if ( "area" === nodeName ) {
		var map = element.parentNode,
			mapName = map.name,
			img;
		if ( !element.href || !mapName || map.nodeName.toLowerCase() !== "map" ) {
			return false;
		}
		img = $( "img[usemap=#" + mapName + "]" )[0];
		return !!img && visible( img );
	}
	return ( /input|select|textarea|button|object/.test( nodeName )
		? !element.disabled
		: "a" == nodeName
			? element.href || isTabIndexNotNaN
			: isTabIndexNotNaN)
		// the element and all of its ancestors must be visible
		&& visible( element );
}

function visible( element ) {
	return !$( element ).parents().andSelf().filter(function() {
		return $.curCSS( this, "visibility" ) === "hidden" ||
			$.expr.filters.hidden( this );
	}).length;
}

$.extend( $.expr[ ":" ], {
	data: function( elem, i, match ) {
		return !!$.data( elem, match[ 3 ] );
	},

	focusable: function( element ) {
		return focusable( element, !isNaN( $.attr( element, "tabindex" ) ) );
	},

	tabbable: function( element ) {
		var tabIndex = $.attr( element, "tabindex" ),
			isTabIndexNaN = isNaN( tabIndex );
		return ( isTabIndexNaN || tabIndex >= 0 ) && focusable( element, !isTabIndexNaN );
	}
});

// support
$(function() {
	var body = document.body,
		div = body.appendChild( div = document.createElement( "div" ) );

	$.extend( div.style, {
		minHeight: "100px",
		height: "auto",
		padding: 0,
		borderWidth: 0
	});

	$.support.minHeight = div.offsetHeight === 100;
	$.support.selectstart = "onselectstart" in div;

	// set display to none to avoid a layout bug in IE
	// http://dev.jquery.com/ticket/4014
	body.removeChild( div ).style.display = "none";
});





// deprecated
$.extend( $.ui, {
	// $.ui.plugin is deprecated.  Use the proxy pattern instead.
	plugin: {
		add: function( module, option, set ) {
			var proto = $.ui[ module ].prototype;
			for ( var i in set ) {
				proto.plugins[ i ] = proto.plugins[ i ] || [];
				proto.plugins[ i ].push( [ option, set[ i ] ] );
			}
		},
		call: function( instance, name, args ) {
			var set = instance.plugins[ name ];
			if ( !set || !instance.element[ 0 ].parentNode ) {
				return;
			}
	
			for ( var i = 0; i < set.length; i++ ) {
				if ( instance.options[ set[ i ][ 0 ] ] ) {
					set[ i ][ 1 ].apply( instance.element, args );
				}
			}
		}
	},
	
	// will be deprecated when we switch to jQuery 1.4 - use jQuery.contains()
	contains: function( a, b ) {
		return document.compareDocumentPosition ?
			a.compareDocumentPosition( b ) & 16 :
			a !== b && a.contains( b );
	},
	
	// only used by resizable
	hasScroll: function( el, a ) {
	
		//If overflow is hidden, the element might have extra content, but the user wants to hide it
		if ( $( el ).css( "overflow" ) === "hidden") {
			return false;
		}
	
		var scroll = ( a && a === "left" ) ? "scrollLeft" : "scrollTop",
			has = false;
	
		if ( el[ scroll ] > 0 ) {
			return true;
		}
	
		// TODO: determine which cases actually cause this to happen
		// if the element doesn't have the scroll set, see if it's possible to
		// set the scroll
		el[ scroll ] = 1;
		has = ( el[ scroll ] > 0 );
		el[ scroll ] = 0;
		return has;
	},
	
	// these are odd functions, fix the API or move into individual plugins
	isOverAxis: function( x, reference, size ) {
		//Determines when x coordinate is over "b" element axis
		return ( x > reference ) && ( x < ( reference + size ) );
	},
	isOver: function( y, x, top, left, height, width ) {
		//Determines when x, y coordinates is over "b" element
		return $.ui.isOverAxis( y, top, height ) && $.ui.isOverAxis( x, left, width );
	}
});

})( jQuery );
/*!
 * jQuery UI Widget 1.8.16
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Widget
 */
(function( $, undefined ) {

// jQuery 1.4+
if ( $.cleanData ) {
	var _cleanData = $.cleanData;
	$.cleanData = function( elems ) {
		for ( var i = 0, elem; (elem = elems[i]) != null; i++ ) {
			try {
				$( elem ).triggerHandler( "remove" );
			// http://bugs.jquery.com/ticket/8235
			} catch( e ) {}
		}
		_cleanData( elems );
	};
} else {
	var _remove = $.fn.remove;
	$.fn.remove = function( selector, keepData ) {
		return this.each(function() {
			if ( !keepData ) {
				if ( !selector || $.filter( selector, [ this ] ).length ) {
					$( "*", this ).add( [ this ] ).each(function() {
						try {
							$( this ).triggerHandler( "remove" );
						// http://bugs.jquery.com/ticket/8235
						} catch( e ) {}
					});
				}
			}
			return _remove.call( $(this), selector, keepData );
		});
	};
}

$.widget = function( name, base, prototype ) {
	var namespace = name.split( "." )[ 0 ],
		fullName;
	name = name.split( "." )[ 1 ];
	fullName = namespace + "-" + name;

	if ( !prototype ) {
		prototype = base;
		base = $.Widget;
	}

	// create selector for plugin
	$.expr[ ":" ][ fullName ] = function( elem ) {
		return !!$.data( elem, name );
	};

	$[ namespace ] = $[ namespace ] || {};
	$[ namespace ][ name ] = function( options, element ) {
		// allow instantiation without initializing for simple inheritance
		if ( arguments.length ) {
			this._createWidget( options, element );
		}
	};

	var basePrototype = new base();
	// we need to make the options hash a property directly on the new instance
	// otherwise we'll modify the options hash on the prototype that we're
	// inheriting from
//	$.each( basePrototype, function( key, val ) {
//		if ( $.isPlainObject(val) ) {
//			basePrototype[ key ] = $.extend( {}, val );
//		}
//	});
	basePrototype.options = $.extend( true, {}, basePrototype.options );
	$[ namespace ][ name ].prototype = $.extend( true, basePrototype, {
		namespace: namespace,
		widgetName: name,
		widgetEventPrefix: $[ namespace ][ name ].prototype.widgetEventPrefix || name,
		widgetBaseClass: fullName
	}, prototype );

	$.widget.bridge( name, $[ namespace ][ name ] );
};

$.widget.bridge = function( name, object ) {
	$.fn[ name ] = function( options ) {
		var isMethodCall = typeof options === "string",
			args = Array.prototype.slice.call( arguments, 1 ),
			returnValue = this;

		// allow multiple hashes to be passed on init
		options = !isMethodCall && args.length ?
			$.extend.apply( null, [ true, options ].concat(args) ) :
			options;

		// prevent calls to internal methods
		if ( isMethodCall && options.charAt( 0 ) === "_" ) {
			return returnValue;
		}

		if ( isMethodCall ) {
			this.each(function() {
				var instance = $.data( this, name ),
					methodValue = instance && $.isFunction( instance[options] ) ?
						instance[ options ].apply( instance, args ) :
						instance;
				// TODO: add this back in 1.9 and use $.error() (see #5972)
//				if ( !instance ) {
//					throw "cannot call methods on " + name + " prior to initialization; " +
//						"attempted to call method '" + options + "'";
//				}
//				if ( !$.isFunction( instance[options] ) ) {
//					throw "no such method '" + options + "' for " + name + " widget instance";
//				}
//				var methodValue = instance[ options ].apply( instance, args );
				if ( methodValue !== instance && methodValue !== undefined ) {
					returnValue = methodValue;
					return false;
				}
			});
		} else {
			this.each(function() {
				var instance = $.data( this, name );
				if ( instance ) {
					instance.option( options || {} )._init();
				} else {
					$.data( this, name, new object( options, this ) );
				}
			});
		}

		return returnValue;
	};
};

$.Widget = function( options, element ) {
	// allow instantiation without initializing for simple inheritance
	if ( arguments.length ) {
		this._createWidget( options, element );
	}
};

$.Widget.prototype = {
	widgetName: "widget",
	widgetEventPrefix: "",
	options: {
		disabled: false
	},
	_createWidget: function( options, element ) {
		// $.widget.bridge stores the plugin instance, but we do it anyway
		// so that it's stored even before the _create function runs
		$.data( element, this.widgetName, this );
		this.element = $( element );
		this.options = $.extend( true, {},
			this.options,
			this._getCreateOptions(),
			options );

		var self = this;
		this.element.bind( "remove." + this.widgetName, function() {
			self.destroy();
		});

		this._create();
		this._trigger( "create" );
		this._init();
	},
	_getCreateOptions: function() {
		return $.metadata && $.metadata.get( this.element[0] )[ this.widgetName ];
	},
	_create: function() {},
	_init: function() {},

	destroy: function() {
		this.element
			.unbind( "." + this.widgetName )
			.removeData( this.widgetName );
		this.widget()
			.unbind( "." + this.widgetName )
			.removeAttr( "aria-disabled" )
			.removeClass(
				this.widgetBaseClass + "-disabled " +
				"ui-state-disabled" );
	},

	widget: function() {
		return this.element;
	},

	option: function( key, value ) {
		var options = key;

		if ( arguments.length === 0 ) {
			// don't return a reference to the internal hash
			return $.extend( {}, this.options );
		}

		if  (typeof key === "string" ) {
			if ( value === undefined ) {
				return this.options[ key ];
			}
			options = {};
			options[ key ] = value;
		}

		this._setOptions( options );

		return this;
	},
	_setOptions: function( options ) {
		var self = this;
		$.each( options, function( key, value ) {
			self._setOption( key, value );
		});

		return this;
	},
	_setOption: function( key, value ) {
		this.options[ key ] = value;

		if ( key === "disabled" ) {
			this.widget()
				[ value ? "addClass" : "removeClass"](
					this.widgetBaseClass + "-disabled" + " " +
					"ui-state-disabled" )
				.attr( "aria-disabled", value );
		}

		return this;
	},

	enable: function() {
		return this._setOption( "disabled", false );
	},
	disable: function() {
		return this._setOption( "disabled", true );
	},

	_trigger: function( type, event, data ) {
		var callback = this.options[ type ];

		event = $.Event( event );
		event.type = ( type === this.widgetEventPrefix ?
			type :
			this.widgetEventPrefix + type ).toLowerCase();
		data = data || {};

		// copy original event properties over to the new event
		// this would happen if we could call $.event.fix instead of $.Event
		// but we don't have a way to force an event to be fixed multiple times
		if ( event.originalEvent ) {
			for ( var i = $.event.props.length, prop; i; ) {
				prop = $.event.props[ --i ];
				event[ prop ] = event.originalEvent[ prop ];
			}
		}

		this.element.trigger( event, data );

		return !( $.isFunction(callback) &&
			callback.call( this.element[0], event, data ) === false ||
			event.isDefaultPrevented() );
	}
};

})( jQuery );
/*
 * jQuery UI Position 1.8.16
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Position
 */
(function( $, undefined ) {

$.ui = $.ui || {};

var horizontalPositions = /left|center|right/,
	verticalPositions = /top|center|bottom/,
	center = "center",
	_position = $.fn.position,
	_offset = $.fn.offset;

$.fn.position = function( options ) {
	if ( !options || !options.of ) {
		return _position.apply( this, arguments );
	}

	// make a copy, we don't want to modify arguments
	options = $.extend( {}, options );

	var target = $( options.of ),
		targetElem = target[0],
		collision = ( options.collision || "flip" ).split( " " ),
		offset = options.offset ? options.offset.split( " " ) : [ 0, 0 ],
		targetWidth,
		targetHeight,
		basePosition;

	if ( targetElem.nodeType === 9 ) {
		targetWidth = target.width();
		targetHeight = target.height();
		basePosition = { top: 0, left: 0 };
	// TODO: use $.isWindow() in 1.9
	} else if ( targetElem.setTimeout ) {
		targetWidth = target.width();
		targetHeight = target.height();
		basePosition = { top: target.scrollTop(), left: target.scrollLeft() };
	} else if ( targetElem.preventDefault ) {
		// force left top to allow flipping
		options.at = "left top";
		targetWidth = targetHeight = 0;
		basePosition = { top: options.of.pageY, left: options.of.pageX };
	} else {
		targetWidth = target.outerWidth();
		targetHeight = target.outerHeight();
		basePosition = target.offset();
	}

	// force my and at to have valid horizontal and veritcal positions
	// if a value is missing or invalid, it will be converted to center 
	$.each( [ "my", "at" ], function() {
		var pos = ( options[this] || "" ).split( " " );
		if ( pos.length === 1) {
			pos = horizontalPositions.test( pos[0] ) ?
				pos.concat( [center] ) :
				verticalPositions.test( pos[0] ) ?
					[ center ].concat( pos ) :
					[ center, center ];
		}
		pos[ 0 ] = horizontalPositions.test( pos[0] ) ? pos[ 0 ] : center;
		pos[ 1 ] = verticalPositions.test( pos[1] ) ? pos[ 1 ] : center;
		options[ this ] = pos;
	});

	// normalize collision option
	if ( collision.length === 1 ) {
		collision[ 1 ] = collision[ 0 ];
	}

	// normalize offset option
	offset[ 0 ] = parseInt( offset[0], 10 ) || 0;
	if ( offset.length === 1 ) {
		offset[ 1 ] = offset[ 0 ];
	}
	offset[ 1 ] = parseInt( offset[1], 10 ) || 0;

	if ( options.at[0] === "right" ) {
		basePosition.left += targetWidth;
	} else if ( options.at[0] === center ) {
		basePosition.left += targetWidth / 2;
	}

	if ( options.at[1] === "bottom" ) {
		basePosition.top += targetHeight;
	} else if ( options.at[1] === center ) {
		basePosition.top += targetHeight / 2;
	}

	basePosition.left += offset[ 0 ];
	basePosition.top += offset[ 1 ];

	return this.each(function() {
		var elem = $( this ),
			elemWidth = elem.outerWidth(),
			elemHeight = elem.outerHeight(),
			marginLeft = parseInt( $.curCSS( this, "marginLeft", true ) ) || 0,
			marginTop = parseInt( $.curCSS( this, "marginTop", true ) ) || 0,
			collisionWidth = elemWidth + marginLeft +
				( parseInt( $.curCSS( this, "marginRight", true ) ) || 0 ),
			collisionHeight = elemHeight + marginTop +
				( parseInt( $.curCSS( this, "marginBottom", true ) ) || 0 ),
			position = $.extend( {}, basePosition ),
			collisionPosition;

		if ( options.my[0] === "right" ) {
			position.left -= elemWidth;
		} else if ( options.my[0] === center ) {
			position.left -= elemWidth / 2;
		}

		if ( options.my[1] === "bottom" ) {
			position.top -= elemHeight;
		} else if ( options.my[1] === center ) {
			position.top -= elemHeight / 2;
		}

		// prevent fractions (see #5280)
		position.left = Math.round( position.left );
		position.top = Math.round( position.top );

		collisionPosition = {
			left: position.left - marginLeft,
			top: position.top - marginTop
		};

		$.each( [ "left", "top" ], function( i, dir ) {
			if ( $.ui.position[ collision[i] ] ) {
				$.ui.position[ collision[i] ][ dir ]( position, {
					targetWidth: targetWidth,
					targetHeight: targetHeight,
					elemWidth: elemWidth,
					elemHeight: elemHeight,
					collisionPosition: collisionPosition,
					collisionWidth: collisionWidth,
					collisionHeight: collisionHeight,
					offset: offset,
					my: options.my,
					at: options.at
				});
			}
		});

		if ( $.fn.bgiframe ) {
			elem.bgiframe();
		}
		elem.offset( $.extend( position, { using: options.using } ) );
	});
};

$.ui.position = {
	fit: {
		left: function( position, data ) {
			var win = $( window ),
				over = data.collisionPosition.left + data.collisionWidth - win.width() - win.scrollLeft();
			position.left = over > 0 ? position.left - over : Math.max( position.left - data.collisionPosition.left, position.left );
		},
		top: function( position, data ) {
			var win = $( window ),
				over = data.collisionPosition.top + data.collisionHeight - win.height() - win.scrollTop();
			position.top = over > 0 ? position.top - over : Math.max( position.top - data.collisionPosition.top, position.top );
		}
	},

	flip: {
		left: function( position, data ) {
			if ( data.at[0] === center ) {
				return;
			}
			var win = $( window ),
				over = data.collisionPosition.left + data.collisionWidth - win.width() - win.scrollLeft(),
				myOffset = data.my[ 0 ] === "left" ?
					-data.elemWidth :
					data.my[ 0 ] === "right" ?
						data.elemWidth :
						0,
				atOffset = data.at[ 0 ] === "left" ?
					data.targetWidth :
					-data.targetWidth,
				offset = -2 * data.offset[ 0 ];
			position.left += data.collisionPosition.left < 0 ?
				myOffset + atOffset + offset :
				over > 0 ?
					myOffset + atOffset + offset :
					0;
		},
		top: function( position, data ) {
			if ( data.at[1] === center ) {
				return;
			}
			var win = $( window ),
				over = data.collisionPosition.top + data.collisionHeight - win.height() - win.scrollTop(),
				myOffset = data.my[ 1 ] === "top" ?
					-data.elemHeight :
					data.my[ 1 ] === "bottom" ?
						data.elemHeight :
						0,
				atOffset = data.at[ 1 ] === "top" ?
					data.targetHeight :
					-data.targetHeight,
				offset = -2 * data.offset[ 1 ];
			position.top += data.collisionPosition.top < 0 ?
				myOffset + atOffset + offset :
				over > 0 ?
					myOffset + atOffset + offset :
					0;
		}
	}
};

// offset setter from jQuery 1.4
if ( !$.offset.setOffset ) {
	$.offset.setOffset = function( elem, options ) {
		// set position first, in-case top/left are set even on static elem
		if ( /static/.test( $.curCSS( elem, "position" ) ) ) {
			elem.style.position = "relative";
		}
		var curElem   = $( elem ),
			curOffset = curElem.offset(),
			curTop    = parseInt( $.curCSS( elem, "top",  true ), 10 ) || 0,
			curLeft   = parseInt( $.curCSS( elem, "left", true ), 10)  || 0,
			props     = {
				top:  (options.top  - curOffset.top)  + curTop,
				left: (options.left - curOffset.left) + curLeft
			};
		
		if ( 'using' in options ) {
			options.using.call( elem, props );
		} else {
			curElem.css( props );
		}
	};

	$.fn.offset = function( options ) {
		var elem = this[ 0 ];
		if ( !elem || !elem.ownerDocument ) { return null; }
		if ( options ) { 
			return this.each(function() {
				$.offset.setOffset( this, options );
			});
		}
		return _offset.call( this );
	};
}

}( jQuery ));
/*
 * jQuery UI Button 1.8.16
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Button
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.widget.js
 */
(function( $, undefined ) {

var lastActive, startXPos, startYPos, clickDragged,
	baseClasses = "ui-button ui-widget ui-state-default ui-corner-all",
	stateClasses = "ui-state-hover ui-state-active ",
	typeClasses = "ui-button-icons-only ui-button-icon-only ui-button-text-icons ui-button-text-icon-primary ui-button-text-icon-secondary ui-button-text-only",
	formResetHandler = function() {
		var buttons = $( this ).find( ":ui-button" );
		setTimeout(function() {
			buttons.button( "refresh" );
		}, 1 );
	},
	radioGroup = function( radio ) {
		var name = radio.name,
			form = radio.form,
			radios = $( [] );
		if ( name ) {
			if ( form ) {
				radios = $( form ).find( "[name='" + name + "']" );
			} else {
				radios = $( "[name='" + name + "']", radio.ownerDocument )
					.filter(function() {
						return !this.form;
					});
			}
		}
		return radios;
	};

$.widget( "ui.button", {
	options: {
		disabled: null,
		text: true,
		label: null,
		icons: {
			primary: null,
			secondary: null
		}
	},
	_create: function() {
		this.element.closest( "form" )
			.unbind( "reset.button" )
			.bind( "reset.button", formResetHandler );

		if ( typeof this.options.disabled !== "boolean" ) {
			this.options.disabled = this.element.propAttr( "disabled" );
		}

		this._determineButtonType();
		this.hasTitle = !!this.buttonElement.attr( "title" );

		var self = this,
			options = this.options,
			toggleButton = this.type === "checkbox" || this.type === "radio",
			hoverClass = "ui-state-hover" + ( !toggleButton ? " ui-state-active" : "" ),
			focusClass = "ui-state-focus";

		if ( options.label === null ) {
			options.label = this.buttonElement.html();
		}

		if ( this.element.is( ":disabled" ) ) {
			options.disabled = true;
		}

		this.buttonElement
			.addClass( baseClasses )
			.attr( "role", "button" )
			.bind( "mouseenter.button", function() {
				if ( options.disabled ) {
					return;
				}
				$( this ).addClass( "ui-state-hover" );
				if ( this === lastActive ) {
					$( this ).addClass( "ui-state-active" );
				}
			})
			.bind( "mouseleave.button", function() {
				if ( options.disabled ) {
					return;
				}
				$( this ).removeClass( hoverClass );
			})
			.bind( "click.button", function( event ) {
				if ( options.disabled ) {
					event.preventDefault();
					event.stopImmediatePropagation();
				}
			});

		this.element
			.bind( "focus.button", function() {
				// no need to check disabled, focus won't be triggered anyway
				self.buttonElement.addClass( focusClass );
			})
			.bind( "blur.button", function() {
				self.buttonElement.removeClass( focusClass );
			});

		if ( toggleButton ) {
			this.element.bind( "change.button", function() {
				if ( clickDragged ) {
					return;
				}
				self.refresh();
			});
			// if mouse moves between mousedown and mouseup (drag) set clickDragged flag
			// prevents issue where button state changes but checkbox/radio checked state
			// does not in Firefox (see ticket #6970)
			this.buttonElement
				.bind( "mousedown.button", function( event ) {
					if ( options.disabled ) {
						return;
					}
					clickDragged = false;
					startXPos = event.pageX;
					startYPos = event.pageY;
				})
				.bind( "mouseup.button", function( event ) {
					if ( options.disabled ) {
						return;
					}
					if ( startXPos !== event.pageX || startYPos !== event.pageY ) {
						clickDragged = true;
					}
			});
		}

		if ( this.type === "checkbox" ) {
			this.buttonElement.bind( "click.button", function() {
				if ( options.disabled || clickDragged ) {
					return false;
				}
				$( this ).toggleClass( "ui-state-active" );
				self.buttonElement.attr( "aria-pressed", self.element[0].checked );
			});
		} else if ( this.type === "radio" ) {
			this.buttonElement.bind( "click.button", function() {
				if ( options.disabled || clickDragged ) {
					return false;
				}
				$( this ).addClass( "ui-state-active" );
				self.buttonElement.attr( "aria-pressed", "true" );

				var radio = self.element[ 0 ];
				radioGroup( radio )
					.not( radio )
					.map(function() {
						return $( this ).button( "widget" )[ 0 ];
					})
					.removeClass( "ui-state-active" )
					.attr( "aria-pressed", "false" );
			});
		} else {
			this.buttonElement
				.bind( "mousedown.button", function() {
					if ( options.disabled ) {
						return false;
					}
					$( this ).addClass( "ui-state-active" );
					lastActive = this;
					$( document ).one( "mouseup", function() {
						lastActive = null;
					});
				})
				.bind( "mouseup.button", function() {
					if ( options.disabled ) {
						return false;
					}
					$( this ).removeClass( "ui-state-active" );
				})
				.bind( "keydown.button", function(event) {
					if ( options.disabled ) {
						return false;
					}
					if ( event.keyCode == $.ui.keyCode.SPACE || event.keyCode == $.ui.keyCode.ENTER ) {
						$( this ).addClass( "ui-state-active" );
					}
				})
				.bind( "keyup.button", function() {
					$( this ).removeClass( "ui-state-active" );
				});

			if ( this.buttonElement.is("a") ) {
				this.buttonElement.keyup(function(event) {
					if ( event.keyCode === $.ui.keyCode.SPACE ) {
						// TODO pass through original event correctly (just as 2nd argument doesn't work)
						$( this ).click();
					}
				});
			}
		}

		// TODO: pull out $.Widget's handling for the disabled option into
		// $.Widget.prototype._setOptionDisabled so it's easy to proxy and can
		// be overridden by individual plugins
		this._setOption( "disabled", options.disabled );
		this._resetButton();
	},

	_determineButtonType: function() {

		if ( this.element.is(":checkbox") ) {
			this.type = "checkbox";
		} else if ( this.element.is(":radio") ) {
			this.type = "radio";
		} else if ( this.element.is("input") ) {
			this.type = "input";
		} else {
			this.type = "button";
		}

		if ( this.type === "checkbox" || this.type === "radio" ) {
			// we don't search against the document in case the element
			// is disconnected from the DOM
			var ancestor = this.element.parents().filter(":last"),
				labelSelector = "label[for='" + this.element.attr("id") + "']";
			this.buttonElement = ancestor.find( labelSelector );
			if ( !this.buttonElement.length ) {
				ancestor = ancestor.length ? ancestor.siblings() : this.element.siblings();
				this.buttonElement = ancestor.filter( labelSelector );
				if ( !this.buttonElement.length ) {
					this.buttonElement = ancestor.find( labelSelector );
				}
			}
			this.element.addClass( "ui-helper-hidden-accessible" );

			var checked = this.element.is( ":checked" );
			if ( checked ) {
				this.buttonElement.addClass( "ui-state-active" );
			}
			this.buttonElement.attr( "aria-pressed", checked );
		} else {
			this.buttonElement = this.element;
		}
	},

	widget: function() {
		return this.buttonElement;
	},

	destroy: function() {
		this.element
			.removeClass( "ui-helper-hidden-accessible" );
		this.buttonElement
			.removeClass( baseClasses + " " + stateClasses + " " + typeClasses )
			.removeAttr( "role" )
			.removeAttr( "aria-pressed" )
			.html( this.buttonElement.find(".ui-button-text").html() );

		if ( !this.hasTitle ) {
			this.buttonElement.removeAttr( "title" );
		}

		$.Widget.prototype.destroy.call( this );
	},

	_setOption: function( key, value ) {
		$.Widget.prototype._setOption.apply( this, arguments );
		if ( key === "disabled" ) {
			if ( value ) {
				this.element.propAttr( "disabled", true );
			} else {
				this.element.propAttr( "disabled", false );
			}
			return;
		}
		this._resetButton();
	},

	refresh: function() {
		var isDisabled = this.element.is( ":disabled" );
		if ( isDisabled !== this.options.disabled ) {
			this._setOption( "disabled", isDisabled );
		}
		if ( this.type === "radio" ) {
			radioGroup( this.element[0] ).each(function() {
				if ( $( this ).is( ":checked" ) ) {
					$( this ).button( "widget" )
						.addClass( "ui-state-active" )
						.attr( "aria-pressed", "true" );
				} else {
					$( this ).button( "widget" )
						.removeClass( "ui-state-active" )
						.attr( "aria-pressed", "false" );
				}
			});
		} else if ( this.type === "checkbox" ) {
			if ( this.element.is( ":checked" ) ) {
				this.buttonElement
					.addClass( "ui-state-active" )
					.attr( "aria-pressed", "true" );
			} else {
				this.buttonElement
					.removeClass( "ui-state-active" )
					.attr( "aria-pressed", "false" );
			}
		}
	},

	_resetButton: function() {
		if ( this.type === "input" ) {
			if ( this.options.label ) {
				this.element.val( this.options.label );
			}
			return;
		}
		var buttonElement = this.buttonElement.removeClass( typeClasses ),
			buttonText = $( "<span></span>" )
				.addClass( "ui-button-text" )
				.html( this.options.label )
				.appendTo( buttonElement.empty() )
				.text(),
			icons = this.options.icons,
			multipleIcons = icons.primary && icons.secondary,
			buttonClasses = [];  

		if ( icons.primary || icons.secondary ) {
			if ( this.options.text ) {
				buttonClasses.push( "ui-button-text-icon" + ( multipleIcons ? "s" : ( icons.primary ? "-primary" : "-secondary" ) ) );
			}

			if ( icons.primary ) {
				buttonElement.prepend( "<span class='ui-button-icon-primary ui-icon " + icons.primary + "'></span>" );
			}

			if ( icons.secondary ) {
				buttonElement.append( "<span class='ui-button-icon-secondary ui-icon " + icons.secondary + "'></span>" );
			}

			if ( !this.options.text ) {
				buttonClasses.push( multipleIcons ? "ui-button-icons-only" : "ui-button-icon-only" );

				if ( !this.hasTitle ) {
					buttonElement.attr( "title", buttonText );
				}
			}
		} else {
			buttonClasses.push( "ui-button-text-only" );
		}
		buttonElement.addClass( buttonClasses.join( " " ) );
	}
});

$.widget( "ui.buttonset", {
	options: {
		items: ":button, :submit, :reset, :checkbox, :radio, a, :data(button)"
	},

	_create: function() {
		this.element.addClass( "ui-buttonset" );
	},
	
	_init: function() {
		this.refresh();
	},

	_setOption: function( key, value ) {
		if ( key === "disabled" ) {
			this.buttons.button( "option", key, value );
		}

		$.Widget.prototype._setOption.apply( this, arguments );
	},
	
	refresh: function() {
		var ltr = this.element.css( "direction" ) === "ltr";
		
		this.buttons = this.element.find( this.options.items )
			.filter( ":ui-button" )
				.button( "refresh" )
			.end()
			.not( ":ui-button" )
				.button()
			.end()
			.map(function() {
				return $( this ).button( "widget" )[ 0 ];
			})
				.removeClass( "ui-corner-all ui-corner-left ui-corner-right" )
				.filter( ":first" )
					.addClass( ltr ? "ui-corner-left" : "ui-corner-right" )
				.end()
				.filter( ":last" )
					.addClass( ltr ? "ui-corner-right" : "ui-corner-left" )
				.end()
			.end();
	},

	destroy: function() {
		this.element.removeClass( "ui-buttonset" );
		this.buttons
			.map(function() {
				return $( this ).button( "widget" )[ 0 ];
			})
				.removeClass( "ui-corner-left ui-corner-right" )
			.end()
			.button( "destroy" );

		$.Widget.prototype.destroy.call( this );
	}
});

}( jQuery ) );
/*
 * jQuery UI Effects 1.8.16
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Effects/
 */
;jQuery.effects || (function($, undefined) {

$.effects = {};



/******************************************************************************/
/****************************** COLOR ANIMATIONS ******************************/
/******************************************************************************/

// override the animation for color styles
$.each(['backgroundColor', 'borderBottomColor', 'borderLeftColor',
	'borderRightColor', 'borderTopColor', 'borderColor', 'color', 'outlineColor'],
function(i, attr) {
	$.fx.step[attr] = function(fx) {
		if (!fx.colorInit) {
			fx.start = getColor(fx.elem, attr);
			fx.end = getRGB(fx.end);
			fx.colorInit = true;
		}

		fx.elem.style[attr] = 'rgb(' +
			Math.max(Math.min(parseInt((fx.pos * (fx.end[0] - fx.start[0])) + fx.start[0], 10), 255), 0) + ',' +
			Math.max(Math.min(parseInt((fx.pos * (fx.end[1] - fx.start[1])) + fx.start[1], 10), 255), 0) + ',' +
			Math.max(Math.min(parseInt((fx.pos * (fx.end[2] - fx.start[2])) + fx.start[2], 10), 255), 0) + ')';
	};
});

// Color Conversion functions from highlightFade
// By Blair Mitchelmore
// http://jquery.offput.ca/highlightFade/

// Parse strings looking for color tuples [255,255,255]
function getRGB(color) {
		var result;

		// Check if we're already dealing with an array of colors
		if ( color && color.constructor == Array && color.length == 3 )
				return color;

		// Look for rgb(num,num,num)
		if (result = /rgb\(\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*,\s*([0-9]{1,3})\s*\)/.exec(color))
				return [parseInt(result[1],10), parseInt(result[2],10), parseInt(result[3],10)];

		// Look for rgb(num%,num%,num%)
		if (result = /rgb\(\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*,\s*([0-9]+(?:\.[0-9]+)?)\%\s*\)/.exec(color))
				return [parseFloat(result[1])*2.55, parseFloat(result[2])*2.55, parseFloat(result[3])*2.55];

		// Look for #a0b1c2
		if (result = /#([a-fA-F0-9]{2})([a-fA-F0-9]{2})([a-fA-F0-9]{2})/.exec(color))
				return [parseInt(result[1],16), parseInt(result[2],16), parseInt(result[3],16)];

		// Look for #fff
		if (result = /#([a-fA-F0-9])([a-fA-F0-9])([a-fA-F0-9])/.exec(color))
				return [parseInt(result[1]+result[1],16), parseInt(result[2]+result[2],16), parseInt(result[3]+result[3],16)];

		// Look for rgba(0, 0, 0, 0) == transparent in Safari 3
		if (result = /rgba\(0, 0, 0, 0\)/.exec(color))
				return colors['transparent'];

		// Otherwise, we're most likely dealing with a named color
		return colors[$.trim(color).toLowerCase()];
}

function getColor(elem, attr) {
		var color;

		do {
				color = $.curCSS(elem, attr);

				// Keep going until we find an element that has color, or we hit the body
				if ( color != '' && color != 'transparent' || $.nodeName(elem, "body") )
						break;

				attr = "backgroundColor";
		} while ( elem = elem.parentNode );

		return getRGB(color);
};

// Some named colors to work with
// From Interface by Stefan Petre
// http://interface.eyecon.ro/

var colors = {
	aqua:[0,255,255],
	azure:[240,255,255],
	beige:[245,245,220],
	black:[0,0,0],
	blue:[0,0,255],
	brown:[165,42,42],
	cyan:[0,255,255],
	darkblue:[0,0,139],
	darkcyan:[0,139,139],
	darkgrey:[169,169,169],
	darkgreen:[0,100,0],
	darkkhaki:[189,183,107],
	darkmagenta:[139,0,139],
	darkolivegreen:[85,107,47],
	darkorange:[255,140,0],
	darkorchid:[153,50,204],
	darkred:[139,0,0],
	darksalmon:[233,150,122],
	darkviolet:[148,0,211],
	fuchsia:[255,0,255],
	gold:[255,215,0],
	green:[0,128,0],
	indigo:[75,0,130],
	khaki:[240,230,140],
	lightblue:[173,216,230],
	lightcyan:[224,255,255],
	lightgreen:[144,238,144],
	lightgrey:[211,211,211],
	lightpink:[255,182,193],
	lightyellow:[255,255,224],
	lime:[0,255,0],
	magenta:[255,0,255],
	maroon:[128,0,0],
	navy:[0,0,128],
	olive:[128,128,0],
	orange:[255,165,0],
	pink:[255,192,203],
	purple:[128,0,128],
	violet:[128,0,128],
	red:[255,0,0],
	silver:[192,192,192],
	white:[255,255,255],
	yellow:[255,255,0],
	transparent: [255,255,255]
};



/******************************************************************************/
/****************************** CLASS ANIMATIONS ******************************/
/******************************************************************************/

var classAnimationActions = ['add', 'remove', 'toggle'],
	shorthandStyles = {
		border: 1,
		borderBottom: 1,
		borderColor: 1,
		borderLeft: 1,
		borderRight: 1,
		borderTop: 1,
		borderWidth: 1,
		margin: 1,
		padding: 1
	};

function getElementStyles() {
	var style = document.defaultView
			? document.defaultView.getComputedStyle(this, null)
			: this.currentStyle,
		newStyle = {},
		key,
		camelCase;

	// webkit enumerates style porperties
	if (style && style.length && style[0] && style[style[0]]) {
		var len = style.length;
		while (len--) {
			key = style[len];
			if (typeof style[key] == 'string') {
				camelCase = key.replace(/\-(\w)/g, function(all, letter){
					return letter.toUpperCase();
				});
				newStyle[camelCase] = style[key];
			}
		}
	} else {
		for (key in style) {
			if (typeof style[key] === 'string') {
				newStyle[key] = style[key];
			}
		}
	}
	
	return newStyle;
}

function filterStyles(styles) {
	var name, value;
	for (name in styles) {
		value = styles[name];
		if (
			// ignore null and undefined values
			value == null ||
			// ignore functions (when does this occur?)
			$.isFunction(value) ||
			// shorthand styles that need to be expanded
			name in shorthandStyles ||
			// ignore scrollbars (break in IE)
			(/scrollbar/).test(name) ||

			// only colors or values that can be converted to numbers
			(!(/color/i).test(name) && isNaN(parseFloat(value)))
		) {
			delete styles[name];
		}
	}
	
	return styles;
}

function styleDifference(oldStyle, newStyle) {
	var diff = { _: 0 }, // http://dev.jquery.com/ticket/5459
		name;

	for (name in newStyle) {
		if (oldStyle[name] != newStyle[name]) {
			diff[name] = newStyle[name];
		}
	}

	return diff;
}

$.effects.animateClass = function(value, duration, easing, callback) {
	if ($.isFunction(easing)) {
		callback = easing;
		easing = null;
	}

	return this.queue(function() {
		var that = $(this),
			originalStyleAttr = that.attr('style') || ' ',
			originalStyle = filterStyles(getElementStyles.call(this)),
			newStyle,
			className = that.attr('class');

		$.each(classAnimationActions, function(i, action) {
			if (value[action]) {
				that[action + 'Class'](value[action]);
			}
		});
		newStyle = filterStyles(getElementStyles.call(this));
		that.attr('class', className);

		that.animate(styleDifference(originalStyle, newStyle), {
			queue: false,
			duration: duration,
			easing: easing,
			complete: function() {
				$.each(classAnimationActions, function(i, action) {
					if (value[action]) { that[action + 'Class'](value[action]); }
				});
				// work around bug in IE by clearing the cssText before setting it
				if (typeof that.attr('style') == 'object') {
					that.attr('style').cssText = '';
					that.attr('style').cssText = originalStyleAttr;
				} else {
					that.attr('style', originalStyleAttr);
				}
				if (callback) { callback.apply(this, arguments); }
				$.dequeue( this );
			}
		});
	});
};

$.fn.extend({
	_addClass: $.fn.addClass,
	addClass: function(classNames, speed, easing, callback) {
		return speed ? $.effects.animateClass.apply(this, [{ add: classNames },speed,easing,callback]) : this._addClass(classNames);
	},

	_removeClass: $.fn.removeClass,
	removeClass: function(classNames,speed,easing,callback) {
		return speed ? $.effects.animateClass.apply(this, [{ remove: classNames },speed,easing,callback]) : this._removeClass(classNames);
	},

	_toggleClass: $.fn.toggleClass,
	toggleClass: function(classNames, force, speed, easing, callback) {
		if ( typeof force == "boolean" || force === undefined ) {
			if ( !speed ) {
				// without speed parameter;
				return this._toggleClass(classNames, force);
			} else {
				return $.effects.animateClass.apply(this, [(force?{add:classNames}:{remove:classNames}),speed,easing,callback]);
			}
		} else {
			// without switch parameter;
			return $.effects.animateClass.apply(this, [{ toggle: classNames },force,speed,easing]);
		}
	},

	switchClass: function(remove,add,speed,easing,callback) {
		return $.effects.animateClass.apply(this, [{ add: add, remove: remove },speed,easing,callback]);
	}
});



/******************************************************************************/
/*********************************** EFFECTS **********************************/
/******************************************************************************/

$.extend($.effects, {
	version: "1.8.16",

	// Saves a set of properties in a data storage
	save: function(element, set) {
		for(var i=0; i < set.length; i++) {
			if(set[i] !== null) element.data("ec.storage."+set[i], element[0].style[set[i]]);
		}
	},

	// Restores a set of previously saved properties from a data storage
	restore: function(element, set) {
		for(var i=0; i < set.length; i++) {
			if(set[i] !== null) element.css(set[i], element.data("ec.storage."+set[i]));
		}
	},

	setMode: function(el, mode) {
		if (mode == 'toggle') mode = el.is(':hidden') ? 'show' : 'hide'; // Set for toggle
		return mode;
	},

	getBaseline: function(origin, original) { // Translates a [top,left] array into a baseline value
		// this should be a little more flexible in the future to handle a string & hash
		var y, x;
		switch (origin[0]) {
			case 'top': y = 0; break;
			case 'middle': y = 0.5; break;
			case 'bottom': y = 1; break;
			default: y = origin[0] / original.height;
		};
		switch (origin[1]) {
			case 'left': x = 0; break;
			case 'center': x = 0.5; break;
			case 'right': x = 1; break;
			default: x = origin[1] / original.width;
		};
		return {x: x, y: y};
	},

	// Wraps the element around a wrapper that copies position properties
	createWrapper: function(element) {

		// if the element is already wrapped, return it
		if (element.parent().is('.ui-effects-wrapper')) {
			return element.parent();
		}

		// wrap the element
		var props = {
				width: element.outerWidth(true),
				height: element.outerHeight(true),
				'float': element.css('float')
			},
			wrapper = $('<div></div>')
				.addClass('ui-effects-wrapper')
				.css({
					fontSize: '100%',
					background: 'transparent',
					border: 'none',
					margin: 0,
					padding: 0
				}),
			active = document.activeElement;

		element.wrap(wrapper);

		// Fixes #7595 - Elements lose focus when wrapped.
		if ( element[ 0 ] === active || $.contains( element[ 0 ], active ) ) {
			$( active ).focus();
		}
		
		wrapper = element.parent(); //Hotfix for jQuery 1.4 since some change in wrap() seems to actually loose the reference to the wrapped element

		// transfer positioning properties to the wrapper
		if (element.css('position') == 'static') {
			wrapper.css({ position: 'relative' });
			element.css({ position: 'relative' });
		} else {
			$.extend(props, {
				position: element.css('position'),
				zIndex: element.css('z-index')
			});
			$.each(['top', 'left', 'bottom', 'right'], function(i, pos) {
				props[pos] = element.css(pos);
				if (isNaN(parseInt(props[pos], 10))) {
					props[pos] = 'auto';
				}
			});
			element.css({position: 'relative', top: 0, left: 0, right: 'auto', bottom: 'auto' });
		}

		return wrapper.css(props).show();
	},

	removeWrapper: function(element) {
		var parent,
			active = document.activeElement;
		
		if (element.parent().is('.ui-effects-wrapper')) {
			parent = element.parent().replaceWith(element);
			// Fixes #7595 - Elements lose focus when wrapped.
			if ( element[ 0 ] === active || $.contains( element[ 0 ], active ) ) {
				$( active ).focus();
			}
			return parent;
		}
			
		return element;
	},

	setTransition: function(element, list, factor, value) {
		value = value || {};
		$.each(list, function(i, x){
			unit = element.cssUnit(x);
			if (unit[0] > 0) value[x] = unit[0] * factor + unit[1];
		});
		return value;
	}
});


function _normalizeArguments(effect, options, speed, callback) {
	// shift params for method overloading
	if (typeof effect == 'object') {
		callback = options;
		speed = null;
		options = effect;
		effect = options.effect;
	}
	if ($.isFunction(options)) {
		callback = options;
		speed = null;
		options = {};
	}
        if (typeof options == 'number' || $.fx.speeds[options]) {
		callback = speed;
		speed = options;
		options = {};
	}
	if ($.isFunction(speed)) {
		callback = speed;
		speed = null;
	}

	options = options || {};

	speed = speed || options.duration;
	speed = $.fx.off ? 0 : typeof speed == 'number'
		? speed : speed in $.fx.speeds ? $.fx.speeds[speed] : $.fx.speeds._default;

	callback = callback || options.complete;

	return [effect, options, speed, callback];
}

function standardSpeed( speed ) {
	// valid standard speeds
	if ( !speed || typeof speed === "number" || $.fx.speeds[ speed ] ) {
		return true;
	}
	
	// invalid strings - treat as "normal" speed
	if ( typeof speed === "string" && !$.effects[ speed ] ) {
		return true;
	}
	
	return false;
}

$.fn.extend({
	effect: function(effect, options, speed, callback) {
		var args = _normalizeArguments.apply(this, arguments),
			// TODO: make effects take actual parameters instead of a hash
			args2 = {
				options: args[1],
				duration: args[2],
				callback: args[3]
			},
			mode = args2.options.mode,
			effectMethod = $.effects[effect];
		
		if ( $.fx.off || !effectMethod ) {
			// delegate to the original method (e.g., .show()) if possible
			if ( mode ) {
				return this[ mode ]( args2.duration, args2.callback );
			} else {
				return this.each(function() {
					if ( args2.callback ) {
						args2.callback.call( this );
					}
				});
			}
		}
		
		return effectMethod.call(this, args2);
	},

	_show: $.fn.show,
	show: function(speed) {
		if ( standardSpeed( speed ) ) {
			return this._show.apply(this, arguments);
		} else {
			var args = _normalizeArguments.apply(this, arguments);
			args[1].mode = 'show';
			return this.effect.apply(this, args);
		}
	},

	_hide: $.fn.hide,
	hide: function(speed) {
		if ( standardSpeed( speed ) ) {
			return this._hide.apply(this, arguments);
		} else {
			var args = _normalizeArguments.apply(this, arguments);
			args[1].mode = 'hide';
			return this.effect.apply(this, args);
		}
	},

	// jQuery core overloads toggle and creates _toggle
	__toggle: $.fn.toggle,
	toggle: function(speed) {
		if ( standardSpeed( speed ) || typeof speed === "boolean" || $.isFunction( speed ) ) {
			return this.__toggle.apply(this, arguments);
		} else {
			var args = _normalizeArguments.apply(this, arguments);
			args[1].mode = 'toggle';
			return this.effect.apply(this, args);
		}
	},

	// helper functions
	cssUnit: function(key) {
		var style = this.css(key), val = [];
		$.each( ['em','px','%','pt'], function(i, unit){
			if(style.indexOf(unit) > 0)
				val = [parseFloat(style), unit];
		});
		return val;
	}
});



/******************************************************************************/
/*********************************** EASING ***********************************/
/******************************************************************************/

/*
 * jQuery Easing v1.3 - http://gsgd.co.uk/sandbox/jquery/easing/
 *
 * Uses the built in easing capabilities added In jQuery 1.1
 * to offer multiple easing options
 *
 * TERMS OF USE - jQuery Easing
 *
 * Open source under the BSD License.
 *
 * Copyright 2008 George McGinley Smith
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * Neither the name of the author nor the names of contributors may be used to endorse
 * or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
*/

// t: current time, b: begInnIng value, c: change In value, d: duration
$.easing.jswing = $.easing.swing;

$.extend($.easing,
{
	def: 'easeOutQuad',
	swing: function (x, t, b, c, d) {
		//alert($.easing.default);
		return $.easing[$.easing.def](x, t, b, c, d);
	},
	easeInQuad: function (x, t, b, c, d) {
		return c*(t/=d)*t + b;
	},
	easeOutQuad: function (x, t, b, c, d) {
		return -c *(t/=d)*(t-2) + b;
	},
	easeInOutQuad: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t + b;
		return -c/2 * ((--t)*(t-2) - 1) + b;
	},
	easeInCubic: function (x, t, b, c, d) {
		return c*(t/=d)*t*t + b;
	},
	easeOutCubic: function (x, t, b, c, d) {
		return c*((t=t/d-1)*t*t + 1) + b;
	},
	easeInOutCubic: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t + b;
		return c/2*((t-=2)*t*t + 2) + b;
	},
	easeInQuart: function (x, t, b, c, d) {
		return c*(t/=d)*t*t*t + b;
	},
	easeOutQuart: function (x, t, b, c, d) {
		return -c * ((t=t/d-1)*t*t*t - 1) + b;
	},
	easeInOutQuart: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t*t + b;
		return -c/2 * ((t-=2)*t*t*t - 2) + b;
	},
	easeInQuint: function (x, t, b, c, d) {
		return c*(t/=d)*t*t*t*t + b;
	},
	easeOutQuint: function (x, t, b, c, d) {
		return c*((t=t/d-1)*t*t*t*t + 1) + b;
	},
	easeInOutQuint: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return c/2*t*t*t*t*t + b;
		return c/2*((t-=2)*t*t*t*t + 2) + b;
	},
	easeInSine: function (x, t, b, c, d) {
		return -c * Math.cos(t/d * (Math.PI/2)) + c + b;
	},
	easeOutSine: function (x, t, b, c, d) {
		return c * Math.sin(t/d * (Math.PI/2)) + b;
	},
	easeInOutSine: function (x, t, b, c, d) {
		return -c/2 * (Math.cos(Math.PI*t/d) - 1) + b;
	},
	easeInExpo: function (x, t, b, c, d) {
		return (t==0) ? b : c * Math.pow(2, 10 * (t/d - 1)) + b;
	},
	easeOutExpo: function (x, t, b, c, d) {
		return (t==d) ? b+c : c * (-Math.pow(2, -10 * t/d) + 1) + b;
	},
	easeInOutExpo: function (x, t, b, c, d) {
		if (t==0) return b;
		if (t==d) return b+c;
		if ((t/=d/2) < 1) return c/2 * Math.pow(2, 10 * (t - 1)) + b;
		return c/2 * (-Math.pow(2, -10 * --t) + 2) + b;
	},
	easeInCirc: function (x, t, b, c, d) {
		return -c * (Math.sqrt(1 - (t/=d)*t) - 1) + b;
	},
	easeOutCirc: function (x, t, b, c, d) {
		return c * Math.sqrt(1 - (t=t/d-1)*t) + b;
	},
	easeInOutCirc: function (x, t, b, c, d) {
		if ((t/=d/2) < 1) return -c/2 * (Math.sqrt(1 - t*t) - 1) + b;
		return c/2 * (Math.sqrt(1 - (t-=2)*t) + 1) + b;
	},
	easeInElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		return -(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
	},
	easeOutElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d)==1) return b+c;  if (!p) p=d*.3;
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		return a*Math.pow(2,-10*t) * Math.sin( (t*d-s)*(2*Math.PI)/p ) + c + b;
	},
	easeInOutElastic: function (x, t, b, c, d) {
		var s=1.70158;var p=0;var a=c;
		if (t==0) return b;  if ((t/=d/2)==2) return b+c;  if (!p) p=d*(.3*1.5);
		if (a < Math.abs(c)) { a=c; var s=p/4; }
		else var s = p/(2*Math.PI) * Math.asin (c/a);
		if (t < 1) return -.5*(a*Math.pow(2,10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )) + b;
		return a*Math.pow(2,-10*(t-=1)) * Math.sin( (t*d-s)*(2*Math.PI)/p )*.5 + c + b;
	},
	easeInBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158;
		return c*(t/=d)*t*((s+1)*t - s) + b;
	},
	easeOutBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158;
		return c*((t=t/d-1)*t*((s+1)*t + s) + 1) + b;
	},
	easeInOutBack: function (x, t, b, c, d, s) {
		if (s == undefined) s = 1.70158;
		if ((t/=d/2) < 1) return c/2*(t*t*(((s*=(1.525))+1)*t - s)) + b;
		return c/2*((t-=2)*t*(((s*=(1.525))+1)*t + s) + 2) + b;
	},
	easeInBounce: function (x, t, b, c, d) {
		return c - $.easing.easeOutBounce (x, d-t, 0, c, d) + b;
	},
	easeOutBounce: function (x, t, b, c, d) {
		if ((t/=d) < (1/2.75)) {
			return c*(7.5625*t*t) + b;
		} else if (t < (2/2.75)) {
			return c*(7.5625*(t-=(1.5/2.75))*t + .75) + b;
		} else if (t < (2.5/2.75)) {
			return c*(7.5625*(t-=(2.25/2.75))*t + .9375) + b;
		} else {
			return c*(7.5625*(t-=(2.625/2.75))*t + .984375) + b;
		}
	},
	easeInOutBounce: function (x, t, b, c, d) {
		if (t < d/2) return $.easing.easeInBounce (x, t*2, 0, c, d) * .5 + b;
		return $.easing.easeOutBounce (x, t*2-d, 0, c, d) * .5 + c*.5 + b;
	}
});

/*
 *
 * TERMS OF USE - EASING EQUATIONS
 *
 * Open source under the BSD License.
 *
 * Copyright 2001 Robert Penner
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without modification,
 * are permitted provided that the following conditions are met:
 *
 * Redistributions of source code must retain the above copyright notice, this list of
 * conditions and the following disclaimer.
 * Redistributions in binary form must reproduce the above copyright notice, this list
 * of conditions and the following disclaimer in the documentation and/or other materials
 * provided with the distribution.
 *
 * Neither the name of the author nor the names of contributors may be used to endorse
 * or promote products derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE
 * COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
 * EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE
 * GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED
 * AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
 * NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED
 * OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 */

})(jQuery);
/*
 * jQuery UI Effects Fade 1.8.16
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Effects/Fade
 *
 * Depends:
 *	jquery.effects.core.js
 */
(function( $, undefined ) {

$.effects.fade = function(o) {
	return this.queue(function() {
		var elem = $(this),
			mode = $.effects.setMode(elem, o.options.mode || 'hide');

		elem.animate({ opacity: mode }, {
			queue: false,
			duration: o.duration,
			easing: o.options.easing,
			complete: function() {
				(o.callback && o.callback.apply(this, arguments));
				elem.dequeue();
			}
		});
	});
};

})(jQuery);
/*
 * jQuery UI Effects Highlight 1.8.16
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Effects/Highlight
 *
 * Depends:
 *	jquery.effects.core.js
 */
(function( $, undefined ) {

$.effects.highlight = function(o) {
	return this.queue(function() {
		var elem = $(this),
			props = ['backgroundImage', 'backgroundColor', 'opacity'],
			mode = $.effects.setMode(elem, o.options.mode || 'show'),
			animation = {
				backgroundColor: elem.css('backgroundColor')
			};

		if (mode == 'hide') {
			animation.opacity = 0;
		}

		$.effects.save(elem, props);
		elem
			.show()
			.css({
				backgroundImage: 'none',
				backgroundColor: o.options.color || '#ffff99'
			})
			.animate(animation, {
				queue: false,
				duration: o.duration,
				easing: o.options.easing,
				complete: function() {
					(mode == 'hide' && elem.hide());
					$.effects.restore(elem, props);
					(mode == 'show' && !$.support.opacity && this.style.removeAttribute('filter'));
					(o.callback && o.callback.apply(this, arguments));
					elem.dequeue();
				}
			});
	});
};

})(jQuery);
/*
 * jQuery UI Effects Slide 1.8.16
 *
 * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 * http://docs.jquery.com/UI/Effects/Slide
 *
 * Depends:
 *	jquery.effects.core.js
 */
(function( $, undefined ) {

$.effects.slide = function(o) {

	return this.queue(function() {

		// Create element
		var el = $(this), props = ['position','top','bottom','left','right'];

		// Set options
		var mode = $.effects.setMode(el, o.options.mode || 'show'); // Set Mode
		var direction = o.options.direction || 'left'; // Default Direction

		// Adjust
		$.effects.save(el, props); el.show(); // Save & Show
		$.effects.createWrapper(el).css({overflow:'hidden'}); // Create Wrapper
		var ref = (direction == 'up' || direction == 'down') ? 'top' : 'left';
		var motion = (direction == 'up' || direction == 'left') ? 'pos' : 'neg';
		var distance = o.options.distance || (ref == 'top' ? el.outerHeight({margin:true}) : el.outerWidth({margin:true}));
		if (mode == 'show') el.css(ref, motion == 'pos' ? (isNaN(distance) ? "-" + distance : -distance) : distance); // Shift

		// Animation
		var animation = {};
		animation[ref] = (mode == 'show' ? (motion == 'pos' ? '+=' : '-=') : (motion == 'pos' ? '-=' : '+=')) + distance;

		// Animate
		el.animate(animation, { queue: false, duration: o.duration, easing: o.options.easing, complete: function() {
			if(mode == 'hide') el.hide(); // Hide
			$.effects.restore(el, props); $.effects.removeWrapper(el); // Restore
			if(o.callback) o.callback.apply(this, arguments); // Callback
			el.dequeue();
		}});

	});

};

})(jQuery);
/** @file
 *
 *  Provide a sprite-based checkbox.
 *
 *  Requires:
 *      ui.core.js
 *      ui.widget.js
 */
/*jslint nomen:false, laxbreak:true, white:false, onevar:false */
/*global jQuery:false */
(function($) {

$.widget("ui.checkbox", {
    version: "0.1.1",

    /* Remove the strange ui.widget._trigger() class name prefix for events
     * so we can bind to events like 'change' instead of 'checkboxchange'.
     *
     * If you need to know which widget the event was triggered from, either
     * bind directly to the widget or look at the event object.
     */
    widgetEventPrefix:    '',

    options: {
        // Defaults
        css:            'checkbox',         // General CSS class
        cssOn:          'on',               // CSS class when    checked
        cssOff:         'off',              // CSS class when un-checked
        titleOn:        'click to turn off',// Title when    checked
        titleOff:       'click to turn on', // Title when un-checked

        useElTitle:     true,               // Include the title of the source
                                            // element (or it's associated
                                            // label) in the title of this
                                            // checkbox.

        hideLabel:      false               // Hide the associated label?  If
                                            // not, clicking on the title will
                                            // be the same as clicking on the
                                            // checkbox.
    },

    /** @brief  Initialize a new instance.
     *
     *  Valid options are:
     *      css             General space-separated CSS class(es) for the
     *                      checkbox [ 'checkbox' ];
     *      cssOn           Space-separated CSS class(es) when checked
     *                      [ 'on' ];
     *      cssOff          Space-separated CSS class(es) when un-checked
     *                      [ 'off' ];
     *      titleOn         Title when checked
     *                      [ 'click to turn off' ];
     *      titleOff        Title when un-checked
     *                      [ 'click to turn on' ];
     *
     *      useElTitle      Include the title of the source element (or it's
     *                      associated label) in the title of this checkbox (as
     *                      a prefix to 'titleOn' or 'titleOff')
     *                      [ true ];
     *
     *      hideLabel       Hide the associated label?  If not, clicking on the
     *                      title will be the same as clicking on the checkbox
     *                      [ false ].
     *
     *  @triggers:
     *      'enabled'               when element is enabled;
     *      'disabled'              when element is disabled;
     *      'change' / 'checked'    when element is checked;
     *      'change' / 'unchecked'  when element is unchecked.
     */
    _create: function() {
        var self    = this;
        var opts    = this.options;

        opts.enabled = (opts.enabled === undefined
                            ? (self.element.attr('disabled') ? false : true)
                            : opts.enabled);
        opts.checked = (opts.checked === undefined
                            ? (self.element.attr('checked')  ? true  : false)
                            : opts.checked);
        opts.title   = '';

        // Remember the original value
        self.element.data('value.uicheckbox', opts.checked);

        var name     = self.element.attr('name');
        var id       = self.element.attr('id');

        // Try to locate the associated label
        self.$label  = false;

        if (id)
        {
            self.$label = $('label[for='+ id +']');
        }
        if ( ((! self.$label) || (self.$label.length < 1)) && name)
        {
            self.$label = $('label[for='+ name +']');
        }

        if (opts.useElTitle === true)
        {
            opts.title = self.element.attr('title');
            if ( ((! opts.title) || (opts.title.length < 1)) &&
                 (self.$label.length > 0) )
            {
                // The element has no 'title', use the text of the label.
                opts.title = self.$label.text();
            }
        }

        var title   = opts.title
                    + (opts.checked
                            ? opts.titleOn
                            : opts.titleOff);

        // Create a new element that will be placed just after the current
        self.$el    = $('<div />')
                        .addClass(opts.css)
                        .addClass('ui-state-default');

        var iconCss = [ (opts.enabled ? ''          : 'disabled'),
                        (opts.checked ? opts.cssOn  : opts.cssOff) ];
        self.$icon  = $('<span />')
                        .addClass( iconCss.join(' ') );
        if (title && (title.length > 0))
        {
            self.$icon.attr('title', title);
        }

        self.$icon.appendTo( self.$el );

        // Insert the new element after the existing and remove the existing.
        self.$el.insertAfter(self.element);

        // Hide the original element.
        self.element.hide();

        if (self.$label && (self.$label.length > 0))
        {
            // We have a label for this field.
            if (opts.hideLabel === true)
            {
                // Hide it.
                self.$label.hide();
            }
            else
            {
                // Treat a click on the label as a click on the item.
                self.$label.click(function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    self.$el.trigger('click',[e]);
                    return false;
                });
            }
        }

        // Interaction events
        self._bindEvents();
    },

    /************************
     * Private methods
     *
     */
    _bindEvents: function() {
        var self    = this;

        var _mouseenter = function(e) {
            if (self.options.enabled === true)
            {
                self.$el.addClass('ui-state-hover');
            }
        };

        var _mouseleave = function(e) {
            self.$el.removeClass('ui-state-hover');
        };

        var _focus      = function(e) {
            if (self.options.enabled === true)
            {
                self.$el.addClass('ui-state-focus');
            }
        };

        var _blur       = function(e) {
            self.$el.removeClass('ui-state-focus');
        };

        var _click      = function(e) {
            self.toggle();
        };

        self.$el.bind('mouseenter.uicheckbox', _mouseenter)
                .bind('mouseleave.uicheckbox', _mouseleave)
                .bind('focus.uicheckbox',      _focus)
                .bind('blur.uicheckbox',       _blur)
                .bind('click.uicheckbox',      _click);
    },

    /************************
     * Public methods
     *
     */
    isChecked: function() {
        return this.options.checked;
    },
    isEnabled: function() {
        return this.options.enabled;
    },
    val: function() {
        return (this.isEnabled() && this.isChecked()
                    ? this.element.val()
                    : null);
    },

    enable: function()
    {
        if (! this.options.enabled)
        {
            this.options.enabled = true;
            this.$el.removeClass('ui-state-disabled');

            this._trigger('enabled');
        }
    },

    disable: function()
    {
        if (this.options.enabled)
        {
            this.options.enabled = false;
            this.$el.addClass('ui-state-disabled');

            this._trigger('disabled');
        }
    },

    toggle: function()
    {
        if (this.options.checked)
        {
            this.uncheck();
        }
        else
        {
            this.check();
        }
    },

    check: function()
    {
        //if (this.options.enabled && (! this.options.checked))
        if (! this.options.checked)
        {
            this.options.checked = true;

            this.$icon
                    .removeClass(this.options.cssOff)
                    .addClass(this.options.cssOn)
                    .attr('title', this.options.title + this.options.titleOn);

            //this.element.click();
            this._trigger('change', null, 'check');
        }
    },

    uncheck: function()
    {
        //if (this.options.enabled && this.options.checked)
        if (this.options.checked)
        {
            this.options.checked = false;

            this.$icon
                    .removeClass(this.options.cssOn)
                    .addClass(this.options.cssOff)
                    .attr('title', this.options.title + this.options.titleOff);

            //this.element.click();
            this._trigger('change', null, 'uncheck');
        }
    },

    /** @brief  Reset the input to its original (creation or last direct set)
     *          value.
     */
    reset: function()
    {
        // Remember the original value
        if (this.element.data('value.uicheckbox'))
        {
            this.check();
        }
        else
        {
            this.uncheck();
        }
    },

    /** @brief  Has the value of this input changed from its original?
     *
     *  @return true | false
     */
    hasChanged: function()
    {
        return (this.options.checked !== this.element.data('value.uicheckbox'));
    },

    destroy: function() {
        if (this.$label)
        {
            this.$label.show();
        }

        this.$el.unbind('.uicheckbox');

        this.$el.remove();

        this.element.show();
    }
});


}(jQuery));
/** @file
 *
 *  jQuery class/objects representing a single, user-generated note as well as
 *  a group of one or more comments.
 *
 *  Requires:
 *      jquery.js
 *      jquery.user.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global jQuery:false */
(function($) {

/********************************************************
 * Unique array sorting
 *
 */
var hasDuplicates   = false;
var sortCompare     = function( a, b ) {
    if ( a === b )
    {
        hasDuplicates = true;
        return 0;
    }

    return ( (a < b) ? -1 : 1 );
};

/** @brief  Perform a unique sort on the given array.
 *  @param  ar      The array to sort;
 *
 *  @return The sorted array with duplicates removed.
 */
$.uniqueSort = function( ar ) {
    hasDuplicates = false;
    ar.sort( sortCompare );

    if (hasDuplicates)
    {
        for (var idex = 1; idex < ar.length; idex++)
        {
            if (ar[idex] === ar[idex - 1])
            {
                ar.splice( idex--, 1 );
            }
        }
    }

    return ar;
};

/******************************************************************************
 * Note
 *
 */

/** @brief  A note comprised of one or more comments and tags.  */
$.Note = function(props) {
    var defaults    = {
        id:         null,
        comments:   [],
        tags:       null
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Note.prototype = {
    /** @brief  Initialize a new Note instance.
     *  @param  props   The properties of this instance:
     *                      id:         The unique id of this instance;
     *                      comments:   An array of $.Comment objects,
     *                                  serialized $.Comment objects, or empty
     *                                  to initialize an empty set;
     *                      tags:       An array of tag strings;
     */
    init: function(props) {
        var self   = this;
        self.props = {};

        $.each(props, function(key,val) {
            self.set(key, val);
        });

        return self;

        this.props = props;

        var commentInstances    = [];
        $.each(this.props.comments, function() {
            var comment = this;
            if ($.isPlainObject(comment))  { comment = new $.Comment(comment); }

            commentInstances.push( comment );
        });

        if (commentInstances.length < 1)
        {
            // Create a single, empty comment
            commentInstances.push( new $.Comment() );
        }

        this.props.comments = commentInstances;

        return this;
    },

    /** @brief  Generic getting of a property.
     *  @param  key     The property to get;
     *
     *  @return The value of the property (or undefined if invalid).
     */
    get:   function(key)
    {
        var res;
        var method  = 'get'+ key[0].toUpperCase() + key.substr(1);

        if ($.isFunction( self[method] ))
        {
            res = self[method](val);
        }

        return res;
    },

    /** @brief  Generic setting of a property.
     *  @param  key     The property to set;
     *  @param  val     The property value;
     */
    set:   function(key, val)
    {
        var self    = this;
        var method  = 'set'+ key[0].toUpperCase() + key.substr(1);

        if ($.isFunction( self[method] ))
        {
            self[method](val);
        }
    },

    getId:          function()  { return this.props.id; },
    getComments:    function()  { return this.props.comments; },
    getCommentCount:function()  { return this.props.comments.length; },

    getTags: function()
    {
        var self    = this;
        //if (! self.props.tags)
        {
            // Create a full set of tags from all comments.
            self.props.tags = [];

            $.each(self.props.comments, function() {
                self.props.tags = self.props.tags.concat( this.getTags() );
            });

            self.props.tags = $.uniqueSort( self.props.tags );
        }

        return self.props.tags;
    },

    getTagCount: function()
    {
        return this.getTags().length;
    },

    /** @brief  (Re)set the id.
     *  @param  id      The new id;
     */
    setId: function(id)
    {
        this.props.id = id;
    },

    /** @brief  (Re)set all comments.
     *  @param  comments    An array of $.Comment instances
     *                      (or serialized versions);
     */
    setComments: function(comments)
    {
        var self    = this;

        self.props.comments = [];
        self.props.tags     = [];
        $.each(comments, function() {
            self.addComment(this);
        });

        if (self.props.comments.length < 1)
        {
            // Create a single, empty comment
            self.addComment( new $.Comment() );
        }
    },

    /** @brief  Add a new comment to this note.
     *  @param  comment A $.Comment instance or properties to create one.
     *
     *  @return The comment instance that was added.
     */
    addComment: function(comment) {
        if ($.isPlainObject(comment))   { comment = new $.Comment(comment); }

        this.props.tags = $.uniqueSort( this.getTags()
                                            .concat( comment.getTags() ) );
        this.props.comments.push(comment);

        return comment;
    },

    /** @brief  Remove a comments from this note.
     *  @param  comment A $.Comment instance to remove.
     *
     *  @return this for a fluent interface.
     */
    removeComment: function(comment) {
        var self    = this;
        if (comment instanceof $.Comment)
        {
            var targetIdex  = -1;
            $.each(self.props.comments, function(idex) {
                if (this === comment)
                {
                    targetIdex = idex;
                    return false;
                }
            });

            if (targetIdex >= 0)
            {
                self.props.comments.splice(targetIdex, 1);
                comment.destroy();

                /* Clear our 'tags' since removing exactly this set isn't
                 * straight forward.  If the tags are needed, they will be
                 * recreated on the next call to getTags().
                 */
                self.props.tags = null;
            }
        }

        return self;
    },

    /** @brief  Return a serialized version of this instance suitable
     *          for creating a duplicate instance via our constructor.
     *
     *  @return The serialized version
     */
    serialize: function() {
        var serialized  = {
            id:         this.props.id,
            comments:   [],
            tags:       this.getTags()
        };

        $.each(this.props.comments, function() {
            serialized.comments.push( this.serialize() );
        });

        return serialized;
    },

    /** @brief  Destroy this instance.
     */
    destroy: function() {
        var self    = this;
        var props   = self.props;
        if ($.isArray(props.comments))
        {
            $.each(props.comments, function() {
                this.destroy();
            });
        }

        delete props.comments;
        delete props.tags;
    }
};

/******************************************************************************
 * Comment
 *
 */

/** @brief  A single, attributable comment.
 *  @param  props   The properties of this comment:
 *                      author:     The $.User instance or serialize $.User
 *                                  representing the author of this comment;
 *                      text:       The text of this comment;
 *                      created:    The date/time the comment was created;
 */
$.Comment  = function(props) {
    var defaults    = {
        author: null,
        text:   '',
        tags:   [],
        created:new Date()
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Comment.prototype = {
    /** @brief  Initialize a new Comment instance.
     *  @param  props   The properties of this comment:
     *                      author:     The Unique ID of the author
     *                      text:       The text of this comment
     *                      created:    The date/time the comment was created
     */
    init: function(props) {
        var self   = this;
        self.props = {};

        $.each(props, function(key,val) {
            self.set(key, val);
        });

        return self;
    },

    /** @brief  Generic getting of a property.
     *  @param  key     The property to get;
     *
     *  @return The value of the property (or undefined if invalid).
     */
    get:   function(key)
    {
        var res;
        var method  = 'get'+ key[0].toUpperCase() + key.substr(1);

        if ($.isFunction( self[method] ))
        {
            res = self[method](val);
        }

        return res;
    },

    /** @brief  Generic setting of a property.
     *  @param  key     The property to set;
     *  @param  val     The property value;
     */
    set:   function(key, val)
    {
        var self    = this;
        var method  = 'set'+ key[0].toUpperCase() + key.substr(1);

        if ($.isFunction( self[method] ))
        {
            self[method](val);
        }
    },

    getAuthor:  function() { return this.props.author; },
    getText:    function() { return this.props.text; },
    getTags:    function() { return this.props.tags; },
    getTagCount:function() { return this.props.tags; },
    getCreated: function() { return this.props.created; },

    setAuthor:   function(author)
    {
        if ( (! author) || (! (author instanceof $.User)) )
        {
            author = new $.User( author );
        }

        this.props.author = author;
    },

    setText:   function(text)
    {
        var tags    = [];
        this.props.text = text;

        if (text)
        {
            var matches = text.match(/#[\w\._\-]+/g);

            $.each(matches, function(idex, str) {
                tags.push( str.substr(1) );
            });
        }

        this.props.tags = tags;
    },

    setCreated: function(created)
    {
        if (! created)  { return; }

        if (! (created instanceof Date))
        {
            try {
                created = new Date(created);
            } catch(e) {}
        }

        this.props.created = created;
    },

    /** @brief  Return a serialized version of this instance suitable
     *          for creating a duplicate instance via our constructor.
     *
     *  @return The serialized version.
     */
    serialize: function() {
        var serialized  = {
            author: (this.props.author
                        ? this.props.author.serialize()
                        : null),
            text:   this.props.text,
            created:this.props.created
        };

        return serialized;
    },

    destroy: function() {
        var self    = this;
        var props   = self.props;

        if (props.author && (props.author instanceof $.User))
        {
            props.author.destroy();
        }

        delete props.author;
        delete props.text;
        delete props.created;
    }
};

 }(jQuery));
/** @file
 *
 *  Provide a UI for $.Note and $.Comment.
 *
 *  The DOM element used to create a new ui.note instance MAY have an 'id'
 *  attribute or the 'id' MAY be passed as an option.
 *
 *  Requires:
 *      jquery.js
 *      jquery.note.js
 *      ui.core.js
 *      ui.widget.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global jQuery:false */
(function($) {

/*****************************************************************************
 *  A UI widget for $.Note
 *
 */
$.widget('ui.note', {
    version:    '0.0.1',

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'note-change' instead of 'notechange'.
     */
    widgetEventPrefix:    'note-',

    options:    {
        note:       null,   /* The associated $.Note instance.  May initially
                             * be a serialized version of a $.Note
                             */

        // The selector for the container of note widgets
        container:  '.notes-pane',

        // Positioning information
        position:   {
            my:     'top',
            at:     'top',
            of:     null,   /* The selector for the element we should sync with
                             * (e.g. the tagged/selected text within a
                             *       sentence).
                             */

            using:  null    /* A movement function. Defaults to a custom
                             * function that works to avoid note collisions.
                             */

        },

        animSpeed:  200,    // The speed (in ms) of animations

        hidden:     false,  // Initially hidden?

        // Template selector
        template:   '#tmpl-note'
    },

    /** @brief  Initialize a new instance.
     *
     *  Options:
     *      note        Either a serialize $.Note or a $.Note instance;
     *      container   A selector or jQuery/DOM instance representing the
     *                  element that will contain all note widgets
     *                  [ '.notes-pane' ];
     *      position    An object suitable for ui.position
     *                  [ {my:'top', at:'top', of:null, using:null} ];
     *      animSpeed   The speed (in ms) of animations [ 200 ];
     *      hidden      Should the widget be initially hidden [ false ];
     *      template    A selector representing the jQuery template to use
     *                  when creating an instance [ '#tmpl-note' ];
     *
     *  @triggers (with a 'note-' prefix):
     *      'change' -- 'commentAdded'
     *      'change' -- 'commentRemoved'
     *      'change' -- 'commentSaved'
     *
     *      'destroyed'
     */
    _init: function() {
        var self    = this;
        var opts    = self.options;

        self._isInitializing = true;

        self.$container = $( opts.container );

        if ( $.isPlainObject(opts.note) )
        {
            if ((opts.note.id === undefined) || (opts.note.id === null))
            {
                opts.note.id = self.element.attr('id');
            }

            // Generate a new $.Note instance...
            opts.note  = new $.Note( opts.note );
        }

        self._widgetCreate()
            ._bindEvents();

        self._isInitializing = false;

        return self;
    },


    /** @brief  Return the id of our $.Note instance.
     *
     *  @return The id (null if not set).
     */
    id: function() {
        var self    = this;
        var opts    = self.options;

        return (opts.note ? opts.note.getId() : null);
    },

    /** @brief  Return the number of $.Note instances.
     *
     *  @return The count.
     */
    commentCount: function() {
        var self    = this;
        var opts    = self.options;

        return opts.note.getCommentCount();
    },

    /** @brief  Add a new comment to our container.
     *  @param  comment     The new $.Comment instance.  If not provided,
     *                      create a new, empty comment.
     *
     *  @return this for a fluent interface.
     */
    addComment: function(comment) {
        var self    = this;
        var opts    = self.options;

        if (! comment)
        {
            // Create an empty comment
            comment = new $.Comment();
        }

        // Create and append a new ui.comment widget
        var $comment    = $('<div />').comment({comment:comment});
        self.$body.append( $comment );

        if (self._isInitializing !== true)
        {
            var comment = $comment.comment('option', 'comment');
            opts.note.addComment(comment);

            self._trigger('change', null, 'commentAdded');
        }

        return self;
    },

    /** @brief  Given a ui.comment widget, remove the comment from our
     *          container.
     *  @param  $comment    The jQuery DOM element that has a ui.comment widget
     *                      attached.
     *
     *  @return this for a fluent interface.
     */
    removeComment: function($comment) {
        var self    = this;
        var opts    = self.options;

        // Remove the identified comment
        var comment = $comment.comment('option', 'comment');
        opts.note.removeComment(comment);

        self._trigger('change', null, 'commentRemoved');

        // If there are no more comments, self-destruct!
        //if (self.commentCount() < 1)
        if (opts.note.getCommentCount() < 1)
        {
            self.destroy();
        }

        return self;
    },

    /** @brief  Mark this instance as 'active'
     *  @param  cb      If provided, an activation completion callback
     */
    activate: function(cb) {
        var self    = this;
        var opts    = self.options;

        if (self.element.hasClass('note-active'))
        {
            // Already actived
            if ($.isFunction(cb))
            {
                cb.apply(this);
            }
            return;
        }

        // Ensure proper reply input/button state by initially blurring
        self.$reply.blur();

        /* NOTE: Popping to the top immediately relies on a z-index set for
         *       .note in both normal and activated states, with the activated
         *       state at a higher z-index.
         */
        var zIndex  = parseInt(self.element.css('z-index'), 10);
        self.element
                .css('z-index', zIndex + 1) // pop to the top immediately...
                .addClass('note-active', opts.animSpeed, function() {
                        // ...then remove the hard z-index and let
                        //    the CSS take over.
                        self.element.css('z-index', '');

                        if ($.isFunction(cb))
                        {
                            cb.apply(this);
                        }
        });
    },

    /** @brief  Mark this instance as 'inactive'
     *  @param  cb      If provided, an deactivation completion callback
     */
    deactivate: function(cb) {
        var self    = this;
        var opts    = self.options;

        if ((! self.element.hasClass('note-active')) || self.deactivating)
        {
            // Already deactived
            if ($.isFunction(cb)) { cb.apply(this); }

            return;
        }
        self.deactivating = true;

        // Cancel any comment that is currently being edited
        self.$body.find('.comment').comment('cancelEdit');

        // And close ourselves up
        self.element.removeClass('note-active', opts.animSpeed, function() {
            if ($.isFunction(cb))   { cb.apply(this); }

            self.deactivating = false;
        });
    },

    /** @brief  Show this note container.
     */
    show: function() {
        var self    = this;
        var opts    = self.options;

        self.element
                .fadeIn(opts.animSpeed)
                .position( opts.position );
    },

    /** @brief  Hide this note container.
     */
    hide: function(cb) {
        var self    = this;
        var opts    = self.options;

        self.element
                .fadeOut(opts.animSpeed, cb);
    },

    /** @brief  Focus on the input area.
     */
    focus: function() {
        var self    = this;
        var opts    = self.options;

        self.$reply.trigger('focus');
    },

    /** @brief  Does this note currently have focus?
     *
     *  @return true | false
     */
    hasFocus: function() {
        var self    = this;
        var opts    = self.options;

        /* If our $input is hidden, we're currently editing a comment and so
         * vicariously have focus
         */
        return ( self.$input.is(':hidden') ||
                 self.$reply.is(':focus') );
    },

    /** @brief  Given a ui.comment widget, put it in edit mode.
     *  @param  $comment    The jQuery DOM element that has a ui.comment widget
     *                      attached [ null == first ].
     *
     *  @return this for a fluent interface.
     */
    editComment: function($comment) {
        var self    = this;
        var opts    = self.options;

        if (! $comment)
        {
            $comment = self.$body.find('.comment:first');
        }

        self.directEdit = true;
        self.$input.hide( );

        // Activate and place the target comment in edit mode.
        self.activate( function() {
            $comment.comment('edit');
        });

        return self;
    },

    /** @brief  Return a serialized version of our underlying $.Note instance.
     *
     *  @return A serialized version of our underlying $.Note instance.
     */
    serialize: function() {
        var self    = this;
        var opts    = self.options;

        return opts.note.serialize();
    },

    /** @brief  Destroy this widget. */
    destroy: function() {
        var self    = this;
        var opts    = self.options;

        self._unbindEvents()
            .hide(function() {
                self._widgetDestroy();
                opts.note.destroy();

                self._trigger('destroyed');
            });
    },

    /*******************************
     * Private methods
     *
     */

    /** @brief  Actually create our widget along with any sub-widgets
     */
    _widgetCreate: function() {
        var self    = this;
        var opts    = self.options;

        if (opts.position.using === null)
        {
            /* A custom movement function that works to avoid note collisions.
             *
             * Position animation can be disabled by setting the
             * 'noPositionAnimation' option to true.
             */
            opts.position.using = function( to ) {

                // See if we have any collisions with other notes
                var myExtent    = self.element.offset();
                var newTop      = myExtent.top + to.top;
                var newBot      = newTop + self.element.height();
                var myId        = self.element.attr('id');
                self.$container.find('.note').each(function() {
                    var $note   = $(this);
                    if (myId === $note.attr('id'))  { return; }

                    var pos     = $note.offset();
                    var extent  = {
                        top:    pos.top,
                        bot:    pos.top  + $note.height()
                    };

                    if ( ((newTop >= extent.top) && (newTop <= extent.bot)) ||
                         ((newBot >= extent.top) && (newBot <= extent.bot)) )
                    {
                        // Collision!  Adjust Down
                        to.top += $note.height() + 4;
                    }
                });

                if (opts.noPositionAnimation === true)
                {
                    $(this).css( 'top', to.top );
                }
                else
                {
                    $(this).animate( {top: to.top}, opts.animSpeed );
                }
            };
        }

        self.element
                .addClass('note')
                .attr('id', 'note-'+ self.id())
                .append( $( opts.template ).tmpl() )
                .appendTo( self.$container );

        if (opts.hidden === true)
        {
            self.element.hide();
        }

        self.$body    = self.element.find('.note-body');
        self.$reply   = self.element.find('.note-reply');
        self.$input   = self.element.find('.note-input-pane');
        self.$buttons = self.$input.find('.buttons button');

        self.$buttons.button();

        // Generate a ui.Note widget for each current $.Note instance
        if (opts.note)
        {
            $.each(opts.note.getComments(), function() {
                self.addComment( this, true );
            });
        }

        if (opts.hidden !== true)
        {
            self.element.position( opts.position );
        }

        return self;
    },

    /** @brief  Destroy this widget along with any sub-widgets
     */
    _widgetDestroy: function() {
        var self    = this;
        var opts    = self.options;

        // Destroy all contained note instances
        self.$body.find('.note').note('destroy');

        self.$buttons.button('destroy');

        self.element.empty();

        return self;
    },

    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;

        /*****************************************************
         * General click handler for document.  If we see
         * this event, deactivate this note widget.
         *
         */
        self._docClick = function(e) {
            var $target = $(e.target);

            if ($target !== self.element)
            {
                self.deactivate();
            }
        };

        $(document).bind('click.ui-note', self._docClick);

        /*****************************************************
         * Handle button clicks (reply/cancel) within the
         * input pane.
         *
         */
        self.$buttons.bind('click.ui-note', function(e) {
            var $button = $(this);

            switch ($button.attr('name'))
            {
            case 'reply':
                var comment = new $.Comment({ text: self.$reply.val() });
                self.addComment(comment);
                self.$reply.val('');
                break;

            case 'cancel-reply':
                self.$reply.val('');
                self.$reply.blur();

                // If there are no (more) comments, self-destruct!
                if (self.commentCount() < 1)
                {
                    self.destroy();
                }
                break;
            }
        });

        /*****************************************************
         * Handle click-to-activate
         *
         */
        self.element.bind('click.ui-note', function(e) {
            self.activate();
            return false;
        });

        /*****************************************************
         * Handle comment edit/cancel
         *
         */
        self.element.delegate('.comment',
                                'comment-edit.ui-note '
                              + 'comment-cancel-edit.ui-note',
                              function(e) {
            var $comment    = $(e.target);

            switch (e.type)
            {
            case 'comment-edit':
                self.$input.hide( );
                break;

            case 'comment-cancel-edit':
                if (self.directEdit)
                {
                    /* On 'cancel-edit', destroy any pending comment.  This
                     * will result in our 'comment-destroyed' handler (below)
                     * once the comment is actually destroyed.
                     */
                    self.removeComment($comment);
                }
                else
                {
                    self.$input.css('display', '');
                }
                break;
            }
        });

        /*****************************************************
         * Handle the deletion of a comment
         *
         */
        self.element.delegate('.comment',
                                'comment-destroyed.ui-note '
                              + 'comment-saved.ui-note',
                              function(e, comment) {
            var $comment    = $(e.target);

            if (self.directEdit)
            {
                /* In direct edit mode (via editComment()), then we've arrived
                 * here due to an edit cancellation (which resulted in a
                 * deletion of the pending comment and a 'comment-destroyed'
                 * event) or a comment save.  At this point the comment should
                 * have been fully dealt with so all we need to do is
                 * de-activate.
                 */
                self.deactivate( function() {
                    self.$input.css('display', '');
                    self.directEdit = false;
                });
            }
            else if (e.type === 'comment-destroyed')
            {
                /* NOT in direct edit mode.  A comment has been destroyed,
                 * likely via the user clicking on the 'delete' button for the
                 * comment.  Make sure our state properly reflects deletion.
                 */
                self.removeComment($comment);
            }
        });

        /*****************************************************
         * Handle 'keyup' in the reply element.
         *
         * Enable/Disable the reply button based upon whether
         * the new content is empty.
         *
         */
        self.$reply.bind('keyup.ui-note', function(e) {
            var $reply  = self.$buttons.filter('[name=reply]');

            // Special keys
            switch (e.keyCode)
            {
            case $.ui.keyCode.ESCAPE:   // 27
                self.$reply.val('');
                self.$reply.blur();
                break;
            }

            if ((! self.$reply.hasClass('hint')) &&
                (self.$reply.val().length > 0))
            {
                $reply.button('enable');
            }
            else
            {
                $reply.button('disable');
            }
        });

        /*****************************************************
         * Handle focus/blur for the reply element
         *
         */
        self.$reply.bind('focus.ui-note', function(e) {
             self.$buttons.show();

             var $reply  = self.$buttons.filter('[name=reply]');
             if (self.$reply.hasClass('hint'))
             {
                self.$reply.val('')
                           .removeClass('hint');
             }

             if (self.$reply.val().length > 0)
             {
                 $reply.button('enable');
             }
             else
             {
                 $reply.button('disable');
             }
        });

        self.$reply.bind('blur.ui-note', function(e) {
             var $reply  = self.$buttons.filter('[name=reply]');
             if (self.$reply.val().length > 0)
             {
                 $reply.button('enable');
             }
             else
             {
                self.$reply.addClass('hint')
                           .val( self.$reply.attr('title') );

                // Disable the reply button and hide the buttons
                $reply.button('disable');

                // If there are comments, hide the buttons
                if (self.commentCount() > 0)
                {
                    self.$buttons.hide();
                }
             }
        });

        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.element.undelegate('.comment', '.ui-note');
        self.element.unbind('.ui-note');
        self.$reply.unbind('.ui-note');
        self.$buttons.unbind('.ui-note');

        $(document).bind('click.ui-note', self._docClick);

        return self;
    }
});

/*****************************************************************************
 *  A UI widget for $.Note
 *
 */
$.widget('ui.comment', {
    version:    '0.0.1',

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'comment-change' instead of 'commentchange'.
     */
    widgetEventPrefix:    'comment-',

    options:    {
        comment:    null,   /* The associated $.Comment instance.  May
                             * initially be a serialized version of a $.Comment
                             */

        // Template Selector
        template:   '#tmpl-comment'
    },

    /** @brief  Return a serialized version of our underlying $.Comment
     *          instance.
     *
     *  @return A serialized version of our underlying $.Comment instance.
     */
    serialize: function() {
        var self    = this;
        var opts    = self.options;

        return opts.comment.serialize();
    },

    /** @brief  Destroy this widget. */
    destroy: function() {
        var self    = this;
        var opts    = self.options;

        self._unbindEvents()
            ._widgetDestroy();

        // Notify our container that this comment has been destroyed.
        self._trigger('destroyed', null, opts.comment);
    },

    /** @brief  Put this comment in edit mode. */
    edit: function() {
        var self    = this;
        var opts    = self.options;

        if (self.editing)   { return self; }
        self.editing = true;

        self.$edit.val( self.$comment.text() );
        self.$comment.hide( opts.animSpeed );
        self.$mainButtons.hide( opts.animSpeed );
        self.$editArea.show();
        self.$edit.focus();

        self._trigger('edit');

        return self;
    },

    /** @brief  Cancel edit mode.
     *  @param  squelchEvent    If true, do NOT trigger the 'cancel-edit'
     *                          event [ false ];
     */
    cancelEdit: function(squelchEvent) {
        var self    = this;
        var opts    = self.options;

        if (! self.editing) { return self; }
        self.editing = false;

        self.$editArea.hide( );
        self.$comment.show( );

        /* Note: Do NOT use show() -- it will add a direct style setting which
         *       will override any CSS rules.  We simply want to remove the
         *       'display:none' style added by .hide() in edit().
         */
        self.$mainButtons.css('display', '');

        if (squelchEvent !== true)
        {
            self._trigger('cancel-edit');
        }

        return self;
    },

    /** @brief  Save any changes and cancel edit mode. */
    save: function() {
        var self    = this;
        var opts    = self.options;

        opts.comment.setText( self.$edit.val() );

        self.$comment.text( opts.comment.getText() );

        // Cancel the edit WITHOUT triggering the 'cancel-edit' event
        self.cancelEdit( true );

        self._trigger('change', null, 'commentSaved');
        self._trigger('saved',  null, opts.comment);

        return self;
    },

    /*******************************
     * Private methods
     *
     */

    /** @brief  Initialize a new instance.
     */
    _init: function() {
        var self    = this;
        var opts    = self.options;

        if ( $.isPlainObject(opts.comment) )
        {
            // Generate a new $.Comment instance
            opts.comment = new $.Comment( opts.comment );
        }

        self._widgetCreate()
            ._bindEvents();

        return self;
    },


    /** @brief  Actually create our widget along with any sub-widgets
     */
    _widgetCreate: function() {
        var self    = this;
        var opts    = self.options;

        self.element
                .addClass('comment')
                .append( $( opts.template ).tmpl( {note: opts.comment} ) );

        self.$comment     = self.element.find('.text');
        self.$editArea    = self.element.find('.edit');
        self.$edit        = self.$editArea.find('textarea');
        self.$buttons     = self.element.find('.buttons button');
        self.$mainButtons = self.element.find('.buttons:last');

        self.$buttons.button();

        return self;
    },

    /** @brief  Destroy this widget along with any sub-widgets
     */
    _widgetDestroy: function() {
        var self    = this;
        var opts    = self.options;

        self.$buttons.button('destroy');
        self.element.empty();

        return self;
    },

    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.$buttons.bind('click.ui-comment', function(e) {
            var $button = $(this);

            switch ($button.attr('name'))
            {
            case 'edit':
                self.edit();
                break;

            case 'delete':
                self.element.slideUp(function() {
                    self.element.remove();
                });
                break;

            case 'save':
                // Save any changes in self.$edit
                self.save();
                break;

            case 'cancel-edit':
                // Cancel 'edit'
                self.cancelEdit();
                break;
            }
        });

        /*****************************************************
         * Handle 'keyup' in the edit element.
         *
         */
        self.$editArea.bind('keyup.ui-comment', function(e) {
            // Special keys
            switch (e.keyCode)
            {
            case $.ui.keyCode.ESCAPE:   // 27
                self.cancelEdit();
                break;
            }
        });


        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.$buttons.unbind('.ui-comment');

        return self;
    }
});

 }(jQuery));
/** @file
 *
 *  Provide a UI component to represent a single sentence.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *      jquery.hoverIntent.js
 *      jquery.delegateHoverIntent.js
 *
 *      rangy.js
 *
 *      jquery.note.js
 *      ui.note.js
 *      ui.contentOverlay.js
 */
/*jslint nomen:false, laxbreak:true, white:false, onevar:false */
/*global jQuery:false */
(function($) {

$.widget("ui.sentence", {
    version: "0.0.1",

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'sentence-change' instead of 'sentencechange'.
     */
    widgetEventPrefix:    'sentence-',

    options: {
        notesPane:      '.notes-pane',  /* The selector OR jQuery DOM element
                                         * representing the notes pane.
                                         */

        rank:           0,              // Sentence rank
        highlighted:    false,          // Is this sentence Highlighted?
        expanded:       false,          // Is this sentence Expanded?
        starred:        false,          // Is this sentence Starred?
        noExpansion:    false,          // Disallow expanison?
        animSpeed:      200,            // Speed (in ms) of animations

        // Basic CSS classes
        css:            {
            highlighted:    'highlight',
            expanded:       'expanded',
            expansion:      'expansion',
            starred:        'starred',
            noExpansion:    'hide-expand',

            // inner-classes
            selected:       'selected',
            tagged:         'ui-state-default tagged'
        }
    },

    /** @brief  Initialize a new instance.
     *
     *  Valid options are:
     *      rank            The rank for this sentence;
     *      highlighted     Is this sentence highlighte?        [ false ];
     *      expanded        Is this sentence expanded/visible?  [ false ];
     *      starred         Is this sentence starred?           [ false ];
     *      noExpansion     Disallow expansion?                 [ false ];
     *      notes           Serialized notes (generated via _serializeNotes());
     *
     *  @triggers (with a 'sentence-' prefix):
     *      'enabled'     / 'disabled'      when element is enabled/disabled;
     *      'highlighted' / 'unhighlighted' when element is expanded/collapsed;
     *      'expanded'    / 'collapsed'     when element is expanded/collapsed;
     *
     *      'change' - 'highlighted'        when element is highlighted;
     *      'change' - 'unhighlighted'      when element is unhighlighted;
     *      'change' - 'expanded'           when element is expanded;
     *      'change' - 'collapsed'          when element is collapsed;
     *      'change' - 'unhighlighted'      when element is unhighlighted;
     *      'change' - 'starred'            when element is starred -- a
     *                                      'change' event with a single type
     *                                      parameter of 'starred';
     *      'change' - 'unstarred'          when element is unstarred -- a
     *                                      'change' event with a single type
     *                                      parameter of 'starred';
     *      'change' - 'commentAdded'       when a new comment is added -- a
     *                                      'change' event with a single type
     *                                      parameter of 'commentAdded';
     *      'change' - 'commentRemoved'     when a new note is added -- a
     *                                      'change' event with a single type
     *                                      parameter of 'commentRemoved';
     */
    _init: function() {
        var self    = this;
        var opts    = this.options;

        opts.enabled = self.element.attr('disabled') ? false : true;

        if (opts.rank <= 0)
        {
            // See if the element has a 'rank' attribute.
            var rank = parseInt(self.element.attr('rank'), 10);
            if (! isNaN(rank))
            {
                opts.rank = rank;
            }
        }

        // Interaction events
        self._widgetInit()
            ._eventsBind();
    },

    /************************
     * Public methods
     *
     */

    /** @brief  Is this sentence "visible"?
     *
     *  @return true | false
     */
    isVisible: function() {
        return (this.element
                    .filter('.highlight,.expanded,.expansion,.keyworded')
                        .length > 0);
    },

    /** @brief  Highlight this sentence. */
    highlight: function() {
        return this._setOption('highlighted', true);
    },

    /** @brief  UnHighlight this sentence. */
    unhighlight: function() {
        return this._setOption('highlighted', false);
    },

    /** @brief  Shortcut -- Expand this sentence. */
    expand: function() {
        return this._setOption('expanded', true);
    },

    /** @brief  Shortcut -- Collapse this sentence. */
    collapse: function() {
        return this._setOption('expanded', false);
    },

    /** @brief  Shortcut -- Star/unstar this sentence.
     *  @param  value   true/false
     */
    star: function(value) {
        return this._setOption('starred', value);
    },

    /** @brief  Return a serialized version of this instance suitable
     *          for creating a duplicate instance via our constructor.
     *
     *  @return The serialized version of this sentence.
     */
    serialize: function() {
        var self    = this;
        var opts    = self.options;
        var ser     = {
            rank:       opts.rank,
            starred:    opts.starred,
            notes:      self._serializeNotes()
        };

        return ser;
    },

    /** @brief  Toggle the given option.
     *  @param  key     The option to toggle.
     *
     *  @return this for a fluent interface
     */
    toggleOption: function(key) {
        var self    = this;
        var opts    = self.options;
        
        if (opts[key])
        {
            self._setOption(key, false);
        }
        else
        {
            self._setOption(key, true);
        }

        return self;
    },

    /** @brief  Sync the position of any notes associated with this sentence.
     *
     *  @return this for a fluent interface.
     */
    syncNotePositions: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;
        var visible = self.isVisible();

        $s.find('.tagged').each(function() {
            var $tagged = $(this);
            var $note   = $tagged.data('note-associate');

            if (! $note)    { return; }

            /* If the sentence containing this tagged item is visible, ensure
             * that the associated note is visible (which will also adjust its
             * position).  Otherwise, hide the associated note.
             */
            $note.note( (visible ? 'show' : 'hide') );
        });

        return self;
    },

    /** @brief  Destroy this widget.
     *
     *  @return this for a fluent interface.
     */
    destroy: function() {
        this._eventsUnbind()
            ._widgetClean();

        return this;
    },

    /************************
     * "Private" methods
     *
     */

    /** @brief  Create the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetInit: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        self.$content   = self.element.find('.content');
        self.$content.contentOverlay();

        self.$notesPane = $('.notes-pane');
        self.notes      = [];

        // Ensure the applied CSS classes matche our initial state
        $s[ opts.highlighted
                ? 'addClass' : 'removeClass']( opts.css.highlighted );
        $s[ opts.expanded
                ? 'addClass' : 'removeClass']( opts.css.expanded );
        $s[ opts.starred
                ? 'addClass' : 'removeClass']( opts.css.starred );
        $s[ opts.noExpansion
                ? 'addClass' : 'removeClass']( opts.css.noExpansion );

        if (opts.notes)
        {
            self._unserializeNotes(opts.notes);
        }
        return self;
    },

    /** @brief  Destroy the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetClean: function() {
        var self    = this;
        var opts    = self.options;

        return self;
    },

    /** @brief  Override widget._setOption() to handle additional functionality
     *          for 'disabled', 'expanded', 'starred'.
     *  @param  key     The property being set;
     *  @param  value   The new property value;
     */
    _setOption: function(key, value) {
        var self    = this;
        var opts    = self.options;
        var trigger = false;

        switch (key)
        {
        case 'disabled':
            if ( value )
            {
                // Disabling
                self._trigger('disabled');
            }
            else
            {
                // Enabling
                self._trigger('enabled');
            }
            break;

        case 'expanded':
            // events triggered via _expand/_collapse
            if (value)  self._expand()
            else        self._collapse();

            break;

        case 'highlighted':
            // events triggered via _highlight/_unhighlight
            if (value)  self._highlight()
            else        self._unhighlight();

            break;

        case 'starred':
            self.widget()
                [ value ? 'addClass' : 'removeClass']( opts.css.starred );

            // Trigger a 'change' event for starred/unstarred
            trigger = (value ? 'starred' : 'unstarred');
            break;

        case 'noExpansion':
            self.widget()
                [ value ? 'addClass' : 'removeClass']( opts.css.noExpansion );
            break;
        }

        $.Widget.prototype._setOption.apply( self, arguments );

        // Trigger any related events (AFTER the value is actually set)
        if (trigger !== false)
        {
            self._trigger('change', null, trigger);
        }
    },

    /** @brief  Return a serialized version of the $.Note attached to this
     *          sentence.
     *
     *  @return An array of serialized notes of the form:
     *              { range: { start: , end: },
     *                note:  serialized-note
     *               }
     */
    _serializeNotes: function() {
        var self        = this;
        var serialized  = [];

        // self.notes is an array of ui.note instances.
        $.each(self.notes, function() {
            // Is this a ui.note instance?
            var $note   = $(this);
            if ( ! $note.data('note'))  { return; }

            //serialized.push(this.serialize());
            var $group  = $note.data('note-associate');
            serialized.push( {
                range:  $group.overlayGroup('serialize'),
                note:   $note.note('serialize')
            });
        });

        return serialized;
    },

    /** @brief  Unserialize notes to attach to this sentence.
     *  @param  notes   The notes serialization (from _serializeNotes());
     *
     *  @return An array of ui.note instances.
     */
    _unserializeNotes: function(notes) {
        var self    = this;
        var hide    = (! self.isVisible());

        if (self.notes.length > 0)
        {
            // :TODO: cleanout the current notes
        }

        self.notes = [];
        $.each(notes, function() {
            if ( (! this.range) || (! this.note) )  { return; }

            // Create an overlay for this range
            var $group = self.$content.contentOverlay('addOverlay',
                                                      this.range, 'tag');

            // Now, using the new overlay, add a note
            self._addNote( $group, this.note, hide);
        });

        return self.notes;
    },


    /** @brief  Highlight this sentence. */
    _highlight: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        if ((opts.highlighted === true) || ($s.data('isHighlighting')))
        {
            // Already done / in progress
            return;
        }

        // Triggered when highlight animation is complete
        var $ctl        = self.element.find('.controls .expand');
        var highlightDone  = function() {
            $s.css('display', '')       // Remove the 'display' style
              .removeData('isHighlighting');

            self.$content.contentOverlay('refresh');
            self.syncNotePositions();

            self._trigger('highlighted');
            self._trigger('change', null, 'highlighted');
        };

        // Mark this sentence as "being highlighted"
        $s.data('isHighlighting', true);
        $s.addClass( opts.css.highlighted, opts.animSpeed, highlightDone);
    },

    /** @brief  Unhighlight this sentence. */
    _unhighlight: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        if ((opts.highlighted === false) || ($s.data('isHighlighting')))
        {
            // Already done / in progress
            return;
        }

        // Triggered when expansion animation is complete
        var unhighlightDone = function() {
            $s.css('display', '')       // Remove the 'display' style
              .removeData('isHighlighting');

            self.$content.contentOverlay('refresh');
            self.syncNotePositions();

            self._trigger('unhighlighted');
            self._trigger('change', null, 'unhighlighted');
        };

        // Mark this sentence as "being highlighted"
        $s.data('isHighlighting', true);

        if ($s.hasClass( opts.css.highlighted ))
        {
            // Directly highlighted
            $s.removeClass( opts.css.highlighted, opts.animSpeed,
                            unhighlightDone);
        }
        else if ($s.hasClass( opts.css.expansion ))
        {
            // highlighted via sibling
            unhighlightDone();
        }
    },

    /** @brief  Expand this sentence. */
    _expand: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        if ((opts.expanded === true) || ($s.data('isExpanding')))
        {
            // Already done / in progress
            return;
        }

        // Triggered when expansion animation is complete
        var $ctl        = $s.find('.controls .expand');
        var $prev       = $s.prev();
        var $next       = $s.next();
        var expandDone  = function() {
            $s.addClass( opts.css.expansion )
              .css('display', '')       // Remove the 'display' style
              .removeData('isExpanding');

            $ctl.attr('title', 'collapse');

            self.$content.contentOverlay('refresh');
            self.syncNotePositions();

            self._trigger('expanded');
            self._trigger('change', null, 'expanded');
        };

        // Mark this sentence as "being expanded"
        $s.data('isExpanding', true);
        $s.addClass( opts.css.expanded, opts.animSpeed, expandDone);

        // if the previous sibling is NOT visible, expand it.
        if (! $prev.sentence('isVisible'))
        {
            $prev.addClass( opts.css.expansion, opts.animSpeed, expandDone);
        }

        // if the next sibling is NOT visible, expand it.
        if (! $next.sentence('isVisible'))
        {
            $next.addClass( opts.css.expansion, opts.animSpeed, expandDone);
        }
    },

    /** @brief  Collapse this sentence. */
    _collapse: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        if ((opts.expanded === false) || ($s.data('isCollapsing')))
        {
            // Already done / in progress
            return;
        }

        // Triggered when expansion animation is complete
        var $ctl                = $s.find('.controls .expand');
        var $prev               = $s.prev();
        var $next               = $s.next();
        var compNeeded          = 1;
        var collapseDone        = function() {
            if ( --compNeeded > 0)  { return; }

            $s.removeClass( opts.css.expansion )
              .css('display', '')       // Remove the 'display' style
              .removeData('isCollapsing');

            if (! $s.hasClass('highlight'))
            {
                /* The target sentence is NOT highlighted so ensure that
                 * sentence controls are hidden and NOT in "hover mode" and
                 * that any overlay controls are hidden.
                 */
                $s.removeClass('ui-hover')
                  .find('.controls .ui-icon')
                    .css('opacity', '')
                  .end()
                  .find('.overlay-controls')
                    .hide();
            }

            $ctl.attr('title', 'expand');

            self.$content.contentOverlay('refresh');
            self.syncNotePositions();

            self._trigger('collapsed');
            self._trigger('change', null, 'collapsed');
        };
        var collapseExpansion   = function($sib) {
            ++compNeeded;

            $sib.removeClass( opts.css.expansion, opts.animSpeed, collapseDone);

            if ($sib.hasClass('expanded'))
            {
                // Collapse this sibling
                $sib.sentence('expanded', false);
            }
        };

        // Mark this sentence as "being expanded"
        $s.data('isCollapsing', true);

        if ($s.hasClass( opts.css.expanded ))
        {
            // Directly expanded
            $s.removeClass( opts.css.expanded, opts.animSpeed, collapseDone);
        }
        else if ($s.hasClass( opts.css.expansion ))
        {
            // Expanded via sibling
            $s.removeClass( opts.css.expansion, opts.animSpeed, collapseDone);
        }

        // if the previous sibling is an expansion, collapse it.
        if ($prev.hasClass( opts.css.expansion ))
        {
            collapseExpansion($prev);
        }

        // if the next sibling is visible, collapse it.
        if ($next.hasClass( opts.css.expansion ))
        {
            collapseExpansion($next);
        }
    },

    /** @brief  Given an ui.overlayGroup widget, create a new $.Note object to
     *          associate with the overlay group.
     *  @param  $group      The ui.overlayGroup instance to associate with the
     *                      new note;
     *  @param  note        If provided, note to be added -- either serialized
     *                      or a $.Note instance.  If not provided, a new
     *                      $.Note instance will be created;
     *  @param  hide        If true, hide the note widget once created.
     *
     *  @return The new ui.note instance
     */
    _addNote: function( $group, note, hide ) {
        var self    = this;
        var opts    = self.options;

        // Generate a ui.note widget at the same vertical offset as $group.
        var $note   = $('<div />').note({
                        container:  opts.notesPane,
                        note:       note,
                        position:   { of:$group },
                        hidden:     (hide ? true : false)
                      });

        self.notes[ $note.note('id') ] = $note;

        /* Provide data-based links between the overlay group  and the
         * associated note.
         */
        $note.data( 'note-associate', $group);
        $group.data('note-associate',  $note);

        /**************************************************
         * Bind handlers for ui.note
         *
         */
        $note.bind('note-change.ui-sentence', function(e, type) {
            /* Reflect this 'note-change' event up as a 'sentence-change'
             * event.
             */
            self._trigger('change', null, type);
        });

        $note.bind('note-destroyed.ui-sentence', function(e) {
            self._removeNote( $note );
        });

        // Reflect 'comment-change' events
        $note.bind('comment-change.ui-sentence', function(e, type) {
            if (type === 'commentSaved')
            {
                /* Reflect this 'comment-change/commentSaved'
                 * event up as a 'sentence-change' event.
                 */
                self._trigger('change', null, type);
            }
        });

        // Trigger a 'sentence-change/noteAdded' event
        self._trigger('change', null, 'noteAdded');

        return $note;
    },

    /** @brief  Remove the identified note along with the associated overlay
     *          group.
     *  @param  $note   The ui.note widget being removed;
     */
    _removeNote: function( $note ) {
        if (! $note)    { return; }

        var self    = this;
        var opts    = self.options;
        var $group  = $note.data('note-associate');
        var id      = $note.note('id');

        // Destroy the ui.note instance
        if (! $note.data('note-destroying'))
        {
            /* Initiate destruction.  This will end with ui.note firing
             * 'destroyed', which will be caught by our handler established in
             * _addNote() causing _removeNote() to be called again.
             */
            $note.data('note-destroying', true);
            $note.note('destroy');
            return;
        }

        $note.unbind('.ui-sentence')
             .removeData('note-associate');

        // Destroy the ui.overlayGroup instance
        $group.removeData('note-associate')
              .overlayGroup('destroy');

        self.notes[ id ] = undefined;

        self._trigger('change', null, 'noteRemoved');
    },
    
    /** @brief  Bind any relevant event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsBind: function() {
        var self    = this;
        var $s      = self.element;

        /*************************************************************
         * Hover over sentence shows controls.
         *
         */
        $s.hoverIntent(function(e) {
            if ( $s.data('isCollapsing') || (! self.isVisible()) )
            {
                // Do NOT show tools
                return;
            }

            switch (e.type)
            {
            case 'mouseenter':
                // Hover over THIS sentence
                $s.addClass('ui-hover');
                break;

            case 'mouseleave':
                $s.removeClass('ui-hover');
                break;
            }
        });

        /*************************************************************
         * Mouse over sentence controls increases opacity.
         *
         */
        $s.delegate('.controls .su-icon', 'mouseenter mouseleave',
                    function(e) {
            var $el = $(this);

            switch (e.type)
            {
            case 'mouseenter':
                $el.css('opacity', 1.0);
                break;

            case 'mouseleave':
                $el.css('opacity', '');
                break;
            }
        });

        /*************************************************************
         * Click handler for sentence controls
         *
         */
        $s.delegate('.controls .su-icon', 'click',
                    function(e) {
            var $el     = $(this);
            var handled = false;

            if ($el.hasClass('star'))
            {
                self.toggleOption('starred');
                handled = true;
            }
            else if ($el.hasClass('expand'))
            {
                self.toggleOption('expanded');
                handled = true;
            }

            if (handled)
            {
                e.stopPropagation();
                return false;
            }
        });

        /*************************************************************
         * Click handler for sentence overlay controls
         *
         */
        $s.bind('overlaygroup-action.ui-sentence', function(e, control) {
            var $group  = $(e.target);
            var $ctl    = $(control);

            console.log('overlaygroup-action: ctl[ '+ $ctl.attr('class') +' ]');

            if ($ctl.hasClass('tag'))
            {
                // Convert $group to a tag/note
                //$group.parent().contentOverlay('changeType', $group, 'tag');
                $group.overlayGroup('changeType', 'tag');

                // Remove any remaining rangy selections.
                rangy.getSelection().removeAllRanges();

                var note    = { id: self.notes.length };
                var $note   = self._addNote( $group, note );

                if ($.ui.sentence.options.quickTag !== true)
                {
                    // Edit the first (empty) command
                    $note.note('editComment');
                }
            }
            else if ($ctl.hasClass('remove'))
            {
                var $note   = $group.data('note-associate');

                self._removeNote($note);
                //$group.overlayGroup('destroy');
            }
        });

        $s.bind(  'overlaygroup-hover-in.ui-sentence '
                + 'overlaygroup-hover-out.ui-sentence',
                function(e) {
            var $group  = $(e.target);
            var $note   = $group.data('note-associate');

            //console.log('overlaygroup-hover: [ '+ e.type +' ]');

            if ($note)
            {
                if (e.type === 'overlaygroup-hover-in')
                {
                    $note.note('activate');
                }
                else if (! $note.note('hasFocus'))
                {
                    $note.note('deactivate');
                }
            }
        });


        /*************************************************************
         * For clicks on a tagged overlay, activate the related note
         * and focus on the comment reply.
         */
        $s.delegate('.tagged', 'click', function(e) {
            var $group  = $(e.target);
            var $note   = $group.data('note-associate');

            if ($note)
            {
                $note.note('focus');

                e.preventDefault();
                e.stopPropagation();
                return false;
            }
        });

        return self;
    },

    /** @brief  Unbind any bound event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsUnbind: function() {
        var self    = this;
        var $s      = self.element;

        self.element.unhoverIntent();

        $s.undelegate('.controls .su-icon', 'mouseenter mouseleave');
        $s.undelegate('.controls .su-icon', 'click');

        $s.unbind('.ui-sentence');
        $s.unhoverIntent();

        return self;
    }
});

// Global sentence options (shared by all ui.sentence instance).
$.ui.sentence.options = {
    quickTag:   false
};


}(jQuery));

/** @file
 *
 *  Provide a UI overlay (ui.contentOverlay) over the target content element to
 *  allow highlighting of a content area without modifying it directly.
 *
 *  Also provide an overlay group (ui.overlayGroup) to represent a single
 *  overlay within ui.contentOverlay.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *
 *      rangy.js
 */
/*jslint nomen:false, laxbreak:true, white:false, onevar:false */
/*global jQuery:false */
(function($) {

$.widget("ui.contentOverlay", {
    version: "0.0.1",

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'contentOverlay-change' instead of 'contentOverlaychange'.
     */
    widgetEventPrefix:    'contentOverlay-',

    options: {
        /* Valid types for addOverlay() along with the associated cssClass to
         * apply to the group as well as a selector for controls to be
         * presented for that group
         */
        types:      {
            selection:  {
                cssClass:   'selected',
                template:   '#tmpl-overlay-controls'
            },
            tag:        {
                cssClass:   'tagged',
                template:   '#tmpl-overlay-remove-controls'
            },
        }
    },

    /** @brief  Initialize a new instance.
     */
    _init: function() {
        var self     = this;
        var opts     = this.options;

        self.$groups = $(); // initialize as an empty set

        rangy.init();

        // Interaction events
        self._widgetInit()
            ._eventsBind();
    },

    /************************
     * Public methods
     *
     */

    /** @brief  Refresh after some DOM change that would alter overlay
     *          positioning (i.e. expand/collapse of the content element).
     */
    refresh: function() {
        var self    = this;
        var opts    = self.options;

        self.$groups = self.$overlay.find('.group');
        self.$groups.overlayGroup('refresh');
    },

    /** @brief  Add a new overlay.
     *  @param  range   A range either as a rangy WrappedRange object OR
     *                  as a string of the form:
     *                          sentence/child:offset,child:offset
     *  @param  type    The overlay type (from $.ui.overlayGroup.types);
     *
     *  @return The new overlayGroup.
     */
    addOverlay: function(range, type) {
        var self        = this;
        var opts        = self.options;
        var typeInfo    = $.ui.overlayGroup.types[ type ];
        if (typeInfo === undefined)
        {
            // Invalid type
            return;
        }

        // Create an overlay group and add an element for each segment.
        var $group  = $('<div />')
                        .appendTo( self.$overlay )
                        .overlayGroup({
                            cssClass:   typeInfo.cssClass,
                            template:   typeInfo.template,
                            content:    self.element,
                            range:      range
                        });

        // Update our list of contained groups
        self.$groups = self.$overlay.find('.group');

        return $group;
    },

    /** @brief  Remove all overlays of the given type.
     *  @param  type    The overlay type (from $.ui.overlayGroup.types);
     *                  If not provided, remove ALL overlays;
     */
    removeAll: function(type) {
        var self        = this;
        var opts        = self.options;

        // If there are no groups, return now.
        if (self.$groups.length < 1)    { return; }

        var $groups     = self.$groups;
        if (type)
        {
            var typeInfo    = $.ui.overlayGroup.types[ type ];
            if (typeInfo === undefined)
            {
                // Invalid type
                return;
            }

            $groups = $groups.filter('.'+ typeInfo.cssClass);
        }

        $groups.overlayGroup('destroy');
    },

    /** @brief  Destroy this widget.
     *
     *  @return this for a fluent interface.
     */
    destroy: function() {
        this._eventsUnbind()
            ._widgetClean();

        return this;
    },

    /************************
     * "Private" methods
     *
     */

    /** @brief  Create the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetInit: function() {
        var self    = this;
        var opts    = self.options;

        self.$overlay = $('<div />')
                            .addClass('overlay')
                            .insertBefore( self.element );

        return self;
    },

    /** @brief  Destroy the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetClean: function() {
        var self    = this;
        var opts    = self.options;

        self.removeAll();
        self.$overlay.remove();

        return self;
    },

    /** @brief  Bind any relevant event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsBind: function() {
        var self    = this;
        var opts    = self.options;

        /*************************************************************
         * Catch any mousedown events that reach 'document' and,
         * when seen, remove any current selection within this
         * overlay.
         */
        self._mouseDown = function(e) {
            self.removeAll('selection');
        };

        $(document).bind('mousedown', self._mouseDown);

        /*************************************************************
         * Since overlays are absolutely positioned BELOW the content,
         * in order to recognize hovers and clicks on an overlay, we
         * must monitor events in the primary content area and adjust
         * them for the overlay.
         *
         * For hover, this requires a mouse movement handler that
         * performs hit testing on the overlay groups.
         *
         */
        self.element.bind('mousemove mouseleave mousedown mouseup click',
                           function(e) {

            // Does this mouse event hit any of our overlays?
            var hit     = null;
            self.$groups.each(function() {
                hit = $(this).overlayGroup('hitTest', e);

                if (hit !== null)   { return false; }
            });

            if ( (hit === null) && (e.type === 'mouseup') )
            {
                /* If there was no hit AND this is a mouseup event,
                 * see if we have a rangy selection.
                 */
                var sel     = rangy.getSelection();
                var strSel  = sel.toString();

                // Remove any existing selection overlay
                self.removeAll('selection');

                if (strSel.length > 0)
                {
                    /* Ensure that the wrappedRange has a start and end element
                     * share the same grand-parent (content area).  If not,
                     * contract the range and invoke addOverlay() on the proper
                     * ui.contentOverlay.
                     */
                    var type            = 'selection';
                    var range           = sel.getRangeAt(0);
                    var $start          = $(range.startContainer);
                    var $end            = $(range.endContainer);
                    var $ancestorStart  = $start.parent().parent();
                    var $ancestorEnd    = $end.parent().parent();
                    var $group;

                    if ($ancestorStart[0] !== $ancestorEnd[0])
                    {
                        /* Contract the range to end with the last offset
                         * within the last child of $ancestorStart.
                         */
                        $end = $ancestorStart.children().last();

                        range.setEnd($end[0].childNodes[0],
                                     $end.text().length);

                        if ($ancestorStart[0] !== self.element[0])
                        {
                            /* Reset the selection to include JUST the adjusted
                             * range
                             */
                            sel.setSingleRange( range );

                            /* Inovke addOverlay() on the ui.contentOverlay
                             * widget associated with $ancestorStart
                             */
                            $group = $ancestorStart
                                        .contentOverlay('addOverlay',
                                                        range, type);
                        }
                    }

                    if (! $group)
                    {
                        /* Range adjustment did NOT result in the creation of
                         * an ui.overlayGroup by another ui.contentOverlay, so
                         * create a new ui.overlayGroup now that is connected
                         * with THIS ui.contentOverlay widget.
                         */
                        $group = self.addOverlay(range, type);
                    }

                    // Squelch this 'mouseup' event
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }
        });

        /*************************************************************
         * Handle maintenance events from ui.overlayGroup.
         *
         */
        self.$overlay.bind('overlaygroup-destroyed', function(e) {
            // Remove the group element that we created
            var $group  = $(e.target);
            $group.remove();

            // Update our list of contained groups
            self.$groups = self.$overlay.find('.group');
        });

        return self;
    },

    /** @brief  Unbind any bound event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsUnbind: function() {
        var self    = this;

        $(document).unbind('mousedown', self._mouseDown);

        self.element.unbind('mousemove mouseleave mousedown mouseup click');
        self.$overlay.unbind('overlaygroup-destroyed');

        return self;
    }
});

/****************************************************************************
 * An overlay group, possibly with overlay controls.
 *
 */
$.widget("ui.overlayGroup", {
    version: "0.0.1",

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'overlayGroup-change' instead of 'overlayGroupchange'.
     */
    widgetEventPrefix:    'overlayGroup-',

    options: {
        cssClass:   'selected',
        template:   '#tmpl-overlay-controls',

        segments:   [],     /* An array of positions representing contiguous,
                             * per-"line" areas within the overlay group.
                             * Each entry should have the form:
                             *      { top:      position value,
                             *        left:     position value,
                             *        height:   size value,
                             *        width:    size value }
                             */

        content:    null,   // The jQuery/DOM element OR selector of the
                            // overlayed content area

        range:      null,   /* The serialized rangy range that fully defines
                             * this group within the context of 'content'.
                             */

        /* How much of a delta should be allowed between mouse events before
         * calling it a hover?
         */
        hoverDelta: 5
    },

    /** @brief  Initialize a new instance.
     *
     *  Valid options:
     *      cssClass    The css class to apply to this overlay group;
     *      template    If provided, a selector for the template to use
     *                  for overlay controls;
     *      segments    An array of positions representing contiguous,
     *                  per-"line" areas within the overlay group.
     *                  Each entry should have the form:
     *                       { top:      position value,
     *                         left:     position value,
     *                         height:   size value,
     *                         width:    size value }
     *
     *      range       The serialized rangy range that fully defines this
     *                  group within the context of 'content' of the form:
     *                      { start: serialized-start-position,
     *                        end:   serialized-end-position }
     *
     *      content     The jQuery/DOM element OR selector of the overlayed
     *                  content area [ the '.content' sibling of our parent ];
     *
     *      hoverDelta  How much of a delta should be allowed between mouse
     *                  events before calling it a hover [ 2 ];
     */
    _init: function() {
        var self      = this;
        var opts      = this.options;

        if ((opts.range !== null) &&
            (opts.range instanceof rangy.WrappedRange))
        {
            // Serialize the range
            self.wrappedRange = opts.range;
        }

        // Interaction events
        self._widgetInit()
            ._eventsBind();
    },

    /** @brief  Destroy this widget.
     *
     *  @return this for a fluent interface.
     */
    destroy: function() {
        var self    = this;

        if (self._destroyed)    { return; }

        self._eventsUnbind()
            ._widgetClean();

        self.element.empty();

        self._destroyed = true;
        self._trigger('destroyed');

        return self;
    },

    /** @brief  Serialize this group.
     *
     *  @return A serialized version of this group.
     */
    serialize: function() {
        var self        = this;
        var opts        = self.options;

        return opts.range;
    },

    /** @brief  Unserialize this group.
     *  @param  group   The serialized version (from serialize());
     *
     *  @return this for a fluent interface.
     */
    unserialize: function(group) {
        var self    = this;
        var opts    = self.options;

        opts.range = group;

        return this;
    },


    /** @brief  Retrieve the associated control element (if any).
     *
     *  @return The associated control element (or undefined).
     */
    getControl: function() {
        return this.$ctl;
    },

    /** @brief  Refresh after some DOM change that would alter overlay
     *          positioning (i.e. expand/collapse of the content element).
     */
    refresh: function() {
        var self    = this;
        var opts    = self.options;

        /********************************************************************
         * Measure the location of the selection, breaking it into segments
         * according to "lines".
         *
         * Start by locating the absolute offsets into the *text* of the
         * content area, generating measurement elements ($pre, $sel),
         * and extracting the selected *text* (strSel).
         */
        var range       = self.wrappedRange;
        var strFull     = self.$content.text();
        var $start      = $(range.startContainer).parent();
        var $end        = $(range.endContainer).parent();

        // All spans within the content
        var $text       = self.$content.children();

        // All spans BEFORE the startContainer
        var $toStart    = $text.slice(0, $text.index($start) );
        var offsetStart = $toStart.text().length + range.startOffset;

        // All spans BEFORE the endContainer
        var $toEnd      = $text.slice(0, $text.index($end) );
        var offsetEnd   = $toEnd.text().length + range.endOffset;

        // The selected string
        var strSel      = strFull.substr(offsetStart,
                                         (offsetEnd - offsetStart));

        // Elements to measure offsets
        var $pre        = $('<span />')
                            .addClass('text')
                            .css('visibility', 'hidden')
                            .text( strFull.substr(0, offsetStart ) )
                            .appendTo(self.$overlay);
        var $sel        = $('<span />')
                            .addClass('text')
                            .css('visibility', 'hidden')
                            .appendTo(self.$overlay);

        /********************************************************************
         * Split the selected text into words and add each as a separate,
         * measureable element to $sel.
         */
        var re  = /([\w’']+)(\W+)?/i;
        var parts;
        while ( (parts = re.exec(strSel)) )
        {
            // Create elements for the word and word separator.
            $('<span />')
                .text(parts[1])
                .appendTo($sel);

            if (parts[2])
            {
                $('<span />')
                    .text(parts[2])
                    .appendTo($sel);
            }

            // Remove this word and word separator
            strSel = strSel.substr(parts[1].length +
                                   (parts[2] ? parts[2].length : 0));
        }

        /********************************************************************
         * Using our constructed selection measurement element ($sel),
         * generate overlay segments by grouping words based upon their top
         * offsets.  This results in one segment per "line" of text.
         */
        var base        = self.$content.offset();
        var segments    = [];
        var segment;        // Current segment
        var lastOffset;

        $sel.children().each( function() {
            var $word   = $(this);
            var offset  = $word.offset();
            if ( (! lastOffset) || (offset.top !== lastOffset.top))
            {
                // New segment
                if (segment)
                {
                    if ((segment.width < 1) && (segment.height < 1))
                    {
                        /* Remove empty segments -- can happen if a selection
                         * crosses a line boundry.
                         */
                        segments.pop();
                    }
                }

                // Begin the new segment and add it to the list
                segment = {
                    top:    offset.top  - base.top,
                    left:   offset.left - base.left,
                    width:  $word.width(),
                    height: $word.height()
                };

                segments.push( segment );
            }
            else
            {
                // Same "line" -- add the width to the current segment
                segment.width += $word.width();
            }

            lastOffset = offset;
        });

        // Remove our measurement elements
        $pre.remove();
        $sel.remove();

        /* Do NOT remove the rangy selection.  Let our parent do that if needed
         * since a selection MAY be represented by a native selection object in
         * order to ensure we have proper selection coloring (e.g. grey with
         * revered text) without the need to insert disruptive elements.  The
         * generated overlay group elements will be used for hit testing as
         * well as a positining anchor for any overlay controls.
         *
         *  rangy.getSelection().removeAllRanges();
         */
 
        /********************************************************************
         * Create an overlay element for every segment
         *
         * In the process, generate an 'extents' object containing the
         * maximal outer boundaries of the full group.
         */
        self.element.empty();

        var extent  = {
            top:    99999,
            left:   99999,
            bottom: 0,
            right:  0
        };
        $.each(segments, function() {
            var segment = this;

            // Update our extent
            extent.top    = Math.min(extent.top,    segment.top);
            extent.left   = Math.min(extent.left,   segment.left);
            extent.bottom = Math.max(extent.bottom, segment.top +
                                                    segment.height);
            extent.right  = Math.max(extent.right,  segment.left +
                                                    segment.width);

            // Expand the segment slightly to provide a better enclosure
            segment.top  -= 1; segment.height += 2;
            //segment.left -= 2; segment.width  += 4;

            // Create the overly element
            $('<div />') 
                .addClass('text '+ opts.cssClass)
                //.css('position', 'absolute')
                //.css('display',  'block')
                .css( segment )
                .data('contentOverlay-segment', segment)
                .appendTo( self.element );
        });
        opts.extent = extent;

        self.$segments = self.element.children();

        if (self.$ctl)
        {
            // Adjust our control
            var pos     = (self.$segments.length > 0
                                ? self.$segments.position()
                                : self.element.position());

            pos.top -= self.$ctl.height();
            self.$ctl.css( pos );
        }
    },

    /** @brief  Change the type of this overlay group.
     *  @param  type    The overlay type (from $.ui.overlayGroup.types);
     */
    changeType: function(type) {
        var self        = this;
        var opts        = self.options;
        var typeInfo    = $.ui.overlayGroup.types[ type ];
        if (typeInfo === undefined)
        {
            // Invalid type
            return;
        }

        // Change the css class and control template
        self._setOption('cssClass', typeInfo.cssClass);
        self._setOption('template', typeInfo.template);
    },

    /** @brief  Given a mouse event, see if the pointer is within this overlay
     *          group or it's associated overlay control.
     *  @param  e       The mouse event;
     *
     *  @return Hit type ('element', 'control', or null if no hit).
     */
    hitTest: function(e) {
        var self    = this;
        var opts    = self.options;
        var hit     = null;
        var $group  = self.element;

        self.$segments.each(function() {
            var $el     = $(this);
            var segment = $el.data('contentOverlay-segment');
            if (! segment) { return; }

            var right   = segment.left + segment.width;
            var bottom  = segment.top  + segment.height;

            /* Normalize the event's offsetX/offsetY
             * (Firefox will have an undefined offsetX/offsetY,
             *  Chrome  sets offsetX/offsetY to the offset of the event from
             *          the target element).
             */
            var eOffset = {
                x:  (e.offsetX !== undefined
                        ? e.offsetX
                        : e.pageX - $(e.target).offset().left),
                y:  (e.offsetY !== undefined
                        ? e.offsetY
                        : e.pageY - $(e.target).offset().top)
            };

            if (e.offsetX === undefined)
            {
                // Include the normalized offset information in the event
                e.offsetX = eOffset.x;
                e.offsetY = eOffset.y;
            }

            /*
            console.log('ui.overlayGroup::hitTest: '
                          + 'eOffset[ '+ eOffset.x +', '+ eOffset.y +' ], '
                          + 'group[ '+ $group.attr('class') +' ], '
                          + 'segment[ '+ segment.left +', '
                          +              segment.top +' - '
                          +              right +', '
                          +              bottom +' ]');
            // */

            if ((eOffset.x >= segment.left) && (eOffset.x <= right) &&
                (eOffset.y >= segment.top)  && (eOffset.y <= bottom))
            {
                // HIT -- within a segment.
                hit = {
                    type:   'element',
                    $el:    $el,
                    $group: $group
                };
                return false;
            }
        });

        /* If we have an associated control, we need to adjust the control
         * based upon hit or miss.
         */
        if (self.$ctl)
        {
            if (hit === null)
            {
                /* We don't yet have a hit.  See if the event occurred within
                 * our control.
                 */
                var segment     = self.$ctl.offset();
    
                segment.top    -= 2; segment.height = self.$ctl.height() + 4;
                segment.left   -= 2; segment.width  = self.$ctl.width()  + 4;

                right           = segment.left + segment.width;
                bottom          = segment.top  + segment.height;
    
                if ((e.pageX >= segment.left) && (e.pageX <= right) &&
                    (e.pageY >= segment.top)  && (e.pageY <= bottom))
                {
                    // HIT -- within the control
                    hit = {
                        type:   'control',
                        $el:    self.$ctl,
                        $group: $group
                    };
                }
            }

            if (hit !== null)
            {
                // We have a hit on this overlayGroup and we have a control.

                /**************************************************************
                 * This event hit within this group.
                 *
                 */
                if ( // Always squelch (mousemove)
                     (e.type === 'mousemove')                                ||
                     // For 'control', squelch (mousedown, mouseup)
                     ((hit.type === 'control') &&
                      ((e.type  === 'mousedown') || (e.type === 'mouseup'))) )
                {
                    // Squelch all mouse events EXCEPT 'click'
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    /* If this is a mousemove event and the last location was
                     * nearly the same as this AND we haven't triggered a hover
                     * event, trigger one now.
                     */
                    if (! self.hovering)
                    {
                        var last    = self.lastEvent;
                        if (last &&
                            (Math.abs(last.pageX - e.pageX)
                                                    < opts.hoverDelta) &&
                            (Math.abs(last.pageY - e.pageY)
                                                    < opts.hoverDelta) )
                        {
                            // Trigger a hover-in event
                            self.hovering = true;
                            self._trigger('hover-in', e, hit);
                        }
                    }
                }
                else if ((hit.type === 'control') && (e.type === 'click'))
                {
                    /*
                    console.log('ui.overlayGroup::hitTest: '
                                + 'type[ '+ e.type +' ], '
                                + 'target[ '+ $(e.target).attr('class') +' ]');
                    // */

                    /* Trigger a new event on our group that references
                     * the click target
                     */
                    self._trigger('action', null, e.target);

                    // Squelch the current event
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
                else if (e.type === 'click')
                {
                    // Trigger a new click event on our group.
                    self.element.click();

                    // Squelch the original event
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }

                self.lastEvent = e;
            }
            else if (self.hovering)
            {
                // Trigger a hover-out
                self._trigger('hover-out', null);

                self.hovering = false;
            }
        }

        return hit;
    },

    /************************
     * "Private" methods
     *
     */

    /** @brief  Override widget._setOption() to handle additional functionality
     *  @param  key     The property being set;
     *  @param  value   The new property value;
     */
    _setOption: function(key, value) {
        var self    = this;
        var opts    = self.options;

        switch (key)
        {
        case 'cssClass':
            self.element
                    .removeClass(opts.cssClass)
                    .addClass( value );
            self.element.children()
                    .removeClass(opts.cssClass)
                    .addClass( value );

            if (self.$ctl)
            {
                self.$ctl.removeClass(opts.cssClass)
                         .addClass( value );
            }
            break;

        case 'template':
            if (self.$ctl)  { self.$ctl.remove(); }

            /* Create a new overlay control element and append it to the
             * content area.
             */
            var pos     = (self.$segments.length > 0
                                ? self.$segments.position()
                                : self.element.position());
            self.$ctl   = $( value )
                            .tmpl()
                            .addClass('overlay-controls '+ opts.cssClass)
                            .hide()
                            .appendTo( self.$content );

            pos.top -= self.$ctl.height();
            self.$ctl.css( pos );

            // Give the group and control knowledge of one another
            self.$ctl.data(   'contentOverlay-group',   self.element);
            self.element.data('contentOverlay-control', self.$ctl);
            break;

        case 'content':
            self.$content = $( value );
            if (self.$ctl)
            {
                // Move the exising controls to the new content area
                self.$ctl.appendTo( self.$content );
            }

            if ((! self.wrappedRange) && (opts.range !== null))
            {
                // Attempt to generate a wrappedRange from opts.range
                var rangeStart,
                    rangeEnd;

                if (opts.range instanceof rangy.WrappedRange)
                {
                    self.wrappedRange = opts.range;
                }
                else if (typeof opts.range === 'string')
                {
                    var re      = /^([0-9\/]+:[0-9]+),([0-9\/]+:[0-9]+)$/;
                    var ranges  = range.match( re );

                    rangeStart  = ranges[1];
                    rangeEnd    = ranges[2];
                }
                else if ($.isPlainObject( opts.range ))
                {
                    /* Allow a range object of the form:
                     *  { start:    serialized-range-string,
                     *    end:      serialized-range-string}
                     */
                    rangeStart = opts.range.start;
                    rangeEnd   = opts.range.end;
                }

                if (rangeStart && rangeEnd)
                {
                    var start   = rangy.deserializePosition(
                                    rangeStart,
                                    self.$content[0]);
                    var end     = rangy.deserializePosition(
                                    rangeEnd,
                                    self.$content[0]);

                    self.wrappedRange = rangy.createRange();

                    self.wrappedRange.setStart(start.node, start.offset);
                    self.wrappedRange.setEnd(end.node, end.offset);
                }
            }

            if (self.wrappedRange)
            {
                // Serialize the range within the context of self.$content
                opts.range = {
                    start:  rangy.serializePosition(
                                            self.wrappedRange.startContainer,
                                            self.wrappedRange.startOffset,
                                            self.$content[0]),
                    end:    rangy.serializePosition(
                                            self.wrappedRange.endContainer,
                                            self.wrappedRange.endOffset,
                                            self.$content[0])
                };
            }

            // (Re)generate our segments
            self.refresh();
            break;
        }

        $.Widget.prototype._setOption.apply( self, arguments );
    },

    /** @brief  Create the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetInit: function() {
        var self    = this;
        var opts    = self.options;

        self.element.addClass('group');
        self.$overlay = self.element.parent();

        /* Ensure our initial options are properly reflected in our operating
         * state by forcing calls to _setOption()
         */
        if (opts.cssClass)  { self._setOption('cssClass', opts.cssClass); }
        if (opts.content)   { self._setOption('content',  opts.content);  }
        if (opts.template)  { self._setOption('template', opts.template); }

        return self;
    },

    /** @brief  Destroy the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetClean: function() {
        var self    = this;
        var opts    = self.options;

        if (self.$ctl)  { self.$ctl.remove(); }

        self.element
                .removeClass(opts.cssClass)
                .removeClass('group');

        return self;
    },

    /** @brief  Bind any relevant event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsBind: function() {
        var self    = this;
        var opts    = self.options;

        /** @brief  handle a 'hover-in' event triggered on the element of this
         *          widget.
         *  @param  e       The triggered event;
         *  @param  hit     The hit object generated via hitTest() that
         *                  indicates the hit type ('element' | 'control') as
         *                  well as the specific segment element;
         */
        var hoverIn = function(e, hit) {
            /* The overlay control is not currently visible.
             *
             * Show it now positioned near the pointer.
             */
            var ctlHeight   = self.$ctl.height();
            var ctlWidth    = self.$ctl.width();
            var elPos       = hit.$el.position();
            var css         = 'corner-top';
            elPos.bottom    = elPos.top  + hit.$el.height();
            elPos.right     = elPos.left + hit.$el.width();

            var pos         = {
                top:    elPos.top - ctlHeight,
                left:   e.offsetX - (ctlWidth / 2)
            };
            if (pos.left < elPos.left)
            {
                // Ctl will be left of the segment -- adjust
                pos.left = elPos.left;
            }

            var posBottom = pos.top  + ctlHeight;
            var posRight  = pos.left + ctlWidth;
            if (posRight > (elPos.right - 4))
            {
                // Ctl will be right of the segment -- adjust
                pos.left  = elPos.right - ctlWidth - 4;
            }

            /* If we have multiple segments (i.e. multiple lines),
             * see if we should align to the top or bottom.
             */
            if ((self.$segments.length > 1) &&
                (e.offsetY > ((opts.extent.bottom - opts.extent.top) / 2) - 4))
            {
                /* Bottom - Position the control along the bottom of the
                 *          segment
                 */
                pos.top = posBottom + ctlHeight - 2;
                css     = 'corner-bottom';
            }

            self.$ctl.css( pos )
                     .removeClass('corner-bottom corner-top')
                     .addClass( css )
                     .show();
        };
        var hoverOut    = function(e) {
            self.$ctl.hide();
        };


        self.element.bind('overlaygroup-hover-in.overlayGroup',  hoverIn);
        self.element.bind('overlaygroup-hover-out.overlayGroup', hoverOut);

        //opts['hover-in']  = hoverIn;
        //opts['hover-out'] = hoverOut;

        return self;
    },

    /** @brief  Unbind any bound event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsUnbind: function() {
        var self    = this;

        return self;
    }
});

/* Valid types for addOverlay() along with the associated cssClass to
 * apply to the group as well as a selector for controls to be
 * presented for that group
 */
$.ui.overlayGroup.types = {
    selection:  {
        cssClass:   'selected',
        template:   '#tmpl-overlay-controls'
    },
    tag:        {
        cssClass:   'tagged',
        template:   '#tmpl-overlay-remove-controls'
    },
};


}(jQuery));
/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *      jquery.delegateHoverIntent.js
 *
 *      ui.checkbox.js
 *      ui.sentence.js
 */
(function($) {

/** @brief  Summary widget */
$.fn.summary = function(options) {
    options = options || {};

    return this.each(function() {
        var $el = $(this);
        
        $el.data('summary', new $.Summary( $el, options ));
    });
};


/** @brief  The Summary class */
$.Summary = function($el, options) {
    return this.init($el, options);
};

$.Summary.prototype = {
    options: {
        src:            null,       // The URL of the original source
        metadata:       null,       /* The URL of the
                                     * summarization/characterization metadata
                                     */

        threshold:      {           // The desired min/max threshold
            min:        -1,         // If -1,-1, dynamically determine the
            max:        -1          //  threshold based upon 'showSentences'
        },
        filter:         'normal',   // The initial filter (tagged,starred)
        
        showSentences:  5,          /* The minimum number of sentences to
                                     * present
                                     */

        quickTag:       true,       // Using quick tag?

        rankOpacity:    0.3,        // The default opacity for rank items
        animSpeed:      200         // Speed (in ms) of animations
    },

    /** @brief  Initialize this new instance.
     *  @param  el          The jQuery DOM element.
     *  @param  options     Initialization options.
     *
     *  @return this for a fluent interface.
     */
    init: function(el, options) {
        var self        = this;
        var opts        = $.extend(true, {}, self.options, options);

        self.element    = el;
        self.options    = opts;
        self.metadata   = null;
        self.state      = [];   // Sentence state based upon their DOM index

        var $gp         = self.element.parent().parent();
        self.$control         = $gp.find('.control-pane');
        self.$tags            = $gp.find('.tags-pane');
        self.$threshold       = self.$control.find('.threshold');
        self.$thresholdValues = self.$threshold.find('.values');
        
        // Initialize any widgets
        self.$buttons   = self.$control.find('.buttons button').button();
        self.$filters   = self.$control.find('.filter :checkbox');
        self.$options   = self.$control.find('.options :checkbox');

        /*********************************************************
         * controls:threshold
         *
         */
        self.$control.find('.buttons .expansion').buttonset();

        /*********************************************************
         * controls:filters
         *
         */
        var $tagged     = self.$filters.filter('#filter-tagged');
        var $starred    = self.$filters.filter('#filter-starred');

        $tagged.checkbox({
            cssOn:      'su-icon su-icon-tag-blue',
            cssOff:     'su-icon su-icon-tag',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });
        $starred.checkbox({
            cssOn:      'su-icon su-icon-star-blue',
            cssOff:     'su-icon su-icon-star',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });

        /*********************************************************
         * controls:options
         *
         */
        var globalOpts  = self._getOptions();
        var $quickTag   = self.$options.filter('#options-quickTag');

        $.ui.sentence.options.quickTag = globalOpts.quickTag;

        $quickTag.checkbox({
            cssOn:      'su-icon su-icon-tagQuick',
            cssOff:     'su-icon su-icon-tagQuick-blue',
            titleOn:    'click to enable',
            titleOff:   'click to disable',
            hideLabel:  true,

            /* Since we use the 'quickTag' icon as an indicator, the logic is a
             * little backwards.  If the checkbox is NOT checked, we're in
             * 'quick' mode, otherwise, 'normal' mode.
             */
            checked:    (! globalOpts.quickTag )
        });


        /*********************************************************
         * Show the initialized control.
         *
         */
        self.$control.show();

        // Bind events
        self._bindEvents();

        // Kick off the retrieval of the metadata
        self.element.addClass('loading');

        var getMetadata  = $.get(opts.metadata);
        getMetadata.success(function( data ) {
            self.metadata = data;

            // Perform the initial rendering of the xml
            self.render();

            self.element.removeClass('loading');
        });
        getMetadata.error(function() {
            alert("Cannot retrieve metadata '"+ opts.metadata +"'");
        });
    },

    /** @brief  Invoked to cleanup this widget. */
    destroy: function() {
        self._unbindEvents();
    },

    /** @brief  Render the summary information over the main article.
     */
    render: function() {
        var self    = this;
        var opts    = self.options;

        // If we have NOT retrieved the XML meta-data, no rendering.
        if (self.metadata === null) { return; }
        
        /* Disable put since we're performing an initial render based upon
         * the incoming XML AND any serialized state
         */
        self._noPut = true;

        // Retrieve the filter state for the current meta-data URL
        var state   = self._getState(opts.metadata);
        if (state)
        {
            opts.threshold.min = state.threshold.min;
            opts.threshold.max = state.threshold.max;
            opts.filter        = state.filter;
            
            self.state         = (state.state ? state.state : []);
        }

        // Renter the XML
        self.renderXml( self.metadata );

        // Find all sentences and bucket them based upon 'rank'
        self.$p     = self.element.find('p');
        self.$s     = self.$p.find('.sentence');
        self.$kws   = self.element.find('.keyword');
        self.ranks  = [];

        /* Instantiate the ui.sentence widgets using any parallel serialized
         * state.
         */
        self.$s.each(function(idex) {
            var $el     = $(this);
            var config  = ( self.state.length > idex
                                ? self.state[idex]
                                : null );

            // Instantiate the sentence using the serialized state (if any)
            $el.sentence( config );

            var rank    = $el.sentence('option', 'rank');

            if (self.ranks[rank] === undefined) { self.ranks[rank] = []; }
            self.ranks[rank].push($el);
        });

        var threshold   = opts.threshold;
        if ((opts.threshold.min < 0) || (opts.threshold.max < 0))
        {
            threshold          = self._computeThreshold();
            self.origThreshold = threshold;

        }

        /* Ensure the filter is properly set (without a refresh).
         * The refresh will take place when we set the threshold.
         */
        self._changeFilter(opts.filter, true);
        self.threshold( threshold.min, threshold.max);

        // Re-enable put
        self._noPut = false;
    },

    /** @brief  Given XML content, convert it to stylable HTML.
     *  @param  xml     The XML to render.
     *
     */
    renderXml: function(xml) {
        var self    = this;
        var opts    = self.options;
        var $xml    = $( xml );

        /* Convert the XML to HTML that can be styled.
         *
         * First, handle any <header>, adding a <header> element BEFORE this
         * element.
         */
        var $header     = $('<header />').appendTo( self.element );
        var $doc        = $xml.find('document');
        var src         = $doc.attr('src');

        if (src) { opts.src = src; }

        $doc.children().each(function() {
            var $el = $(this);

            switch (this.nodeName)
            {
            case 'title':
                var $h1 = $('<h1 />');

                if (opts.src !== null)
                {
                    var $a  = $('<a />')
                                .attr('href', opts.src)
                                .text( $el.text() )
                                .appendTo($h1);
                }
                else
                {
                    $h1.text( $el.text() );
                }

                $header.append( $h1 );
                break;

            case 'published':
                var str     = $el.find('date').text() +' '
                            + $el.find('time').text();
                var date    = new Date(str);
                var $time   = $('<time />')
                                .attr('datetime', date.toISOString())
                                .attr('pubdate',  true)
                                .text(str)
                                .appendTo($header);
                break;

            case 'keywords':
                // Process any XML <keyword> elements
                $('#tmpl-header-keywords')
                    .tmpl({ keywords: $el.find('keyword') })
                    .appendTo($header);
                break;

            case 'body':
                // Process any XML <section> elements
                $el.find('section').each(function() {
                    // Leave this for later
                    var $div     = $('<section />')
                                        .appendTo( self.element );

                    // Convert the XML <p> to an HTML <p>
                    $(this).find('p').each(function() {
                        var $p  = $('<p />')
                                    .appendTo($div);

                        // Convert the XML <s> to an HTML <div>
                        $(this).find('s').each(function() {
                            var $s          = $(this);
                            var rank        = parseFloat($s.attr('rank'));

                            /* If there is one or more <w> element that does
                             * NOT have a 'keyword' attribute, don't create
                             * elements for raw text, just for <w> elements.
                             */
                            var ignoreText  = ($s.find('w:not([keyword])')
                                                                .length > 0);
                            if (isNaN(rank))    { rank = 0; }

                            /* Treat the rank as an integer percentile
                             * (0 ..  100).
                             */
                            rank = parseInt(rank * 100, 10);

                            var $sEl = $('#tmpl-sentence')
                                            .tmpl( {rank: rank} )
                                            .appendTo($p);
                            var $sC  = $sEl.find('.content');

                            /* Mark the sentence with information about whether
                             * it contains ONLY word elements or if text spans
                             * contain multiple words.
                             */
                            $sEl.attr('wordElements', ignoreText);

                            $sEl.find('.rank')
                                    .css('opacity', opts.rankOpacity);

                            // Assemble the HTML from the XML
                            $.each(this.childNodes, function() {
                                var $node   = $(this);
                                switch (this.nodeName)
                                {
                                case '#text':
                                    if (ignoreText === true)
                                    {
                                        // Ignore
                                        return;
                                    }
                                    // Fall through

                                case 'w':
                                    if ($node.attr('keyword'))
                                    {
                                        $('#tmpl-sentence-keyword')
                                            .tmpl( {
                                                keyword:$node.attr('keyword'),
                                                text:   $node.text()
                                            } )
                                            .appendTo( $sC );
                                    }
                                    else
                                    {
                                        $('#tmpl-sentence-text')
                                            .tmpl( {
                                                text:   $node.text()
                                            } )
                                            .appendTo( $sC );
                                    }
                                    break;

                                case 'keyword':
                                    $('#tmpl-sentence-keyword')
                                        .tmpl( {
                                            keyword:$node.attr('name'),
                                            text:   $node.text()
                                        } )
                                        .appendTo( $sC );
                                    break;
                                }
                            });
                        });
                    });
                });
                break;

            default:
                $header.append( $el );
                break;
            }
        });

    },

    /** @brief  Change the rank threshold.
     *  @param  min     The minimum threshold.
     *  @param  max     The maximum threshold.
     */
    threshold: function( min, max) {
        var self        = this;
        var opts        = self.options;
        var isExpand    = (min < opts.threshold.min);

        // Update the threshold and threshold value presentation
        opts.threshold.min = min;
        opts.threshold.max = max;

        self.refresh( isExpand );
    },

    /** @brief  Refresh the presentation based upon the current filter and
     *          thresholds.
     *  @param  isExpand        Is this an
     *                              expansion   (true),
     *                              contraction (false) or
     *                              neither     (undefined).
     *
     */
    refresh: function(isExpand) {
        var self        = this;
        var opts        = self.options;

        var str = opts.threshold.min +' - ' + opts.threshold.max;
        self.$thresholdValues.text( str );

        /* Initially mark all sentences as 'NOT highlighted' and all
         * paragraphs as 'NOT shown'
         */
        self.$s.addClass('noHighlight');

        if (opts.filter === 'normal')
        {
            // Show only sentences within the threshold range
            for (var idex = opts.threshold.max;
                    idex >= opts.threshold.min;
                        idex--)
            {
                var ar  = self.ranks[idex];
                if (ar === undefined)   { continue; }

                var nItems  = ar.length;
                for (var jdex = 0; jdex < nItems; jdex++)
                {
                    // Mark this sentence as TO BE highlighted
                    var $s      = ar[jdex];
                    $s.addClass('toHighlight')
                      .removeClass('noHighlight');
                }
            }
        }
        else
        {
            if (opts.filter.indexOf('tagged') >= 0)
            {
                /* Show ALL sentences containing one or more tags regardless of
                 * threshold
                 */
                self.$s.filter( ':has(.tagged)' )
                        .addClass('toHighlight')
                        .removeClass('noHighlight');
            }

            if (opts.filter.indexOf('starred') >= 0)
            {
                // Show ALL starred sentences regardless of threshold
                self.$s.filter( '.starred' )
                        .addClass('toHighlight')
                        .removeClass('noHighlight');
            }
        }

        /* Hide expansion controls for sentences that have no siblings that
         * would be expanded.
         */
        self.$s.sentence('option', 'noExpansion', false);
        self.$p.each(function() {
            var $p          = $(this);
            var $ss         = $p.find('.sentence');

            if ($ss.length === 1)
            {
                // Only one sentence period -- Always hide
                $ss.sentence('option', 'noExpansion', true);
                return;
            }

            $ss.each(function() {
                var $s  = $(this);
                var $pS = $s.prev();
                var $nS = $s.next();
                if ($pS.length < 1)
                {
                    // First sentence
                    if ($s.hasClass('noHighlight') ||   // is NOT highlighted
                        ($nS.length < 1)           ||   // No next
                        $nS.hasClass('toHighlight'))    // Next is highlighted
                    {
                        $s.sentence('option', 'noExpansion', true);
                    }
                }
                else if ($nS.length < 1)
                {
                    // Last sentence
                    if ($s.hasClass('noHighlight') ||   // is NOT highlighted
                        ($pS.length < 1)           ||   // No previous
                        $pS.hasClass('toHighlight'))    // Prev is highlighted
                    {
                        $s.sentence('option', 'noExpansion', true);
                    }
                }
                else if ( $pS.hasClass('toHighlight') &&// Prev is highlighted
                          $nS.hasClass('toHighlight') ) // Next is highlighted
                {
                    $s.sentence('option', 'noExpansion', true);
                }
            });
        });

        self.$s
            // Hide sentences
            .filter('.noHighlight')
                .removeClass('noHighlight')
                .sentence('unhighlight')
            .end()
            // Show sentences
            .filter('.toHighlight')
                .removeClass('toHighlight')
                .sentence('highlight');
          
        self._putState();
    },

    /******************************************************************
     * "Private" methods
     *
     */

    /** @brief  Retrieve the current view state.
     *  @param  url     The URL to retrieve view state for [ opts.metadata ];
     */
    _getState: function(url) {
        var self    = this;
        var opts    = self.options;
        
        if (url === undefined)  { url = opts.metadata; }
        
        return $.jStorage.get(url);
    },

    /** @brief  Store the current view state.
     *  @param  url     The URL to retrieve view state for [ opts.metadata ];
     */
    _putState: function(url) {
        var self    = this;
        var opts    = self.options;

        if (self._noPut === true)   { return; }
        
        if (url === undefined)  { url = opts.metadata; }
        
        // Remember the current settings
        var state  = {
            threshold:  opts.threshold,
            filter:     opts.filter,
            
            state:      self.state      // Sentence state
        };
        
        $.jStorage.set(url, state);
    },

    /** @brief  Retrieve global options.
     */
    _getOptions: function() {
        var self    = this;
        var opts    = self.options;
        
        var globalOpts  = $.jStorage.get('options:/');
        if (! globalOpts)
        {
            globalOpts = {
                quickTag:   false
            };
        }

        return globalOpts;
    },

    /** @brief  Store the current global options.
     */
    _putOptions: function(url) {
        var self    = this;
        var opts    = self.options;

        if (self._noPut === true)   { return; }
        
        // Remember the current settings
        var opts   = {
            quickTag:   opts.quickTag
        };
        
        $.jStorage.set('options:/', opts);
    },

    
    /** @brief  Compute the thresholds based upon opts.showSentences.
     * 
     *  @return The new threshold object {min: , max: }
     */
    _computeThreshold: function() {
        var self        = this;
        var opts        = self.options;
        var num         = 0;
        var threshold   = {
            min:    -1,
            max:    100
        };


        /* Find the highest rank that will include at least opts.showSentences
         * sentences.
         */
        for (var idex = self.ranks.length - 1; idex > 0; idex--)
        {
            var ar = self.ranks[idex];
            if (ar === undefined) { continue; }

            num += ar.length;
            if (num > opts.showSentences)
            {
                threshold.min = Math.floor(idex / 10) * 10;
                break;
            }
        }
        
        return threshold;
    },
    
    /** @brief  Change the filter value.
     *  @param  filter      The new value ('normal', 'tagged', 'starred').
     *  @param  noRefresh   If true, do NOT perform a refresh.
     *
     *  @return this for a fluent interface.
     */
    _changeFilter: function(filter, noRefresh) {
        var self        = this;
        var opts        = self.options;
        var $buttons    = self.$control.find(  '[name=threshold-up],'
                                             + '[name=threshold-down]');
        var filters     = (filter
                            ? filter.split(/\s*,\s*/)
                            : [ 'normal' ]);

        $.each(filters, function() {
            switch (this.toString())
            {
            case 'tagged':
                $buttons.button('disable');
                break;

            case 'starred':
                $buttons.button('disable');
                break;

            case 'normal':
            default:
                filter = 'normal';
                $buttons.button('enable');

                self.$filters.checkbox('uncheck');
                /*
                self.$control.find('#filter-normal')
                        .attr('checked', true)
                        .button('refresh');
                // */
                break;
            }
        });

        // Set the filter value
        opts.filter = filter;
        self.element.removeClass('starred tagged normal')
                    .addClass(filters.join(' '));

        if (noRefresh !== true)
        {
            // Re-apply the current threshold
            self.refresh();
        }

        return self;
    },

    /** @brief  Set the caret/cursor position within the given element
     *  @param  $el     The jQuery/DOM element representing the input control;
     *  @param  pos     The desired caret/cursor position;
     */
    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();


        /*************************************************************
         * Handle clicks on the page-level control buttons.
         *
         */
        $gp.delegate('.controls input, .controls button', 'click',
                     function() {
            var $el     = $(this);
            var name    = $el.attr('name');
            var newMin  = opts.threshold.min;

            switch (name)
            {
            case 'threshold-all':
                // Set the threshold.min
                opts.threshold.min = 0;

                // Force 'filter' to 'normal' as well
                self._changeFilter();
                break;

            case 'threshold-reset':
                // Reset the threshold.min
                if (self.origThreshold === undefined)
                {
                    self.origThreshold = self._computeThreshold();
                }
                opts.threshold.min = self.origThreshold.min;

                // Remove all aging
                self.$s.removeClass( 'old-0 old-1 old-2 old-3 old-4 '
                                    +'old-5 old-6 old-7 old-8')
                       .removeData('age');

                // Force 'filter' to 'normal' as well
                self._changeFilter();
                break;

            case 'threshold-down':
                // Decrease the minimum threshold
                if (newMin > 9)                         { newMin -= 10; }
                self.threshold(newMin, opts.threshold.max);
                break;

            case 'threshold-up':
                // Increase the minimum threshold
                if (newMin < (opts.threshold.max - 9))   { newMin += 10; }
                self.threshold(newMin, opts.threshold.max);
                break;
            }
        });

        /*************************************************************
         * Handle changes to the filter and option controls (triggered
         * by the ui.checkbox widget).
         *
         */
        $gp.delegate('.controls .filter, .controls .options', 'change',
                     function(e, type) {
            var $el         = $(e.target);
            var name        = $el.attr('name');

            switch (name)
            {
            case 'filter':
                // Assemble the filter as the value of all filter checkboxes
                var filter  = self.$filters
                                .map(function() {
                                    return $(this).checkbox('val');
                                });

                self._changeFilter( $.makeArray(filter).join(',') );
                break;

            case 'quickTag':
                /* Since we use the 'quickTag' icon as an indicator, the logic
                 * is a little backwards.  If the checkbox is NOT checked,
                 * we're in 'quick' mode, otherwise, 'normal' mode.
                 */
                opts.quickTag = (! $el.checkbox('val') );
                $.ui.sentence.options.quickTag = opts.quickTag;
                self._putOptions();
                break;
            }
        });

        /*************************************************************
         * Hover over a keyword changes the color of all keywords
         *
         */
        $gp.delegateHoverIntent('.keyword', function(e) {
            var $kw     = $(this);
            if ((e.type === 'hover-in') && $kw.hasClass('ui-state-highlight'))
            {
                // Ignore hover over keywords that are already highlighted
                return;
            }

            var name    = $kw.attr('name');
            var $kws    = self.$kws.filter('[name='+ name +']');
            switch (e.type)
            {
            case 'hover-out':
                $kws.removeClass('keyword-hover');
                break;

            case 'hover-in':
                $kws.addClass('keyword-hover');
                break;
            }
        });

        /*************************************************************
         * Hover over a rank increases the opacity of them all
         *
         */
        $parent.delegateHoverIntent('.rank', function(e) {
            var $el = $(this);

            //console.log('.rank hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-out':
                // Remove the opacity change for all ranks
                self.$s.find('.rank').css('opacity', opts.rankOpacity);

                /* Don't let the 'hover-out' propagate so other hover-based
                 * events won't be inadvertantly triggered
                 * (e.g. sentence controls hidden).
                 */
                e.stopPropagation();
                break;

            case 'hover-in':
                self.$s.find('.rank').css('opacity', 1.0);
                break;
            }
        });

        /*************************************************************
         * Click handler for non-highlighted/hidden sentences
         *
         */
        $parent.delegate('p', 'click', function(e) {
            // '.sentence:not(.highlight,.expanded,.expansion)',
            var $p  = $(this);
            var $t  = $(e.target);
            var $s;

            if ( (! $t.is('p')) && (! $t.hasClass('sentence')) )
            {
                $t = $t.parents('.sentence:first');
            }

            if ($t.hasClass('sentence'))
            {
                if ($t.sentence('isVisible'))
                {
                    // IGNORE clicks on visible sentences
                    return;
                }

                // A sentence that isn't currently "visible"
                $s = $t;
            }
            else
            {
                // Find the sentence nearest the click
                var $ss = $p.find('.sentence');

                $ss.each(function() {
                    var $el     = $(this);
                    var bounds  = $el.offset();

                    // Expand the bounds slightly
                    bounds.top    -= 2;
                    bounds.left   -= 2;
                    bounds.right  = bounds.left + $el.width()  + 4;
                    bounds.bottom = bounds.top  + $el.height() + 4;

                    if ( (e.pageX >= bounds.left)  &&
                         (e.pageX <= bounds.right) &&
                         (e.pageY >= bounds.top)   &&
                         (e.pageY <= bounds.bottom) )
                    {
                        $s = $el;
                        return false;
                    }
                });

                if (($s === undefined) || ($s.sentence('isVisible')))
                {
                    /* The final target sentence is either unidentified or
                     * already visible -- IGNORE
                     */
                    return;
                }
            }

            if ($s.sentence('option', 'noExpansion'))
            {
                // Is there a highlighted neighbor near by?
                var $sib    = $s.siblings('.highlight:first');
                if ($sib.length < 1)
                {
                    /* No highlighted neighbor.  Use the nearest neighbor that
                     * does NOT have
                     *  '.hide-expand' (from
                     *                  ui.sentenct.options.css.noExpansion)
                     */
                    $sib = $s.siblings(':not(.hide-expand):first');

                    if ($sib.length < 1)
                    {
                        /* NO sentences without '.hide-expand'
                         * Remove 'hide-expand' from the target and toggle
                         * it.
                         */
                        $s.sentence('option', 'noExpansion', false);
                        $sib = $s;
                    }
                }
                $sib.sentence('toggleOption', 'expanded');
            }
            else
            {
                $s.sentence('toggleOption', 'expanded');
            }
        });

        /*************************************************************
         * Clicking on a keyword shows all sentences with that keyword
         *
         */
        $parent.delegate('header .keyword', 'click', function() {
            var $kw         = $(this);
            var toggleOn    = (! $kw.hasClass('ui-state-highlight'));
            var name        = $kw.attr('name');
            var $kws        = $parent.find('article p .keyword');
            var $hl         = $kws.filter('[name='+ name +']');

            if (toggleOn)
            {
                // Make any sentence currently visible "older"
                self.$s.filter('.highlight,.expansion').older( opts );

                // Highlight the keyword control
                $kw.addClass('ui-state-highlight');

                /* For each keyword that should be highlighted, highlight it
                 * and ensure that it's containing sentence and paragraph are
                 * visible.
                 */
                $hl.each(function() {
                    var $el = $(this);
                    var $s  = $el.parents('.sentence:first');
                    var $p  = $s.parent();
                    $el.addClass('ui-state-highlight');

                    $s.addClass('keyworded', opts.animSpeed);
                });
            }
            else
            {
                /* For each keyword that should be un-highlighted, un-highlight
                 * it and then re-apply threshold to ensure a proper filter
                 */
                $hl.each(function() {
                    var $el     = $(this);
                    var $s      = $el.parents('.sentence:first');
                    var $p      = $s.parent();
                    $el.removeClass('ui-state-highlight');

                    var nLeft   = $s.find('.keyword.ui-state-highlight').length;
                    if (nLeft < 1)
                    {
                        // No more keywords in this sentence
                        $s.removeClass('keyworded', opts.animSpeed);
                    }
                });

                // Remove any 'old' class
                self.$s.filter('[class*=" old"]').younger( opts );

                // Remove the highlight from the keyword control
                $kw.removeClass('ui-state-highlight');
            }
        });

        /*************************************************************
         * Handle any 'sentence-change' events.
         *
         */
        $parent.delegate('.sentence', 'sentence-change', function(e, type) {
            var $s      = $(this);
            var idex    = self.$s.index( $s );

            switch (type)
            {
            case 'highlighted':
            case 'unhighlighted':
            case 'expanded':
            case 'collapsed':
                /* Notify all following sentences to synchronize their note
                 * positions.
                 */
                self.$s.slice(idex + 1).each(function() {
                    $(this).sentence('syncNotePositions');
                });
                break;

            case 'starred':
            case 'unstarred':
            case 'noteAdded':
            case 'noteRemoved':
            case 'commentAdded':    // Reflected from ui.note via ui.sentence
            case 'commentRemoved':  // Reflected from ui.note via ui.sentence
            case 'commentSaved':    // Reflected from ui.note via ui.sentence
                // Save the serialize state of this sentence.
                self.state[idex] = $s.sentence('serialize');
                self._putState();

                // Use the current state to update the global list of tags
                var tags    = [];
                $.each(self.state, function() {
                    if ((! this) || (! this.notes)) { return; }

                    $.each(this.notes, function() {
                        tags = tags.concat( this.note.tags );
                    });
                });

                self.$tags.text( tags.join(', ') );
                break;
            }
        });
    },

    _unbindEvents: function() {
        var self    = this;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();

        $gp.undelegate('.controls input, .controls button', 'click');
        $parent.undelegate('p', 'click');
        $parent.undelegateHoverIntent('.rank');
        $parent.undelegate('header .keyword', 'click');
        $parent.undelegate('.sentence', 'sentence-change');
    }
};

/***********************
 * Age helpers.
 *
 */

/** @brief  Make the target element "older".
 *  @param  options     An object containing options:
 *                          animSpeed   The speed of animation
 */
$.fn.older = function(options) {
    options = $.extend({animSpeed: 100}, options || {});

    return this.each(function() {
        var $el = $(this);
        
        var age = $el.data('age');

        // Increase and remember the current age
        if (age >= 0)   { age++;   }
        else            { age = 0; }

        $el.data('age', age);

        // Add the current age class
        $el.addClass('old-'+ age, options.animSpeed);
    });
};

/** @brief  Make the target element "younger".
 *  @param  options     An object containing options:
 *                          animSpeed   The speed of animation
 */
$.fn.younger = function(options) {
    options = $.extend({animSpeed: 100}, options || {});

    return this.each(function() {
        var $el = $(this);
        var age = $el.data('age');
        if (age === undefined)  { age = 0; }

        // Remove the current age class
        $el.removeClass('old-'+ age, options.animSpeed);

        // Decrease and remember the current age
        if (age >= 0)   { age--; }
        $el.data('age', age);
    });
};

}(jQuery));
/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *      jquery.delegateHoverIntent.js
 *
 *      ui.checkbox.js
 *      ui.sentence.js
 */
(function($) {

/** @brief  Summary widget */
$.fn.summary = function(options) {
    options = options || {};

    return this.each(function() {
        var $el = $(this);
        
        $el.data('summary', new $.Summary( $el, options ));
    });
};


/** @brief  The Summary class */
$.Summary = function($el, options) {
    return this.init($el, options);
};

$.Summary.prototype = {
    options: {
        src:            null,       // The URL of the original source
        metadata:       null,       /* The URL of the
                                     * summarization/characterization metadata
                                     */

        threshold:      {           // The desired min/max threshold
            min:        -1,         // If -1,-1, dynamically determine the
            max:        -1          //  threshold based upon 'showSentences'
        },
        filter:         'normal',   // The initial filter (tagged,starred)
        
        showSentences:  5,          /* The minimum number of sentences to
                                     * present
                                     */

        quickTag:       true,       // Using quick tag?

        rankOpacity:    0.3,        // The default opacity for rank items
        animSpeed:      200         // Speed (in ms) of animations
    },

    /** @brief  Initialize this new instance.
     *  @param  el          The jQuery DOM element.
     *  @param  options     Initialization options.
     *
     *  @return this for a fluent interface.
     */
    init: function(el, options) {
        var self        = this;
        var opts        = $.extend(true, {}, self.options, options);

        self.element    = el;
        self.options    = opts;
        self.metadata   = null;
        self.state      = [];   // Sentence state based upon their DOM index

        var $gp         = self.element.parent().parent();
        self.$control         = $gp.find('.control-pane');
        self.$tags            = $gp.find('.tags-pane');
        self.$threshold       = self.$control.find('.threshold');
        self.$thresholdValues = self.$threshold.find('.values');
        
        // Initialize any widgets
        self.$buttons   = self.$control.find('.buttons button').button();
        self.$filters   = self.$control.find('.filter :checkbox');
        self.$options   = self.$control.find('.options :checkbox');

        /*********************************************************
         * controls:threshold
         *
         */
        self.$control.find('.buttons .expansion').buttonset();

        /*********************************************************
         * controls:filters
         *
         */
        var $tagged     = self.$filters.filter('#filter-tagged');
        var $starred    = self.$filters.filter('#filter-starred');

        $tagged.checkbox({
            cssOn:      'su-icon su-icon-tag-blue',
            cssOff:     'su-icon su-icon-tag',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });
        $starred.checkbox({
            cssOn:      'su-icon su-icon-star-blue',
            cssOff:     'su-icon su-icon-star',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });

        /*********************************************************
         * controls:options
         *
         */
        var globalOpts  = self._getOptions();
        var $quickTag   = self.$options.filter('#options-quickTag');

        $.ui.sentence.options.quickTag = globalOpts.quickTag;

        $quickTag.checkbox({
            cssOn:      'su-icon su-icon-tagQuick',
            cssOff:     'su-icon su-icon-tagQuick-blue',
            titleOn:    'click to enable',
            titleOff:   'click to disable',
            hideLabel:  true,

            /* Since we use the 'quickTag' icon as an indicator, the logic is a
             * little backwards.  If the checkbox is NOT checked, we're in
             * 'quick' mode, otherwise, 'normal' mode.
             */
            checked:    (! globalOpts.quickTag )
        });


        /*********************************************************
         * Show the initialized control.
         *
         */
        self.$control.show();

        // Bind events
        self._bindEvents();

        // Kick off the retrieval of the metadata
        self.element.addClass('loading');

        var getMetadata  = $.get(opts.metadata);
        getMetadata.success(function( data ) {
            self.metadata = data;

            // Perform the initial rendering of the xml
            self.render();

            self.element.removeClass('loading');
        });
        getMetadata.error(function() {
            alert("Cannot retrieve metadata '"+ opts.metadata +"'");
        });
    },

    /** @brief  Invoked to cleanup this widget. */
    destroy: function() {
        self._unbindEvents();
    },

    /** @brief  Render the summary information over the main article.
     */
    render: function() {
        var self    = this;
        var opts    = self.options;

        // If we have NOT retrieved the XML meta-data, no rendering.
        if (self.metadata === null) { return; }
        
        /* Disable put since we're performing an initial render based upon
         * the incoming XML AND any serialized state
         */
        self._noPut = true;

        // Retrieve the filter state for the current meta-data URL
        var state   = self._getState(opts.metadata);
        if (state)
        {
            opts.threshold.min = state.threshold.min;
            opts.threshold.max = state.threshold.max;
            opts.filter        = state.filter;
            
            self.state         = (state.state ? state.state : []);
        }

        // Renter the XML
        self.renderXml( self.metadata );

        // Find all sentences and bucket them based upon 'rank'
        self.$p     = self.element.find('p');
        self.$s     = self.$p.find('.sentence');
        self.$kws   = self.element.find('.keyword');
        self.ranks  = [];

        /* Instantiate the ui.sentence widgets using any parallel serialized
         * state.
         */
        self.$s.each(function(idex) {
            var $el     = $(this);
            var config  = ( self.state.length > idex
                                ? self.state[idex]
                                : null );

            // Instantiate the sentence using the serialized state (if any)
            $el.sentence( config );

            var rank    = $el.sentence('option', 'rank');

            if (self.ranks[rank] === undefined) { self.ranks[rank] = []; }
            self.ranks[rank].push($el);
        });

        var threshold   = opts.threshold;
        if ((opts.threshold.min < 0) || (opts.threshold.max < 0))
        {
            threshold          = self._computeThreshold();
            self.origThreshold = threshold;

        }

        /* Ensure the filter is properly set (without a refresh).
         * The refresh will take place when we set the threshold.
         */
        self._changeFilter(opts.filter, true);
        self.threshold( threshold.min, threshold.max);

        // Re-enable put
        self._noPut = false;
    },

    /** @brief  Given XML content, convert it to stylable HTML.
     *  @param  xml     The XML to render.
     *
     */
    renderXml: function(xml) {
        var self    = this;
        var opts    = self.options;
        var $xml    = $( xml );

        /* Convert the XML to HTML that can be styled.
         *
         * First, handle any <header>, adding a <header> element BEFORE this
         * element.
         */
        var $header     = $('<header />').appendTo( self.element );
        var $doc        = $xml.find('document');
        var src         = $doc.attr('src');

        if (src) { opts.src = src; }

        $doc.children().each(function() {
            var $el = $(this);

            switch (this.nodeName)
            {
            case 'title':
                var $h1 = $('<h1 />');

                if (opts.src !== null)
                {
                    var $a  = $('<a />')
                                .attr('href', opts.src)
                                .text( $el.text() )
                                .appendTo($h1);
                }
                else
                {
                    $h1.text( $el.text() );
                }

                $header.append( $h1 );
                break;

            case 'published':
                var str     = $el.find('date').text() +' '
                            + $el.find('time').text();
                var date    = new Date(str);
                var $time   = $('<time />')
                                .attr('datetime', date.toISOString())
                                .attr('pubdate',  true)
                                .text(str)
                                .appendTo($header);
                break;

            case 'keywords':
                // Process any XML <keyword> elements
                $('#tmpl-header-keywords')
                    .tmpl({ keywords: $el.find('keyword') })
                    .appendTo($header);
                break;

            case 'body':
                // Process any XML <section> elements
                $el.find('section').each(function() {
                    // Leave this for later
                    var $div     = $('<section />')
                                        .appendTo( self.element );

                    // Convert the XML <p> to an HTML <p>
                    $(this).find('p').each(function() {
                        var $p  = $('<p />')
                                    .appendTo($div);

                        // Convert the XML <s> to an HTML <div>
                        $(this).find('s').each(function() {
                            var $s          = $(this);
                            var rank        = parseFloat($s.attr('rank'));

                            /* If there is one or more <w> element that does
                             * NOT have a 'keyword' attribute, don't create
                             * elements for raw text, just for <w> elements.
                             */
                            var ignoreText  = ($s.find('w:not([keyword])')
                                                                .length > 0);
                            if (isNaN(rank))    { rank = 0; }

                            /* Treat the rank as an integer percentile
                             * (0 ..  100).
                             */
                            rank = parseInt(rank * 100, 10);

                            var $sEl = $('#tmpl-sentence')
                                            .tmpl( {rank: rank} )
                                            .appendTo($p);
                            var $sC  = $sEl.find('.content');

                            /* Mark the sentence with information about whether
                             * it contains ONLY word elements or if text spans
                             * contain multiple words.
                             */
                            $sEl.attr('wordElements', ignoreText);

                            $sEl.find('.rank')
                                    .css('opacity', opts.rankOpacity);

                            // Assemble the HTML from the XML
                            $.each(this.childNodes, function() {
                                var $node   = $(this);
                                switch (this.nodeName)
                                {
                                case '#text':
                                    if (ignoreText === true)
                                    {
                                        // Ignore
                                        return;
                                    }
                                    // Fall through

                                case 'w':
                                    if ($node.attr('keyword'))
                                    {
                                        $('#tmpl-sentence-keyword')
                                            .tmpl( {
                                                keyword:$node.attr('keyword'),
                                                text:   $node.text()
                                            } )
                                            .appendTo( $sC );
                                    }
                                    else
                                    {
                                        $('#tmpl-sentence-text')
                                            .tmpl( {
                                                text:   $node.text()
                                            } )
                                            .appendTo( $sC );
                                    }
                                    break;

                                case 'keyword':
                                    $('#tmpl-sentence-keyword')
                                        .tmpl( {
                                            keyword:$node.attr('name'),
                                            text:   $node.text()
                                        } )
                                        .appendTo( $sC );
                                    break;
                                }
                            });
                        });
                    });
                });
                break;

            default:
                $header.append( $el );
                break;
            }
        });

    },

    /** @brief  Change the rank threshold.
     *  @param  min     The minimum threshold.
     *  @param  max     The maximum threshold.
     */
    threshold: function( min, max) {
        var self        = this;
        var opts        = self.options;
        var isExpand    = (min < opts.threshold.min);

        // Update the threshold and threshold value presentation
        opts.threshold.min = min;
        opts.threshold.max = max;

        self.refresh( isExpand );
    },

    /** @brief  Refresh the presentation based upon the current filter and
     *          thresholds.
     *  @param  isExpand        Is this an
     *                              expansion   (true),
     *                              contraction (false) or
     *                              neither     (undefined).
     *
     */
    refresh: function(isExpand) {
        var self        = this;
        var opts        = self.options;

        var str = opts.threshold.min +' - ' + opts.threshold.max;
        self.$thresholdValues.text( str );

        /* Initially mark all sentences as 'NOT highlighted' and all
         * paragraphs as 'NOT shown'
         */
        self.$s.addClass('noHighlight');

        if (opts.filter === 'normal')
        {
            // Show only sentences within the threshold range
            for (var idex = opts.threshold.max;
                    idex >= opts.threshold.min;
                        idex--)
            {
                var ar  = self.ranks[idex];
                if (ar === undefined)   { continue; }

                var nItems  = ar.length;
                for (var jdex = 0; jdex < nItems; jdex++)
                {
                    // Mark this sentence as TO BE highlighted
                    var $s      = ar[jdex];
                    $s.addClass('toHighlight')
                      .removeClass('noHighlight');
                }
            }
        }
        else
        {
            if (opts.filter.indexOf('tagged') >= 0)
            {
                /* Show ALL sentences containing one or more tags regardless of
                 * threshold
                 */
                self.$s.filter( ':has(.tagged)' )
                        .addClass('toHighlight')
                        .removeClass('noHighlight');
            }

            if (opts.filter.indexOf('starred') >= 0)
            {
                // Show ALL starred sentences regardless of threshold
                self.$s.filter( '.starred' )
                        .addClass('toHighlight')
                        .removeClass('noHighlight');
            }
        }

        /* Hide expansion controls for sentences that have no siblings that
         * would be expanded.
         */
        self.$s.sentence('option', 'noExpansion', false);
        self.$p.each(function() {
            var $p          = $(this);
            var $ss         = $p.find('.sentence');

            if ($ss.length === 1)
            {
                // Only one sentence period -- Always hide
                $ss.sentence('option', 'noExpansion', true);
                return;
            }

            $ss.each(function() {
                var $s  = $(this);
                var $pS = $s.prev();
                var $nS = $s.next();
                if ($pS.length < 1)
                {
                    // First sentence
                    if ($s.hasClass('noHighlight') ||   // is NOT highlighted
                        ($nS.length < 1)           ||   // No next
                        $nS.hasClass('toHighlight'))    // Next is highlighted
                    {
                        $s.sentence('option', 'noExpansion', true);
                    }
                }
                else if ($nS.length < 1)
                {
                    // Last sentence
                    if ($s.hasClass('noHighlight') ||   // is NOT highlighted
                        ($pS.length < 1)           ||   // No previous
                        $pS.hasClass('toHighlight'))    // Prev is highlighted
                    {
                        $s.sentence('option', 'noExpansion', true);
                    }
                }
                else if ( $pS.hasClass('toHighlight') &&// Prev is highlighted
                          $nS.hasClass('toHighlight') ) // Next is highlighted
                {
                    $s.sentence('option', 'noExpansion', true);
                }
            });
        });

        self.$s
            // Hide sentences
            .filter('.noHighlight')
                .removeClass('noHighlight')
                .sentence('unhighlight')
            .end()
            // Show sentences
            .filter('.toHighlight')
                .removeClass('toHighlight')
                .sentence('highlight');
          
        self._putState();
    },

    /******************************************************************
     * "Private" methods
     *
     */

    /** @brief  Retrieve the current view state.
     *  @param  url     The URL to retrieve view state for [ opts.metadata ];
     */
    _getState: function(url) {
        var self    = this;
        var opts    = self.options;
        
        if (url === undefined)  { url = opts.metadata; }
        
        return $.jStorage.get(url);
    },

    /** @brief  Store the current view state.
     *  @param  url     The URL to retrieve view state for [ opts.metadata ];
     */
    _putState: function(url) {
        var self    = this;
        var opts    = self.options;

        if (self._noPut === true)   { return; }
        
        if (url === undefined)  { url = opts.metadata; }
        
        // Remember the current settings
        var state  = {
            threshold:  opts.threshold,
            filter:     opts.filter,
            
            state:      self.state      // Sentence state
        };
        
        $.jStorage.set(url, state);
    },

    /** @brief  Retrieve global options.
     */
    _getOptions: function() {
        var self    = this;
        var opts    = self.options;
        
        var globalOpts  = $.jStorage.get('options:/');
        if (! globalOpts)
        {
            globalOpts = {
                quickTag:   false
            };
        }

        return globalOpts;
    },

    /** @brief  Store the current global options.
     */
    _putOptions: function(url) {
        var self    = this;
        var opts    = self.options;

        if (self._noPut === true)   { return; }
        
        // Remember the current settings
        var opts   = {
            quickTag:   opts.quickTag
        };
        
        $.jStorage.set('options:/', opts);
    },

    
    /** @brief  Compute the thresholds based upon opts.showSentences.
     * 
     *  @return The new threshold object {min: , max: }
     */
    _computeThreshold: function() {
        var self        = this;
        var opts        = self.options;
        var num         = 0;
        var threshold   = {
            min:    -1,
            max:    100
        };


        /* Find the highest rank that will include at least opts.showSentences
         * sentences.
         */
        for (var idex = self.ranks.length - 1; idex > 0; idex--)
        {
            var ar = self.ranks[idex];
            if (ar === undefined) { continue; }

            num += ar.length;
            if (num > opts.showSentences)
            {
                threshold.min = Math.floor(idex / 10) * 10;
                break;
            }
        }
        
        return threshold;
    },
    
    /** @brief  Change the filter value.
     *  @param  filter      The new value ('normal', 'tagged', 'starred').
     *  @param  noRefresh   If true, do NOT perform a refresh.
     *
     *  @return this for a fluent interface.
     */
    _changeFilter: function(filter, noRefresh) {
        var self        = this;
        var opts        = self.options;
        var $buttons    = self.$control.find(  '[name=threshold-up],'
                                             + '[name=threshold-down]');
        var filters     = (filter
                            ? filter.split(/\s*,\s*/)
                            : [ 'normal' ]);

        $.each(filters, function() {
            switch (this.toString())
            {
            case 'tagged':
                $buttons.button('disable');
                break;

            case 'starred':
                $buttons.button('disable');
                break;

            case 'normal':
            default:
                filter = 'normal';
                $buttons.button('enable');

                self.$filters.checkbox('uncheck');
                /*
                self.$control.find('#filter-normal')
                        .attr('checked', true)
                        .button('refresh');
                // */
                break;
            }
        });

        // Set the filter value
        opts.filter = filter;
        self.element.removeClass('starred tagged normal')
                    .addClass(filters.join(' '));

        if (noRefresh !== true)
        {
            // Re-apply the current threshold
            self.refresh();
        }

        return self;
    },

    /** @brief  Set the caret/cursor position within the given element
     *  @param  $el     The jQuery/DOM element representing the input control;
     *  @param  pos     The desired caret/cursor position;
     */
    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();


        /*************************************************************
         * Handle clicks on the page-level control buttons.
         *
         */
        $gp.delegate('.controls input, .controls button', 'click',
                     function() {
            var $el     = $(this);
            var name    = $el.attr('name');
            var newMin  = opts.threshold.min;

            switch (name)
            {
            case 'threshold-all':
                // Set the threshold.min
                opts.threshold.min = 0;

                // Force 'filter' to 'normal' as well
                self._changeFilter();
                break;

            case 'threshold-reset':
                // Reset the threshold.min
                if (self.origThreshold === undefined)
                {
                    self.origThreshold = self._computeThreshold();
                }
                opts.threshold.min = self.origThreshold.min;

                // Remove all aging
                self.$s.removeClass( 'old-0 old-1 old-2 old-3 old-4 '
                                    +'old-5 old-6 old-7 old-8')
                       .removeData('age');

                // Force 'filter' to 'normal' as well
                self._changeFilter();
                break;

            case 'threshold-down':
                // Decrease the minimum threshold
                if (newMin > 9)                         { newMin -= 10; }
                self.threshold(newMin, opts.threshold.max);
                break;

            case 'threshold-up':
                // Increase the minimum threshold
                if (newMin < (opts.threshold.max - 9))   { newMin += 10; }
                self.threshold(newMin, opts.threshold.max);
                break;
            }
        });

        /*************************************************************
         * Handle changes to the filter and option controls (triggered
         * by the ui.checkbox widget).
         *
         */
        $gp.delegate('.controls .filter, .controls .options', 'change',
                     function(e, type) {
            var $el         = $(e.target);
            var name        = $el.attr('name');

            switch (name)
            {
            case 'filter':
                // Assemble the filter as the value of all filter checkboxes
                var filter  = self.$filters
                                .map(function() {
                                    return $(this).checkbox('val');
                                });

                self._changeFilter( $.makeArray(filter).join(',') );
                break;

            case 'quickTag':
                /* Since we use the 'quickTag' icon as an indicator, the logic
                 * is a little backwards.  If the checkbox is NOT checked,
                 * we're in 'quick' mode, otherwise, 'normal' mode.
                 */
                opts.quickTag = (! $el.checkbox('val') );
                $.ui.sentence.options.quickTag = opts.quickTag;
                self._putOptions();
                break;
            }
        });

        /*************************************************************
         * Hover over a keyword changes the color of all keywords
         *
         */
        $gp.delegateHoverIntent('.keyword', function(e) {
            var $kw     = $(this);
            if ((e.type === 'hover-in') && $kw.hasClass('ui-state-highlight'))
            {
                // Ignore hover over keywords that are already highlighted
                return;
            }

            var name    = $kw.attr('name');
            var $kws    = self.$kws.filter('[name='+ name +']');
            switch (e.type)
            {
            case 'hover-out':
                $kws.removeClass('keyword-hover');
                break;

            case 'hover-in':
                $kws.addClass('keyword-hover');
                break;
            }
        });

        /*************************************************************
         * Hover over a rank increases the opacity of them all
         *
         */
        $parent.delegateHoverIntent('.rank', function(e) {
            var $el = $(this);

            //console.log('.rank hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-out':
                // Remove the opacity change for all ranks
                self.$s.find('.rank').css('opacity', opts.rankOpacity);

                /* Don't let the 'hover-out' propagate so other hover-based
                 * events won't be inadvertantly triggered
                 * (e.g. sentence controls hidden).
                 */
                e.stopPropagation();
                break;

            case 'hover-in':
                self.$s.find('.rank').css('opacity', 1.0);
                break;
            }
        });

        /*************************************************************
         * Click handler for non-highlighted/hidden sentences
         *
         */
        $parent.delegate('p', 'click', function(e) {
            // '.sentence:not(.highlight,.expanded,.expansion)',
            var $p  = $(this);
            var $t  = $(e.target);
            var $s;

            if ( (! $t.is('p')) && (! $t.hasClass('sentence')) )
            {
                $t = $t.parents('.sentence:first');
            }

            if ($t.hasClass('sentence'))
            {
                if ($t.sentence('isVisible'))
                {
                    // IGNORE clicks on visible sentences
                    return;
                }

                // A sentence that isn't currently "visible"
                $s = $t;
            }
            else
            {
                // Find the sentence nearest the click
                var $ss = $p.find('.sentence');

                $ss.each(function() {
                    var $el     = $(this);
                    var bounds  = $el.offset();

                    // Expand the bounds slightly
                    bounds.top    -= 2;
                    bounds.left   -= 2;
                    bounds.right  = bounds.left + $el.width()  + 4;
                    bounds.bottom = bounds.top  + $el.height() + 4;

                    if ( (e.pageX >= bounds.left)  &&
                         (e.pageX <= bounds.right) &&
                         (e.pageY >= bounds.top)   &&
                         (e.pageY <= bounds.bottom) )
                    {
                        $s = $el;
                        return false;
                    }
                });

                if (($s === undefined) || ($s.sentence('isVisible')))
                {
                    /* The final target sentence is either unidentified or
                     * already visible -- IGNORE
                     */
                    return;
                }
            }

            if ($s.sentence('option', 'noExpansion'))
            {
                // Is there a highlighted neighbor near by?
                var $sib    = $s.siblings('.highlight:first');
                if ($sib.length < 1)
                {
                    /* No highlighted neighbor.  Use the nearest neighbor that
                     * does NOT have
                     *  '.hide-expand' (from
                     *                  ui.sentenct.options.css.noExpansion)
                     */
                    $sib = $s.siblings(':not(.hide-expand):first');

                    if ($sib.length < 1)
                    {
                        /* NO sentences without '.hide-expand'
                         * Remove 'hide-expand' from the target and toggle
                         * it.
                         */
                        $s.sentence('option', 'noExpansion', false);
                        $sib = $s;
                    }
                }
                $sib.sentence('toggleOption', 'expanded');
            }
            else
            {
                $s.sentence('toggleOption', 'expanded');
            }
        });

        /*************************************************************
         * Clicking on a keyword shows all sentences with that keyword
         *
         */
        $parent.delegate('header .keyword', 'click', function() {
            var $kw         = $(this);
            var toggleOn    = (! $kw.hasClass('ui-state-highlight'));
            var name        = $kw.attr('name');
            var $kws        = $parent.find('article p .keyword');
            var $hl         = $kws.filter('[name='+ name +']');

            if (toggleOn)
            {
                // Make any sentence currently visible "older"
                self.$s.filter('.highlight,.expansion').older( opts );

                // Highlight the keyword control
                $kw.addClass('ui-state-highlight');

                /* For each keyword that should be highlighted, highlight it
                 * and ensure that it's containing sentence and paragraph are
                 * visible.
                 */
                $hl.each(function() {
                    var $el = $(this);
                    var $s  = $el.parents('.sentence:first');
                    var $p  = $s.parent();
                    $el.addClass('ui-state-highlight');

                    $s.addClass('keyworded', opts.animSpeed);
                });
            }
            else
            {
                /* For each keyword that should be un-highlighted, un-highlight
                 * it and then re-apply threshold to ensure a proper filter
                 */
                $hl.each(function() {
                    var $el     = $(this);
                    var $s      = $el.parents('.sentence:first');
                    var $p      = $s.parent();
                    $el.removeClass('ui-state-highlight');

                    var nLeft   = $s.find('.keyword.ui-state-highlight').length;
                    if (nLeft < 1)
                    {
                        // No more keywords in this sentence
                        $s.removeClass('keyworded', opts.animSpeed);
                    }
                });

                // Remove any 'old' class
                self.$s.filter('[class*=" old"]').younger( opts );

                // Remove the highlight from the keyword control
                $kw.removeClass('ui-state-highlight');
            }
        });

        /*************************************************************
         * Handle any 'sentence-change' events.
         *
         */
        $parent.delegate('.sentence', 'sentence-change', function(e, type) {
            var $s      = $(this);
            var idex    = self.$s.index( $s );

            switch (type)
            {
            case 'highlighted':
            case 'unhighlighted':
            case 'expanded':
            case 'collapsed':
                /* Notify all following sentences to synchronize their note
                 * positions.
                 */
                self.$s.slice(idex + 1).each(function() {
                    $(this).sentence('syncNotePositions');
                });
                break;

            case 'starred':
            case 'unstarred':
            case 'noteAdded':
            case 'noteRemoved':
            case 'commentAdded':    // Reflected from ui.note via ui.sentence
            case 'commentRemoved':  // Reflected from ui.note via ui.sentence
            case 'commentSaved':    // Reflected from ui.note via ui.sentence
                // Save the serialize state of this sentence.
                self.state[idex] = $s.sentence('serialize');
                self._putState();

                // Use the current state to update the global list of tags
                var tags    = [];
                $.each(self.state, function() {
                    if ((! this) || (! this.notes)) { return; }

                    $.each(this.notes, function() {
                        tags = tags.concat( this.note.tags );
                    });
                });

                self.$tags.text( tags.join(', ') );
                break;
            }
        });
    },

    _unbindEvents: function() {
        var self    = this;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();

        $gp.undelegate('.controls input, .controls button', 'click');
        $parent.undelegate('p', 'click');
        $parent.undelegateHoverIntent('.rank');
        $parent.undelegate('header .keyword', 'click');
        $parent.undelegate('.sentence', 'sentence-change');
    }
};

/***********************
 * Age helpers.
 *
 */

/** @brief  Make the target element "older".
 *  @param  options     An object containing options:
 *                          animSpeed   The speed of animation
 */
$.fn.older = function(options) {
    options = $.extend({animSpeed: 100}, options || {});

    return this.each(function() {
        var $el = $(this);
        
        var age = $el.data('age');

        // Increase and remember the current age
        if (age >= 0)   { age++;   }
        else            { age = 0; }

        $el.data('age', age);

        // Add the current age class
        $el.addClass('old-'+ age, options.animSpeed);
    });
};

/** @brief  Make the target element "younger".
 *  @param  options     An object containing options:
 *                          animSpeed   The speed of animation
 */
$.fn.younger = function(options) {
    options = $.extend({animSpeed: 100}, options || {});

    return this.each(function() {
        var $el = $(this);
        var age = $el.data('age');
        if (age === undefined)  { age = 0; }

        // Remove the current age class
        $el.removeClass('old-'+ age, options.animSpeed);

        // Decrease and remember the current age
        if (age >= 0)   { age--; }
        $el.data('age', age);
    });
};

}(jQuery));
