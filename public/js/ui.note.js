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
     *  @return The id.
     */
    id: function() {
        var self    = this;
        var opts    = self.options;

        return opts.note.getId();
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

    /** @brief  Given a new $.Comment instance, add the comment to our
     *          container.
     *  @param  comment     The new $.Comment instance.
     *
     *  @return this for a fluent interface.
     */
    addComment: function(comment) {
        var self    = this;
        var opts    = self.options;

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

        // Create and append a new ui.comment widget
        var comment = $comment.comment('option', 'comment');

        opts.note.removeComment(comment);

        self._trigger('change', null, 'commentRemoved');

        // If there are no more comments, self-destruct!
        if (self.commentCount() < 1)
        {
            self.destroy();
        }

        return self;
    },

    /** @brief  Mark this instance as 'active'
     */
    activate: function() {
        var self    = this;
        var opts    = self.options;

        if (self.element.hasClass('note-active'))      { return; }

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
        });
    },

    /** @brief  Mark this instance as 'inactive'
     */
    deactivate: function() {
        var self    = this;
        var opts    = self.options;

        if (! self.element.hasClass('note-active'))    { return; }

        // Cancel any note that is currently being edited
        self.element.find('.note .buttons [name=cancel]').click();

        self.element.removeClass('note-active', opts.animSpeed);
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

        return self.$reply.is(':focus');
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
        self.$buttons = self.element.find('.note-input-pane .buttons button');

        self.$buttons.button();

        // Generate a ui.Note widget for each current $.Note instance
        $.each(opts.note.getComments(), function() {
            self.addComment( this, true );
        });

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
        self.element.delegate('.note-input-pane button',
                              'click.ui-note', function(e) {
            var $button = $(this);

            switch ($button.attr('name'))
            {
            case 'reply':
                var comment = new $.Comment({ text: self.$reply.val() });
                self.addComment(comment);
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
         * Handle click-to-activate
         *
         */
        self.element.bind('click.ui-note', function(e) {
            self.activate();
            return false;
        });

        /*****************************************************
         * Handle the deletion of a comment
         *
         */
        self.element.delegate('.comment', 'comment-destroyed',
                              function(e, comment) {
            var $comment    = $(e.target);

            self.removeComment($comment);
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

                self.$buttons.hide();
                 $reply.button('disable');
             }
        });

        return self;
    },

    _unbindEvents: function() {
        var self    = this;
        var opts    = self.options;

        self.element.undelegate('.note-input-pane button', 'click.ui-note');
        self.$reply.unbind('.ui-note');
        self.element.unbind('.ui-note');
        self.element.undelegate('.comment', 'comment-destroyed');

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
        //self.element.trigger('destroyed', opts.comment);
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
                opts.comment.setText( self.$edit.val() );

                self.$comment.text( opts.comment.getText() );

                self._trigger('change', null, 'commentSaved');

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

        self.$buttons.unbind('.ui-comment');

        return self;
    }
});

 }(jQuery));
