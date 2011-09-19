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

    /** @brief  Refresh after some DOM change that would overlay positioning
     *          (i.e. expand/collapse of the content element).
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
                            self._trigger('hover-in');
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
                self._trigger('hover-out');

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

        var hoverIn = function(e) {
            /* The overlay control is not currently visible.
             *
             * Show it now possibly positioned near the pointer.
             */
            var ctlHeight   = self.$ctl.height();
            var top         = opts.extent.top - ctlHeight;

            /* If we have multiple segments (i.e. multiple lines),
             * see if we should align to the top or bottom.
             *
            if (opts.segments.length > 1)
            {
                if (e.offsetY >
                        ((opts.extent.bottom - opts.extent.top) / 2))
                {
                    // Bottom
                    top = opts.extent.bottom + ctlHeight;
                }
            }
            // */

            self.$ctl.css('top', top)
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
