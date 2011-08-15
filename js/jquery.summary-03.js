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

        var $gp = self.element.parent().parent();
        self.$control         = $gp.find('.control-pane');
        self.$threshold       = self.$control.find('.threshold');
        self.$thresholdValues = self.$threshold.find('.values');
        self.$coverage        = self.$control.find('.coverage .indicator');

        rangy.init();
        //self.cssApply   = rangy.createCssClassApplier('tagged', true);
        self.cssApply = rangy.createCssClassApplier(
                                    'ui-state-default tagged',
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

        self.$control.find('.buttons').buttonset();
        self.$coverage.slider({
            orientation:    'vertical',
            range:          'min',
            min:            0,
            max:            100,
            disabled:       true
        });

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
        self.$p.addClass('noShow');
        self.$p.has('.keyworded').removeClass('noShow').addClass('toShow');

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

                var $p  = $s.parent();
                $p.addClass('toShow')
                  .removeClass('noShow');
            }
        }

        /* Ensure that any paragraph containing a 'keyworded' sentence is
         * visible regardless
        self.$p.filter(':has(.keyworded)').show();
         */
        var coverage    = self.$s.filter('.toHighlight').length /
                          self.$s.length;
        self._updateCoverage( coverage );

        // Hide/Show paramgraphs
        self.$p.filter('.noShow')
            .removeClass('noShow')
            .slideUp(250);
        self.$p.filter('.toShow')
            .removeClass('toShow')
            .slideDown(250);

        // Hide/Show sentences
        self.$s.filter('.noHighlight')
            .removeClass('noHighlight')
            .slideUp(500, function() {
                var $s  = $(this);

                if ($s.hasClass('highlight'))
                {
                    /* The current sentence was previously highlighted so we
                     * need to adjust the age (younger).
                     */
                    self._ageYounger($s);
                }

                /* Remove the highlight as well as any per-sentence expansion
                 * indicators.
                 */
                $s.removeClass('highlight expanded expansion');
            });
        self.$s.filter('.toHighlight')
            .removeClass('toHighlight')
            .slideDown(500, function() {
                var $s  = $(this);

                // Remove any per-sentence expansion indicators.
                $s.removeClass('expanded expansion');

                // If the current senntence was already highlighted...
                if ($s.hasClass('highlight'))
                {
                    /* Already highlighted so we need to adjust the age
                     *      expanding   (older)
                     *      contracting (younger)
                     */
                    if (isExpand)
                    {
                        // older
                        self._ageOlder($s);
                    }
                    else
                    {
                        // younger
                        self._ageYounger($s);
                    }
                }
                else
                {
                    // NOT already highlighted so just highlight
                    $s.addClass('highlight');
                }
            });
    },

    /******************************************************************
     * "Private" methods
     *
     */

    /** @brief  Update the coverage indicator.
     *  @param  coverage    The new value (0..1);
     */
    _updateCoverage: function(coverage) {
        var self    = this;
        self.$coverage.slider('value', Math.round(coverage * 100, 2));
    },

    /** @brief  Make this sentence "older".
     *  @param  $s      The jQuery DOM sentence element
     */
    _ageOlder: function($s) {
        var age         = $s.data('age');

        // Increase and remember the current age
        if (age >= 0)   { age++;   }
        else            { age = 0; }

        $s.data('age', age);

        // Add the current age class
        $s.addClass('old-'+ age, 500);
    },

    /** @brief  Make this sentence "younger".
     *  @param  $s      The jQuery DOM sentence element
     */
    _ageYounger: function($s) {
        var age         = $s.data('age');
        if (age === undefined)  { age = 0; }

        // Remove the current age class
        $s.removeClass('old-'+ age, 500);

        // Decrease and remember the current age
        if (age >= 0)   { age--; }
        $s.data('age', age);
    },

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
                if (expansion)
                {
                    $s.removeClass('expansion');
                }
                else
                {
                    $s.addClass('hidden');
                }

                $s.css('display', '');

                if ($s.parent().find(':visible').length < 1)
                {
                    $s.parent().hide();
                }
            };

            if (! expansion)
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
                $s.slideUp(hideDone);
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

            var coverage    = self.$s.filter(':visible').length /
                              self.$s.length;
            self._updateCoverage(coverage);
        };

        if ($s.data('isExpanding') || $s.hasClass('expanded'))
        {
            // Already (being) expanded
            return;
        }
        
        // Mark this sentence as being expanded
        $s.data('isExpanding', true);
        $s.addClass('expanded', 500);

        // If the previous sibling is NOT visible...
        if ( (! $prev.is(':visible')) &&
             (! $prev.hasClass('hidden')) )
        {
            $prev.slideDown(expandDone);
        }
        
        // If the next sibling NOT is visible...
        if ( (! $next.is(':visible')) &&
             (! $next.hasClass('hidden')) )
        {
            $next.slideDown(expandDone);
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

            $el.attr('title', 'expand');

            var coverage    = self.$s.filter(':visible').length /
                              self.$s.length;
            self._updateCoverage(coverage);
        };
        var collapseExpansion   = function($sib) {
            self._collapse($sib);
            $sib.slideUp(collapseDone);
        };

        if ($s.data('isCollapsing'))
        {
            // This sentence is already being collapsed
            return;
        }

        if ($s.hasClass('expanded'))
        {
            $s.removeClass('expanded', 500);
        }
        else if (! $s.hasClass('expansion'))
        {
            return;
        }

        // Mark this sentence as being collapsed
        $s.data('isCollapsing', true);

        // If the previous sibling is visible...
        if ($prev.is(':visible') && (! $prev.hasClass('highlight')))
        {
            if ($prev.hasClass('expanded'))
            {
                // Expanded expansion
                collapseExpansion($prev);
            }
            else
            {
                // Simple expansion
                $prev.slideUp(collapseDone);
            }
        }

        // If the next sibling is visible...
        if ($next.is(':visible') && (! $next.hasClass('highlight')))
        {
            if ($next.hasClass('expanded'))
            {
                // Expanded expansion
                collapseExpansion($next);
            }
            else
            {
                // Simple expansion
                $next.slideUp(collapseDone);
            }
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
         * Clicking on a keyword hides all sentences except those
         * with that keyword
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
                self.$s.filter(':visible').each(function() {
                    self._ageOlder( $(this) );
                });

                // Highlight the keyword control
                $kw.addClass('ui-state-highlight');

                /* For each keyword that should be highlighted, highlight it
                 * and ensure that it's containing sentence and paragraph are
                 * visible.
                 */
                $hl.each(function() {
                    var $el = $(this);
                    var $s  = $el.parent();
                    $el.addClass('ui-state-highlight');

                    $s.parent().slideDown(250);
                    $s.slideDown(500, function() {
                        $s.addClass('keyworded');
                    });
                });
            }
            else
            {
                /* For each keyword that should be un-highlighted, un-highlight
                 * it and then re-apply threshold to ensure a proper view
                 */
                $hl.each(function() {
                    var $el = $(this);
                    var $s  = $el.parent();
                    $el.removeClass('ui-state-highlight');

                    if ($s.find('ui-state-highlight').length < 1)
                    {
                        $s.removeClass('keyworded');
                        if (! $s.hasClass('highlight'))
                        {
                            $s.slideUp(500, function() {
                                if ($s.parent().find(':visible').length < 1)
                                {
                                    $s.parent().hide();
                                }
                            });
                        }
                    }
                });

                // Remove any 'old' class
                self.$s.filter('[class*=" old"]').each(function() {
                    self._ageYounger( $(this) );
                });

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

                var $s  = $(this);
                var sel = rangy.getSelection();
                var str = sel.toString();

                console.log('control click: '+ $el.attr('class')
                            +', selected[ '+ str +' ]');

                if ($el.hasClass('tag'))
                {
                    // Toggle tagged for the current selection
                    self.cssApply.toggleSelection( );
                }
                else if ($el.hasClass('remove'))
                {
                    // Remove the current highligher
                    var $hl = $el.parents('.tagged:first');

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
            var mouseE  = e.originalEvent;
            // Adjust the mouse coordinates to be relative to $el
            var mouse   = {
                x:  Math.abs(mouseE.pageX - offset.left),
                y:  Math.abs(mouseE.pageY - offset.top)
            };

            //console.log('.sentence hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-in':
                // Add a new selection control just above the current selection
                var left    = mouse.x - 12;
                if (left < 0)                   { left = 0; }
                else if ((left + 24) > width)   { left = width - 24; }

                $('#tmpl-selection-remove-controls')
                    .tmpl()
                    .appendTo($el)
                    .css({
                        top:    (Math.floor(mouse.y / opts.lineHeight) *
                                opts.lineHeight) - opts.lineHeight - 3,
                        left:   left
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
                               opts.lineHeight) - opts.lineHeight - 3,
                    left:   e.offsetX - 12
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

}(jQuery));
