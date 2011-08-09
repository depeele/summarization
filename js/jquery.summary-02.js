/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 *
 *  The markup for controls to allow a continuous range should be of the form:
 *      <div class='control-pane'>
 *       <div class='threshold'>
 *        <label for='threshold'>Threshold range:</label>
 *        <input name='threshold' type='text' />
 *       </div>
 *      </div>
 *
 *  The markup for controls to allow a discrete set of values  should be of the
 *  form:
 *      <div class='control-pane'>
 *       <div class='buttons'>
 *        <label for='threshold'>Threshold:</label>
 *
 *        <input name='threshold' id='threshold-low' type='radio' value'=25' />
 *        <label for='threshold-low'>low</label>
 *
 *        <input name='threshold' id='threshold-med' type='radio' value'=50' />
 *        <label for='threshold-med'>medium</label>
 *
 *        <input name='threshold' id='threshold-high' type='radio' value'=75' />
 *        <label for='threshold-high'>high</label>
 *       </div>
 *      </div>
 *
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *      jquery.delegateHoverIntent.js
 *      rangy.js
 *      rangy/seializer.js
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
        src:            null,       // The URL of the original source
        metadata:       null,       // The URL of the
                                    // summarization/characterization metadata

        showSentences:  5,          // The minimum number of sentences to
                                    // present

        lineHeight:     -1,         // The height of a single line
                                    // (measured in renderXml() if -1);

        useColor:       false,
        rankOpacity:    0.3         // The default opacity for rank items
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

        var $gp = self.element.parent().parent()
        self.$control   = $gp.find('.control-pane');
        self.$threshold = self.$control.find('input[name=threshold]');
        self.$slider    = null;

        rangy.init();
        //self.cssApply   = rangy.createCssClassApplier('highlighter', true);
        self.cssApply = rangy.createCssClassApplier(
                                    'ui-state-default highlighter',
                                    true);

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

        if (self.metadata === null) { return; }

        // Renter the XML
        self.renderXml( self.metadata );

        // Find all sentences and bucket them based upon 'rank'
        self.$s     = self.element.find('p .sentence');
        self.ranks  = [];
        self.$s.each(function() {
            var $el     = $(this);
            var rank    = parseFloat($el.attr('rank'));
            if (isNaN(rank))                    { return; }

            // Treat the rank as an integer percentile (0 .. 100).
            rank = parseInt(rank * 100);
            if (self.ranks[rank] === undefined) { self.ranks[rank] = []; }

            if (opts.useColor === true)
            {
                // Adjust the color of the sentence based upon the rank
                var red     = 221 - Math.ceil( 221 * (rank / 100) );
                var green   = red;
                var blue    = red;
                var color   = 'rgb('+ red +','+ green +','+ blue +')';
                $el.css({color:color});
            }

            // Include the rank within the sentence
            $('#tmpl-sentence-rank')
                .tmpl({rank:rank})
                .css('opacity', opts.rankOpacity)
                .prependTo($el);

            // And sentence controls
            $('#tmpl-sentence-controls')
                .tmpl()
                .appendTo($el);

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
        var opts    = self.options;
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

            case 'keywords':
                // Process any XML <keyword> elements
                $('#tmpl-header-keywords')
                    .tmpl({ keywords: $el.find('keyword') })
                    .appendTo($header);
                break;

            case 'body':
                // Process any XML <section> elements
                $el.find('section').each(function() {
                    // Leave this for later
                    var $div     = $('<section />')
                                        .appendTo( self.element );

                    // Convert the XML <p> to an HTML <p>
                    $(this).find('p').each(function() {
                        var $p  = $('<p />')
                                    .appendTo($div);

                        // Convert the XML <s> to an HTML <div>
                        $(this).find('s').each(function() {
                            var $s      = $(this);
                            var $sEl  = $('<div />')
                                            .addClass('sentence')
                                            .attr('rank', $s.attr('rank'))
                                            .appendTo($p);

                            // Assemble the HTML from the XML
                            $.each(this.childNodes, function() {
                                var $node   = $(this);
                                switch (this.nodeName)
                                {
                                case '#text':
                                    $('#tmpl-sentence-text')
                                        .tmpl( {node:$node} )
                                        .appendTo( $sEl );
                                    break;

                                case 'keyword':
                                    $('#tmpl-sentence-keyword')
                                        .tmpl( {node:$node} )
                                        .appendTo( $sEl );
                                    break;
                                }
                            });

                            if (opts.lineHeight < 1)
                            {
                                opts.lineHeight = $sEl.height();
                            }


                            //$p.append( $sEl );
                        });

                        //$div.append($p);
                    });

                    //self.element.append( $div );
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

        // Single threshold input indicates that we use the slider
        if (self.$threshold.length === 1)
        {
            // Render the slider controls
            var $controls  = self.$threshold.parent();

            self.$threshold.addClass('ui-corner-all');
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
        }
        // Multiple threshold inputs indicates that we use radio buttons
        else
        {
            // Render the discrete controls
            self.$threshold.each(function() {
                var $el = $(this);
                var val = parseInt($el.val(), 10);
                $el.data('valueInt', val);
            });
        }
        self.$control.find('.buttons').buttonset();

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

        if (self.$slider)
        {
            self.$slider.slider('values', 0, min);
            self.$slider.slider('values', 1, max);

            var str = min +' - ' + max;
            self.$threshold.val( str );
        }
        else
        {
            // Discrete
            var val;
            self.$threshold.each(function() {
                val = $(this).data('valueInt');
                if (min >= val) { self.minThreshold = val; }
            });

            val = self.$threshold.filter(':checked').data('valueInt');
            if (val !== self.minThreshold)
            {
                /* This click SHOULD be caught by the $threshold.change()
                 * handler, which will invoke THIS method AGAIN with the new
                 * value.
                 *
                 * So just return.
                 */
                self.$threshold.filter('[value='+ self.minThreshold +']')
                        .click();
                return;
            }
        }

        // Remove existing highlights and hide all paragraphs
        self.$s.removeClass('highlight');
        self.element.find('p').hide();

        for (var idex = self.maxThreshold; idex >= self.minThreshold; idex--)
        {
            var ar  = self.ranks[idex];
            if (ar === undefined)   { continue; }

            var nItems  = ar.length;
            for (var jdex = 0; jdex < nItems; jdex++)
            {
                var $s  = ar[jdex];

                if ( ((opts.view !== 'all') && ($s.data('isHidden'))) ||
                     ((opts.view === 'flagged') && (! $s.data('isFlagged'))) )
                {
                    continue;
                }

                $s.addClass('highlight')
                  .parent().show();
            }
        }

        /* Ensure that any paragraph containing a 'keyworded' sentence is
         * visible
         */
        self.element.find('p:has(.keyworded)').show();
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
        var opts    = self.options;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();

        /*************************************************************
         * Reflect changes in the threshold input box to the slider
         *
         */
        $gp.delegate('.controls input', 'change', function() {
            var $el     = $(this);
            var name    = $el.attr('name');
            var val     = $el.val();
            var min,max;

            switch (name)
            {
            case 'threshold':
                if (self.$threshold)
                {
                    var range   = val.split(/\s*-\s*/);
                    min = parseInt(range[0]);
                    max = parseInt(range[1]);
                }
                else
                {
                    min = parseInt( val, 10 );
                }

                if (isNaN(min)) { min = self.minThreshold; }
                if (isNaN(max)) { max = self.maxThreshold; }

                self.threshold(min, max);
                break;

            case 'view':
                opts.view = val;
                self.element.removeClass('all flagged normal')
                            .addClass(val);
                self.threshold(self.minThreshold, self.maxThreshold);
                break;
            }
        });

        /*************************************************************
         * Allow arrow up/down to change the threshold input values
         *
         */
        $gp.delegate('.controls input', 'keydown', function(e) {
            if (! self.$threshold)
            {
                return;
            }

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

        /*************************************************************
         * Hover over a rank increases the opacity of them all
         *
         */
        $parent.delegateHoverIntent('.rank', function(e) {
            var $el = $(this);

            //console.log('.rank hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-out':
                // Remove the opacity change for all ranks
                self.$s.find('.rank').css('opacity', opts.rankOpacity);

                /* Don't let the 'hover-out' propagate so other hover-based
                 * events won't be inadvertantly triggered
                 * (e.g. sentence controls hidden).
                 */
                e.stopPropagation();
                break;

            case 'hover-in':
                self.$s.find('.rank').css('opacity', 1.0);
                break;
            }
        });

        /*************************************************************
         * Hover over a sentence to show the sentence controls
         *
         */
        $parent.delegateHoverIntent('.sentence', function(e) {
            var $el = $(this);

            //console.log('.sentence hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-in':
                $el.addClass('ui-hover');
                break;

            case 'hover-out':
                $el.removeClass('ui-hover');
                break;
            }
        });

        /*************************************************************
         * Click handler for sentence controls
         *
         */
        $parent.delegate('.sentence .controls .ui-icon', 'click', function(e) {
            var $el = $(this);
            var $s  = $el.parents('.sentence:first');
            console.log('control click: '+ $el.attr('class'));

            if ($el.hasClass('flag'))
            {
                // (un)Flag this sentence
                if ($s.data('isFlagged'))
                {
                    $s.removeClass('flagged')
                      .removeData('isFlagged');
                }
                else
                {
                    $s.addClass('flagged')
                      .data('isFlagged', true);
                }
            }
            else if ($el.hasClass('hide'))
            {
                // (un)Hide this sentence
                if ($s.data('isHidden'))
                {
                    $s.removeClass('hidden')
                      .removeData('isHidden');
                }
                else
                {
                    /* If this sentence was presented because of an expansion
                     * of a nearby sentence, then hide should not hide it
                     * permanently but rather hide this part of the expansion.
                     */
                    var expanded    = $s.hasClass('expanded');
                    var hideDone    = function() {
                        if (expanded)
                        {
                            $s.removeClass('expanded');
                        }
                        else
                        {
                            $s.addClass('hidden')
                        }

                        $s.css('display', '');

                        if ($s.parent().find(':visible').length < 1)
                        {
                            $s.parent().hide();
                        }
                    };

                    if (! expanded)
                    {
                        $s.data('isHidden', true);
                        if (opts.view !== 'all')
                        {
                            $s.slideUp(hideDone);
                        }
                        else
                        {
                            // Make the change immediately
                            hideDone();
                        }
                    }
                    else
                    {
                        $.slideUp(hideDone);
                    }
                }
            }
            else if ($el.hasClass('expand'))
            {
                // (un)Expand this sentence
                var $prev       = $s.prev();
                var $next       = $s.next();
                var expandDone  = function() {
                    var $this = $(this);

                    if ($this.hasClass('expanded'))
                    {
                        $this.removeClass('expanded');

                        $el.removeClass('ui-icon-minus')
                           .addClass('ui-icon-plus')
                           .attr('title', 'expand');
                    }
                    else
                    {
                        $this.addClass('expanded');

                        $el.removeClass('ui-icon-plus')
                           .addClass('ui-icon-minus')
                           .attr('title', 'collapse');
                    }
                    $this.css('display', '');
                };

                if ($el.data('isExpanded'))
                {
                    // Collapse
                    $el.removeData('isExpanded');

                    if ($prev.is(':visible') && (! $prev.hasClass('highlight')))
                    {
                        $prev.slideUp(expandDone);
                    }

                    if ($next.is(':visible') && (! $next.hasClass('highlight')))
                    {
                        $next.slideUp(expandDone);
                    }
                }
                else
                {
                    // Expand
                    $el.data('isExpanded', true);

                    if (! $prev.is(':visible'))
                    {
                        $prev.slideDown(expandDone);
                    }

                    if (! $next.is(':visible'))
                    {
                        $next.slideDown(expandDone);
                    }
                }
            }
        });

        /*************************************************************
         * Clicking on a keyword hides all sentences except those
         * with that keyword
         *
         */
        $parent.delegate('header .keyword', 'click', function() {
            var $kw         = $(this);
            var toggleOn    = (! $kw.hasClass('ui-state-highlight'));
            var name        = $kw.attr('name');
            var $kws        = $parent.find('article .keyword');
            var $hl         = $kws.filter('[name='+ name +']');

            // Remove any sentence 'keyworded' classes
            //$parent.find('.keyworded').removeClass('keyworded');

            // Remove all keyword highlights
            //$kws.removeClass('ui-state-highlight');

            if (toggleOn)
            {
                /* For each keyword that should be highlighted, highlight it
                 * and ensure that it's containing sentence and paragraph are
                 * visible.
                 */
                $hl.each(function() {
                    var $el = $(this);
                    $el.addClass('ui-state-highlight');

                    $el.parent().addClass('keyworded');
                    $el.parent().parent().show();
                });
            }
            else
            {
                /* For each keyword that should be un-highlighted, un-highlight
                 * it and then re-apply threshold to ensure a proper view
                 */
                $hl.each(function() {
                    var $el = $(this);
                    $el.removeClass('ui-state-highlight');

                    if ($el.parent().find('ui-state-highlight').length < 1)
                    {
                        $el.parent().removeClass('keyworded');
                    }
                });

                self.threshold(self.minThreshold, self.maxThreshold);
            }
        });

        /*************************************************************
         * Click handler for selection controls
         *
         * This is broken into mousedown/mouseup in order to squelch
         * any mouse events if necessary in order to avoid modifying
         * the current selection.
         *
         */
        $parent.delegate('.sentence .selection-controls .ui-icon',
                         'mousedown mouseup',
                         function(e) {
            var $el     = $(e.target);
            var $ctl    = $el.parents('.selection-controls:first');

            console.log('selection-controls '+ e.type
                        +': '+ $el.attr('class'));

            switch (e.type)
            {
            case 'mousedown':
                $ctl.data('mousedown', true);
                break;

            case 'mouseup':
                if (! $ctl.data('mousedown'))
                {
                    return;
                }

                // Count this a click
                $ctl.removeData('mousedown');

                var $s  = $(this);
                var sel = rangy.getSelection();
                var str = sel.toString();

                console.log('control click: '+ $el.attr('class')
                            +', selected[ '+ str +' ]');

                if ($el.hasClass('highlight'))
                {
                    // Toggle a highlighter for the current selection
                    self.cssApply.toggleSelection( );
                }
                else if ($el.hasClass('remove'))
                {
                    // Remove the current highligher
                    var $hl = $el.parents('.highlighter:first');

                    $hl.after( $hl.text() ).remove();
                }
                break;
            }

            // Squelch this mouse event
            e.preventDefault();
            e.stopPropagation();
            return false;
        });

        /*************************************************************
         * Hover over a 'highlighter' section shows selection controls
         * to allow removal.
         *
         */
        $parent.delegateHoverIntent('.sentence .highlighter', function(e) {
            var $el     = $(this);
            var $s      = $el.parent();
            var mouseE  = e.originalEvent;

            //console.log('.sentence hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-in':
               /* Add a new selection control just above the current selection.
                *
                * Since the original event was triggered within the context of
                * $parent but on .highlighter, and the nearest positioning
                * element to it is the sentence, we need to take into account
                * that mouseE.offsetX has values based upon the offset of
                * $parent.  SO, we must remove the offset of the sentence that
                * will contain the controls in order to position it properly
                * using the mouseE.offsetX value.
                */
                var pos = $s.offset();

                $('#tmpl-selection-remove-controls')
                    .tmpl()
                    .appendTo($el)
                    .css({
                        top:    (Math.floor(mouseE.offsetY / opts.lineHeight) *
                                opts.lineHeight) - (opts.lineHeight + 1),
                        left:   mouseE.offsetX  - pos.left - 16
                    });
                break;

            case 'hover-out':
                // Remove the selection control
                $s.find('.selection-controls').remove();
                break;
            }
        });


        /*************************************************************
         * On mouseup, see if there is a selection.
         *
         */
        $parent.delegate('article .sentence', 'mouseup', function(e) {
            var $s  = $(this);
            var $el = $(e.target);
            var sel = rangy.getSelection();
            var str = sel.toString();

            console.log('mouseup: selection[ '+ str +' ]');

            // Remove any existing selection controls
            $parent.find('.selection-controls').remove();
            if (str.length < 1)
            {
                // No selection
                return;
            }

            // Add a new selection control just above the current selection
            var pos = $s.offset();
            $('#tmpl-selection-controls')
                .tmpl()
                .appendTo($s)
                .css({
                    top:    (Math.floor(e.offsetY / opts.lineHeight) *
                               opts.lineHeight) - (opts.lineHeight + 4),
                    left:   e.offsetX - 16
                });
        });

    },

    _unbindEvents: function() {
        var self    = this;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();

        $gp.undelegate('.controls input', 'change keydown');

        $parent.undelegate('.rank', 'mouseenter mouseleave');
        $parent.undelegate('.sentence', 'mouseenter mouseleave');
        $parent.undelegate('.sentence .controls .ui-icon', 'click');
        $parent.undelegate('header keyword',  'click');
    }
};

}(jQuery));
