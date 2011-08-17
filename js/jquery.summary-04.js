/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *      jquery.delegateHoverIntent.js
 *      rangy.js
 *      rangy/seializer.js
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
        src:            null,       // The URL of the original source
        metadata:       null,       /* The URL of the
                                     * summarization/characterization metadata
                                     */

        showSentences:  5,          /* The minimum number of sentences to
                                     * present
                                     */

        lineHeight:     -1,         /* The height of a single line
                                     * (measured in renderXml() if -1);
                                     */

        useColor:       false,      // Color sentences based upon rank?
        rankOpacity:    0.3,        // The default opacity for rank items
        animSpeed:      200         // Speed (in ms) of animations
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

        var $gp = self.element.parent().parent();
        self.$control         = $gp.find('.control-pane');
        self.$threshold       = self.$control.find('.threshold');
        self.$thresholdValues = self.$threshold.find('.values');

        rangy.init();
        self.cssTag    = rangy.createCssClassApplier(
                                    'ui-state-default tagged',
                                    true);
        self.cssSelect = rangy.createCssClassApplier('selected', true);

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
        self.$p     = self.element.find('p');
        self.$s     = self.$p.find('.sentence');
        self.ranks  = [];
        self.$s.each(function() {
            var $el     = $(this);
            var rank    = parseFloat($el.attr('rank'));
            if (isNaN(rank))                    { return; }

            // Treat the rank as an integer percentile (0 .. 100).
            rank = parseInt(rank * 100, 10);
            if (self.ranks[rank] === undefined) { self.ranks[rank] = []; }

            if (opts.useColor !== false)
            {
                // Adjust the color of the sentence based upon the rank
                var base    = (opts.useColor === true
                                ? 221
                                : opts.useColor);
                var red     = base - Math.ceil( base * (rank / 100) );
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
                minThreshold = Math.floor(idex / 10) * 10;
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
                var $h1 = $('<h1 />');

                if (opts.src !== null)
                {
                    var $a  = $('<a />')
                                .attr('href', opts.src)
                                .text( $el.text() )
                                .appendTo($h1);
                }
                else
                {
                    $h1.text( $el.text() );
                }

                $header.append( $h1 );
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

        self.$control.find('.show,.buttons').buttonset();
        self.threshold( minThreshold, maxThreshold);
    },

    /** @brief  Change the rank threshold.
     *  @param  min     The minimum threshold.
     *  @param  max     The maximum threshold.
     *
     */
    threshold: function( min, max) {
        var self        = this;
        var opts        = self.options;
        var isExpand    = (min < self.minThreshold);

        // Update the threshold and threshold value presentation
        self.minThreshold = min;
        self.maxThreshold = max;

        var str = min +' - ' + max;
        self.$thresholdValues.text( str );

        /* Initially mark all sentences as 'NOT highlighted' and all
         * paragraphs as 'NOT shown'
         */
        self.$s.addClass('noHighlight');

        // Mark all sentences within the threshold range 'toHighlight'
        for (var idex = self.maxThreshold; idex >= self.minThreshold; idex--)
        {
            var ar  = self.ranks[idex];
            if (ar === undefined)   { continue; }

            var nItems  = ar.length;
            for (var jdex = 0; jdex < nItems; jdex++)
            {
                var $s  = ar[jdex];

                if ( ((opts.view !== 'all') && ($s.data('isHidden'))) ||
                     ((opts.view === 'starred') && (! $s.data('isStarred'))) )
                {
                    continue;
                }

                // Mark this sentence as TO BE highlighted
                $s.addClass('toHighlight')
                  .removeClass('noHighlight');
            }
        }

        /* Hide expansion controls for sentences that have no siblings that
         * would be expanded.
         */
        self.$s.removeClass('hide-expand');
        self.$p.each(function() {
            var $p          = $(this);
            var $ss         = $p.find('.sentence');

            if ($ss.length === 1)
            {
                // Only one sentence period -- Always hide
                $ss.addClass('hide-expand');
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
                        $s.addClass('hide-expand');
                    }
                }
                else if ($nS.length < 1)
                {
                    // Last sentence
                    if ($s.hasClass('noHighlight') ||   // is NOT highlighted
                        ($pS.length < 1)           ||   // No previous
                        $pS.hasClass('toHighlight'))    // Prev is highlighted
                    {
                        $s.addClass('hide-expand');
                    }
                }
                else if ( $pS.hasClass('toHighlight') &&// Prev is highlighted
                          $nS.hasClass('toHighlight') ) // Next is highlighted
                {
                    $s.addClass('hide-expand');
                }
            });
        });


        // Hide sentences
        self.$s.filter('.noHighlight')
               .removeClass('noHighlight expanded expansion')
               .filter('.highlight')
               .removeClass('highlight', opts.animSpeed * 2, function() {
                    var $s  = $(this);
                    $s.younger()
                      .removeData('isHighlighted');
               });

        // Show sentences
        self.$s.filter('.toHighlight')
            .removeClass('toHighlight')
            .addClass('highlight', opts.animSpeed * 2, function() {
                var $s  = $(this);

                // Remove any per-sentence expansion indicators.
                $s.removeClass('expanded expansion');

                // If the current senntence was already highlighted...
                if ($s.data('isHighlighted'))
                {
                    // Already highlighted so we need to adjust the age
                    //      expanding   (older)
                    //      contracting (younger)
                    if (isExpand)
                    {
                        // older
                        $s.older();
                    }
                    else
                    {
                        // younger
                        $s.younger();
                    }
                }

                $s.data('isHighlighted', true);
            });
    },

    /******************************************************************
     * "Private" methods
     *
     */

    /** @brief  Given a jQuery DOM sentence element (.sentence),
     *          toggle the 'star' setting.
     *  @param  $s      The jQuery DOM sentence element
     *
     */
    _toggleStar: function($s) {
        var self    = this;
        var opts    = self.options;
        var $el     = $s.find('.controls .expand');
        // (un)Star this sentence
        if ($s.data('isStarred'))
        {
            $s.removeClass('starred')
              .removeData('isStarred');
            $el.removeClass('su-state-active');
        }
        else
        {
            $s.addClass('starred')
              .data('isStarred', true);
            $el.addClass('su-state-active');
        }

        return this;
    },

    /** @brief  Given a jQuery DOM sentence element (.sentence),
     *          toggle the visibility setting.
     *  @param  $s      The jQuery DOM sentence element
     *
     */
    _toggleHide: function($s) {
        var self    = this;
        var opts    = self.options;
        var $el     = $s.find('.controls .expand');

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
            var expansion   = $s.hasClass('expansion');
            var hideDone    = function() {
                /*
                if ($s.parent().find(':not([class*="hidden"])').length < 1)
                {
                    $s.parent().addClass('hidden', opts.animSpeed / 4);
                }
                // */
            };

            if (! expansion)
            {
                $s.data('isHidden', true);
                if (opts.view !== 'all')
                {
                    $s.addClass('hidden', opts.animSpeed, hideDone);
                }
                else
                {
                    // Make the change immediately
                    $s.addClass('hidden');
                    hideDone();
                }
            }
            else
            {
                $s.removeClass('expansion', opts.animSpeed, hideDone);
            }

        }

        return this;
    },

    /** @brief  Given a jQuery DOM sentence (.sentence), expand it.
     *  @param  $s      The jQuery DOM sentence element
     */
    _expand: function($s) {
        var self        = this;
        var opts        = self.options;
        var $el         = $s.find('.controls .expand');
        var $prev       = $s.prev();
        var $next       = $s.next();
        var expandDone  = function() {
            var $this = $(this);

            $this.addClass('expansion');
            $this.css('display', '');

            $el.attr('title', 'collapse');
        };

        if ($s.data('isExpanding') || $s.hasClass('expanded'))
        {
            // Already (being) expanded
            return;
        }
        
        // Mark this sentence as being expanded
        $s.data('isExpanding', true);
        $s.addClass('expanded', opts.animSpeed);

        // If the previous sibling is NOT visible...
        if ( ! $prev.hasClass('hidden highlight expanded expansion') )
        {
            $prev.addClass('expansion', opts.animSpeed);
        }
        
        // If the next sibling NOT is visible...
        if ( ! $next.hasClass('hidden highlight expanded expansion') )
        {
            $next.addClass('expansion', opts.animSpeed, expandDone);
        }

        // Remove our marker indicating that this sentence is being expanded
        $s.removeData('isExpanding');
        return this;
    },

    /** @brief  Given a jQuery DOM sentence (.sentence), collapse it.
     *  @param  $s      The jQuery DOM sentence element
     */
    _collapse: function($s) {
        var self                = this;
        var opts                = self.options;
        var $el                 = $s.find('.controls .expand');
        var $prev               = $s.prev();
        var $next               = $s.next();
        var collapseDone        = function() {
            var $this = $(this);

            $this.removeClass('expansion');
            $this.css('display', '');

            // Ensure that sentence controls are hidden
            $this.find('.controls .su-icon').css('opacity', '');
            $this.find('.selection-controls').remove();

            $el.attr('title', 'expand');
        };
        var collapseExpansion   = function($sib) {
            $sib.removeClass('expansion', opts.animSpeed);
            if ($sib.hasClass('expanded'))
            {
                self._collapse($sib);
            }
        };

        if ($s.data('isCollapsing'))
        {
            // This sentence is already being collapsed
            return;
        }

        if ($s.hasClass('expanded'))
        {
            $s.removeClass('expanded', opts.animSpeed);
        }
        else if (! $s.hasClass('expansion'))
        {
            return;
        }

        // Mark this sentence as being collapsed
        $s.data('isCollapsing', true);

        // If the previous sibling is visible...
        if ($prev.hasClass('expansion'))
        {
            collapseExpansion($prev);
        }

        // If the next sibling is visible...
        if ($next.hasClass('expansion'))
        {
            collapseExpansion($next);
        }

        // Remove our marker indicating that this sentence is being collapsed
        $s.removeData('isCollapsing');

        return this;
    },

    /** @brief  Given a jQuery DOM sentence element (.sentence),
     *          toggle the expand/collapse setting.
     *  @param  $s      The jQuery DOM sentence element
     *
     */
    _toggleExpand: function($s) {
        var self        = this;
        var opts        = self.options;
        var $el         = $s.find('.controls .expand');

        if ($s.hasClass('expanded'))
        {
            // Collapse
            self._collapse($s);
        }
        else
        {
            // Expand
            self._expand($s);
        }

        return this;
    },

    /** @brief  Set the caret/cursor position within the given element
     *  @param  $el     The jQuery/DOM element representing the input control;
     *  @param  pos     The desired caret/cursor position;
     */
    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();


        /*************************************************************
         * Handle toggling the primary controls
         *
         */
        $gp.delegate('.control-pane .toggle-controls', 'click',
                     function() {
            var $ctl    = $(this).siblings('.controls');

            if ($ctl.is(":visible"))
            {
                $ctl.hide(opts.animSpeed/ 4);
            }
            else
            {
                $ctl.show(opts.animSpeed / 4);
            }
        });

        /*************************************************************
         * Handle clicks on control buttons.
         *
         */
        $gp.delegate('.controls input, .controls button', 'click',
                     function() {
            var $el     = $(this);
            var name    = $el.attr('name');
            var newMin  = self.minThreshold;

            switch (name)
            {
            case 'view':
                var val   = $el.val();
                opts.view = val;
                self.element.removeClass('all starred normal')
                            .addClass(val);
                self.threshold(self.minThreshold, self.maxThreshold);
                break;

            case 'threshold-down':
                if (newMin > 9)                         { newMin -= 10; }
                break;

            case 'threshold-up':
                if (newMin < (self.maxThreshold - 9))   { newMin += 10; }
            }

            if ((name === 'threshold-up') || (name === 'threshold-down'))
            {
                if (newMin === self.minThreshold)
                {
                    $el.anim('flash');
                }
                else
                {
                    self.threshold(newMin, self.maxThreshold);
                }
            }
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
            var $s  = $(this);
            var $p  = $s.parents('p:first');

            if ( $s.data('isCollapsing')     ||
                 ((! $s.hasClass('highlight')) &&
                  (! $s.hasClass('expanded'))  &&
                  (! $s.hasClass('expansion')) &&
                  (! $s.hasClass('keyworded')))  )
            {
                return;
            }

            //console.log('.sentence hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-in':
                $s.addClass('ui-hover');
                break;

            case 'hover-out':
                $s.removeClass('ui-hover');
                break;
            }
        });

        /*************************************************************
         * Mouse over for sentence controls
         *
         */
        $parent.delegate('.sentence .controls .su-icon',
                         'mouseenter mouseleave',
                         function(e) {
            var $el = $(this);

            switch (e.type)
            {
            case 'mouseenter':
                $el.css('opacity', 1.0);
                break;

            case 'mouseleave':
                $el.css('opacity', '');
                break;
            }
        });

        /*************************************************************
         * Click handler for sentence controls
         *
         */
        $parent.delegate('.sentence .controls .su-icon', 'click',
                         function(e) {
            var $el = $(this);
            var $s  = $el.parents('.sentence:first');
            console.log('control click: '+ $el.attr('class'));

            if ($el.hasClass('star'))
            {
                self._toggleStar($s);
            }
            else if ($el.hasClass('hide'))
            {
                self._toggleHide($s);
            }
            else if ($el.hasClass('expand'))
            {
                self._toggleExpand($s);
            }
        });

        /*************************************************************
         * Click handler for non-highlighted sentences
         *
         */
        $parent.delegate('.sentence:not(.highlight,.expanded,.expansion)',
                         'click', function(e) {
            var $s  = $(this);
            if ($s.hasClass('hide-expand'))
            {
                // Is there a highlighted neighbor near by?
                var $sib    = $s.siblings('.highlight:first');
                if ($sib.length < 1)
                {
                    /* No highlighted neighbor.  Use the nearest neighbor that
                     * does NOT have '.hide-expand'
                     */
                    $sib = $s.siblings(':not(.hide-expand):first');

                    if ($sib.length < 1)
                    {
                        /* NO sentences without '.hide-expand'
                         * Remove 'hide-expand' from the target and toggle
                         * it.
                         */
                        $s.removeClass('hide-expand');
                        $sib = $s;

                        console.log('un-highlighted sentence click - '
                                    + 'NO sentences without hide-expand');
                    }
                    else
                    {
                        console.log('un-highlighted sentence click - '
                                    + 'sibling without hide-expand');
                    }
                }
                else
                {
                    console.log('un-highlighted sentence click - '
                                + 'toggle nearest highlight');
                }
                self._toggleExpand($sib);
            }
            else
            {
                console.log('un-highlighted sentence click - toggle');
                self._toggleExpand($s);
            }
        });

        /*************************************************************
         * Clicking on a keyword shows all sentences with that keyword
         *
         */
        $parent.delegate('header .keyword', 'click', function() {
            var $kw         = $(this);
            var toggleOn    = (! $kw.hasClass('ui-state-highlight'));
            var name        = $kw.attr('name');
            var $kws        = $parent.find('article p .keyword');
            var $hl         = $kws.filter('[name='+ name +']');

            if (toggleOn)
            {
                // Make any sentence currently visible "older"
                self.$s.filter('.highlight,.expansion').older();

                // Highlight the keyword control
                $kw.addClass('ui-state-highlight');

                /* For each keyword that should be highlighted, highlight it
                 * and ensure that it's containing sentence and paragraph are
                 * visible.
                 */
                $hl.each(function() {
                    var $el = $(this);
                    var $s  = $el.parent();
                    var $p  = $s.parent();
                    $el.addClass('ui-state-highlight');

                    /*
                    if (! $p.data('isOpening'))
                    {
                        $p.data('isOpening', true)
                        $p.removeClass('hidden', opts.animSpeed, function() {
                            $p.removeData('isOpening');
                        });
                    }
                    // */

                    $s.addClass('keyworded', opts.animSpeed);
                });
            }
            else
            {
                /* For each keyword that should be un-highlighted, un-highlight
                 * it and then re-apply threshold to ensure a proper view
                 */
                $hl.each(function() {
                    var $el     = $(this);
                    var $s      = $el.parent();
                    var $p      = $s.parent();
                    $el.removeClass('ui-state-highlight');

                    var nLeft   = $s.find('.keyword.ui-state-highlight').length;
                    if (nLeft < 1)
                    {
                        // No more keywords in this sentence
                        $s.removeClass('keyworded', opts.animSpeed, function() {
                            nLeft = $p.find(':not([class*="hidden"])')
                                        .length;

                            $s.css('display', '');

                            /*
                            if (nLeft < 1)
                            {
                                // No visible sentences in this paragraph
                                $p.addClass('hidden', opts.animSpeed / 4);
                            }
                            // */
                        });
                    }
                });

                // Remove any 'old' class
                self.$s.filter('[class*=" old"]').younger();

                // Remove the highlight from the keyword control
                $kw.removeClass('ui-state-highlight');
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
        $parent.delegate('.sentence .selection-controls .su-icon',
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

                var sel = rangy.getSelection();
                var str = sel.toString();

                console.log('control click: '+ $el.attr('class')
                            +', selected[ '+ str +' ]');

                if ($el.hasClass('tag'))
                {
                    // Toggle '.tagged' for the current selection
                    self.cssTag.toggleSelection( );

                    // Remove the 'selected' class
                    var $s  = $(this).parents('.sentence:first');
                    $s.find('.tagged').removeClass('selected');
                }
                else if ($el.hasClass('remove'))
                {
                    // Remove the current highligher
                    var $hl = $el.parents('.tagged:first');

                    $hl.after( $hl.text() ).remove();
                }

                sel.removeAllRanges();
                $ctl.remove();
                break;
            }

            // Squelch this mouse event
            e.preventDefault();
            e.stopPropagation();
            return false;
        });

        /*************************************************************
         * Hover over a 'tagged' section shows selection controls
         * to allow removal.
         *
         */
        $parent.delegateHoverIntent('article .sentence .tagged',
                                    function(e) {
            var $el     = $(this);
            var $s      = $el.parent();
            var pos     = $el.position();
            var offset  = $el.offset();
            var width   = $el.width();

            //console.log('.sentence hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-in':
                // Add a new selection control just above the current selection
                $('#tmpl-selection-remove-controls')
                    .tmpl()
                    .appendTo($el)
                    .css({
                        top:    -22,
                        left:   0
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
        $parent.delegate('article .sentence', 'mouseup',
                         function(e) {
            var $s  = $(this);
            var $el = $(e.target);
            var sel = rangy.getSelection();
            var str = sel.toString();

            // Remove any existing selection controls and selection
            $parent.find('.selection-controls').remove();
            $parent.find('.selected').each(function() {
                var $sel    = $(this);
                if ($sel.hasClass('keyword'))
                {
                    $sel.removeClass('selected');
                }
                else
                {
                    $sel.replaceWith( $sel.html() );
                }
            });
            if (str.length < 1)
            {
                // No selection
                return;
            }

            // Apply '.selected'
            self.cssSelect.applyToSelection();

            // Add a new selection control just above the current selection
            var $sel    = $s.find('.selected:first');
            $('#tmpl-selection-controls')
                .tmpl()
                .appendTo($sel)
                .css({
                    top:    -22,
                    left:   0
                });
        });

    },

    _unbindEvents: function() {
        var self    = this;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();

        $gp.undelegate('.controls input, .controls button', 'click');

        $parent.undelegateHoverIntent('.rank');
        $parent.undelegateHoverIntent('.sentence');

        $parent.undelegate('.sentence .controls .su-icon',
                           'mouseenter mouseleave click');

        $parent.undelegate('header .keyword', 'click');

        $parent.undelegate('.sentence .selection-controls .su-icon',
                           'mousedown mouseup');

        $parent.undelegateHoverIntent('article .sentence .tagged');

        $parent.undelegate('article .sentence', 'mouseup');
    }
};

/***********************
 * Age helpers.
 *
 */

/** @brief  Make the target element "older".
 *  @param  options     An object containing options:
 *                          animSpeed   The speed of animation
 */
$.fn.older = function(options) {
    options = $.extend({animSpeed: 100}, options || {});

    return this.each(function() {
        var $el = $(this);
        
        var age = $el.data('age');

        // Increase and remember the current age
        if (age >= 0)   { age++;   }
        else            { age = 0; }

        $el.data('age', age);

        // Add the current age class
        $el.addClass('old-'+ age, options.animSpeed);
    });
};

/** @brief  Make the target element "younger".
 *  @param  options     An object containing options:
 *                          animSpeed   The speed of animation
 */
$.fn.younger = function(options) {
    options = $.extend({animSpeed: 100}, options || {});

    return this.each(function() {
        var $el = $(this);
        var age = $el.data('age');
        if (age === undefined)  { age = 0; }

        // Remove the current age class
        $el.removeClass('old-'+ age, options.animSpeed);

        // Decrease and remember the current age
        if (age >= 0)   { age--; }
        $el.data('age', age);
    });
};

}(jQuery));
