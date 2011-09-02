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

        hidden:     false,  // Initially hidden?

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

            self.element.trigger('changed');
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

        self.element.trigger('changed');

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
        self.$body.bind('destroyed', function(e, note) {
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
        self.element.trigger('destroyed', opts.note);
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

                self.element.trigger('changed');

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
