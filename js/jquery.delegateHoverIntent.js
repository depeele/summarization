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


}(jQuery));
