/** @file
 *
 *  Provide a UI component to represent a single sentence.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *      jquery.hoverIntent.js
 *      jquery.delegateHoverIntent.js
 *
 *      rangy.js
 *      rangy/seializer.js
 *      rangy/cssclassapplier.js
 *
 *      jquery.notes.js
 *      ui.notes.js
 */
/*jslint nomen:false, laxbreak:true, white:false, onevar:false */
/*global jQuery:false */
(function($) {

/** @brief  Shared rangy cssClassAppliers */
var cssSelect   = null;
var cssTag      = null;


$.widget("ui.sentence", {
    version: "0.0.1",

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'sentence-change' instead of 'sentencechange'.
     */
    widgetEventPrefix:    'sentence-',

    /** @brief  Properties used to generate the shared rangy css selection
     *          applier (cssSelect).
     */
    cssSelect:  {
        cssClass:   'selected', // The CSS class to apply to selected elements
        tagName:    'em'        /* The DOM element to use when wrapping
                                 * selected areas.
                                 */
    },

    /** @brief  Properties used to generate the shared rangy css selection
     *          applier (cssTag).
     */
    cssTag:     {
        cssClass:   'ui-state-default tagged',
        tagName:    'em'
    },

    options: {
        notesPane:      '.notes-pane',  /* The selector OR jQuery DOM element
                                         * representing the notes pane.
                                         */

        rank:           0,              // Sentence rank
        highlighted:    false,          // Is this sentence Highlighted?
        expanded:       false,          // Is this sentence Expanded?
        starred:        false,          // Is this sentence Starred?
        noExpansion:    false,          // Disallow expanison?
        animSpeed:      200,            // Speed (in ms) of animations

        // Basic CSS classes
        css:            {
            highlighted:    'highlight',
            expanded:       'expanded',
            expansion:      'expansion',
            starred:        'starred',
            noExpansion:    'hide-expand'
        }
    },

    /** @brief  Initialize a new instance.
     *
     *  Valid options are:
     *      rank            The rank for this sentence;
     *      highlighted     Is this sentence highlighte?        [ false ];
     *      expanded        Is this sentence expanded/visible?  [ false ];
     *      starred         Is this sentence starred?           [ false ];
     *      noExpansion     Disallow expansion?                 [ false ];
     *      notes           A serialized version of the associated $.Notes;
     *
     *  @triggers (with a 'sentence-' prefix):
     *      'enabled'     / 'disabled'      when element is enabled/disabled;
     *      'highlighted' / 'unhighlighted' when element is expanded/collapsed;
     *      'expanded'    / 'collapsed'     when element is expanded/collapsed;
     *
     *      'change' - 'highlighted'        when element is highlighted;
     *      'change' - 'unhighlighted'      when element is unhighlighted;
     *      'change' - 'expanded'           when element is expanded;
     *      'change' - 'collapsed'          when element is collapsed;
     *      'change' - 'unhighlighted'      when element is unhighlighted;
     *      'change' - 'starred'            when element is starred -- a
     *                                      'change' event with a single type
     *                                      parameter of 'starred';
     *      'change' - 'unstarred'          when element is unstarred -- a
     *                                      'change' event with a single type
     *                                      parameter of 'starred';
     *      'change' - 'notesAdded'         when a new note is added -- a
     *                                      'change' event with a single type
     *                                      parameter of 'notesAdded';
     *      'change' - 'notesRemoved'       when a new note is added -- a
     *                                      'change' event with a single type
     *                                      parameter of 'notesRemoved';
     */
    _init: function() {
        var self    = this;
        var opts    = this.options;

        if (cssSelect === null)
        {
            // Generate the shared cssClassAppliers
            cssTag    = rangy.createCssClassApplier(
                            self.cssTag.cssClass, {
                                normalize:      true,
                                elementTagName: self.cssTag.tagName
                        });
            cssSelect = rangy.createCssClassApplier(
                            self.cssSelect.cssClass, {
                                normalize:      true,
                                elementTagName: self.cssSelect.tagName
                        });
        }

        opts.enabled = self.element.attr('disabled') ? false : true;

        if (opts.rank <= 0)
        {
            // See if the element has a 'rank' attribute.
            var rank = parseInt(self.element.attr('rank'), 10);
            if (! isNaN(rank))
            {
                opts.rank = rank;
            }
        }

        // Interaction events
        self._widgetInit()
            ._eventsBind();

        if (opts.notes)
        {
            var notes   = opts.notes;
            opts.notes  = undefined;

            self.addNotes( notes, (! self.isVisible()) );
        }
    },

    /************************
     * Public methods
     *
     */

    /** @brief  Is this sentence "visible"?
     *
     *  @return true | false
     */
    isVisible: function() {
        return (this.element
                    .filter('.highlight,.expanded,.expansion,.keyworded')
                        .length > 0);
    },

    /** @brief  Highlight this sentence. */
    highlight: function() {
        return this._setOption('highlighted', true);
    },

    /** @brief  UnHighlight this sentence. */
    unhighlight: function() {
        return this._setOption('highlighted', false);
    },

    /** @brief  Shortcut -- Expand this sentence. */
    expand: function() {
        return this._setOption('expanded', true);
    },

    /** @brief  Shortcut -- Collapse this sentence. */
    collapse: function() {
        return this._setOption('expanded', false);
    },

    /** @brief  Shortcut -- Star/unstar this sentence.
     *  @param  value   true/false
     */
    star: function(value) {
        return this._setOption('starred', value);
    },

    /** @brief  Return a serialized version of this sentence.
     *
     *  @return The serialized version of this sentence.
     */
    serialize: function() {
        var self    = this;
        var opts    = self.options;
        var ser     = {
            rank:       opts.rank,
            starred:    opts.starred,
            notes:      self.serializeNotes()
        };

        return ser;
    },

    /** @brief  Apply serialized state to this sentence.
     *  @param  ser     The serialized state to apply to this sentence
     *                  (generated via serialize());
     *
     *  @return this for a fluent interface.
     */
    unserialize: function(ser) {
        var self    = this;
        var opts    = self.options;

        $.each(ser, function(key, val) {
            if (key === 'notes')    { return; }

            self._setOption(key, val);
        });

        if ( $.isArray(ser.notes))
        {
            $.each(self.notes, function() {
                ser.notes.push( this.serialize() );
            });
        }

        return self;
    },

    /** @brief  Given an array of serialized notes, (re)apply them to the
     *          current sentence.
     *  @param  notes   An array of serialized notes;
     *  @param  hide    If true, hide the notes widget once created.
     *
     *  @return this for a fluent interface
     */
    addNotes: function( notes, hide ) {
        var self    = this;
        var opts    = self.options;

        $.each(notes, function() {
            if (! this) { return; }

            var notesInst   = ( this instanceof $.Notes
                                    ? this
                                    : new $.Notes( this ) );
            self._addNotes( notesInst.getRange(), notesInst, hide );
        });

        return self;
    },

    /** @brief  Toggle the given option.
     *  @param  key     The option to toggle.
     *
     *  @return this for a fluent interface
     */
    toggleOption: function(key) {
        var self    = this;
        var opts    = self.options;
        
        if (opts[key])
        {
            self._setOption(key, false);
        }
        else
        {
            self._setOption(key, true);
        }

        return self;
    },

    /** @brief  Sync the position of any notes associated with this sentence.
     *
     *  @return this for a fluent interface.
     */
    syncNotesPositions: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;
        var visible = self.isVisible();

        $s.find('.tagged').each(function() {
            var $tagged = $(this);
            var $notes  = $tagged.data('notes-associate');

            if (! $notes)
            {
                $tagged.removeData('notes-associate');
                $tagged.removeClass( opts.css.tagged );
                return;
            }

            /* If the sentence containing this tagged item is visible, ensure
             * that the associated note is visible (which will also adjust its
             * position).  Otherwise, hide the associated note.
             */
            $notes.notes( (visible ? 'show' : 'hide') );
        });

        return self;
    },

    /** @brief  Return a serialized version of the $.Notes attached to this
     *          sentend.
     *
     *  @return A serialized version of the $.Notes.
     */
    serializeNotes: function() {
        var self        = this;
        var serialized  = [];

        // self.notes is an array of ui.notes instances.
        $.each(self.notes, function(idex, val) {
            if ( ! $(this).data('notes')) { return; }

            //serialized.push(this.serialize());
            serialized.push( this.notes('serialize') );
        });

        return serialized;
    },

    /** @brief  Destroy this widget.
     *
     *  @return this for a fluent interface.
     */
    destroy: function() {
        this._eventsUnbind()
            ._widgetClean();

        return this;
    },

    /************************
     * "Private" methods
     *
     */

    /** @brief  Create the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetInit: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        self.$notesPane = $('.notes-pane');
        self.notes      = [];

        // Ensure the applied CSS classes matche our initial state
        $s[ opts.highlighted
                ? 'addClass' : 'removeClass']( opts.css.highlighted );
        $s[ opts.expanded
                ? 'addClass' : 'removeClass']( opts.css.expanded );
        $s[ opts.starred
                ? 'addClass' : 'removeClass']( opts.css.starred );
        $s[ opts.noExpansion
                ? 'addClass' : 'removeClass']( opts.css.noExpansion );

        return self;
    },

    /** @brief  Destroy the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetClean: function() {
        var self    = this;
        var opts    = self.options;

        return self;
    },

    /** @brief  Override widget._setOption() to handle additional functionality
     *          for 'disabled', 'expanded', 'starred'.
     *  @param  key     The property being set;
     *  @param  value   The new property value;
     */
    _setOption: function(key, value) {
        var self    = this;
        var opts    = self.options;
        var trigger = false;

        switch (key)
        {
        case 'disabled':
            if ( value )
            {
                // Disabling
                self._trigger('disabled');
            }
            else
            {
                // Enabling
                self._trigger('enabled');
            }
            break;

        case 'expanded':
            // events triggered via _expand/_collapse
            if (value)  self._expand()
            else        self._collapse();

            break;

        case 'highlighted':
            // events triggered via _highlight/_unhighlight
            if (value)  self._highlight()
            else        self._unhighlight();

            break;

        case 'starred':
            self.widget()
                [ value ? 'addClass' : 'removeClass']( opts.css.starred );

            // Trigger a 'change' event for starred/unstarred
            trigger = (value ? 'starred' : 'unstarred');
            break;

        case 'noExpansion':
            self.widget()
                [ value ? 'addClass' : 'removeClass']( opts.css.noExpansion );
            break;
        }

        $.Widget.prototype._setOption.apply( self, arguments );

        // Trigger any related events (AFTER the value is actually set)
        if (trigger !== false)
        {
            self._trigger('change', null, trigger);
        }
    },

    /** @brief  Highlight this sentence. */
    _highlight: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        if ((opts.highlighted === true) || ($s.data('isHighlighting')))
        {
            // Already done / in progress
            return;
        }

        // Triggered when highlight animation is complete
        var $ctl        = self.element.find('.controls .expand');
        var highlightDone  = function() {
            $s.css('display', '')       // Remove the 'display' style
              .removeData('isHighlighting');

            self.syncNotesPositions();

            self._trigger('highlighted');
            self._trigger('change', null, 'highlighted');
        };

        // Mark this sentence as "being highlighted"
        $s.data('isHighlighting', true);
        $s.addClass( opts.css.highlighted, opts.animSpeed, highlightDone);
    },

    /** @brief  Unhighlight this sentence. */
    _unhighlight: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        if ((opts.highlighted === false) || ($s.data('isHighlighting')))
        {
            // Already done / in progress
            return;
        }

        // Triggered when expansion animation is complete
        var unhighlightDone = function() {
            $s.css('display', '')       // Remove the 'display' style
              .removeData('isHighlighting');

            self.syncNotesPositions();

            self._trigger('unhighlighted');
            self._trigger('change', null, 'unhighlighted');
        };

        // Mark this sentence as "being highlighted"
        $s.data('isHighlighting', true);

        if ($s.hasClass( opts.css.highlighted ))
        {
            // Directly highlighted
            $s.removeClass( opts.css.highlighted, opts.animSpeed,
                            unhighlightDone);
        }
        else if ($s.hasClass( opts.css.expansion ))
        {
            // highlighted via sibling
            unhighlightDone();
        }
    },

    /** @brief  Expand this sentence. */
    _expand: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        if ((opts.expanded === true) || ($s.data('isExpanding')))
        {
            // Already done / in progress
            return;
        }

        // Triggered when expansion animation is complete
        var $ctl        = $s.find('.controls .expand');
        var $prev       = $s.prev();
        var $next       = $s.next();
        var expandDone  = function() {
            $s.addClass( opts.css.expansion )
              .css('display', '')       // Remove the 'display' style
              .removeData('isExpanding');

            $ctl.attr('title', 'collapse');

            self.syncNotesPositions();

            self._trigger('expanded');
            self._trigger('change', null, 'expanded');
        };

        // Mark this sentence as "being expanded"
        $s.data('isExpanding', true);
        $s.addClass( opts.css.expanded, opts.animSpeed, expandDone);

        // if the previous sibling is NOT visible, expand it.
        if (! $prev.sentence('isVisible'))
        {
            $prev.addClass( opts.css.expansion, opts.animSpeed, expandDone);
        }

        // if the next sibling is NOT visible, expand it.
        if (! $next.sentence('isVisible'))
        {
            $next.addClass( opts.css.expansion, opts.animSpeed, expandDone);
        }
    },

    /** @brief  Collapse this sentence. */
    _collapse: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;

        if ((opts.expanded === false) || ($s.data('isCollapsing')))
        {
            // Already done / in progress
            return;
        }

        // Triggered when expansion animation is complete
        var $ctl                = $s.find('.controls .expand');
        var $prev               = $s.prev();
        var $next               = $s.next();
        var compNeeded          = 1;
        var collapseDone        = function() {
            if ( --compNeeded > 0)  { return; }

            $s.removeClass( opts.css.expansion )
              .css('display', '')       // Remove the 'display' style
              .removeData('isCollapsing');

            if (! $s.hasClass('highlight'))
            {
                /* The target sentence is NOT highlighted so ensure that
                 * sentence controls are hidden and NOT in "hover mode" and
                 * that any selection controls are removed.
                 */
                $s.removeClass('ui-hover')
                  .find('.controls .sui-icon')
                    .css('opacity', '')
                  .end()
                  .find('.selection-controls')
                    .remove();
            }

            $ctl.attr('title', 'expand');

            self.syncNotesPositions();

            self._trigger('collapsed');
            self._trigger('change', null, 'collapsed');
        };
        var collapseExpansion   = function($sib) {
            ++compNeeded;

            $sib.removeClass( opts.css.expansion, opts.animSpeed, collapseDone);

            if ($sib.hasClass('expanded'))
            {
                // Collapse this sibling
                $sib.sentence('expanded', false);
            }
        };

        // Mark this sentence as "being expanded"
        $s.data('isCollapsing', true);

        if ($s.hasClass( opts.css.expanded ))
        {
            // Directly expanded
            $s.removeClass( opts.css.expanded, opts.animSpeed, collapseDone);
        }
        else if ($s.hasClass( opts.css.expansion ))
        {
            // Expanded via sibling
            $s.removeClass( opts.css.expansion, opts.animSpeed, collapseDone);
        }

        // if the previous sibling is an expansion, collapse it.
        if ($prev.hasClass( opts.css.expansion ))
        {
            collapseExpansion($prev);
        }

        // if the next sibling is visible, collapse it.
        if ($next.hasClass( opts.css.expansion ))
        {
            collapseExpansion($next);
        }
    },

    /** @brief  Given a range string, create a new $.Notes object to associate
     *          with all items within the range.  The elements within the range
     *          will also be wrapped in one or more '.tagged' containers.
     *  @param  range   A range string of the form:
     *                      sentence/child:offset,child:offset
     *  @param  notes   If provided, a $.Notes instance representing the
     *                  existing notes;
     *  @param  hide    If true, hide the notes widget once created.
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
        var re          = /^([0-9\/]+:[0-9]+),([0-9\/]+:[0-9]+)$/;
        var ranges      = range.match( re );
        var rangeStart  = ranges[1];
        var rangeEnd    = ranges[2];
        var start       = rangy.deserializePosition(
                                    rangeStart,
                                    self.element.find('.content')[0]);
        var end         = rangy.deserializePosition(
                                    rangeEnd,
                                    self.element.find('.content')[0]);
        var rRange      = rangy.createRange();
        var sel         = rangy.getSelection();

        rRange.setStart(start.node, start.offset);
        rRange.setEnd(end.node, end.offset);

        sel.removeAllRanges();
        sel.setSingleRange( rRange );

        // Apply '.tagged' to the selection
        cssTag.applyToSelection();

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
                        container:  opts.notesPane,
                        notes:      notes,
                        position:   { of:$tagged },
                        hidden:     (hide ? true : false)
                      });
        self.notes[ notesId ] = $notes; //$notes.notes('serialize');
        $tagged.data('summary-notes', $notes);

        /* Provide data-based links between the tagged item within content and
         * the associated notes in the notes pane.
         */
        $notes.data('notes-associate', $tagged);
        $tagged.data('notes-associate',  $notes);

        /**************************************************
         * Bind handlers for ui.notes and ui.note events
         *
         */
        $notes.bind('notes-change', function(e, type) {
            if (type === 'noteRemoved')
            {
                // Are there any more note entries in the ui.notes widget?
                if ($notes.notes('notesCount') < 1)
                {
                    // NO -- destroy the ui.notes widget
                    var $tagged = $notes.data('notes-associate');

                    self._removeNotes( $tagged );

                    return false;
                }
            }

            /* Reflect this 'notes-change' event up as a 'sentence-change'
             * event.
             */
            self._trigger('change', null, type);
        });

        // Reflect 'note-change/noteSaved' events
        $notes.bind('note-change', function(e, type) {
            if (type === 'noteSaved')
            {
                /* Reflect this 'note-change' event up as a 'sentence-change'
                 * event.
                 */
                self._trigger('change', null, type);
            }
        });

        // Trigger a 'sentence-change/notesAdded' event
        self._trigger('change', null, 'notesAdded');
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

        $notes.unbind('notes-change note-change')
              .removeData('tagged-item')
              .notes('destroy');

        $el.removeData('summary-notes');

        //delete self.notes[ id ];
        self.notes[ id ] = undefined;

        // Remove the '.tagged' container
        $tags.each(function() {
            var $tagged = $(this);
            $tagged.replaceWith( $tagged.html() );
        });

        self._trigger('change', null, 'notesRemoved');
    },
    
    /** @brief  Given a rangy selection object, generate a corresponding
     *          summary range string.
     *  @param  sel     The rangy selection object.  If not provided,
     *                  retrieve the current rangy selection.
     *
     *  Note: We limit selection to WITHIN this sentence.
     *
     *  @return A range string of the form 'ss/se:so,es/ee:eo'.
     */
    _generateRange: function(sel) {
        if (sel === undefined)  { sel = rangy.getSelection(); }

        var self    = this;
        var opts    = self.options;
        var $s      = self.element;
        var ranges  = sel.getAllRanges();

        /* Compute the indices of the sentences, .text/.keyword
         * children, and text offsents.
         */
        var start   = ranges[0];
        var end     = ranges[ ranges.length - 1];

        /* A sentence range is the child index and offset in the form:
         *      ci:offset
         *
         * Grab the start and end sentence along with an array of
         * sentences between the two.
         */
        var sRange  = {
            start:  rangy.serializePosition(
                                    start.startContainer,
                                    start.startOffset,
                                    $s.find('.content')[0]),
            end:    rangy.serializePosition(
                                    end.endContainer,
                                    end.endOffset,
                                    $s.find('.content')[0])
        };

        console.log("_generateRange: "+ sRange.start +','+ sRange.end);

        return sRange.start +','+ sRange.end;
    },

    /** @brief  Bind any relevant event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsBind: function() {
        var self    = this;
        var $s      = self.element;

        /*************************************************************
         * Hover over sentence shows controls.
         *
         */
        var hover   = function(e) {
            if ( $s.data('isCollapsing') || (! self.isVisible()) )
            {
                // Do NOT show tools
                return;
            }

            switch (e.type)
            {
            case 'mouseenter':
                // Hover over THIS sentence
                $s.addClass('ui-hover');
                break;

            case 'mouseleave':
                $s.removeClass('ui-hover');
                break;
            }
        };

        $s.hoverIntent(hover);

        /*************************************************************
         * Mouse over sentence controls increases opacity.
         *
         */
        $s.delegate('.controls .su-icon', 'mouseenter mouseleave',
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
        $s.delegate('.controls .su-icon', 'click',
                    function(e) {
            var $el     = $(this);
            var handled = false;

            if ($el.hasClass('star'))
            {
                self.toggleOption('starred');
                handled = true;
            }
            else if ($el.hasClass('expand'))
            {
                self.toggleOption('expanded');
                handled = true;
            }

            if (handled)
            {
                e.stopPropagation();
                return false;
            }
        });

        /*************************************************************
         * Click handler for sentence selection controls
         *
         * This is broken into mousedown/mouseup in order to squelch
         * any mouse events if necessary in order to avoid modifying
         * the current selection.
         *
         */
        $s.delegate('.selection-controls .su-icon', 'mousedown mouseup',
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
                    cssSelect.undoToSelection();

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
         * On mouseup, see if there is a selection.
         *
         */
        $s.bind('mouseup.ui-sentence', function(e) {
            var $el = $(e.target);
            var sel = rangy.getSelection();
            var str = sel.toString();

            // Remove any existing selection controls and selection
            $s.find('.selection-controls').remove();
            $s.find('.selected').each(function() {
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
            cssSelect.applyToSelection();

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

        /*************************************************************
         * Hover over a 'tagged' section shows selection controls
         * to allow removal.
         *
         */
        $s.delegateHoverIntent('.tagged', function(e) {
            /* Using the 'name' attribute of the target element, locate
             * all similarly named elements along with the ui.notes instance
             * associated with them.
             */
            var $el     = $(this);
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
                var $s  = $el.parents('.sentence:first');
                $s.find('.selection-controls').remove();
                break;
            }
        });

        /* If the user clicks on the tagged item, note that any following
         * 'hover-out' event should be ignored so the associated notes
         * remain activated.
         */
        $s.delegate('.tagged', 'click', function(e) {
            /* Using the 'name' attribute of the target element, locate
             * all similarly named elements along with the ui.notes instance
             * associated with them.
             */
            var $el     = $(this);
            var name    = $el.attr('name');
            var $tagged = self.element.find('[name='+ name +']:first');
            var $notes  = $tagged.data('notes-associate');

            $notes.notes('focus');

            self._ignoreHoverOut = true;
            return false;
        });

        /*************************************************************
         * Reflect any ui.notes 'notes-change' events up as a
         * 'sentence-change' event.
         *
        self.$notesPane.delegate('.notes', 'notes-change',
                                 function(e, type) {
            var $notes  = $(this);
            var $tagged = $notes.data('notes-associate');
            var $s      = $tagged.parents('.sentence:first');

            if ($s != self.element) { return; }

            if (type === 'noteRemoved')
            {
                // Are there any more note entries in the ui.notes widget?
                if ($notes.notes('notesCount') < 1)
                {
                    // NO -- destroy the ui.notes widget
                    var $tagged = $notes.data('notes-associate');

                    self._removeNotes( $tagged );

                    return false;
                }
            }

            // Reflect this 'notes-change' event up as a 'sentence-change'
            // event.
            self._trigger('change', null, type);
        });
         */

        /*************************************************************
         * Reflect any ui.note 'note-change/noteSaved' event up as a
         * 'sentence-change' event.
         *
         */
        self.$notesPane.delegate('.notes', 'note-change',
                                 function(e, type) {
            if (type === 'noteSaved')
            {
                /* Reflect this 'note-change' event up as a 'sentence-change'
                 * event.
                 */
                self._trigger('change', null, type);
            }
        });

        return self;
    },

    /** @brief  Unbind any bound event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsUnbind: function() {
        var self    = this;
        var $s      = self.element;

        self.element.unhoverIntent();

        $s.undelegate('.controls .su-icon', 'mouseenter mouseleave');
        $s.undelegate('.controls .su-icon', 'click');
        $s.undelegate('.selection-controls .su-icon', 'mousedown mouseup');
        $s.unbind('.ui-sentence');
        $s.undelegateHoverIntent('.tagged');
        $s.undelegate('.tagged', 'click');

        return self;
    }
});


}(jQuery));

/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *      jquery.delegateHoverIntent.js
 *
 *      ui.checkbox.js
 *      ui.sentence.js
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
        filter:         'normal',   // The initial filter (tagged,starred)
        
        showSentences:  5,          /* The minimum number of sentences to
                                     * present
                                     */

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
        var self        = this;
        var opts        = $.extend(true, {}, self.options, options);

        self.element    = el;
        self.options    = opts;
        self.metadata   = null;
        self.state      = [];   // Sentence state based upon their DOM index

        var $gp         = self.element.parent().parent();
        self.$control         = $gp.find('.control-pane');
        self.$threshold       = self.$control.find('.threshold');
        self.$thresholdValues = self.$threshold.find('.values');
        
        // Initialize any widgets
        self.$buttons   = self.$control.find('.buttons button').button();
        self.$filters   = self.$control.find('.filter :checkbox');

        self.$control.find('.buttons .expansion').buttonset();
        //self.$control.find('.buttons .global').buttonset();

        var $tagged     = self.$filters.filter('#filter-tagged');
        var $starred    = self.$filters.filter('#filter-starred');

        $tagged.checkbox({
            cssOn:      'su-icon su-icon-tag-blue',
            cssOff:     'su-icon su-icon-tag',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });
        $starred.checkbox({
            cssOn:      'su-icon su-icon-star-blue',
            cssOff:     'su-icon su-icon-star',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });
        self.$control.show();

        // Bind events
        self._bindEvents();

        // Kick off the retrieval of the metadata
        self.element.addClass('loading');

        var getMetadata  = $.get(opts.metadata);
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
        
        /* Disable put since we're performing an initial render based upon
         * the incoming XML AND any serialized state
         */
        self._noPut = true;

        // Retrieve the filter state for the current meta-data URL
        var state   = self._getState(opts.metadata);
        var notes   = [];
        if (state)
        {
            opts.threshold.min = state.threshold.min;
            opts.threshold.max = state.threshold.max;
            opts.filter        = state.filter;
            
            self.state         = (state.state ? state.state : []);

            if (state.notes)    { notes = state.notes; }
        }

        // Renter the XML
        self.renderXml( self.metadata );

        // Find all sentences and bucket them based upon 'rank'
        self.$p     = self.element.find('p');
        self.$s     = self.$p.find('.sentence');
        self.$kws   = self.element.find('.keyword');
        self.ranks  = [];

        // Instantiate the ui.sentence widgets using any serialized state
        self.$s.each(function(idex) {
            var $el     = $(this);
            var config  = ( self.state.length > idex
                                ? self.state[idex]
                                : null );

            // Instantiate the sentence using the serialized state (if any)
            $el.sentence( config );

            var rank    = $el.sentence('option', 'rank');

            if (self.ranks[rank] === undefined) { self.ranks[rank] = []; }
            self.ranks[rank].push($el);
        });

        var threshold   = opts.threshold;
        if ((opts.threshold.min < 0) || (opts.threshold.max < 0))
        {
            threshold          = self._computeThreshold();
            self.origThreshold = threshold;

        }

        /* Ensure the filter is properly set (without a refresh).
         * The refresh will take place when we set the threshold.
         */
        self._changeFilter(opts.filter, true);
        self.threshold( threshold.min, threshold.max);

        // Re-enable put
        self._noPut = false;
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
        var $doc        = $xml.find('document');
        var src         = $doc.attr('src');

        if (src) { opts.src = src; }

        $doc.children().each(function() {
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
                                case 'w':
                                case '#text':
                                    if ($node.attr('keyword'))
                                    {
                                        $('#tmpl-sentence-keyword')
                                            .tmpl( {
                                                keyword:$node.attr('keyword'),
                                                text:   $node.text()
                                            } )
                                            .appendTo( $sC );
                                    }
                                    else
                                    {
                                        $('#tmpl-sentence-text')
                                            .tmpl( {
                                                text:   $node.text()
                                            } )
                                            .appendTo( $sC );
                                    }
                                    break;

                                case 'keyword':
                                    $('#tmpl-sentence-keyword')
                                        .tmpl( {
                                            keyword:$node.attr('name'),
                                            text:   $node.text()
                                        } )
                                        .appendTo( $sC );
                                    break;
                                }
                            });
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

        /* Hide expansion controls for sentences that have no siblings that
         * would be expanded.
         */
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

        self.$s
            // Hide sentences
            .filter('.noHighlight')
                .removeClass('noHighlight')
                .sentence('unhighlight')
            .end()
            // Show sentences
            .filter('.toHighlight')
                .removeClass('toHighlight')
                .sentence('highlight');
          
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

        if (self._noPut === true)   { return; }
        
        if (url === undefined)  { url = opts.metadata; }
        
        // Remember the current settings
        var state  = {
            threshold:  opts.threshold,
            filter:     opts.filter,
            
            state:      self.state      // Sentence state
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
    
    /** @brief  Change the filter value.
     *  @param  filter      The new value ('normal', 'tagged', 'starred').
     *  @param  noRefresh   If true, do NOT perform a refresh.
     *
     *  @return this for a fluent interface.
     */
    _changeFilter: function(filter, noRefresh) {
        var self        = this;
        var opts        = self.options;
        var $buttons    = self.$control.find(  '[name=threshold-up],'
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
        self.element.removeClass('starred tagged normal')
                    .addClass(filters.join(' '));

        if (noRefresh !== true)
        {
            // Re-apply the current threshold
            self.refresh();
        }

        return self;
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

                // Remove all aging
                self.$s.removeClass( 'old-0 old-1 old-2 old-3 old-4 '
                                    +'old-5 old-6 old-7 old-8')
                       .removeData('age');

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
            }
        });

        /*************************************************************
         * Handle changes to the filter controls -- triggered by the
         * ui.checkbox widget.
         *
         */
        $gp.delegate('.controls .filter', 'change',
                     function(e, type) {
            var $filters    = $(this);
            var $el         = $(e.target);
            var name        = $el.attr('name');

            switch (name)
            {
            case 'filter':
                // Assemble the filter as the value of all filter checkboxes
                var filter  = self.$filters
                                .map(function() {
                                    return $(this).checkbox('val');
                                });

                self._changeFilter( $.makeArray(filter).join(',') );
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
         * Click handler for non-highlighted/hidden sentences
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
                if ($t.sentence('isVisible'))
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

                if (($s === undefined) || ($s.sentence('isVisible')))
                {
                    /* The final target sentence is either unidentified or
                     * already visible -- IGNORE
                     */
                    return;
                }
            }

            if ($s.sentence('option', 'noExpansion'))
            {
                // Is there a highlighted neighbor near by?
                var $sib    = $s.siblings('.highlight:first');
                if ($sib.length < 1)
                {
                    /* No highlighted neighbor.  Use the nearest neighbor that
                     * does NOT have
                     *  '.hide-expand' (from
                     *                  ui.sentenct.options.css.noExpansion)
                     */
                    $sib = $s.siblings(':not(.hide-expand):first');

                    if ($sib.length < 1)
                    {
                        /* NO sentences without '.hide-expand'
                         * Remove 'hide-expand' from the target and toggle
                         * it.
                         */
                        $s.sentence('option', 'noExpansion', false);
                        $sib = $s;
                    }
                }
                $sib.sentence('toggleOption', 'expanded');
            }
            else
            {
                $s.sentence('toggleOption', 'expanded');
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
                self.$s.filter('.highlight,.expansion').older( opts );

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
                 * it and then re-apply threshold to ensure a proper filter
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
                self.$s.filter('[class*=" old"]').younger( opts );

                // Remove the highlight from the keyword control
                $kw.removeClass('ui-state-highlight');
            }
        });

        /*************************************************************
         * Handle any 'sentence-change' events.
         *
         */
        $parent.delegate('.sentence', 'sentence-change', function(e, type) {
            var $s      = $(this);
            var idex    = self.$s.index( $s );

            switch (type)
            {
            case 'highlighted':
            case 'unhighlighted':
            case 'expanded':
            case 'collapsed':
                self.$s.slice(idex).sentence('syncNotesPositions');
                break;

            case 'starred':
            case 'unstarred':
            case 'notesAdded':
            case 'notesRemoved':
            case 'noteAdded':       // Reflected from ui.notes via ui.sentence
            case 'noteRemoved':     // Reflected from ui.notes via ui.sentence
            case 'noteSaved':       // Reflected from ui.notes via ui.sentence
                // Save the serialize state of this sentence.
                self.state[idex] = $s.sentence('serialize');
                self._putState();
                break;
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
        $parent.undelegate('header .keyword', 'click');
        $parent.undelegate('.sentence', 'sentence-change');
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
/** @file
 *
 *  A simple jQuery widget to present an article along with summarization
 *  information about that article.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *      jquery.delegateHoverIntent.js
 *
 *      ui.checkbox.js
 *      ui.sentence.js
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
        filter:         'normal',   // The initial filter (tagged,starred)
        
        showSentences:  5,          /* The minimum number of sentences to
                                     * present
                                     */

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
        var self        = this;
        var opts        = $.extend(true, {}, self.options, options);

        self.element    = el;
        self.options    = opts;
        self.metadata   = null;
        self.state      = [];   // Sentence state based upon their DOM index

        var $gp         = self.element.parent().parent();
        self.$control         = $gp.find('.control-pane');
        self.$threshold       = self.$control.find('.threshold');
        self.$thresholdValues = self.$threshold.find('.values');
        
        // Initialize any widgets
        self.$buttons   = self.$control.find('.buttons button').button();
        self.$filters   = self.$control.find('.filter :checkbox');

        self.$control.find('.buttons .expansion').buttonset();
        //self.$control.find('.buttons .global').buttonset();

        var $tagged     = self.$filters.filter('#filter-tagged');
        var $starred    = self.$filters.filter('#filter-starred');

        $tagged.checkbox({
            cssOn:      'su-icon su-icon-tag-blue',
            cssOff:     'su-icon su-icon-tag',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });
        $starred.checkbox({
            cssOn:      'su-icon su-icon-star-blue',
            cssOff:     'su-icon su-icon-star',
            titleOn:    'click to remove filter',
            titleOff:   'click to filter',
            hideLabel:  true
        });
        self.$control.show();

        // Bind events
        self._bindEvents();

        // Kick off the retrieval of the metadata
        self.element.addClass('loading');

        var getMetadata  = $.get(opts.metadata);
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
        
        /* Disable put since we're performing an initial render based upon
         * the incoming XML AND any serialized state
         */
        self._noPut = true;

        // Retrieve the filter state for the current meta-data URL
        var state   = self._getState(opts.metadata);
        var notes   = [];
        if (state)
        {
            opts.threshold.min = state.threshold.min;
            opts.threshold.max = state.threshold.max;
            opts.filter        = state.filter;
            
            self.state         = (state.state ? state.state : []);

            if (state.notes)    { notes = state.notes; }
        }

        // Renter the XML
        self.renderXml( self.metadata );

        // Find all sentences and bucket them based upon 'rank'
        self.$p     = self.element.find('p');
        self.$s     = self.$p.find('.sentence');
        self.$kws   = self.element.find('.keyword');
        self.ranks  = [];

        // Instantiate the ui.sentence widgets using any serialized state
        self.$s.each(function(idex) {
            var $el     = $(this);
            var config  = ( self.state.length > idex
                                ? self.state[idex]
                                : null );

            // Instantiate the sentence using the serialized state (if any)
            $el.sentence( config );

            var rank    = $el.sentence('option', 'rank');

            if (self.ranks[rank] === undefined) { self.ranks[rank] = []; }
            self.ranks[rank].push($el);
        });

        var threshold   = opts.threshold;
        if ((opts.threshold.min < 0) || (opts.threshold.max < 0))
        {
            threshold          = self._computeThreshold();
            self.origThreshold = threshold;

        }

        /* Ensure the filter is properly set (without a refresh).
         * The refresh will take place when we set the threshold.
         */
        self._changeFilter(opts.filter, true);
        self.threshold( threshold.min, threshold.max);

        // Re-enable put
        self._noPut = false;
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
        var $doc        = $xml.find('document');
        var src         = $doc.attr('src');

        if (src) { opts.src = src; }

        $doc.children().each(function() {
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
                                case 'w':
                                case '#text':
                                    if ($node.attr('keyword'))
                                    {
                                        $('#tmpl-sentence-keyword')
                                            .tmpl( {
                                                keyword:$node.attr('keyword'),
                                                text:   $node.text()
                                            } )
                                            .appendTo( $sC );
                                    }
                                    else
                                    {
                                        $('#tmpl-sentence-text')
                                            .tmpl( {
                                                text:   $node.text()
                                            } )
                                            .appendTo( $sC );
                                    }
                                    break;

                                case 'keyword':
                                    $('#tmpl-sentence-keyword')
                                        .tmpl( {
                                            keyword:$node.attr('name'),
                                            text:   $node.text()
                                        } )
                                        .appendTo( $sC );
                                    break;
                                }
                            });
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

        /* Hide expansion controls for sentences that have no siblings that
         * would be expanded.
         */
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

        self.$s
            // Hide sentences
            .filter('.noHighlight')
                .removeClass('noHighlight')
                .sentence('unhighlight')
            .end()
            // Show sentences
            .filter('.toHighlight')
                .removeClass('toHighlight')
                .sentence('highlight');
          
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

        if (self._noPut === true)   { return; }
        
        if (url === undefined)  { url = opts.metadata; }
        
        // Remember the current settings
        var state  = {
            threshold:  opts.threshold,
            filter:     opts.filter,
            
            state:      self.state      // Sentence state
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
    
    /** @brief  Change the filter value.
     *  @param  filter      The new value ('normal', 'tagged', 'starred').
     *  @param  noRefresh   If true, do NOT perform a refresh.
     *
     *  @return this for a fluent interface.
     */
    _changeFilter: function(filter, noRefresh) {
        var self        = this;
        var opts        = self.options;
        var $buttons    = self.$control.find(  '[name=threshold-up],'
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
        self.element.removeClass('starred tagged normal')
                    .addClass(filters.join(' '));

        if (noRefresh !== true)
        {
            // Re-apply the current threshold
            self.refresh();
        }

        return self;
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

                // Remove all aging
                self.$s.removeClass( 'old-0 old-1 old-2 old-3 old-4 '
                                    +'old-5 old-6 old-7 old-8')
                       .removeData('age');

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
            }
        });

        /*************************************************************
         * Handle changes to the filter controls -- triggered by the
         * ui.checkbox widget.
         *
         */
        $gp.delegate('.controls .filter', 'change',
                     function(e, type) {
            var $filters    = $(this);
            var $el         = $(e.target);
            var name        = $el.attr('name');

            switch (name)
            {
            case 'filter':
                // Assemble the filter as the value of all filter checkboxes
                var filter  = self.$filters
                                .map(function() {
                                    return $(this).checkbox('val');
                                });

                self._changeFilter( $.makeArray(filter).join(',') );
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
         * Click handler for non-highlighted/hidden sentences
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
                if ($t.sentence('isVisible'))
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

                if (($s === undefined) || ($s.sentence('isVisible')))
                {
                    /* The final target sentence is either unidentified or
                     * already visible -- IGNORE
                     */
                    return;
                }
            }

            if ($s.sentence('option', 'noExpansion'))
            {
                // Is there a highlighted neighbor near by?
                var $sib    = $s.siblings('.highlight:first');
                if ($sib.length < 1)
                {
                    /* No highlighted neighbor.  Use the nearest neighbor that
                     * does NOT have
                     *  '.hide-expand' (from
                     *                  ui.sentenct.options.css.noExpansion)
                     */
                    $sib = $s.siblings(':not(.hide-expand):first');

                    if ($sib.length < 1)
                    {
                        /* NO sentences without '.hide-expand'
                         * Remove 'hide-expand' from the target and toggle
                         * it.
                         */
                        $s.sentence('option', 'noExpansion', false);
                        $sib = $s;
                    }
                }
                $sib.sentence('toggleOption', 'expanded');
            }
            else
            {
                $s.sentence('toggleOption', 'expanded');
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
                self.$s.filter('.highlight,.expansion').older( opts );

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
                 * it and then re-apply threshold to ensure a proper filter
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
                self.$s.filter('[class*=" old"]').younger( opts );

                // Remove the highlight from the keyword control
                $kw.removeClass('ui-state-highlight');
            }
        });

        /*************************************************************
         * Handle any 'sentence-change' events.
         *
         */
        $parent.delegate('.sentence', 'sentence-change', function(e, type) {
            var $s      = $(this);
            var idex    = self.$s.index( $s );

            switch (type)
            {
            case 'highlighted':
            case 'unhighlighted':
            case 'expanded':
            case 'collapsed':
                self.$s.slice(idex).sentence('syncNotesPositions');
                break;

            case 'starred':
            case 'unstarred':
            case 'notesAdded':
            case 'notesRemoved':
            case 'noteAdded':       // Reflected from ui.notes via ui.sentence
            case 'noteRemoved':     // Reflected from ui.notes via ui.sentence
            case 'noteSaved':       // Reflected from ui.notes via ui.sentence
                // Save the serialize state of this sentence.
                self.state[idex] = $s.sentence('serialize');
                self._putState();
                break;
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
        $parent.undelegate('header .keyword', 'click');
        $parent.undelegate('.sentence', 'sentence-change');
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
