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
 *
 *      jquery.note.js
 *      ui.note.js
 *      ui.contentOverlay.js
 */
/*jslint nomen:false, laxbreak:true, white:false, onevar:false */
/*global jQuery:false */
(function($) {

$.widget("ui.sentence", {
    version: "0.0.1",

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'sentence-change' instead of 'sentencechange'.
     */
    widgetEventPrefix:    'sentence-',

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
            noExpansion:    'hide-expand',

            // inner-classes
            selected:       'selected',
            tagged:         'ui-state-default tagged'
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
     *      notes           Serialized notes (generated via _serializeNotes());
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
     *      'change' - 'commentAdded'       when a new comment is added -- a
     *                                      'change' event with a single type
     *                                      parameter of 'commentAdded';
     *      'change' - 'commentRemoved'     when a new note is added -- a
     *                                      'change' event with a single type
     *                                      parameter of 'commentRemoved';
     */
    _init: function() {
        var self    = this;
        var opts    = this.options;

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

    /** @brief  Return a serialized version of this instance suitable
     *          for creating a duplicate instance via our constructor.
     *
     *  @return The serialized version of this sentence.
     */
    serialize: function() {
        var self    = this;
        var opts    = self.options;
        var ser     = {
            rank:       opts.rank,
            starred:    opts.starred,
            notes:      self._serializeNotes()
        };

        return ser;
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
    syncNotePositions: function() {
        var self    = this;
        var opts    = self.options;
        var $s      = self.element;
        var visible = self.isVisible();

        $s.find('.tagged').each(function() {
            var $tagged = $(this);
            var $note   = $tagged.data('note-associate');

            if (! $note)    { return; }

            /* If the sentence containing this tagged item is visible, ensure
             * that the associated note is visible (which will also adjust its
             * position).  Otherwise, hide the associated note.
             */
            $note.note( (visible ? 'show' : 'hide') );
        });

        return self;
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

        self.$content   = self.element.find('.content');
        self.$content.contentOverlay();

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

        if (opts.notes)
        {
            self._unserializeNotes(opts.notes);
        }
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

    /** @brief  Return a serialized version of the $.Note attached to this
     *          sentence.
     *
     *  @return An array of serialized notes of the form:
     *              { range: { start: , end: },
     *                note:  serialized-note
     *               }
     */
    _serializeNotes: function() {
        var self        = this;
        var serialized  = [];

        // self.notes is an array of ui.note instances.
        $.each(self.notes, function() {
            // Is this a ui.note instance?
            var $note   = $(this);
            if ( ! $note.data('note'))  { return; }

            //serialized.push(this.serialize());
            var $group  = $note.data('note-associate');
            serialized.push( {
                range:  $group.overlayGroup('serialize'),
                note:   $note.note('serialize')
            });
        });

        return serialized;
    },

    /** @brief  Unserialize notes to attach to this sentence.
     *  @param  notes   The notes serialization (from _serializeNotes());
     *
     *  @return An array of ui.note instances.
     */
    _unserializeNotes: function(notes) {
        var self    = this;
        var hide    = (! self.isVisible());

        if (self.notes.length > 0)
        {
            // :TODO: cleanout the current notes
        }

        self.notes = [];
        $.each(notes, function() {
            if ( (! this.range) || (! this.note) )  { return; }

            // Create an overlay for this range
            var $group = self.$content.contentOverlay('addOverlay',
                                                      this.range, 'tag');

            // Now, using the new overlay, add a note
            self._addNote( $group, this.note, hide);
        });

        return self.notes;
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

            self.$content.contentOverlay('refresh');
            self.syncNotePositions();

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

            self.$content.contentOverlay('refresh');
            self.syncNotePositions();

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

            self.$content.contentOverlay('refresh');
            self.syncNotePositions();

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
                 * that any overlay controls are hidden.
                 */
                $s.removeClass('ui-hover')
                  .find('.controls .ui-icon')
                    .css('opacity', '')
                  .end()
                  .find('.overlay-controls')
                    .hide();
            }

            $ctl.attr('title', 'expand');

            self.$content.contentOverlay('refresh');
            self.syncNotePositions();

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

    /** @brief  Given an ui.overlayGroup widget, create a new $.Note object to
     *          associate with the overlay group.
     *  @param  $group      The ui.overlayGroup instance to associate with the
     *                      new note;
     *  @param  note        If provided, note to be added -- either serialized
     *                      or a $.Note instance.  If not provided, a new
     *                      $.Note instance will be created;
     *  @param  hide        If true, hide the note widget once created.
     */
    _addNote: function( $group, note, hide ) {
        var self    = this;
        var opts    = self.options;
        var noteId; 

        if (! note)
        {
            noteId = self.notes.length;
            note   = {id:noteId};
        }
        else
        {
            if (! (note instanceof $.Note) )
            {
                note = new $.Note( note );
            }

            noteId = note.getId();
        }

        // Generate a ui.note widget at the same vertical offset as $group.
        var $note   = $('<div />').note({
                        container:  opts.notesPane,
                        note:       note,
                        position:   { of:$group },
                        hidden:     (hide ? true : false)
                      });
        self.notes[ noteId ] = $note; //$note.note('serialize');

        /* Provide data-based links between the overlay group  and the
         * associated note.
         */
        $note.data( 'note-associate', $group);
        $group.data('note-associate',  $note);

        /**************************************************
         * Bind handlers for ui.note
         *
         */
        $note.bind('note-change.ui-sentence', function(e, type) {
            /* Reflect this 'note-change' event up as a 'sentence-change'
             * event.
             */
            self._trigger('change', null, type);
        });

        $note.bind('note-destroyed.ui-sentence', function(e) {
            self._removeNote( $note );
        });

        // Reflect 'comment-change' events
        $note.bind('comment-change.ui-sentence', function(e, type) {
            if (type === 'commentSaved')
            {
                /* Reflect this 'comment-change/commentSaved'
                 * event up as a 'sentence-change' event.
                 */
                self._trigger('change', null, type);
            }
        });

        // Trigger a 'sentence-change/noteAdded' event
        self._trigger('change', null, 'noteAdded');
    },

    /** @brief  Remove the identified note along with the associated overlay
     *          group.
     *  @param  $note   The ui.note widget being removed;
     */
    _removeNote: function( $note ) {
        if (! $note)    { return; }

        var self    = this;
        var opts    = self.options;
        var $group  = $note.data('note-associate');
        var id      = $note.note('id');

        // Destroy the ui.note instance
        if (! $note.data('note-destroying'))
        {
            /* Initiate destruction.  This will end with ui.note firing
             * 'destroyed', which will be caught by our handler established in
             * _addNote() causing _removeNote() to be called again.
             */
            $note.data('note-destroying', true);
            $note.note('destroy');
            return;
        }

        $note.unbind('.ui-sentence')
             .removeData('note-associate');

        // Destroy the ui.overlayGroup instance
        $group.removeData('note-associate')
              .overlayGroup('destroy');

        self.notes[ id ] = undefined;

        self._trigger('change', null, 'noteRemoved');
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
        $s.hoverIntent(function(e) {
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
        });

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
         * Click handler for sentence overlay controls
         *
         */
        $s.bind('overlaygroup-action.ui-sentence', function(e, control) {
            var $group  = $(e.target);
            var $ctl    = $(control);

            console.log('overlaygroup-action: ctl[ '+ $ctl.attr('class') +' ]');

            if ($ctl.hasClass('tag'))
            {
                // Convert $group to a tag/note
                //$group.parent().contentOverlay('changeType', $group, 'tag');
                $group.overlayGroup('changeType', 'tag');

                self._addNote( $group );
            }
            else if ($ctl.hasClass('remove'))
            {
                var $note   = $group.data('note-associate');

                self._removeNote($note);
                //$group.overlayGroup('destroy');
            }
        });

        $s.bind(  'overlaygroup-hover-in.ui-sentence '
                + 'overlaygroup-hover-out.ui-sentence',
                function(e) {
            var $group  = $(e.target);
            var $note   = $group.data('note-associate');

            //console.log('overlaygroup-hover: [ '+ e.type +' ]');

            if ($note)
            {
                if (e.type === 'overlaygroup-hover-in')
                {
                    $note.note('activate');
                }
                else if (! $note.note('hasFocus'))
                {
                    $note.note('deactivate');
                }
            }
        });


        /*************************************************************
         * For clicks on a tagged overlay, activate the related note
         * and focus on the comment reply.
         */
        $s.delegate('.tagged', 'click', function(e) {
            var $group  = $(e.target);
            var $note   = $group.data('note-associate');

            if ($note)
            {
                $note.note('focus');

                e.preventDefault();
                e.stopPropagation();
                return false;
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

        $s.unbind('.ui-sentence');
        $s.unhoverIntent();

        return self;
    }
});


}(jQuery));

