/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 *
 *  Requires:
 *      backbone.js
 *      model/doc.js
 *      view/doc.js
 *      jquery.js
 */
(function($) {
var app = window.app = (this.app || {Model:{},      View:{},
                                     Controller:{}, Helper:{}});

// Application-wide defaults
app = _.extend(app, {
    quickTag:       true,       // Using quick tag?
    animSpeed:      200     // Speed (in ms) of animations
});


/** @brief  The Summary class */
$.Summary = Backbone.View.extend({
    // Defaults
    options:    {
        doc:            null,   /* The app.Model.Doc instance or URL to
                                 * retrieve a serialized, JSON version of the
                                 * document.
                                 */

        threshold:      {           // The desired min/max threshold
            min:        -1,         // If -1,-1, dynamically determine the
            max:        -1          //  threshold based upon 'showSentences'
        },
        filter:         'normal',   // The initial filter (tagged,starred)
        
        showSentences:  5           /* The minimum number of sentences to
                                     * present
                                     */
    },

    events: {
        'click .controls :input':   'controlClick',
        'change .controls :input':  'controlClick',
    },

    /** @brief  Initialize the app. */
    initialize: function() {
        var self    = this;
        var opts    = self.options;

        self._initialize_controlPane();

        self.$paneContent  = self.el.find('.content-pane');
        self.$paneContent.addClass('loading');

        if (opts.doc instanceof app.Model.Doc)
        {
            self.render();    
        }
        else
        {
            var getDoc  = $.getJSON(opts.doc);

            getDoc.success(function( data ) {
                opts.doc = new app.Model.Doc( data );
            });

            getDoc.error(function() {
                alert("Cannot retrieve document data '"+ opts.doc +"'");
            });

            getDoc.complete(function() {
                self.render();
            });
        }
    },

    /** @brief  (Re)render the application. */
    render: function() {
        var self    = this;
        var opts    = self.options;

        if (opts.doc instanceof app.Model.Doc)
        {
            var view    = new app.View.Doc({model:opts.doc});

            self.$paneContent.html( view.render().el );

            // Gather the ranks
            self.ranks  = [];
            self.$p     = self.$paneContent.find('section p');
            self.$s     = self.$paneContent.find('.sentence');
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
        }

        self.$paneContent.removeClass('loading');
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
        self.$thresholdValues.text( str );

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

        self.$s
            // Collapse sentences
            .filter('.noHighlight')
                .removeClass('noHighlight')
                .trigger('sentence:collapse')
            .end()
            // Expand sentences
            .filter('.toHighlight')
                .removeClass('toHighlight')
                .trigger('sentence:expand')
            .end()
            .trigger('paragraph:collapseCheck');
          
        //self._putState();
    },

    /** @brief  Handle a click on a button or checkbox control.
     *  @param  e   The triggering event.
     *
     */
    controlClick: function(e) {
        var self    = this;
        var opts    = self.options;
        var $el     = $(e.currentTarget);
        var name    = $el.attr('name');
        var newMin  = opts.threshold.min;

        switch (name)
        {
        case 'threshold-all':
            // Set the threshold.min
            opts.threshold.min = 0;

            // Force 'filter' to 'normal' as well
            self._changeFilter();
            break;

        case 'threshold-reset':
            // Reset the threshold.min
            if (self.origThreshold === undefined)
            {
                self.origThreshold = self._computeThreshold();
            }
            opts.threshold.min = self.origThreshold.min;

            // Force 'filter' to 'normal' as well
            self._changeFilter();
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

        case 'filter':
            // Assemble the filter as the value of all filter checkboxes
            var filter  = self.$filters
                            .map(function() {
                                return $(this).checkbox('val');
                            });

            self._changeFilter( $.makeArray(filter).join(',') );
            break;

        case 'quickTag':
            /* Since we use the 'quickTag' icon as an indicator, the logic
             * is a little backwards.  If the checkbox is NOT checked,
             * we're in 'quick' mode, otherwise, 'normal' mode.
             */
            app.quickTag = (! $el.checkbox('val') );
            break;
        }
    },

    /*************************************************************************
     * "Private" methods
     *
     */

    /** @brief  Initialize the control pane */
    _initialize_controlPane: function() {
        var self    = this;
        var opts    = self.options;

        self.$paneControls = self.el.find('.control-pane');

        self.$buttons   = self.$paneControls.find('.buttons button').button();
        self.$filters   = self.$paneControls.find('.filter :checkbox');
        self.$options   = self.$paneControls.find('.options :checkbox');

        self.$threshold       = self.$paneControls.find('.threshold');
        self.$thresholdValues = self.$threshold.find('.values');

        /*********************************************************
         * controls:threshold
         *
         */
        self.$paneControls.find('.buttons .expansion').buttonset();

        /*********************************************************
         * controls:filters
         *
         */
        var $tagged     = self.$filters.filter('#filter-tagged');

        $tagged.checkbox({
            cssOn:      'su-icon su-icon-tag-blue',
            cssOff:     'su-icon su-icon-tag',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });

        /*********************************************************
         * controls:options
         *
         */
        var $quickTag   = self.$options.filter('#options-quickTag');

        $quickTag.checkbox({
            cssOn:      'su-icon su-icon-tagQuick',
            cssOff:     'su-icon su-icon-tagQuick-blue',
            titleOn:    'click to enable',
            titleOff:   'click to disable',
            hideLabel:  true,

            /* Since we use the 'quickTag' icon as an indicator, the logic is a
             * little backwards.  If the checkbox is NOT checked, we're in
             * 'quick' mode, otherwise, 'normal' mode.
             */
            checked:    (! app.quickTag )
        });

        self.$paneControls.show();
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

    /** @brief  Change the filter value.
     *  @param  filter      The new value ('normal', 'tagged', 'starred').
     *  @param  noRefresh   If true, do NOT perform a refresh.
     *
     *  @return this for a fluent interface.
     */
    _changeFilter: function(filter, noRefresh) {
        var self        = this;
        var opts        = self.options;
        var $buttons    = self.$paneControls.find(  '[name=threshold-up],'
                                                  + '[name=threshold-down]');
        var filters     = (filter
                            ? filter.split(/\s*,\s*/)
                            : [ 'normal' ]);

        $.each(filters, function() {
            switch (this.toString())
            {
            case 'tagged':
                $buttons.button('disable');
                break;

            case 'starred':
                $buttons.button('disable');
                break;

            case 'normal':
            default:
                filter = 'normal';
                $buttons.button('enable');

                self.$filters.checkbox('uncheck');
                /*
                self.$control.find('#filter-normal')
                        .attr('checked', true)
                        .button('refresh');
                // */
                break;
            }
        });

        // Set the filter value
        opts.filter = filter;
        self.el.removeClass('starred tagged normal')
                    .addClass(filters.join(' '));

        if (noRefresh !== true)
        {
            // Re-apply the current threshold
            self.refresh();
        }

        return self;
    },

});

}(jQuery));
