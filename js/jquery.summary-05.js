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

        threshold:      {           // The desired min/max threshold
            min:        -1,         // If -1,-1, dynamically determine the
            max:        -1          //  threshold based upon 'showSentences'
        },
        view:           'normal',   // The initial view (normal,tagged,starred)
        
        showSentences:  5,          /* The minimum number of sentences to
                                     * present
                                     */

        lineHeight:     -1,         /* The height of a single line
                                     * (measured in renderXml() if -1);
                                     */

        useColor:       false,      // Color sentences based upon rank?
        useFolding:     false,      // Fold empty paragraphs?
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
        self.starred  = [];
        self.notes    = [];

        var $gp     = self.element.parent().parent();
        self.$control         = $gp.find('.control-pane');
        self.$notes           = $gp.find('.notes-pane');
        self.$threshold       = self.$control.find('.threshold');
        self.$thresholdValues = self.$threshold.find('.values');
        
        // Initialize any widgets
        self.$control.find('.show,.buttons').buttonset();

        rangy.init();
        self.cssTag    = rangy.createCssClassApplier(
                                    'ui-state-default tagged', {
                                        normalize:      true,
                                        elementTagName: 'em'
                                    });
        self.cssSelect = rangy.createCssClassApplier('selected', {
                                        normalize:      true,
                                        elementTagName: 'em'
                                    });

        // Bind events
        self._bindEvents();

        // Kick off the retrieval of the metadata
        var getMetadata  = $.get(opts.metadata);

        self.element.addClass('loading');
        getMetadata.success(function( data ) {
            self.metadata = data;

            // Perform the initial rendering of the xml
            self.render();

            self.element.removeClass('loading');
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

        // If we have NOT retrieved the XML meta-data, no rendering.
        if (self.metadata === null) { return; }
        
        // Retrieve the view state for the current meta-data URL
        var state   = self._getState(opts.metadata);
        var notes   = [];
        if (state)
        {
            opts.threshold.min = state.threshold.min;
            opts.threshold.max = state.threshold.max;
            opts.view          = state.view;
            
            self.starred       = (state.starred ? state.starred : []);

            if (state.notes)    { notes = state.notes; }
        }

        // Renter the XML
        self.renderXml( self.metadata );

        // Find all sentences and bucket them based upon 'rank'
        self.$p     = self.element.find('p');
        self.$s     = self.$p.find('.sentence');
        self.$kws   = self.element.find('.keyword');
        self.ranks  = [];
        self.$s.each(function() {
            var $el     = $(this);
            var rank    = parseInt($el.attr('rank'), 10);
            if (isNaN(rank))                    { return; }

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

            self.ranks[rank].push($el);
        });

        var threshold   = opts.threshold;
        if ((opts.threshold.min < 0) || (opts.threshold.max < 0))
        {
            threshold          = self._computeThreshold();
            self.origThreshold = threshold;

        }

        // If there were previously starred sentences, mark them now
        if (self.starred.length > 0)
        {
            // Remove any current star markings and apply those indicated by
            // self.starred
            self.$s.removeClass('starred');
            $.each(self.starred, function(idex, val) {
                if (val === true)
                {
                    var $s  = $( self.$s.get(idex) );
                    $s.addClass('starred');
                }
            });
        }
        
        // If there were previous tags, mark them now
        if (notes.length > 0)
        {
            var nNotes  = notes.length;

            self._noPut = true;
            for (var idex = 0; idex < nNotes; idex++)
            {
                var curNotes    = notes[idex];
                if (! curNotes) { continue; }

                var notesInst   = new $.Notes( curNotes );
                var $tagged     = self._addNotes( notesInst.getRange(),
                                                  notesInst,
                                                  true );
            }
            self._noPut = false;
        }

        /* Ensure the view is properly set (without a refresh).
         * The refresh will take place when we set the threshold.
         */
        self._changeView(opts.view, true);
        self.threshold( threshold.min, threshold.max);
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
                            var $s   = $(this);
                            var rank = parseFloat($s.attr('rank'));
                            if (isNaN(rank))    { rank = 0; }

                            /* Treat the rank as an integer percentile
                             * (0 ..  100).
                             */
                            rank = parseInt(rank * 100, 10);

                            var $sEl = $('#tmpl-sentence')
                                            .tmpl( {rank: rank} )
                                            .appendTo($p);
                            var $sC  = $sEl.find('.content');

                            $sEl.find('.rank')
                                    .css('opacity', opts.rankOpacity);

                            // Assemble the HTML from the XML
                            $.each(this.childNodes, function() {
                                var $node   = $(this);
                                switch (this.nodeName)
                                {
                                case '#text':
                                    $('#tmpl-sentence-text')
                                        .tmpl( {node:$node} )
                                        .appendTo( $sC );
                                    break;

                                case 'keyword':
                                    $('#tmpl-sentence-keyword')
                                        .tmpl( {node:$node} )
                                        .appendTo( $sC );
                                    break;
                                }
                            });

                            if (opts.lineHeight < 1)
                            {
                                opts.lineHeight = $sEl.height();
                            }
                        });
                    });
                });
                break;

            default:
                $header.append( $el );
                break;
            }
        });

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

    /** @brief  Refresh the presentation based upon the current view and
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
        self.$thresholdValues.text( str );

        /* Initially mark all sentences as 'NOT highlighted' and all
         * paragraphs as 'NOT shown'
         */
        self.$s.addClass('noHighlight');

        if (opts.view === 'tagged')
        {
            /* Show ALL sentences containing one or more tags regardless of
             * threshold
             */
            self.$s.filter( ':has(.tagged)' )
                    .addClass('toHighlight')
                    .removeClass('noHighlight');
        }
        else if (opts.view === 'starred')
        {
            // Show ALL starred sentences regardless of threshold
            self.$s.filter( '.starred' )
                    .addClass('toHighlight')
                    .removeClass('noHighlight');
        }
        else
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

        if (opts.useFolding)
        {
            // Find all paragraphs that contain ONLY '.noHighlight' entries
            self.$p.removeClass('folded')
                   .filter(':not(:has(.toHighlight))')
                    .addClass('folded').each(function() {
                        var $p  = $(this);
                        var len = $p.text().length;

                        $p.css('height', len / 100 +'px');
                    });
        }
        
        // Hide sentences
        self.$s.filter('.noHighlight')
               .removeClass('noHighlight highlight expanded expansion',
                            opts.animSpeed * 2,
                            function() {
                    var $s  = $(this);

                    if ($s.data('isHighlighted'))
                    {
                        $s.younger()
                          .removeData('isHighlighted');
                    }

                    // Hide any associated notes
                    self._syncNotesPosition( $s );
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
                    if (isExpand === true)
                    {
                        // older
                        $s.older();
                    }
                    else if (isExpand === false)
                    {
                        // younger
                        $s.younger();
                    }
                }

                // Sync the position of associated notes
                self._syncNotesPosition( $s );

                $s.data('isHighlighted', true);
            });
          
        self._putState();
    },

    /******************************************************************
     * "Private" methods
     *
     */

    /** @brief  Retrieve the current view state.
     *  @param  url     The URL to retrieve view state for [ opts.metadata ];
     */
    _getState: function(url) {
        var self    = this;
        var opts    = self.options;
        
        if (url === undefined)  { url = opts.metadata; }
        
        return $.jStorage.get(url);
    },

    /** @brief  Store the current view state.
     *  @param  url     The URL to retrieve view state for [ opts.metadata ];
     */
    _putState: function(url) {
        var self    = this;
        var opts    = self.options;
        
        if (url === undefined)  { url = opts.metadata; }
        
        // Remember the current settings
        var state  = {
            threshold:  opts.threshold,
            view:       opts.view,
            
            starred:    self.starred,
            notes:      self.notes
        };
        
        $.jStorage.set(url, state);
    },
    
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
    
    /** @brief  Given a jQuery DOM sentence element (.sentence), determine
     *          whether or not it is fully "visible".
     *  @param  $s      The jQuery DOM sentence element
     *
     *  @return true | false
     */
    _isVisible: function($s) {
        return ($s.filter('.highlight,.expanded,.expansion,.keyworded')
                        .length > 0);
    },

    /** @brief  Given a jQuery DOM sentence element (.sentence),
     *          turn ON the 'star' setting.
     *  @param  $s      The jQuery DOM sentence element
     *
     */
    _starOn: function($s) {
        var self    = this;
        var opts    = self.options;
        
        // Locate the paragraph/sentence number
        var sNum    = self.$s.index($s);
        
        $s.addClass('starred');
        self.starred[sNum] = true;

        return this;
    },
    
    /** @brief  Given a jQuery DOM sentence element (.sentence),
     *          turn OFF the 'star' setting.
     *  @param  $s      The jQuery DOM sentence element
     *
     */
    _starOff: function($s) {
        var self    = this;
        var opts    = self.options;
        
        // Locate the paragraph/sentence number
        var sNum    = self.$s.index($s);
        
        $s.removeClass('starred');
        self.starred[sNum] = false;

        return this;
    },

    /** @brief  Given a jQuery DOM sentence element (.sentence),
     *          toggle the 'star' setting.
     *  @param  $s      The jQuery DOM sentence element
     *
     */
    _toggleStar: function($s) {
        var self    = this;
        
        // (un)Star this sentence
        if ($s.hasClass('starred'))
        {
            self._starOff($s);
        }
        else
        {
            self._starOn($s);
        }

        return this;
    },

    /** @brief  Sync the position of any notes associated with the provided
     *          sentence.
     *  @param  $s      The jQuery DOM element representing the target sentence.
     */
    _syncNotesPosition: function($s) {
        var self    = this;
        var opts    = self.options;
        var visible = self._isVisible($s);

        $s.find('.tagged').each(function() {
            var $tagged = $(this);
            var $notes  = $tagged.data('notes-associate');

            if (! $notes)
            {
                $tagged.removeData('notes-associate');
                $tagged.removeClass('.tagged');
                return;
            }

            $notes.notes( (visible ? 'show' : 'hide') );
        });
    },

    /** @brief  For every "visible" sentence, ensure that any associated notes
     *          are properly positioned along side.
     */
    _syncNotesPositions: function() {
        var self        = this;
        var opts        = self.options;

        self.$s.each(function() {
            self._syncNotesPosition( $(this) );
        });
    },

    /** @brief  Given a jQuery DOM sentence (.sentence), expand it.
     *  @param  $s      The jQuery DOM sentence element
     */
    _expand: function($s) {
        var self                = this;
        var opts                = self.options;
        var $p                  = $s.parents('p:first');
        var $el                 = $s.find('.controls .expand');
        var $prev               = $s.prev();
        var $next               = $s.next();
        var completionsNeeded   = 1;
        var expandDone  = function() {
            var $this = $(this);

            $this.addClass('expansion');
            $this.css('display', '');

            $el.attr('title', 'collapse');

            if ( --completionsNeeded < 1)
            {
                self._syncNotesPositions();
            }
        };

        if ($s.data('isExpanding') || $s.hasClass('expanded'))
        {
            // Already (being) expanded
            return;
        }
        
        // Mark this sentence as being expanded
        $s.data('isExpanding', true);
        $s.addClass('expanded', opts.animSpeed, expandDone);

        if (opts.useFolding)
        {
            if ($p.hasClass('folded'))
            {
                $p.removeClass('folded')
                  .addClass('un-folded');
            }
        }

        // If the previous sibling is NOT visible...
        if (! self._isVisible( $prev ) )
        {
            completionsNeeded++;
            $prev.addClass('expansion', opts.animSpeed, expandDone);
        }
        
        // If the next sibling NOT is visible...
        if (! self._isVisible( $next ) )
        {
            completionsNeeded++;
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
        var $p                  = $s.parents('p:first');
        var $el                 = $s.find('.controls .expand');
        var $prev               = $s.prev();
        var $next               = $s.next();
        var completionsNeeded   = 1;
        var collapseDone        = function() {
            if ( --completionsNeeded > 0) { return; }

            $s.removeClass('expansion');

            if (! $s.hasClass('highlight'))
            {
                /* The target sentence is NOT highlighted, so ensure that
                 * sentence controls are hidden and NOT in "hover mode" and any
                 * selection controls are removed.
                 */
                $s.removeClass('ui-hover');
                $s.find('.controls .su-icon').css('opacity', '');
                $s.find('.selection-controls').remove();
            }

            // Change the expand/contract title back to "expand"
            $el.attr('title', 'expand');

            if (opts.useFolding)
            {
                if ($p.hasClass('un-folded'))
                {
                    /* If this was the last expanded sentence in this
                     * paragraph, change the paragraph marking BACK to 'folded'
                     */
                    if ($p.find(':has(.highlight))').length < 1)
                    {
                        $p.removeClass('un-folded')
                          .addClass('folded');
                    }
                }
            }

            self._syncNotesPositions();

            // Mark collapse completed
            $s.removeData('isCollapsing');
        };
        var collapseExpansion   = function($sib) {
            completionsNeeded++;
            $sib.removeClass('expansion', opts.animSpeed, collapseDone);

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

        collapseDone();
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

    /** @brief  Change the view value.
     *  @param  view        The new value ('normal', 'tagged', 'starred').
     *  @param  noRefresh   If true, do NOT perform a refresh.
     *
     *  @return this for a fluent interface.
     */
    _changeView: function(view, noRefresh) {
        var self        = this;
        var opts        = self.options;
        var $buttons    = self.$control.find(  '[name=threshold-up],'
                                             + '[name=threshold-down]');

        switch (view)
        {
        case 'tagged':
            $buttons.button('disable');
            self.$control.find('#view-tagged')
                    .attr('checked', true)
                    .button('refresh');
            break;

        case 'starred':
            $buttons.button('disable');
            self.$control.find('#view-starred')
                    .attr('checked', true)
                    .button('refresh');
            break;

        case 'normal':
        default:
            view = 'normal';
            $buttons.button('enable');
            self.$control.find('#view-normal')
                    .attr('checked', true)
                    .button('refresh');
            break;
        }

        // Set the view value
        opts.view = view;
        self.element.removeClass('starred tagged normal')
                    .addClass(view);

        if (noRefresh !== true)
        {
            // Re-apply the current threshold
            self.refresh();
        }

        return self;
    },

    /** @brief  Given a rangy selection object, generate a corresponding
     *          summary range string.
     *  @param  sel     The rangy selection object.  If not provided,
     *                  retrieve the current rangy selection.
     *
     *  @return A range string of the form 'ss/se:so,es/ee:eo'.
     */
    _generateRange: function(sel) {
        if (sel === undefined)  { sel = rangy.getSelection(); }

        var self    = this;
        var opts    = self.options;
        var ranges  = sel.getAllRanges();

        /* Compute the indices of the sentences, .text/.keyword
         * children, and text offsents.
         */
        var start   = ranges[0];
        var end     = ranges[ ranges.length - 1];

        /* A sentence range is the sentence index, child index,
         * and offset in the form:
         *      si/ci:offset
         *
         * Grab the start and end sentence along with an array of
         * sentences between the two.
         */
        var $sStart = $(start.startContainer).parents('.sentence:first');
        var $sEnd   = $(end.endContainer).parents('.sentence:first');
        var sRange  = {
            start:  self.$s.index( $sStart ) +'/'
                    + rangy.serializePosition(
                                    start.startContainer,
                                    start.startOffset,
                                    $sStart.find('.content')[0]),
            end:    self.$s.index( $sEnd ) +'/'
                    + rangy.serializePosition(
                                    end.endContainer,
                                    end.endOffset,
                                    $sEnd.find('.content')[0])
        };

        console.log("_generateRange: "+ sRange.start +','+ sRange.end);

        return sRange.start +','+ sRange.end;
    },

    /** @brief  Given a range object from _generateRange(), create a new
     *          $.Notes object to associate with all items within the range.
     *          The elements within the range will also be wrapped in one or
     *          more '.tagged' containers.
     *  @param  range   A range string from _generateRange()
     *  @param  notes   If provided, a $.Notes instance representing the
     *                  existing notes;
     *  @param  hide    If true, hide the notes widget once created.
     *
     *  @return The jQuery DOM element representing the FIRST tagged item.
     */
    _addNotes: function( range, notes, hide ) {
        var self    = this;
        var opts    = self.options;
        var notesId;

        if ( (! notes) || (! notes instanceof $.Notes) )
        {
            notesId = (notes && (notes.id !== undefined)
                        ? notes.id
                        : self.notes.length);

            notes = {id:notesId, range:range};
        }
        else
        {
            notesId = notes.getId();
        }

        // Parse the incoming 'range' to generate a matching rangy selection.
        var re          = /^([0-9]+)\/([0-9\/]+:[0-9]+)$/;
        var ranges      = range.split(/\s*,\s*/);
        var rangeStart  = ranges[0].match( re );
        var rangeEnd    = ranges[1].match( re );
        var $sStart     = $(self.$s.get(rangeStart[1]));
        var $sEnd       = $(self.$s.get(rangeEnd[1]));
        var start       = rangy.deserializePosition(
                                    rangeStart[2],
                                    $sStart.find('.content')[0]);
        var end         = rangy.deserializePosition(
                                    rangeEnd[2],
                                    $sEnd.find('.content')[0]);
        var rRange      = rangy.createRange();
        var sel         = rangy.getSelection();

        rRange.setStart(start.node, start.offset);
        rRange.setEnd(end.node, end.offset);

        sel.removeAllRanges();
        sel.setSingleRange( rRange );

        // Apply '.tagged' to the selection
        self.cssTag.applyToSelection();

        // Attach our $.Notes object to the FIRST element in the range.
        var ranges  = sel.getAllRanges();
        var $tagged = $(ranges[0].startContainer).parent();

        /* Retrieve all '.tagged' items within the range and add a 'name'
         * attribute identifying the notes to which the items belong.
         */
        ranges[0].getNodes([3], function(node) {
            var $parent = $(node).parent();
            if ($parent.hasClass('tagged'))
            {
                $parent.attr('name', 'summary-notes-'+ notesId);
            }
        });
        sel.removeAllRanges();

        /* Finally, generate a notes container in the right side-bar at the
         * same vertical offset as $tagged.
         */
        var $notes  = $('<div />').notes({
                        notes:      notes,
                        position:   { of:$tagged },
                        hidden:     (hide ? true : false)
                      });
        self.notes[ notesId ] = $notes.notes('serialize');
        $tagged.data('summary-notes', $notes);

        /* Provide data-based links between the tagged item within content and
         * the associated notes in the notes pane.
         */
        $notes.data('notes-associate', $tagged);
        $tagged.data('notes-associate',  $notes);

        if (self._noPut !== true)
        {
            self._putState();
        }

        return $tagged;
    },

    /** @brief  Given a jQuery DOM element that has been tagged via
     *          _addNotes(), remove the tag for all items in the associated
     *          range.
     *  @param  $el     The jQuery DOM element that has been tagged.
     */
    _removeNotes: function( $el ) {
        var self    = this;
        var opts    = self.options;
        var $notes  = $el.data('summary-notes');

        if (! $notes)   { return; }

        var id      = $notes.notes('id');
        var name    = 'summary-notes-'+ id;
        var $tags   = self.element.find('[name='+ name +']');

        $notes.removeData('tagged-item')
              .notes('destroy');

        $el.removeData('summary-notes');

        //delete self.notes[ id ];
        self.notes[ id ] = undefined;

        // Remove the '.tagged' container
        $tags.each(function() {
            var $tagged = $(this);
            $tagged.replaceWith( $tagged.html() );
        });

        self._putState();
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
         * Handle clicks on the page-level control buttons.
         *
         */
        $gp.delegate('.controls input, .controls button', 'click',
                     function() {
            var $el     = $(this);
            var name    = $el.attr('name');
            var newMin  = opts.threshold.min;

            switch (name)
            {
            case 'view':
                self._changeView( $el.val() );
                break;

            case 'threshold-all':
                // Set the threshold.min
                opts.threshold.min = 0;

                // Force 'view' to 'normal' as well
                self._changeView();
                break;

            case 'threshold-reset':
                // Reset the threshold.min
                if (self.origThreshold === undefined)
                {
                    self.origThreshold = self._computeThreshold();
                }
                opts.threshold.min = self.origThreshold.min;

                // Remove all aging
                self.$s.removeClass( 'old-0 old-1 old-2 old-3 old-4 '
                                    +'old-5 old-6 old-7 old-8')
                       .removeData('age');

                // Force 'view' to 'normal' as well
                self._changeView();
                break;

            case 'threshold-down':
                // Decrease the minimum threshold
                if (newMin > 9)                         { newMin -= 10; }
                self.threshold(newMin, opts.threshold.max);
                break;

            case 'threshold-up':
                // Increase the minimum threshold
                if (newMin < (opts.threshold.max - 9))   { newMin += 10; }
                self.threshold(newMin, opts.threshold.max);
                break;
            }
        });

        /*************************************************************
         * Hover over a keyword changes the color of all keywords
         *
         */
        $gp.delegateHoverIntent('.keyword', function(e) {
            var $kw     = $(this);
            if ((e.type === 'hover-in') && $kw.hasClass('ui-state-highlight'))
            {
                // Ignore hover over keywords that are already highlighted
                return;
            }

            var name    = $kw.attr('name');
            var $kws    = self.$kws.filter('[name='+ name +']');
            switch (e.type)
            {
            case 'hover-out':
                $kws.removeClass('keyword-hover');
                break;

            case 'hover-in':
                $kws.addClass('keyword-hover');
                break;
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

            if ( $s.data('isCollapsing') || (! self._isVisible($s)) )
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
            var $el     = $(this);
            var $s      = $el.parents('.sentence:first');
            var handled = false;
            console.log('control click: '+ $el.attr('class'));

            if ($el.hasClass('star'))
            {
                self._toggleStar($s);
                handled = true;
            }
            else if ($el.hasClass('expand'))
            {
                self._toggleExpand($s);
                handled = true;
            }

            if (handled)
            {
                e.stopPropagation();
                return false;
            }
        });

        /*************************************************************
         * Click handler for non-highlighted sentences
         *
         */
        $parent.delegate('p', 'click', function(e) {
            // '.sentence:not(.highlight,.expanded,.expansion)',
            var $p  = $(this);
            var $t  = $(e.target);
            var $s;

            if ( (! $t.is('p')) && (! $t.hasClass('sentence')) )
            {
                $t = $t.parents('.sentence:first');
            }

            if ($t.hasClass('sentence'))
            {
                if (self._isVisible($t))
                {
                    // IGNORE clicks on visible sentences
                    return;
                }

                // A sentence that isn't currently "visible"
                $s = $t;
            }
            else
            {
                // Find the sentence nearest the click
                var $ss = $p.find('.sentence');

                $ss.each(function() {
                    var $el     = $(this);
                    var bounds  = $el.offset();

                    // Expand the bounds slightly
                    bounds.top    -= 2;
                    bounds.left   -= 2;
                    bounds.right  = bounds.left + $el.width()  + 4;
                    bounds.bottom = bounds.top  + $el.height() + 4;

                    if ( (e.pageX >= bounds.left)  &&
                         (e.pageX <= bounds.right) &&
                         (e.pageY >= bounds.top)   &&
                         (e.pageY <= bounds.bottom) )
                    {
                        $s = $el;
                        return false;
                    }
                });

                if (($s === undefined) || (self._isVisible($s)))
                {
                    /* The final target sentence is either unidentified or
                     * already visible -- IGNORE
                     */
                    return;
                }
            }

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
                    }
                }
                self._toggleExpand($sib);
            }
            else
            {
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
                    var $s  = $el.parents('.sentence:first');
                    var $p  = $s.parent();
                    $el.addClass('ui-state-highlight');

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
                    var $s      = $el.parents('.sentence:first');
                    var $p      = $s.parent();
                    $el.removeClass('ui-state-highlight');

                    var nLeft   = $s.find('.keyword.ui-state-highlight').length;
                    if (nLeft < 1)
                    {
                        // No more keywords in this sentence
                        $s.removeClass('keyworded', opts.animSpeed);
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

                // Count this as a click
                var $target = $ctl.parent();
                $ctl.removeData('mousedown')
                    .remove();

                if ($el.hasClass('tag'))
                {
                    // Tag the current selection
                    var sel = rangy.getSelection();

                    // Remove the rangy selection selection
                    self.cssSelect.undoToSelection();

                    // Generate a sentence-based range
                    range = self._generateRange( sel );

                    // Remove current selection
                    sel.removeAllRanges();
                
                    // Create notes
                    self._addNotes( range );
                }
                else
                {
                    // Remove all notes
                    self._removeNotes( $target );
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
            var $s      = $el.parents('.sentence:first');
            var pos     = $el.position();
            var offset  = $el.offset();
            var width   = $el.width();

            /* Using the 'name' attribute of the target element, locate
             * all similarly named elements along with the ui.notes instance
             * associated with them.
             */
            var name    = $el.attr('name');
            var $tagged = self.element.find('[name='+ name +']:first');
            var $notes  = $tagged.data('notes-associate');

            //console.log('.sentence hover: '+ e.type);

            switch (e.type)
            {
            case 'hover-in':
                // Add selection controls just above the item.
                self._ignoreHoverOut = false;
                $('#tmpl-selection-remove-controls')
                    .tmpl()
                    .appendTo($tagged)
                    .css({
                        top:    -22,
                        left:   0
                    });

                // Activate any associated notes
                if ($notes)
                {
                    $notes.notes('activate');
                }
                break;

            case 'hover-out':
                // De-active any associated notes
                if ($notes && (self._ignoreHoverOut !== true))
                {
                    $notes.notes('deactivate');
                }
                self._ignoreHoverOut = false;

                // Remove any selection controls.
                $s.find('.selection-controls').remove();
                break;
            }
        });

        /* If the user clicks on the tagged item, note that any following
         * 'hover-out' event should be ignored so the associated notes
         * remain activated.
         */
        $parent.delegate('article .sentence .tagged', 'click', function(e) {
            self._ignoreHoverOut = true;
            return false;
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
            var $sel    = self.element.find('.selected:first');
            $('#tmpl-selection-controls')
                .tmpl()
                .appendTo($sel)
                .css({
                    top:    -22,
                    left:   0
                });
        });

        /*************************************************************
         * Handle any 'changed' event on notes contained within
         * our notes pane.
         */
        self.$notes.delegate('.notes', 'changed', function() {
            var $notes  = $(this);
            var notesCount  = $notes.notes('notesCount');

            if (notesCount < 1)
            {
                /* There are no more notes.  Remove the Notes widget.
                 * First, grab the associated "tagged" element, which is the
                 * parameter needed for _removeNotes().
                 */
                var $el = $notes.data('notes-associate');

                self._removeNotes($el);
            }
            else
            {
                // There are still notes.  (Re)serialize the notes.
                var id      = $notes.notes('id');

                self.notes[ id ] = $notes.notes('serialize');

                if (self._noPut !== true)
                {
                    self._putState();
                }
            }
        });
    },

    _unbindEvents: function() {
        var self    = this;
        var $parent = self.element.parent();
        var $gp     = $parent.parent();

        $gp.undelegate('.controls input, .controls button', 'click');

        $parent.undelegate('p', 'click');

        $parent.undelegateHoverIntent('.rank');
        $parent.undelegateHoverIntent('.sentence');

        $parent.undelegate('.sentence .controls .su-icon',
                           'mouseenter mouseleave click');

        $parent.undelegate('header .keyword', 'click');

        $parent.undelegate('.sentence .selection-controls .su-icon',
                           'mousedown mouseup');

        $parent.undelegateHoverIntent('article .sentence .tagged');
        $parent.undelegate('article .sentence .tagged', 'click');

        $parent.undelegate('article .sentence', 'mouseup');

        self.$notes.undelegate('.notes', 'changed');
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
