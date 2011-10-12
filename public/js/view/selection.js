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

    /** @brief  A View for a app.Model.Ranges instance. */
    app.View.Selection = Backbone.View.extend({
        viewName:   'Selection',
        clickEvent: 'control:click',

        tagName:    'div',
        className:  'selection',
        template:   _.template($('#template-selection').html()),
        rangeViews: null,

        events: {
            'control:click':    '_controlClick'
        },

        initialize: function() {

            // Mix in the _trackClick method from the click helper
            this._trackClick = _.bind(app.Helper.click._trackClick, this);

            /* Gather the events used by _trackClick, ensuring that 'mouseup'
             * is included.
             *
             * :NOTE: If we don't include 'mouseup', _trackClick will not
             *        properly handle the click event for this situation
             *        (i.e. the control moved from it's original container into
             *              the '.selected' element).
             */
            var events  = [ 'mouseup.'+ this.viewName ];
            $.each(app.Helper.click.events, function(event, method) {
                events.push( event +'.'+ this.viewName );
            });

            this._trackClickEvents = events.join(' ');
        },

        /** @brief  Override so we can properly remove component range views.
         */
        remove: function() {
            var self    = this;

            if (self.rangeViews)
            {
                // Remove all component View.Range elements
                $.each(self.rangeViews, function() {
                    var view    = this;

                    // Un-bind event handlers
                    $(view.el).undelegate('.selected', '.'+ self.viewName);

                    view.remove();
                });
            }

            if (self.$control)
            {
                self.$control.unbind('.'+ self.viewName);
            }

            return Backbone.View.prototype.remove.call(this);
        },

        render: function() {
            var self    = this;

            self.$el = $(self.el);
            self.$el.attr('id', self.model.cid);
            self.$el.html( self.template( self.model.toJSON() ) );

            // Store a reference to this view instance
            self.$el.data('View:'+ self.viewName, self);

            // Gather our pieces
            self.$control = self.$el.find('.range-control')
                                    .hide();

            self.rangeViews  = [];
            var events       = [ 'mouseenter.'+ self.viewName,
                                 'mouseleave.'+ self.viewName ].join(' ');
            self.model.each(function(model) {
                var view    = new app.View.Range( {
                                    parentView: self,
                                    model:      model,
                                    className:  self.className
                              });
                view.render();

                // Bind to mouse events on this range view
                $(view.el).delegate('.selected',  events,
                                    _.bind(self._rangeMouse, self));

                self.rangeViews.push( view );

                /* The Range view inserts itself in the proper sentence
                 * overlay.  Do NOT move it by appending it to our own element.
                 * Instead, we maintain the 'views' array to contain a list of
                 * our component views.
                 *
                 * self.$el.append( view.render().el );
                 */
            });

            return self;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Handle control:click events.
         *  @param  e       The triggering event which SHOULD include an
         *                  'originalEvent' that can be used to identify the
         *                  originating target;
         */
        _controlClick: function(e) {
            var self    = this;
            var $el     = $(e.originalEvent.target);
            var name    = $el.attr('name');

            console.log('View.'+ self.viewName +'::_controlClick(): '
                        +   'name[ '+ name +' ]');

            switch (name)
            {
            case 'note-add':
                // :TODO: Convert this Selection view to a Note view.
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

                /* Move the control INTO the target overlay so mouse movement
                 * will NOT indicate 'leave'
                 */
                if (self.$control.parent().get(0) !== $selected.get(0))
                {
                    self.$control.unbind('.'+ self.viewName);

                    self.$control.prependTo($selected);

                    // Bind the events needed by _trackClick
                    self.$control.bind( self._trackClickEvents,
                                        _.bind(self._trackClick, self) );
                }

                /* :TODO: Move the control to the nearest edge of the target
                 *        and position the controls there, perhaps adjusting
                 *        the border radius according to which edge abuts the
                 *        range.
                 *
                 *        The bounds of any selection can be defined by 3
                 *        contiguous elements:
                 *           +------------------------------------------+
                 *           |                                          |
                 *           |          +-----------------------------+ |
                 *           |          | 1                           | |
                 *           | +--------+-----------------------------+ |
                 *           | |          2                           | |
                 *           | +-------------------------+------------+ |
                 *           | |          3              |              |
                 *           | +-------------------------+              |
                 *           |                                          |
                 *           +------------------------------------------+
                 */
                var position    = {
                    my: 'bottom',
                    at: 'top',
                    of: $selected
                };

                self.$control.show()
                             .position( position );
                break;

            case 'mouseleave':
                // :TODO: If the mouse is IN the control, do NOT hide it.

                // Hide the range controls
                self.$control.hide();
                break;
            }
        }
    });

 }).call(this);
