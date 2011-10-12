/** @file
 *
 *  Backbone View for a single selection defined by a Model.Ranges instance.
 *
 *  Requires:
 *      jquery.js
 *      backbone.js
 *      model/range.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.View)     { app.View  = {}; }

    var $           = jQuery.noConflict();

    /** @brief  A View for a app.Model.Ranges instance.
     *
     *  Set 'ranges' in the constructor options to establish the Model.Ranges
     *  collection to use to render this selection.  Each model in the provide
     *  Model.Ranges instance will be used to generate a View.Range to
     *  represent that range.
     */
    app.View.Selection = Backbone.View.extend({
        viewName:   'Selection',

        tagName:    'div',
        className:  'selection',
        template:   _.template($('#template-selection').html()),
        rangeViews: null,

        events: {
            'mouseenter .range-control':    '_controlMouse',
            'mouseleave .range-control':    '_controlMouse',
            'click .range-control':         '_controlClick'
        },

        /** @brief  Initialize this instance. */
        initialize: function() {
            // Cache the options.ranges value
            this.ranges     = this.options.ranges;
            this.rangeViews = this.options.rangeViews;
        },

        /** @brief  Override so we can properly remove component range views.
         */
        remove: function() {
            var self    = this;

            if (self.rangeViews)
            {
                /* Remove all component View.Range elements, which will also
                 * destroy the underlying models (Model.Range).
                 */
                $.each(self.rangeViews, function() {
                    var view    = this;

                    // Un-bind event handlers
                    $(view.el).undelegate('.selected', '.'+ self.viewName);

                    view.remove( (self.ranges === null) );
                });
            }

            if (self.$control)
            {
                self.$control.unbind('.'+ self.viewName);
            }

            return Backbone.View.prototype.remove.call(this);
        },

        /** @brief  Render this view. */
        render: function() {
            var self    = this;

            self.$el = $(self.el);
            //self.$el.attr('id', self.ranges.cid);
            self.$el.html( self.template( (self.model
                                            ? self.model.toJSON()
                                            : null) ) );

            // Store a reference to this view instance
            self.$el.data('View:'+ self.viewName, self);

            // Gather our pieces
            self.$control = self.$el.find('.range-control')
                                    .hide();

            var events       = [ 'mouseenter.'+ self.viewName,
                                 'mouseleave.'+ self.viewName ].join(' ');
            if ($.isArray(self.rangeViews))
            {
                /* We're inheriting a "collection" of range views so we need to
                 * delegate events.
                 */
                $.each(self.rangeViews, function(idex, view) {
                    // Bind to mouse events on this range view
                    $(view.el).delegate('.selected',  events,
                                        _.bind(self._rangeMouse, self));
                });
            }
            else
            {
                /* Create a "collection" of range views based upon the attached
                 * ranges (Model.Ranges).
                 */
                self.rangeViews  = [];
                self.ranges.each(function(range) {
                    var view    = new app.View.Range( {
                                        parentView: self,
                                        model:      range,
                                        className:  self.className
                                  });
                    view.render();

                    // Delegate events for this range view
                    $(view.el).delegate('.selected',  events,
                                        _.bind(self._rangeMouse, self));

                    self.rangeViews.push( view );

                    /* The Range view inserts itself in the proper sentence
                     * overlay.  Do NOT move it by appending it to our own
                     * element.
                     *
                     * Instead, we maintain the 'rangeViews' array to contain a
                     * list of our component views.
                     *
                     * self.$el.append( view.render().el );
                     */
                });
            }

            return self;
        },

        /** @brief  Generate a Model.Note instance with our ranges,
         *          disconnecting the ranges from this instance.
         *
         *  @return The new Model.Note instance.
         */
        toNote: function() {
            var self        = this;

            // Create a note view to take over our ranges.
            var note    = new app.Model.Note({ranges:   self.ranges});

            /* Set our 'ranges' to null so we can destroy the existing range
             * views without destroying the underlying models (see remove()).
             */
            self.ranges = null;

            // Schedule our demise
            setTimeout(function() { self.remove(); }, 10);

            return note;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Handle click events on our control element.
         *  @param  e       The triggering event which SHOULD include an
         *                  'originalEvent' that can be used to identify the
         *                  originating target;
         */
        _controlClick: function(e) {
            var self    = this;
            var $el     = $(e.originalEvent.target);
            var name    = $el.attr('name');

            /*
            console.log('View.'+ self.viewName +'::_controlClick(): '
                        +   'name[ '+ name +' ]');
            // */

            switch (name)
            {
            case 'note-add':
                // :TODO: Convert this Selection view to a Note Model.
                app.main.addNote( self.toNote() );
                break;
            }
        },

        /** @brief  Handle mouseenter/leave within the range control.
         *  @param  e       The triggering event;
         *
         */
        _controlMouse: function(e) {
            var self    = this;

            switch (e.type)
            {
            case 'mouseenter':
                if (self._pendingLeave)
                {
                    // Cancel any pending leave
                    clearTimeout( self._pendingLeave );
                    self._pendingLeave = null;
                }
                break;

            case 'mouseleave':
                /* Wait a short time to see if _rangeMouse() is fired with
                 * 'mouseenter'.
                 */
                self._pendingLeave = setTimeout(function() {
                    // Hide the range controls
                    self.$control.hide();
                    self._pendingLeave = null;
                }, 100);
                break;
            }
        },

        /** @brief  Handle mouseenter/leave within the associated ranges view.
         *  @param  e       The triggering event;
         *
         */
        _rangeMouse: function(e) {
            var self    = this;

            switch (e.type)
            {
            case 'mouseenter':
                var $selected   = $(e.target);
                if (self._pendingLeave)
                {
                    // Cancel any pending leave
                    clearTimeout( self._pendingLeave );
                    self._pendingLeave = null;
                }

                self._showControl( {x: e.pageX, y: e.pageY} );
                break;

            case 'mouseleave':
                /* Wait a short time to see if _controlMouse() is fired with
                 * 'mouseenter'.
                 */
                self._pendingLeave = setTimeout(function() {
                    // Hide the range controls
                    self.$control.hide();
                    self._pendingLeave = null;
                }, 100);
                break;
            }
        },

        /** @brief  Given x,y coordinates, determine if they fall within one of 
         *          our bounding segments.  If so, show the control along the
         *          edge of the nearest segment near the provided coordinates.
         *  @param  coords      An object of { x: , y: } coordinates;
         *
         *  @return The offset, or null.
         */
        _showControl: function( coords ) {
            var self    = this;
            var segment = self._inSegment( coords );

            if (! segment)  { return null; }

            var offset  = {top:0, left:0};

            // Find the nearest horizontal edge
            if ((coords.y - segment.top) >
                    ((segment.bottom - segment.top) / 2))
            {
                // Nearest the bottom of 'segment'
                offset.top = segment.bottom;
                self.$control.removeClass('ui-corner-top')
                             .addClass('ui-corner-bottom');
            }
            else
            {
                // Nearest the top of 'segment'
                offset.top = segment.top - self.$control.height();
                self.$control.removeClass('ui-corner-bottom')
                             .addClass('ui-corner-top');
            }

            // Find the nearest vertical edge
            var cWidth  = self.$control.outerWidth();
            offset.left = coords.x - (cWidth / 2);
            if ((offset.left + cWidth) > segment.right)
            {
                offset.left = segment.right - cWidth;
            }
            else if (offset.left < segment.left)
            {
                offset.left = segment.left;
            }

            self.$control.show()
                         .offset( offset );
        },

        /** @brief  Retrieve the bounding segments of the selection.
         *  @param  force   If true, force a re-computation, otherwise, if we
         *                  have cached values, return them;
         *
         *  The bounds of any selection can be defined by 3 contiguous
         *  segments:
         *      +------------------------------------------+
         *      |                                          |
         *      |          +-----------------------------+ |
         *      |          | 1                           | |
         *      | +--------+-----------------------------+ |
         *      | |          2                           | |
         *      | +-------------------------+------------+ |
         *      | |          3              |              |
         *      | +-------------------------+              |
         *      |                                          |
         *      +------------------------------------------+
         *
         *  @return The bounding segments, each in the form:
         *              { top:, right:, bottom:, left: }
         */
        _boundingSegments: function(force) {
            var self            = this;

            if ( (force !== true) && self._cacheSegments)
            {
                return self._cacheSegments;
            }

            var $first          = $( _.first(self.rangeViews).el )
                                                        .find('.selected'),
                $last           = $( _.last(self.rangeViews).el )
                                                        .find('.selected'),
                $measureStart   = $first.find('.measure-start'),
                $measureEnd     = $last.find('.measure-end'),
                segments        = [],
                segment;

            // Compute segment 1
            segment         = $measureStart.offset();
            // Account for padding
            segment.left   -= ($first.outerWidth() - $first.width()) / 2;
            segment.bottom  = segment.top  + $measureStart.height();
            segment.right   = (segment.left + $first.outerWidth()) -
                             (segment.left - $first.offset().left);

            segments[0] = $.extend({}, segment);

            // Compute segment 3
            segment = $measureEnd.offset();
            if (segments[0].top === segment.top)
            {
                // Segment 3 === Segment 1 (single segment)
                segment = segments[0];
            }
            else
            {
                segment.bottom = segment.top  + $measureStart.height();
                segment.right  = segment.left;
                segment.left   = $last.offset().left;
            }

            segments[2] = $.extend({}, segment);

            // Compute segment 2 (if it exists)
            segment.top = segment.bottom = segment.right = segment.left = 0;
            if (segments[0].bottom < segments[2].top)
            {
                // There is something between.  Construct a non-empty segment
                segment.top    = segments[0].bottom;
                segment.right  = segments[0].right;
                segment.bottom = segments[2].top;
                segment.left   = segments[2].left;
            }
            segments[1] = $.extend({}, segment);

            // Cache the segments
            self._cacheSegments = segments;

            //console.log(segments);

            return segments;
        },

        /** @brief  Determine if the given x,y coordinates fall within one of
         *          our bounding segments.  If so, return the segment.
         *  @param  coords      An object of { x: , y: } coordinates;
         *
         *  @return The segment the contains { x: , y: } or null.
         */
        _inSegment: function( coords ) {
            var self        = this,
                segments    = self._boundingSegments(),
                inSegment   = null;

            /*
            console.log('View:Selection:_inSegment( '
                        + coords.x +', '+ coords.y +' )');
            // */

            $.each(segments, function(idex, segment) {

                if ((coords.x >= segment.left) && (coords.x <= segment.right) &&
                    (coords.y >= segment.top)  && (coords.y <= segment.bottom))
                {
                    // HIT
                    inSegment = segment;
                    return false;           // terminate iteration
                }
            });

            return inSegment;
        }
    });

 }).call(this);
