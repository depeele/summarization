/** @file
 *
 *  hoverIntent will fire a hoverIntentOver/hoverIntentOut event on the
 *  targeted element iff the user's mouse has slowed down (beneath the
 *  sensitivity threshold) over the element.
 *
 *  Based upon hoverIntent r6 // 2011.02.26 // jQuery 1.5.1+
 *      <http://cherne.net/brian/resources/jquery.hoverIntent.html>
 * 
 *      hoverIntent is currently available for use in all personal or
 *      commercial projects under both MIT and GPL licenses. This means that
 *      you can choose the license that best suits your project, and use it
 *      accordingly.
 *
 *      @author    Brian Cherne brian(at)cherne(dot)net
 * 
 *  basic usage:
 *      $("ul li").hoverIntent( );
 *
 *      'hoverIntentOver/hoverIntentOut' events will be fired on $("ul li")
 *      elements.
 * 
 *  advanced usage receives configuration object only
 *      $("ul li").hoverIntent({
 *	        sensitivity:    7,          // sensitivity threshold (>= 1)
 *	        interval:       100,        // milliseconds of polling interval
 *	        timeout:        0,          // milliseconds delay before
 *	                                    // "hoverIntentOut" is triggered.
 *	        over:           showNav,    // onHoverIntentOver callback
 *	        out:            hideNav     // onHoverIntentOut  callback
 *      });
 */
(function($) {
	$.fn.hoverIntent = function(opts) {
		// default configuration options
		var cfg = {
			sensitivity:7,
			interval:   100,
			timeout:    0
		};
        if (opts)   { cfg = $.extend(true, cfg, opts); }

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
                /* set hoverIntent state to true (so hoverIntentOut can be
                 * called)
                 */
				ob.hoverIntent_s = 1;

                ev.type = 'hoverIntentOver';
                $(ob).trigger(ev);
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

		// A private function for delaying the hoverIntentOut function
		var delay = function(ev,ob) {
			ob.hoverIntent_t = clearTimeout(ob.hoverIntent_t);
			ob.hoverIntent_s = 0;

            ev.type = 'hoverIntentOut';
            $(ob).trigger(ev);
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

                /* if hoverIntent state is true, then call the hoverIntentOut
                 * function after the specified delay
                 */
				if (ob.hoverIntent_s == 1) {
                    ob.hoverIntent_t = setTimeout( function(){delay(ev,ob);},
                                                   cfg.timeout );
                }
			}
		};

        // Bind any configuration-provided handlers
        if ($.isFunction(cfg.over)) {
            this.bind('hoverIntentOver.hoverIntent',cfg.over);
        }
        if ($.isFunction(cfg.out)) {
            this.bind('hoverIntentOut.hoverIntent',cfg.out);
        }

		// bind the function to the two event listeners
		return this.bind('mouseenter.hoverIntent',handleHover)
                   .bind('mouseleave.hoverIntent',handleHover);
	};

	$.fn.unhoverIntent = function() {
        return this.unbind('.hoverIntent');
    };

})(jQuery);
