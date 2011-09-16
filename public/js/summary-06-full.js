/** @file
 *
 *  jQuery class/objects representing a single, user-generated note as well as
 *  a group of one or more notes.
 *
 *  Requires:
 *      jquery.js
 *      jquery.user.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global jQuery:false */
(function($) {

/******************************************************************************
 * Note
 *
 */

/** @brief  A single, attributable note/comment.
 *  @param  props   The properties of this note:
 *                      author:     The $.User instance or serialize $.User
 *                                  representing the author of this note;
 *                      text:       The text of this note;
 *                      created:    The date/time the note was created;
 */
$.Note  = function(props) {
    var defaults    = {
        author: null,
        text:   '',
        created:new Date()
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Note.prototype = {
    /** @brief  Initialize a new Note instance.
     *  @param  props   The properties of this note:
     *                      author:     The Unique ID of the author
     *                      text:       The text of this note
     *                      created:    The date/time the note was created
     */
    init: function(props) {
        this.props = props;

        if ( (this.props.author === null) ||
             ($.isPlainObject(this.props.author)) )
        {
            this.props.author = new $.User( this.props.author );
        }

        return this;
    },

    getAuthor: function() { return this.props.author; },
    getText:   function() { return this.props.text; },
    getCreated:function() { return this.props.created; },

    setText:   function(text)
    {
        this.props.text = text;
    },

    serialize: function() {
        var serialized  = {
            author: (this.props.author
                        ? this.props.author.serialize()
                        : null),
            text:   this.props.text,
            created:this.props.created
        };

        return serialized;
    },

    destroy: function() {
        var self    = this;
        var props   = self.props;

        if (props.author && (props.author instanceof $.User))
        {
            props.author.destroy();
        }

        delete props.author;
        delete props.text;
        delete props.created;
    }
};

/******************************************************************************
 * Notes
 *
 */

/** @brief  Notes and tags associated with a particular range within
 *          a document.
 */
$.Notes = function(props) {
    var defaults    = {
        id:     null,
        range:  null,
        notes:  [],
        tags:   []
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Notes.prototype = {
    /** @brief  Initialize a new Notes instance.
     *  @param  props   The properties of this instance:
     *                      id:         The unique id of this instance;
     *                      range:      The range that this set of notes should
     *                                  be associated with
     *                                  (from summary._generateRange());
     *                      notes:      An array of $.Note objects,
     *                                  serialized $.Note objects, or empty
     *                                  to initialize an empty notes set;
     *                      tags:       An array of tag strings;
     */
    init: function(props) {
        this.props = props;

        var noteInstances   = [];
        $.each(this.props.notes, function() {
            var note    = this;
            if ($.isPlainObject(note))  { note = new $.Note(note); }

            noteInstances.push( note );
        });

        if (noteInstances.length < 1)
        {
            // Create a single, empty note
            noteInstances.push( new $.Note() );
        }

        this.props.notes = noteInstances;

        return this;
    },

    /** @brief  Add a new note to this set of notes.
     *  @param  note    a $.Note instance or properties to create one.
     *
     *  @return The note instance that was added.
     */
    addNote: function(note) {
        if ($.isPlainObject(note))      { note = new $.Note(note); }

        this.props.notes.push(note);

        return note;
    },

    /** @brief  Remove a note from this set of notes.
     *  @param  note    a $.Note instance to remove.
     *
     *  @return this for a fluent interface.
     */
    removeNote: function(note) {
        var self    = this;
        if (note instanceof $.Note)
        {
            var targetIdex  = -1;
            $.each(self.props.notes, function(idex) {
                if (this === note)
                {
                    targetIdex = idex;
                    return false;
                }
            });

            if (targetIdex >= 0)
            {
                self.props.notes.splice(targetIdex, 1);
                note.destroy();
            }
        }

        return self;
    },

    getId: function()           { return this.props.id; },
    getRange: function()        { return this.props.range; },
    getNotes: function()        { return this.props.notes; },
    getNotesCount: function()   { return this.props.notes.length; },
    getTags: function()         { return this.props.tags; },

    getNote: function(idex) {
        idex = idex || 0;
        return this.props.notes[idex];
    },
    getTag: function(idex) {
        idex = idex || 0;
        return this.props.tags[idex];
    },

    /** @brief  Serialize this instance.
     *
     *  @return The serialize 
     */
    serialize: function() {
        var serialized  = {
            id:     this.props.id,
            range:  this.props.range,
            notes:  [],
            tags:   this.props.tags
        };

        $.each(this.props.notes, function() {
            serialized.notes.push( this.serialize() );
        });

        return serialized;
    },

    /** @brief  Destroy this instance.
     */
    destroy: function() {
        var self    = this;
        var props   = self.props;
        if ($.isArray(props.notes))
        {
            $.each(props.notes, function() {
                this.destroy();
            });
        }

        delete props.range;
        delete props.notes;
        delete props.tags;
    }
};

 }(jQuery));
/** @file
 *
 *  Provide a UI for $.Notes and $.Note.
 *
 *  The DOM element used to create a new ui.notes instance MAY have an 'id'
 *  attribute or the 'id' MAY be passed as an option.
 *
 *  Requires:
 *      jquery.js
 *      jquery.notes.js
 *      ui.core.js
 *      ui.widget.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global jQuery:false */
(function($) {

/*****************************************************************************
 *  A UI widget for $.Notes
 *
 */
$.widget('ui.notes', {
    version:    '0.0.1',

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'notes-change' instead of 'noteschange'.
     */
    widgetEventPrefix:    'notes-',

    options:    {
        notes:      null,   /* The associated $.Notes instance.  May initially
                             * be a serialized version of a $.Notes
                             */

        // The selector for the container of notes widgets
        container:  '.notes-pane',

        // Positioning information
        position:   {
            my:     'top',
            at:     'top',
            of:     null,   /* The selector for the element we should sync with
                             * (e.g. the tagged/selected text within a
                             *       sentence).
                             */
            using:  null    // A movement function (defaults to animate())
        },

        animSpeed:  200,    // The speed (in ms) of animations

        hidden:     false,  // Initially hidden?

        // Template selector
        template:   '#tmpl-notes'
    },

    /** @brief  Initialize a new instance.
     *
     *  @triggers (with a 'notes-' prefix):
     *      'change' -- 'noteAdded'
     *      'change' -- 'noteRemoved'
     *      'change' -- 'noteSaved'
     *
     *      'destroyed'
     */
    _init: function() {
        var self    = this;
        var opts    = self.options;

        self._isInitializing = true;

        self.$container = $( opts.container );

        if ( $.isPlainObject(opts.notes) )
        {
            if ((opts.notes.id === undefined) || (opts.notes.id === null))
            {
                opts.notes.id = self.element.attr('id');
            }

            // Generate a new $.Notes instance...
            opts.notes  = new $.Notes( opts.notes );
        }

        self._widgetCreate()
            ._bindEvents();

        self._isInitializing = false;

        return self;
    },


    /** @brief  Return the id of our $.Notes instance.
     *
     *  @return The id.
     */
    id: function() {
        var self    = this;
        var opts    = self.options;

        return opts.notes.getId();
    },

    /** @brief  Return the number of $.Note instances.
     *
     *  @return The count.
     */
    notesCount: function() {
        var self    = this;
        var opts    = self.options;

        return opts.notes.getNotesCount();
    },

    /** @brief  Given a new $.Note instance, add the note to our container.
     *  @param  note    The new $.Note instance.
     *
     *  @return this for a fluent interface.
     */
    addNote: function(note) {
        var self    = this;
        var opts    = self.options;

        // Create and append a new ui.note widget
        var $note   = $('<div />').note({note:note});
        self.$body.append( $note );

        if (self._isInitializing !== true)
        {
            var note    = $note.note('option', 'note');
            opts.notes.addNote(note);

            self._trigger('change', null, 'noteAdded');
        }

        return self;
    },

    /** @brief  Given a ui.Note widget, remove the note from our container.
     *  @param  $note   The jQuery DOM element that has a ui.Note widget
     *                  attached.
     *
     *  @return this for a fluent interface.
     */
    removeNote: function($note) {
        var self    = this;
        var opts    = self.options;

        // Create and append a new ui.note widget
        var note    = $note.note('option', 'note');

        opts.notes.removeNote(note);

        self._trigger('change', null, 'noteRemoved');

        return self;
    },

    /** @brief  Mark this instance as 'active'
     */
    activate: function() {
        var self    = this;
        var opts    = self.options;

        if (self.element.hasClass('notes-active'))      { return; }

        var $reply  = self.$buttons.filter('[name=reply]');
        if ((! self.$reply.hasClass('hint')) &&
            (self.$reply.val().length > 0))
        {
            self.$buttons.show();
            $reply.button('enable');
        }
        else
        {
            self.$buttons.hide();
            $reply.button('disable');
            self.$reply.addClass('hint')
                       .val( self.$reply.attr('title') );
        }

        self.element.addClass('notes-active', opts.animSpeed, function() {
            //self.$reply.focus();
        });
    },

    /** @brief  Mark this instance as 'inactive'
     */
    deactivate: function() {
        var self    = this;
        var opts    = self.options;

        if (! self.element.hasClass('notes-active'))    { return; }

        // Cancel any note that is currently being edited
        self.element.find('.note .buttons [name=cancel]').click();

        self.element.removeClass('notes-active', opts.animSpeed);
    },

    /** @brief  Show this notes container.
     */
    show: function() {
        var self    = this;
        var opts    = self.options;

        self.element
                .fadeIn(opts.animSpeed)
                .position( opts.position );
    },

    /** @brief  Hide this notes container.
     */
    hide: function(cb) {
        var self    = this;
        var opts    = self.options;

        self.element
                .fadeOut(opts.animSpeed, cb);
    },

    /** @brief  Focus on the input area.
     */
    focus: function() {
        var self    = this;
        var opts    = self.options;

        self.$reply.trigger('focus');
    },

    /** @brief  Return a serialized version of our underlying $.Notes instance.
     *
     *  @return A serialized version of our underlying $.Notes instance.
     */
    serialize: function() {
        var self    = this;
        var opts    = self.options;

        return opts.notes.serialize();
    },

    /** @brief  Destroy this widget. */
    destroy: function() {
        var self    = this;
        var opts    = self.options;

        self._unbindEvents()
            .hide(function() {
                self._widgetDestroy();
                opts.notes.destroy();
            });
    },

    /*******************************
     * Private methods
     *
     */

    /** @brief  Actually create our widget along with any sub-widgets
     */
    _widgetCreate: function() {
        var self    = this;
        var opts    = self.options;

        if (opts.position.using === null)
        {
            opts.position.using = function( to ) {
                $(this).animate( {top: to.top}, opts.animSpeed );
            };
        }

        self.element
                .addClass('notes ui-corner-all')
                .append( $( opts.template ).tmpl() )
                .appendTo( self.$container );

        if (opts.hidden === true)
        {
            self.element.hide();
        }
        else
        {
            self.element.position( opts.position );
        }

        self.$body    = self.element.find('.notes-body');
        self.$reply   = self.element.find('.notes-reply');
        self.$buttons = self.element.find('.notes-input-pane .buttons button');

        self.$buttons.button();

        // Generate a ui.Note widget for each current $.Note instance
        $.each(opts.notes.getNotes(), function() {
            self.addNote( this, true );
        });

        return self;
    },

    /** @brief  Destroy this widget along with any sub-widgets
     */
    _widgetDestroy: function() {
        var self    = this;
        var opts    = self.options;

        // Destroy all contained note instances
        self.$body.find('.note').note('destroy');

        self.$buttons.button('destroy');

        self.element.empty();

        return self;
    },

    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self._docClick = function(e) {
            var $target = $(e.target);

            if ($target !== self.element)
            {
                self.deactivate();
            }
        };

        /*****************************************************
         * General click handler for document.  If we see
         * this event, deactivate this notes widget.
         *
         */
        $(document).bind('click.ui-notes', self._docClick);

        /*****************************************************
         * Handle button clicks (reply/cancel) within the
         * input pane.
         *
         */
        self.element.delegate('.notes-input-pane button',
                              'click.ui-notes', function(e) {
            var $button = $(this);

            switch ($button.attr('name'))
            {
            case 'reply':
                var note    = new $.Note({
                    text:   self.$reply.val()
                });
                self.addNote(note);
                self.$reply.val('');
                break;

            case 'cancel':
                self.$reply.val('');
                self.$reply.blur();
                //self.deactivate();
                break;
            }
        });

        /*****************************************************
         * Handle 'keyup' in the reply area.
         *
         * Enable/Disale the reply button based upon whether
         * the new content is empty.
         *
         */
        self.$reply.bind('keyup.ui-notes', function(e) {
            var $reply  = self.$buttons.filter('[name=reply]');
            if ((! self.$reply.hasClass('hint')) &&
                (self.$reply.val().length > 0))
            {
                $reply.button('enable');
            }
            else
            {
                $reply.button('disable');
            }
        });

        /*****************************************************
         * Handle click-to-activate
         *
         */
        self.element.bind('click.ui-notes', function(e) {
            self.activate();
            return false;
        });

        /*****************************************************
         * Handle the deletion of contained notes
         *
         */
        self.element.delegate('.note', 'note-destroyed', function(e, note) {
            var $note   = $(e.target);

            self.removeNote($note);
        });

        /*****************************************************
         * Handle focus/blur for the reply element
         *
         */
        self.$reply.bind('focus', function(e) {
             self.$buttons.show();

             var $reply  = self.$buttons.filter('[name=reply]');
             if (self.$reply.hasClass('hint'))
             {
                self.$reply.val('')
                           .removeClass('hint');
             }

             if (self.$reply.val().length > 0)
             {
                 $reply.button('enable');
             }
             else
             {
                 $reply.button('disable');
             }
        });

        self.$reply.bind('blur', function(e) {
             var $reply  = self.$buttons.filter('[name=reply]');
             if (self.$reply.val().length > 0)
             {
                 $reply.button('enable');
             }
             else
             {
                self.$reply.addClass('hint')
                           .val( self.$reply.attr('title') );

                self.$buttons.hide();
                 $reply.button('disable');
             }
        });

        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.element.unbind('.ui-notes');
        self.element.undelegate('.notes-input-pane button', '.ui-notes');
        self.$reply.unbind('.ui-notes');

        $(document).unbind('click.ui-notes', self._docClick);

        return self;
    }
});

/*****************************************************************************
 *  A UI widget for $.Note
 *
 */
$.widget('ui.note', {
    version:    '0.0.1',

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'note-change' instead of 'notechange'.
     */
    widgetEventPrefix:    'note-',

    options:    {
        note:       null,   /* The associated $.Note instance.  May initially
                             * be a serialized version of a $.Note
                             */

        // Template Selector
        template:   '#tmpl-note'
    },

    /** @brief  Return a serialized version of our underlying $.Notes instance.
     *
     *  @return A serialized version of our underlying $.Notes instance.
     */
    serialize: function() {
        var self    = this;
        var opts    = self.options;

        return opts.note.serialize();
    },

    /** @brief  Destroy this widget. */
    destroy: function() {
        var self    = this;
        var opts    = self.options;

        self._unbindEvents()
            ._widgetDestroy();

        // Notify our container that this note has been destroyed.
        self._trigger('destroyed', null, opts.note);
        //self.element.trigger('destroyed', opts.note);
    },

    /*******************************
     * Private methods
     *
     */

    /** @brief  Initialize a new instance.
     */
    _init: function() {
        var self    = this;
        var opts    = self.options;

        if ( $.isPlainObject(opts.note) )
        {
            // Generate a new $.Note instance
            opts.note = new $.Notes( opts.notes );
        }

        self._widgetCreate()
            ._bindEvents();

        return self;
    },


    /** @brief  Actually create our widget along with any sub-widgets
     */
    _widgetCreate: function() {
        var self    = this;
        var opts    = self.options;

        self.element
                .addClass('note')
                .append( $( opts.template ).tmpl( {note: opts.note} ) );

        self.$comment     = self.element.find('.comment');
        self.$editArea    = self.element.find('.edit');
        self.$edit        = self.$editArea.find('textarea');
        self.$buttons     = self.element.find('.buttons button');
        self.$mainButtons = self.element.find('.buttons:last');

        self.$buttons.button();

        return self;
    },

    /** @brief  Destroy this widget along with any sub-widgets
     */
    _widgetDestroy: function() {
        var self    = this;
        var opts    = self.options;

        self.$buttons.button('destroy');
        self.element.empty();

        return self;
    },

    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.$buttons.bind('click.ui-note', function(e) {
            var $button = $(this);

            switch ($button.attr('name'))
            {
            case 'edit':
                self.$edit.val( self.$comment.text() );
                self.$comment.hide();
                self.$mainButtons.css('display', 'none');
                self.$editArea.show();
                self.$edit.focus();
                break;

            case 'delete':
                //self.destroy();
                self.element.slideUp(function() {
                    self.element.remove();
                });
                break;

            case 'save':
                // Save any changes in self.$edit
                opts.note.setText( self.$edit.val() );

                self.$comment.text( opts.note.getText() );

                self._trigger('change', null, 'noteSaved');

                // Fall-through to 'cancel' to restore non-edit mode

            case 'cancel':
                // Cancel 'edit'
                self.$editArea.hide();
                self.$comment.show();
                self.$mainButtons.css('display', '');
                break;
            }
        });

        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.$buttons.unbind('.ui-note');

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
        filter:         'normal',   // The initial filter (tagged,starred)
        
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
        self.starred  = [];
        self.notes    = [];

        var $gp     = self.element.parent().parent();
        self.$control         = $gp.find('.control-pane');
        self.$notes           = $gp.find('.notes-pane');
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
        
        // Retrieve the filter state for the current meta-data URL
        var state   = self._getState(opts.metadata);
        var notes   = [];
        if (state)
        {
            opts.threshold.min = state.threshold.min;
            opts.threshold.max = state.threshold.max;
            opts.filter        = state.filter;
            
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

        /* Ensure the filter is properly set (without a refresh).
         * The refresh will take place when we set the threshold.
         */
        self._changeFilter(opts.filter, true);
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
               .removeClass('noHighlight highlight expanded expansion',
                            opts.animSpeed * 2,
                            function() {
                    var $s  = $(this);

                    if ($s.data('isHighlighted'))
                    {
                        $s.younger( opts )
                          .removeData('isHighlighted');
                    }

                    // Hide any associated notes
                    self._syncNotesPosition( $s );
               });

        // Show sentences
        self.$s.filter('.toHighlight')
            .removeClass('toHighlight expanded expansion')
            .addClass('highlight', opts.animSpeed * 2, function() {
                var $s              = $(this);
                var wasHighlighted  = $s.data('isHighlighted');
                $s.data('isHighlighted', true);

                // If the current senntence was already highlighted...
                if (wasHighlighted)
                {
                    // Already highlighted so we need to adjust the age
                    //      expanding   (older)
                    //      contracting (younger)
                    if (isExpand === true)
                    {
                        // older
                        $s.older( opts );
                    }
                    else if (isExpand === false)
                    {
                        // younger
                        $s.younger( opts );
                    }
                }

                // Sync the position of associated notes
                self._syncNotesPosition( $s );
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
            filter:     opts.filter,
            
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

            /* If the sentence containing this tagged item is visible, ensure
             * that the associated note is visible (which will also adjust its
             * position).  Otherwise, hide the associated note.
             */
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

            // Unhover all sentences
            self.$s.removeClass('ui-hover');

            switch (e.type)
            {
            case 'hover-in':
                // Hover over THIS sentence
                $s.addClass('ui-hover');
                break;

            /*
            case 'hover-out':
                $s.removeClass('ui-hover');
                break;
            // */
            }
        });

        /*************************************************************
         * Mouse over sentence controls increases opacity.
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
        $parent.delegate('article .sentence .tagged', 'click', function(e) {
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
        self.$notes.delegate('.notes',
                             'notes-changed note-change note-destroyed',
                             function() {
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

        self.$notes.undelegate('.notes',
                               'notes-changed note-change note-destroyed');
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
