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
            'click .range-control':         '_controlClick',

            /* Since View.Doc uses 'mouseup' to see if a rangy selection has
             * been established (in order to create a View.Selection from the
             * rangy selection) and will remove any existing View.Selection
             * elements if there is no rangy selection, we need to squelch any
             * 'mouseup' events within our range-control to ensure that, when
             * clicked, our view is not destroyed before _controlClikc() can be
             * invoked to generate a matching View.Note.
             */
            'mouseup .range-control':       '_squelch'
        },

        /** @brief  Initialize this instance. */
        initialize: function() {
            // Cache the options.ranges value
            this.ranges     = this.options.ranges;
            this.rangeViews = this.options.rangeViews;
        },

        /** @brief  Render this view. */
        render: function() {
            var self    = this;

            self.$el = $(self.el);

            if (self.ranges.cid)    { self.$el.attr('id', self.ranges.cid); }

            self.$el.html( self.template( (self.model
                                            ? self.model.toJSON()
                                            : null) ) );

            // Store a reference to this view instance
            self.$el.data('View:'+ self.viewName, self);

            // Gather our pieces
            self.$control = self.$el.find('.range-control')
                                    .hide();

            /* Create a "collection" of range views based upon the attached
             * ranges (Model.Ranges).
             */
            var events      = [ 'mouseenter.'+ self.viewName,
                                'mouseleave.'+ self.viewName ].join(' '),
                selector    = '.'+ self.className;

            self.__rangeMouse = _.bind(self._rangeMouse, self);
            self.rangeViews   = [];
            self.ranges.each(function(range) {
                var view    = new app.View.Range( {
                                    parentView: self,
                                    model:      range,
                                    className:  self.className
                              });
                view.render();

                // Delegate events for this range view
                view.$el.delegate(selector, events, self.__rangeMouse);

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

            return self;
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
                var events      = '.'+ self.viewName,
                    selector    = '.'+ self.className;
                $.each(self.rangeViews, function() {
                    var view    = this;

                    // Un-bind event handlers
                    view.$el.undelegate(selector, events, self.__rangeMouse);

                    view.remove( (self.ranges === null) );
                });
            }

            if (self.$control)
            {
                self.$control.unbind('.'+ self.viewName);
            }

            return Backbone.View.prototype.remove.call(this);
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

            // Self-destruct and return the constructed Model.Note
            //setTimeout(function() { self.remove(); }, 10);
            self.remove();

            return note;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Squelch the event.
         *  @param  e       The triggering event;
         */
        _squelch: function(e) {
            e.stopPropagation();
        },

        /** @brief  Handle click events on our control element.
         *  @param  e       The triggering event which SHOULD include an
         *                  'originalEvent' that can be used to identify the
         *                  originating target;
         */
        _controlClick: function(e) {
            var self    = this,
                $el     = $(e.originalEvent.target),
                name    = $el.attr('name');

            /*
            console.log('View.%s::_controlClick(): name[ %s ]',
                        self.viewName, name);
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

            /*
            console.log('View.%s::_controlMouse(): type[ %s ]',
                        self.viewName, e.type);
            // */

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

            /*
            console.log('View.Selection::_rangeMouse(): '
                        + 'type[ '+ e.type +' ]');
            // */

            switch (e.type)
            {
            case 'mouseenter':
                var $token  = $(e.target);
                if (self._pendingLeave)
                {
                    // Cancel any pending leave
                    clearTimeout( self._pendingLeave );
                    self._pendingLeave = null;
                }

                self._showControl( $token, {x: e.pageX, y: e.pageY} );
                break;

            case 'mouseleave':
                /* Wait a short time to see if _controlMouse() is fired with
                 * 'mouseenter'.
                 */
                self._pendingLeave = setTimeout(function() {
                    // Hide the range controls
                    self._hideControl();
                    self._pendingLeave = null;
                }, 100);
                break;
            }
        },

        /** @brief  Given x,y coordinates, determine if they fall within one of 
         *          our bounding segments.  If so, show the control along the
         *          edge of the nearest segment near the provided coordinates.
         *  @param  $token      The token element near which to show the
         *                      control;
         *  @param  coords      An object of { x: , y: } coordinates;
         *
         *  @return The offset, or null.
         */
        _showControl: function( $token, coords ) {
            var self        = this,
                segment     = $token.offset(),
                position    = {
                    my:     'bottom',
                    at:     'top',
                    of:     $token,
                    using:  function(to) {
                        if (self.$control.data('control-animation'))
                        {
                            // Animate positioning
                            self.$control
                                .stop()
                                .animate( to, app.config.animSpeed );
                        }
                        else
                        {
                            // Direct move
                            self.$control
                                .css( to );
                        }
                    }
                };

            segment.right  = segment.left + $token.outerWidth();
            segment.bottom = segment.top  + $token.outerHeight();

            // Find the nearest horizontal edge
            if ((coords.y - segment.top) >
                    ((segment.bottom - segment.top) / 2))
            {
                // Nearest the bottom of 'segment'
                position.my = 'top';
                position.at = 'bottom';
                self.$control.removeClass('ui-corner-top')
                             .addClass('ui-corner-bottom');
            }
            else
            {
                // Nearest the top of 'segment'
                self.$control.removeClass('ui-corner-bottom')
                             .addClass('ui-corner-top');
            }

            /* Mark whether or not to animate the position based upon the
             * current visibility of the control, ensure that it is visible,
             * and perform positioning.
             */
            self.$control.data('control-animation',
                               self.$control.is(':visible'))
                         .show()
                         .position( position );

            return self;
        },

        /** @brief  Hide the control.
         *
         *  This is a method so sub-classes can override.
         */
        _hideControl: function( ) {
            var self    = this;

            self.$control.hide();

            return self;
        }
    });

 }).call(this);
