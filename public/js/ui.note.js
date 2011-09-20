/** @file
 *
 *  Provide a UI for $.Note and $.Comment.
 *
 *  The DOM element used to create a new ui.note instance MAY have an 'id'
 *  attribute or the 'id' MAY be passed as an option.
 *
 *  Requires:
 *      jquery.js
 *      jquery.note.js
 *      ui.core.js
 *      ui.widget.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global jQuery:false */
(function($) {

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

        // The selector for the container of note widgets
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
        template:   '#tmpl-note'
    },

    /** @brief  Initialize a new instance.
     *
     *  Options:
     *      note        Either a serialize $.Note or a $.Note instance;
     *      container   A selector or jQuery/DOM instance representing the
     *                  element that will contain all note widgets
     *                  [ '.notes-pane' ];
     *      position    An object suitable for ui.position
     *                  [ {my:'top', at:'top', of:null, using:null} ];
     *      animSpeed   The speed (in ms) of animations [ 200 ];
     *      hidden      Should the widget be initially hidden [ false ];
     *      template    A selector representing the jQuery template to use
     *                  when creating an instance [ '#tmpl-note' ];
     *
     *  @triggers (with a 'note-' prefix):
     *      'change' -- 'commentAdded'
     *      'change' -- 'commentRemoved'
     *      'change' -- 'commentSaved'
     *
     *      'destroyed'
     */
    _init: function() {
        var self    = this;
        var opts    = self.options;

        self._isInitializing = true;

        self.$container = $( opts.container );

        if ( $.isPlainObject(opts.note) )
        {
            if ((opts.note.id === undefined) || (opts.note.id === null))
            {
                opts.note.id = self.element.attr('id');
            }

            // Generate a new $.Note instance...
            opts.note  = new $.Note( opts.note );
        }

        self._widgetCreate()
            ._bindEvents();

        self._isInitializing = false;

        return self;
    },


    /** @brief  Return the id of our $.Note instance.
     *
     *  @return The id (null if not set).
     */
    id: function() {
        var self    = this;
        var opts    = self.options;

        return (opts.note ? opts.note.getId() : null);
    },

    /** @brief  Return the number of $.Note instances.
     *
     *  @return The count.
     */
    commentCount: function() {
        var self    = this;
        var opts    = self.options;

        return opts.note.getCommentCount();
    },

    /** @brief  Add a new comment to our container.
     *  @param  comment     The new $.Comment instance.  If not provided,
     *                      create a new, empty comment.
     *
     *  @return this for a fluent interface.
     */
    addComment: function(comment) {
        var self    = this;
        var opts    = self.options;

        if (! comment)
        {
            // Create an empty comment
            comment = new $.Comment();
        }

        // Create and append a new ui.comment widget
        var $comment    = $('<div />').comment({comment:comment});
        self.$body.append( $comment );

        if (self._isInitializing !== true)
        {
            var comment = $comment.comment('option', 'comment');
            opts.note.addComment(comment);

            self._trigger('change', null, 'commentAdded');
        }

        return self;
    },

    /** @brief  Given a ui.comment widget, remove the comment from our
     *          container.
     *  @param  $comment    The jQuery DOM element that has a ui.comment widget
     *                      attached.
     *
     *  @return this for a fluent interface.
     */
    removeComment: function($comment) {
        var self    = this;
        var opts    = self.options;

        // Remove the identified comment
        var comment = $comment.comment('option', 'comment');
        opts.note.removeComment(comment);

        self._trigger('change', null, 'commentRemoved');

        // If there are no more comments, self-destruct!
        //if (self.commentCount() < 1)
        if (opts.note.getCommentCount() < 1)
        {
            self.destroy();
        }

        return self;
    },

    /** @brief  Mark this instance as 'active'
     *  @param  cb      If provided, an activation completion callback
     */
    activate: function(cb) {
        var self    = this;
        var opts    = self.options;

        if (self.element.hasClass('note-active'))
        {
            // Already actived
            if ($.isFunction(cb))
            {
                cb.apply(this);
            }
            return;
        }

        // Ensure proper reply input/button state by initially blurring
        self.$reply.blur();

        /* NOTE: Popping to the top immediately relies on a z-index set for
         *       .note in both normal and activated states, with the activated
         *       state at a higher z-index.
         */
        var zIndex  = parseInt(self.element.css('z-index'), 10);
        self.element
                .css('z-index', zIndex + 1) // pop to the top immediately...
                .addClass('note-active', opts.animSpeed, function() {
                        // ...then remove the hard z-index and let
                        //    the CSS take over.
                        self.element.css('z-index', '');

                        if ($.isFunction(cb))
                        {
                            cb.apply(this);
                        }
        });
    },

    /** @brief  Mark this instance as 'inactive'
     *  @param  cb      If provided, an deactivation completion callback
     */
    deactivate: function(cb) {
        var self    = this;
        var opts    = self.options;

        if (! self.element.hasClass('note-active'))
        {
            // Already deactived
            if ($.isFunction(cb))
            {
                cb.apply(this);
            }
            return;
        }

        // Cancel any comment that is currently being edited
        self.$body.find('.comment').comment('cancelEdit');

        // And close ourselves up
        self.element.removeClass('note-active', opts.animSpeed, cb);
    },

    /** @brief  Show this note container.
     */
    show: function() {
        var self    = this;
        var opts    = self.options;

        self.element
                .fadeIn(opts.animSpeed)
                .position( opts.position );
    },

    /** @brief  Hide this note container.
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

    /** @brief  Does this note currently have focus?
     *
     *  @return true | false
     */
    hasFocus: function() {
        var self    = this;
        var opts    = self.options;

        /* If our $input is hidden, we're currently editing a comment and so
         * vicariously have focus
         */
        return ( self.$input.is(':hidden') ||
                 self.$reply.is(':focus') );
    },

    /** @brief  Given a ui.comment widget, put it in edit mode.
     *  @param  $comment    The jQuery DOM element that has a ui.comment widget
     *                      attached [ null == first ].
     *
     *  @return this for a fluent interface.
     */
    editComment: function($comment) {
        var self    = this;
        var opts    = self.options;

        if (! $comment)
        {
            $comment = self.$body.find('.comment:first');
        }

        self.directEdit = true;
        self.$input.hide( );

        // Activate and place the target comment in edit mode.
        self.activate( function() {
            $comment.comment('edit');
        });

        return self;
    },

    /** @brief  Return a serialized version of our underlying $.Note instance.
     *
     *  @return A serialized version of our underlying $.Note instance.
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
            .hide(function() {
                self._widgetDestroy();
                opts.note.destroy();

                self._trigger('destroyed');
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

                // See if there is an existing note we will be colliding with
                var myExtent    = self.element.offset();
                var newTop      = myExtent.top + to.top;
                var newBot      = newTop + self.element.height();
                var myId        = self.element.attr('id');

                self.$container.find('.note').each(function() {
                    var $note   = $(this);
                    if (myId === $note.attr('id'))  { return; }

                    var pos     = $note.offset();
                    var extent  = {
                        top:    pos.top,
                        bot:    pos.top  + $note.height()
                    };

                    if ( ((newTop >= extent.top) && (newTop <= extent.bot)) ||
                         ((newBot >= extent.top) && (newBot <= extent.bot)) )
                    {
                        // Collision!  Adjust Down
                        to.top += $note.height() + 4;
                    }
                });

                $(this).animate( {top: to.top}, opts.animSpeed );
            };
        }

        self.element
                .addClass('note ui-corner-all')
                .attr('id', 'note-'+ self.id())
                .append( $( opts.template ).tmpl() )
                .appendTo( self.$container );

        if (opts.hidden === true)
        {
            self.element.hide();
        }

        self.$body    = self.element.find('.note-body');
        self.$reply   = self.element.find('.note-reply');
        self.$input   = self.element.find('.note-input-pane');
        self.$buttons = self.$input.find('.buttons button');

        self.$buttons.button();

        // Generate a ui.Note widget for each current $.Note instance
        if (opts.note)
        {
            $.each(opts.note.getComments(), function() {
                self.addComment( this, true );
            });
        }

        if (opts.hidden !== true)
        {
            self.element.position( opts.position );
        }

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
         * this event, deactivate this note widget.
         *
         */
        $(document).bind('click.ui-note', self._docClick);

        /*****************************************************
         * Handle button clicks (reply/cancel) within the
         * input pane.
         *
         */
        self.$buttons.bind('click.ui-note', function(e) {
            var $button = $(this);

            switch ($button.attr('name'))
            {
            case 'reply':
                var comment = new $.Comment({ text: self.$reply.val() });
                self.addComment(comment);
                self.$reply.val('');
                break;

            case 'cancel-reply':
                self.$reply.val('');
                self.$reply.blur();

                // If there are no (more) comments, self-destruct!
                if (self.commentCount() < 1)
                {
                    self.destroy();
                }
                break;
            }
        });

        /*****************************************************
         * Handle click-to-activate
         *
         */
        self.element.bind('click.ui-note', function(e) {
            self.activate();
            return false;
        });

        /*****************************************************
         * Handle comment edit/cancel
         *
         */
        self.element.delegate('.comment',
                                'comment-edit.ui-note '
                              + 'comment-cancel-edit.ui-note',
                              function(e) {
            var $comment    = $(e.target);

            switch (e.type)
            {
            case 'comment-edit':
                self.$input.hide( );
                break;

            case 'comment-cancel-edit':
                if (self.directEdit)
                {
                    /* On 'cancel-edit', destroy any pending comment.  This
                     * will result in our 'comment-destroyed' handler (below)
                     * once the comment is actually destroyed.
                     */
                    self.removeComment($comment);
                }
                else
                {
                    self.$input.css('display', '');
                }
                break;
            }
        });

        /*****************************************************
         * Handle the deletion of a comment
         *
         */
        self.element.delegate('.comment',
                                'comment-destroyed.ui-note '
                              + 'comment-saved.ui-note',
                              function(e, comment) {
            var $comment    = $(e.target);

            if (self.directEdit)
            {
                /* In direct edit mode (via editComment()), then we've arrived
                 * here due to an edit cancellation (which resulted in a
                 * deletion of the pending comment and a 'comment-destroyed'
                 * event) or a comment save.  At this point the comment should
                 * have been fully dealt with so all we need to do is
                 * de-activate.
                 */
                self.deactivate( function() {
                    self.$input.css('display', '');
                    self.directEdit = false;
                });
            }
            else if (e.type === 'comment-destroyed')
            {
                /* NOT in direct edit mode.  A comment has been destroyed,
                 * likely via the user clicking on the 'delete' button for the
                 * comment.  Make sure our state properly reflects deletion.
                 */
                self.removeComment($comment);
            }
        });

        /*****************************************************
         * Handle 'keyup' in the reply element.
         *
         * Enable/Disable the reply button based upon whether
         * the new content is empty.
         *
         */
        self.$reply.bind('keyup.ui-note', function(e) {
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
         * Handle focus/blur for the reply element
         *
         */
        self.$reply.bind('focus.ui-note', function(e) {
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

        self.$reply.bind('blur.ui-note', function(e) {
             var $reply  = self.$buttons.filter('[name=reply]');
             if (self.$reply.val().length > 0)
             {
                 $reply.button('enable');
             }
             else
             {
                self.$reply.addClass('hint')
                           .val( self.$reply.attr('title') );

                // Disable the reply button and hide the buttons
                $reply.button('disable');

                // If there are comments, hide the buttons
                if (self.commentCount() > 0)
                {
                    self.$buttons.hide();
                }
             }
        });

        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.element.undelegate('.comment', '.ui-note');
        self.element.unbind('.ui-note');
        self.$reply.unbind('.ui-note');
        self.$buttons.unbind('.ui-note');

        $(document).bind('click.ui-note', self._docClick);

        return self;
    }
});

/*****************************************************************************
 *  A UI widget for $.Note
 *
 */
$.widget('ui.comment', {
    version:    '0.0.1',

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'comment-change' instead of 'commentchange'.
     */
    widgetEventPrefix:    'comment-',

    options:    {
        comment:    null,   /* The associated $.Comment instance.  May
                             * initially be a serialized version of a $.Comment
                             */

        // Template Selector
        template:   '#tmpl-comment'
    },

    /** @brief  Return a serialized version of our underlying $.Comment
     *          instance.
     *
     *  @return A serialized version of our underlying $.Comment instance.
     */
    serialize: function() {
        var self    = this;
        var opts    = self.options;

        return opts.comment.serialize();
    },

    /** @brief  Destroy this widget. */
    destroy: function() {
        var self    = this;
        var opts    = self.options;

        self._unbindEvents()
            ._widgetDestroy();

        // Notify our container that this comment has been destroyed.
        self._trigger('destroyed', null, opts.comment);
    },

    /** @brief  Put this comment in edit mode. */
    edit: function() {
        var self    = this;
        var opts    = self.options;

        if (self.editing)   { return; }
        self.editing = true;

        self.$edit.val( self.$comment.text() );
        self.$comment.hide( opts.animSpeed );
        self.$mainButtons.hide( opts.animSpeed );
        self.$editArea.show();
        self.$edit.focus();

        self._trigger('edit');

        return this;
    },

    /** @brief  Cancel edit mode. */
    cancelEdit: function() {
        var self    = this;
        var opts    = self.options;

        if (! self.editing) { return; }
        self.editing = false;

        self.$editArea.hide( );
        self.$comment.show( );

        /* Note: Do NOT use show() -- it will add a direct style setting which
         *       will override any CSS rules.  We simply want to remove the
         *       'display:none' style added by .hide() in edit().
         */
        self.$mainButtons.css('display', '');

        return this;
    },

    /** @brief  Save any changes and cancel edit mode. */
    save: function() {
        var self    = this;
        var opts    = self.options;

        opts.comment.setText( self.$edit.val() );

        self.$comment.text( opts.comment.getText() );

        self._trigger('change', null, 'commentSaved');
        self._trigger('saved',  null, opts.comment);

        self.cancelEdit();
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

        if ( $.isPlainObject(opts.comment) )
        {
            // Generate a new $.Comment instance
            opts.comment = new $.Comment( opts.comment );
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
                .addClass('comment')
                .append( $( opts.template ).tmpl( {note: opts.comment} ) );

        self.$comment     = self.element.find('.text');
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

        self.$buttons.bind('click.ui-comment', function(e) {
            var $button = $(this);

            switch ($button.attr('name'))
            {
            case 'edit':
                self.edit();
                break;

            case 'delete':
                self.element.slideUp(function() {
                    self.element.remove();
                });
                break;

            case 'save':
                // Save any changes in self.$edit
                self.save();
                break;

            case 'cancel-edit':
                // Cancel 'edit'
                self.cancelEdit();
                self._trigger('cancel-edit');
                break;
            }
        });

        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.$buttons.unbind('.ui-comment');

        return self;
    }
});

 }(jQuery));
