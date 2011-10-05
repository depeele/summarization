/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 *
 *  Requires:
 *      jquery.js
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
        doc:        null,           /* The model.Doc instance OR URL of the
                                     * JSON that describes the document to be
                                     * presented.
                                     */
        template:   '#template-doc',/* The DOM selector for the template to use
                                     * when rendering 'doc'.
                                     */

        filter:         'normal',   // The initial filter (tagged,starred)
        showSentences:  5,          /* The minimum number of sentences to
                                     * present
                                     */
        threshold:      {           // The desired min/max threshold
            min:        -1,         // If -1,-1, dynamically determine the
            max:        -1          //  threshold based upon 'showSentences'
        }
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

        // Bind events
        self._bindEvents();

        // Kick off the retrieval of the metadata
        self.element.addClass('loading');

        var renderSuccess   = function() {
            self.render();
            self.element.removeClass('loading');
        };

        if (opts.doc instanceof Doc)
        {
            renderSuccess();
        }
        else
        {
            var getDoc  = $.getJSON(opts.doc);
            getDoc.success(function( data ) {
                opts.doc = new Doc( data );

                renderSuccess();
            });
            getDoc.error(function() {
                alert("Cannot retrieve metadata '"+ opts.doc +"'");
                self.element.removeClass('loading');
            });
        }
    },

    /** @brief  Invoked to cleanup this widget. */
    destroy: function() {
        self._unbindEvents();
    },

    /** @brief  Render the document.
     */
    render: function() {
        var self    = this;
        var opts    = self.options;
        var doc     = opts.doc;

        if (! (doc instanceof Doc)) { return; }

        if (! opts.templateCompiled)
        {
            opts.templateCompiled = _.template( $( opts.template ).html() );
        }

        // Render the document
        self.element.html( opts.templateCompiled( doc ) );

        // Gather the ranks
        self.ranks  = [];
        self.$p     = self.element.find('section p');
        self.$s     = self.element.find('.sentence');
        self.$s.each(function() {
            var $s      = $(this);
            var rank    = $s.attr('rank');
            if (rank === undefined) { return; }

            rank = Math.floor(rank * (rank < 1 ? 100 : 1));

            if (self.ranks[rank] === undefined) { self.ranks[rank] = []; }
            self.ranks[rank].push($s);
        });

        // Compute the threshold (unless explicitly provided)
        var threshold   = opts.threshold;
        if ((opts.threshold.min < 0) || (opts.threshold.max < 0))
        {
            threshold          = self._computeThreshold();
            self.origThreshold = threshold;

        }

        // Apply the threshold
        self.threshold( threshold.min, threshold.max );
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
        //self.$thresholdValues.text( str );

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

        /* If a paragraphs has no sentences to be highlighted, add 'collapsed'
         * as a style.
         */
        self.$p.each(function() {
            var $p  = $(this);
            if ($p.find('.sentence.toHighlight').length < 1)
            {
                $p.addClass('collapsed');
            }
            else
            {
                $p.removeClass('collapsed');
            }
        });

        /* Hide expansion controls for sentences that have no siblings that
         * would be expanded.
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
         */

        self.$s
            // Hide sentences
            .filter('.noHighlight')
                .removeClass('noHighlight expanded')
                //.sentence('unhighlight')
            .end()
            // Show sentences
            .filter('.toHighlight')
                .removeClass('toHighlight')
                .addClass('expanded')
                //.sentence('highlight')
                ;
          
        //self._putState();
    },

    /*************************************************************************
     * "Private" methods
     *
     */

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

    /** @brief  Set the caret/cursor position within the given element
     *  @param  $el     The jQuery/DOM element representing the input control;
     *  @param  pos     The desired caret/cursor position;
     */
    _bindEvents: function() {
        var self    = this;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();

    },

    _unbindEvents: function() {
        var self    = this;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();

    }
};

}(jQuery));
