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

        // Renter the XML
        self.renderXml( self.metadata );

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
        var num             = 0;
        var minThreshold    = -1;
        var maxThreshold    = 100;

        for (var idex = self.ranks.length - 1; idex > 0; idex--)
        {
            var ar = self.ranks[idex];
            if (ar === undefined) { continue; }

            num += ar.length;
            if (num > opts.showSentences)
            {
                minThreshold = idex;
                break;
            }
        }

        self.renderControl( minThreshold, maxThreshold );
    },

    /** @brief  Given XML content, convert it to stylable HTML.
     *  @param  xml     The XML to render.
     *
     */
    renderXml: function(xml) {
        var self    = this;
        var $xml    = $( xml );

        /* Convert the XML to HTML that can be styled.
         *
         * First, handle any <header>, adding a <header> element BEFORE this
         * element.
         */
        var $header     = $('<header />').appendTo( self.element );

        $xml.find('document').children().each(function() {
            var $el = $(this);

            switch (this.nodeName)
            {
            case 'title':
                $header.append('<h1>'+ $el.text() +'</h1>');
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

            case 'body':
                // Process any XML <section> elements
                $el.find('section').each(function() {
                    // Leave this for later
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
                break;

            default:
                $header.append( $el );
                break;
            }
        });

    },

    /** @brief  Render the summary dialog with controls.
     *  @param  minThreshold    The threshold minimum.
     *  @param  maxThreshold    The threshold maximum.
     */
    renderControl: function( minThreshold, maxThreshold ) {
        var self    = this;
        var opts    = self.options;

        // Render the jquery-ui controls: dialog, slider
        var $control   = $('.summary-control');
        var $controls  = $control.find('.controls');

        self.$list     = $control.find('.list');
        self.$threshold= $controls.find('#threshold')
                            .addClass('ui-corner-all');
        self.$slider   = $('<div />')
                            .addClass('slider')
                            .slider({
                                range:  true,
                                min:    0,
                                max:    100,
                                values: [minThreshold, maxThreshold],
                                slide:  function(event, ui) {
                                    self.threshold(ui.values[0],
                                                   ui.values[1]);
                                }
                            })
                            .appendTo($controls);

        self.threshold( minThreshold, maxThreshold );
    },

    /** @brief  Change the rank threshold.
     *  @param  min     The minimum threshold.
     *  @param  max     The maximum threshold.
     *
     */
    threshold: function( min, max) {
        var self    = this;
        var opts    = self.options;

        self.minThreshold = min;
        self.maxThreshold = max;

        self.$slider.slider('values', 0, self.minThreshold);
        self.$slider.slider('values', 1, self.maxThreshold);

        var str = self.minThreshold +' - ' + self.maxThreshold;
        self.$threshold.val( str );

        // Remove existing highlights
        self.$s.removeClass('highlight')
               .removeAttr('style');

        self.$list.empty();
        for (var idex = self.maxThreshold; idex >= self.minThreshold; idex--)
        {
            var ar  = self.ranks[idex];
            if (ar === undefined)   { continue; }

            //var blue    = Math.floor(255 - (25 * Math.log( 100 - idex )));
            var blue    = Math.ceil( 255 * (idex / 100) );
            var color   = 'rgb(34,34,'+ blue +')';
            var nItems  = ar.length;
            for (var jdex = 0; jdex < nItems; jdex++)
            {
                //ar[jdex].attr('style', 'font-weight:bold;');
                ar[jdex].addClass('highlight')
                        .css({color: color});

                var $li     = $('<li />')
                                .html(ar[jdex].html())
                                .css({color: color});
                if (jdex === 0)
                {
                    // Include a rank
                    $('<div />').addClass('rank')
                                .text(idex)
                                .prependTo($li);
                }

                    self.$list.append( $li );
            }
        }
    },

    /******************************************************************
     * "Private" methods
     *
     */

    /** @brief  Is the current caret/cursor within the min or max value?
     *  @param  $el     The jQuery/DOM element representing the input control;
     *
     *  @return The caret/cursor position;
     */
    _getCaret: function($el) {
        var self    = this;
        var el      = $el[0];
        var pos     = 0;

        if (document.selection)
        {
            // IE

            /* Several hurdles with IE:
             *  - IE does not handle a selection for a given element but for
             *    the entire document;
             *  - Windows newlines (\r\n) are counted as 2 characters except
             *    which it comes to positioning the cursor;
             *  - There is no easy way to find the cursor position;
             *
             * Focus on the target object otherwise the selection MAY NOT be
             * what we expect.
             */
            el.focus();

            // Create a TextRange based on the current selection
            var range = document.selection.createRange();
            if (range.parentElement() == obj)
            {
                /* Move the start of the cursor back by as much as the value
                 * length
                 */
                range.moveStart('character', -el.value.length);

                /* The length of the range text is now the current cursor
                 * position
                 */
                pos = range.text.length;
            }
        }
        else if (el.selectionStart)
        {
            // Gecko
            pos = el.selectionStart;
        }

        return pos;
    },

    /** @brief  Set the caret/cursor position within the given element
     *  @param  $el     The jQuery/DOM element representing the input control;
     *  @param  pos     The desired caret/cursor position;
     */
    _setCaret: function($el, pos) {
        var self    = this;
        var el      = $el[0];

        if (document.selection)
        {
            // IE
            var range   = obj.createTextRange();
            range.move('character', pos);
            range.select();
        }
        else if (el.selectionStart)
        {
            // Gecko
            el.focus();
            el.setSelectionRange(pos, pos);
        }
    },


    _bindEvents: function() {
        var self    = this;
        var $gp     = self.element.parent().parent();

        /*************************************************************
         * Link from highlights to the summary entry
         *
         */
        var articleTimer    = null;
        $gp.delegate('.article-pane .highlight', 'mouseenter', function() {
            var $el = $(this);
            articleTimer = setTimeout(function() {
                articleTimer = null;

                var txt = $el.text();

                var $s = self.$list
                            .find(':contains('+ txt +')');
                $s.addClass('ui-state-highlight');

                // Scroll the container
                //self.$list.scrollTo($s, {duration:100, axis:'y'});

            }, 250);
        });

        $gp.delegate('.article-pane .highlight', 'mouseleave', function() {
            if (articleTimer !== null)
            {
                // Just cancel the pending highlight
                clearTimeout(articleTimer);
                return;
            }

            var $el = $(this);
            var txt = $el.text();

            var $s = self.$list
                        .find(':contains('+ txt +')');
            $s.removeClass('ui-state-highlight');
        });

        /*************************************************************
         * Link from summary items to their source paragraphs
         *
         */
        var controlTimer    = null;
        $gp.delegate('.summary-control .list li', 'mouseenter', function() {
            var $el = $(this);
            controlTimer = setTimeout(function() {
                controlTimer = null;

                var rk  = $el.children().text();
                var re  = (rk.length > 0
                            ? new RegExp('^'+ rk)
                            : null);
                var txt = $el.text();
                if (re !== null)
                {
                    txt = txt.replace(re, '');
                }

                var $s = self.element
                            .find('span:contains('+ txt +')');
                $s.addClass('ui-state-highlight');
                $s.parent().addClass('hover-link');

                // Scroll the container
                //self.element.scrollTo($s.parent(), {duration:100, axis:'y'});
            }, 250);
        });

        $gp.delegate('.summary-control .list li', 'mouseleave', function() {
            if (controlTimer !== null)
            {
                // Just cancel the pending highlight
                clearTimeout(controlTimer);
                return;
            }

            var $el = $(this);
            var rk  = $el.children().text();
            var re  = (rk.length > 0
                        ? new RegExp('^'+ rk)
                        : null);
            var txt = $el.text();
            if (re !== null)
            {
                txt = txt.replace(re, '');
            }

            var $s = self.element
                        .find('span:contains('+ txt +')');
            $s.removeClass('ui-state-highlight');
            $s.parent().removeClass('hover-link');
        });

        /*************************************************************
         * Reflect changes in the threshold input box to the slider
         *
         */
        $gp.delegate('.controls input', 'change', function() {
            var val     = $(this).val();
            var range   = val.split(/\s*-\s*/);
            var min     = parseInt(range[0]);
            var max     = parseInt(range[1]);

            if (isNaN(min)) { min = self.minThreshold; }
            if (isNaN(max)) { max = self.maxThreshold; }

            self.threshold(min, max);
        });

        /*************************************************************
         * Allow arrow up/down to change the threshold input values
         *
         */
        $gp.delegate('.controls input', 'keydown', function(e) {
            var $el     = $(this);
            var val     = $el.val();
            var divider = val.indexOf('-');
            var pos     = self._getCaret( $el );
            var vals    = [ self.minThreshold, self.maxThreshold ];
            var which   = ( pos > divider ? 1 : 0);

            /* If the key is arrow up or down, adjust the min or max threshold
             * (depending on which one the current caret/cursor is nearest) up
             * or down.
             */
            switch (e.which)
            {
            case $.ui.keyCode.UP:
                if (vals[which] < 100)
                {
                    vals[which] = vals[which] + 1;
                }
                break;

            case $.ui.keyCode.DOWN:
                if (vals[which] > 0)
                {
                    vals[which] = vals[which] - 1;
                }
                break;

            default:
                return;
            }

            // If we've flipped min/max, make sure they're properly ordered
            vals = vals.sort(function(a,b){ return a-b; });
            self.threshold(vals[0], vals[1]);

            // Reset the caret/cursor position to its original value
            self._setCaret( $el, pos );

            // Squelch this event
            return false;
        });
    },

    _unbindEvents: function() {
        var $parent = this.element.parent();

        $parent.undelegate('.controls input', 'change');
        $parent.undelegate('.controls input', 'keydown');

        var self    = this;
        var $gp     = self.element.parent().parent();

        $gp.undelegate('.article-pane span', 'hover');

        $gp.delegate('.summary-control .list li', 'mouseenter', function() {
            var $el = $(this);
            var rk  = $el.children().text();
            var re  = (rk.length > 0
                        ? new RegExp('^'+ rk)
                        : null);
            var txt = $el.text();
            if (re !== null)
            {
                txt = txt.replace(re, '');
            }

            var $s = self.element
                        .find(':contains('+ txt +')');
            $s.addClass('hover-link');
        });

        $gp.delegate('.summary-control .list li', 'mouseleave', function() {
            var $el = $(this);
            var rk  = $el.children().text();
            var re  = (rk.length > 0
                        ? new RegExp('^'+ rk)
                        : null);
            var txt = $el.text();
            if (re !== null)
            {
                txt = txt.replace(re, '');
            }

            var $s = self.element
                        .find(':contains('+ txt +')');
            $s.removeClass('hover-link');
        });

        $gp.delegate('.controls input', 'change', function() {
            var val     = $(this).val();
            var range   = val.split(/\s*-\s*/);
            var min     = parseInt(range[0]);
            var max     = parseInt(range[1]);

            if (isNaN(min)) { min = self.minThreshold; }
            if (isNaN(max)) { max = self.maxThreshold; }

            self.threshold(min, max);
        });

        $gp.delegate('.controls input', 'keydown', function(e) {
            var $el     = $(this);
            var val     = $el.val();
            var divider = val.indexOf('-');
            var pos     = self._getCaret( $el );
            var vals    = [ self.minThreshold, self.maxThreshold ];
            var which   = ( pos > divider ? 1 : 0);

            /* If the key is arrow up or down, adjust the min or max threshold
             * (depending on which one the current caret/cursor is nearest) up
             * or down.
             */
            switch (e.which)
            {
            case $.ui.keyCode.UP:
                if (vals[which] < 100)
                {
                    vals[which] = vals[which] + 1;
                }
                break;

            case $.ui.keyCode.DOWN:
                if (vals[which] > 0)
                {
                    vals[which] = vals[which] - 1;
                }
                break;

            default:
                return;
            }

            // If we've flipped min/max, make sure they're properly ordered
            vals = vals.sort(function(a,b){ return a-b; });
            self.threshold(vals[0], vals[1]);

            // Reset the caret/cursor position to its original value
            self._setCaret( $el, pos );

            // Squelch this event
            return false;
        });
    }
};

}(jQuery));
