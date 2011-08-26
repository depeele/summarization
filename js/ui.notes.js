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

        // Template selector
        template:   '#tmpl-notes'
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

    /** @brief  Given a new $.Note instance, add the note to our container.
     *  @param  note    The new $.Note instance.
     */
    addNote: function(note) {
        var self    = this;
        var opts    = self.options;

        // Create and append a new ui.note widget
        self.$body.append( $('<div />').note({note:note}) );

        return self;
    },

    /** @brief  Mark this instance as 'active'
     */
    activate: function() {
        var self    = this;
        var opts    = self.options;

        self.element.addClass('notes-active', opts.animSpeed);
    },

    /** @brief  Mark this instance as 'inactive'
     */
    deactivate: function() {
        var self    = this;
        var opts    = self.options;

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

    /** @brief  Initialize a new instance.
     */
    _init: function() {
        var self    = this;
        var opts    = self.options;

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

        return self;
    },


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
                .appendTo( self.$container )
                .position( opts.position );

        self.$body  = self.element.find('.notes-body');

        // Generate a ui.Note widget for each current $.Note instance
        $.each(opts.notes.getNotes(), function() {
            self.addNote( this );
        });

        return self;
    },

    /** @brief  Destroy this widget along with any sub-widgets
     */
    _widgetDestroy: function() {
        var self    = this;
        var opts    = self.options;

        // Destroy all contained note instances
        self.$body.find('.note').destroy();

        self.element.empty();

        return self;
    },

    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;

        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        return self;
    }
});

/*****************************************************************************
 *  A UI widget for $.Note
 *
 */
$.widget('ui.note', {
    version:    '0.0.1',

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

        // Let ui.notes handle this
        //opts.note.destroy();
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

        return self;
    },

    /** @brief  Destroy this widget along with any sub-widgets
     */
    _widgetDestroy: function() {
        var self    = this;
        var opts    = self.options;

        self.element.empty();

        return self;
    },

    _bindEvents: function() {
        var self    = this;
        var opts    = self.options;

        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        return self;
    }
});

 }(jQuery));
