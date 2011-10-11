/** @file
 *
 *  Backbone Helper to properly handle click events.
 *
 *  Requires:
 *      backbone.js
 *      jquery.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app             = this.app = (this.app || {Model:{},      View:{},
                                                   Controller:{}, Helper:{}});
    var $               = jQuery.noConflict();
    app.Helper.click    = {
        clickEvent:         'element:click',
        dblClickTimeout:    150,
        events:             {
            /* Track mouse events to fuse a single click event iff the mouse
             * was IN this paragraph on mousedown AND mouseup/click.
             */
            'mousedown':    '_trackClick',
            'click':        '_trackClick',
            'mouseenter':   '_trackClick',
            'mouseleave':   '_trackClick',
            'dblclick':     '_trackClick'
        },

        /** @brief  Monitor mouseDown/Up for clicks WITHIN this element. */
        _trackClick: function(e) {
            var self    = this;

            //console.log('Helper::_trackClick: type[ '+ e.type +' ]');

            /* To ensure that nested elements perform properly, invoking a
             * click event ONLY on the lowest level element, stop
             * propagation of this mouse event.
             */
            e.stopPropagation();

            switch (e.type)
            {
            case 'mousedown':
                self._clickDown = e;
                break;

            case 'click':
                if (self._clickDown !== null)
                {
                    /* We've seen a mousedown WITHIN this paragraph.  If this
                     * 'up' event is NEAR the 'down' event, it is a potential
                     * click.
                     */
                    var delta   = {
                        x:  Math.abs( self._clickDown.pageX - e.pageX ),
                        y:  Math.abs( self._clickDown.pageY - e.pageY )
                    };

                    if ((delta.x < 10) && (delta.y < 10))
                    {
                        /* In order to avoid squelching double-clicks, wait a
                         * short time to see if there is an additional 'down'
                         * event.
                         */
                        var orig    = self._clickDown;
                        setTimeout(function() {
                            if (orig === self._clickDown)
                            {
                                /* Create a new event that encapsulates THIS
                                 * event, and for the event type to
                                 * 'clickEvent'
                                 */
                                var event   = new $.Event( e, {
                                                    type: self.clickEvent
                                              } );

                                /*
                                console.log('Helper::_trackClick: trigger[ '
                                             + event.type +' ]');
                                // */

                                self.$el.trigger( event );
                            }

                            self._clickDown = null;
                        }, self.dblClickTimeout);
                        return;
                    }
                }

                // Fallthrough to reset the click state

            case 'dblclick':
            case 'mouseenter':
            case 'mouseleave':
                self._clickDown = null;
                break;
            }
        }
    };

 }).call(this);
