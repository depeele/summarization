/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 */
(function($) {

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
        src:            null,   // The URL of the original source
        metadata:       null,   // The URL of the
                                // summarization/characterization metadata

        showSentences:  5       // The minimum number of sentences to present
    },

    /** @brief  Initialize this new instance.
     *  @param  el          The jQuery DOM element.
     *  @param  options     Initialization options.
     *
     *  @return this for a fluent interface.
     */
    init: function(el, options) {
        var self    = this;
        var opts    = $.extend(true, {}, self.options, options);

        self.element  = el;
        self.options  = opts;
        self.metadata = null;
        self.$src     = null;

        self._bindEvents();

        // Kick off the retrieval of the metadata
        var getMetadata  = $.get(opts.metadata);

        getMetadata.success(function( data ) {
            self.metadata = data;
            self.render();
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

        if ((self.$src === null) && (opts.src !== null))
        {
            // Include a zoomed frame of the original source
            self.$src = $("<div />")
                            .addClass('src');

            var $frame  = $('<iframe />')
                            .attr('src', opts.src)
                            .css('visibility', 'hidden');

            self.$src.append( $frame );
            self.element.append( self.$src );
        }

        if (self.metadata === null) { return; }

        var $xml    = $( self.metadata );

        /* Convert the XML to HTML that can be styled.
         * Start with the XML <section>
         */
        $xml.find('body section').each(function() {
            var $div     = $('<section />');

            // Convert the XML <p> to an HTML <p>
            $(this).find('p').each(function() {
                var $p  = $('<p />');

                // Convert the XML <s> to an HTML <span>
                $(this).find('s').each(function() {
                    var $s    = $(this);
                    var $span = $('<span />')
                                    .attr('rank', $s.attr('rank'))
                                    .text( $s.text() );

                    $p.append($span);
                });

                $div.append($p);
            });

            self.element.append( $div );
        });

        // Find all sentences and bucket them based upon 'rank'
        self.$s     = self.element.find('p span');
        self.ranks  = [];
        self.$s.each(function() {
            var $el     = $(this);
            var rank    = parseFloat($el.attr('rank'));
            if (isNaN(rank))                    { return; }

            // Treat the rank as an integer percentile (0 .. 100).
            rank = parseInt(rank * 100);
            if (self.ranks[rank] === undefined) { self.ranks[rank] = []; }
            self.ranks[rank].push($el);
        });

        /* Find the highest rank that will include at least opts.showSentences
         * sentences.
         */
        var num         = 0;
        var threshold   = -1;

        for (var idex = self.ranks.length - 1; idex > 0; idex--)
        {
            var ar = self.ranks[idex];
            if (ar === undefined) { continue; }

            num += ar.length;
            if (num > opts.showSentences)
            {
                threshold = idex;
                break;
            }
        }

        self.threshold( threshold );
    },

    /** @brief  Change the rank threshold.
     *  @param  threshold   The new threshold.
     *
     */
    threshold: function( threshold) {
        var self    = this;
        var opts    = self.options;

        self.threshold = threshold;

        // Remove existing highlights
        self.$s.removeClass('highlight');
        for (var idex = threshold; idex < 100; idex++)
        {
            var ar  = self.ranks[idex];
            if (ar === undefined)   { continue; }

            var nItems  = ar.length;
            for (var jdex = 0; jdex < nItems; jdex++)
            {
                //ar[jdex].attr('style', 'font-weight:bold;');
                ar[jdex].addClass('highlight');
            }
        }
    },

    /******************************************************************
     * "Private" methods
     *
     */
    _bindEvents: function() {
    },

    _unbindEvents: function() {
    }
};

}(jQuery));
