/** @file
 *
 *  jQuery class/objects representing a single, user-generated note as well as
 *  a group of one or more comments.
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

/** @brief  A note comprised of one or more comments and tags.  */
$.Note = function(props) {
    var defaults    = {
        id:         null,
        comments:   [],
        tags:       []
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Note.prototype = {
    /** @brief  Initialize a new Note instance.
     *  @param  props   The properties of this instance:
     *                      id:         The unique id of this instance;
     *                      comments:   An array of $.Comment objects,
     *                                  serialized $.Comment objects, or empty
     *                                  to initialize an empty set;
     *                      tags:       An array of tag strings;
     */
    init: function(props) {
        this.props = props;

        var commentInstances    = [];
        $.each(this.props.comments, function() {
            var comment = this;
            if ($.isPlainObject(comment))  { comment = new $.Comment(comment); }

            commentInstances.push( comment );
        });

        if (commentInstances.length < 1)
        {
            // Create a single, empty comment
            commentInstances.push( new $.Comment() );
        }

        this.props.comments = commentInstances;

        return this;
    },

    /** @brief  Add a new comment to this note.
     *  @param  comment A $.Comment instance or properties to create one.
     *
     *  @return The comment instance that was added.
     */
    addComment: function(comment) {
        if ($.isPlainObject(comment))   { comment = new $.Comment(comment); }

        this.props.comments.push(comment);

        return comment;
    },

    /** @brief  Remove a comments from this note.
     *  @param  comment A $.Comment instance to remove.
     *
     *  @return this for a fluent interface.
     */
    removeComment: function(comment) {
        var self    = this;
        if (comment instanceof $.Comment)
        {
            var targetIdex  = -1;
            $.each(self.props.comments, function(idex) {
                if (this === comment)
                {
                    targetIdex = idex;
                    return false;
                }
            });

            if (targetIdex >= 0)
            {
                self.props.comments.splice(targetIdex, 1);
                comment.destroy();
            }
        }

        return self;
    },

    getId: function()           { return this.props.id; },
    getComments: function()     { return this.props.comments; },
    getCommentCount: function() { return this.props.comments.length; },
    getTags: function()         { return this.props.tags; },

    getComment: function(idex) {
        idex = idex || 0;
        return this.props.comments[idex];
    },
    getTag: function(idex) {
        idex = idex || 0;
        return this.props.tags[idex];
    },

    /** @brief  Return a serialized version of this instance suitable
     *          for creating a duplicate instance via our constructor.
     *
     *  @return The serialized version
     */
    serialize: function() {
        var serialized  = {
            id:         this.props.id,
            comments:   [],
            tags:       this.props.tags
        };

        $.each(this.props.comments, function() {
            serialized.comments.push( this.serialize() );
        });

        return serialized;
    },

    /** @brief  Destroy this instance.
     */
    destroy: function() {
        var self    = this;
        var props   = self.props;
        if ($.isArray(props.comments))
        {
            $.each(props.comments, function() {
                this.destroy();
            });
        }

        delete props.comments;
        delete props.tags;
    }
};

/******************************************************************************
 * Comment
 *
 */

/** @brief  A single, attributable comment.
 *  @param  props   The properties of this comment:
 *                      author:     The $.User instance or serialize $.User
 *                                  representing the author of this comment;
 *                      text:       The text of this comment;
 *                      created:    The date/time the comment was created;
 */
$.Comment  = function(props) {
    var defaults    = {
        author: null,
        text:   '',
        created:new Date()
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Comment.prototype = {
    /** @brief  Initialize a new Comment instance.
     *  @param  props   The properties of this comment:
     *                      author:     The Unique ID of the author
     *                      text:       The text of this comment
     *                      created:    The date/time the comment was created
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

    /** @brief  Return a serialized version of this instance suitable
     *          for creating a duplicate instance via our constructor.
     *
     *  @return The serialized version.
     */
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

 }(jQuery));
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

        if ((! self.element.hasClass('note-active')) || self.deactivating)
        {
            // Already deactived
            if ($.isFunction(cb)) { cb.apply(this); }

            return;
        }
        self.deactivating = true;

        // Cancel any comment that is currently being edited
        self.$body.find('.comment').comment('cancelEdit');

        // And close ourselves up
        self.element.removeClass('note-active', opts.animSpeed, function() {
            if ($.isFunction(cb))   { cb.apply(this); }

            self.deactivating = false;
        });
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

            // Special keys
            switch (e.keyCode)
            {
            case $.ui.keyCode.ESCAPE:   // 27
                self.$reply.val('');
                self.$reply.blur();
                break;
            }

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

        if (self.editing)   { return self; }
        self.editing = true;

        self.$edit.val( self.$comment.text() );
        self.$comment.hide( opts.animSpeed );
        self.$mainButtons.hide( opts.animSpeed );
        self.$editArea.show();
        self.$edit.focus();

        self._trigger('edit');

        return self;
    },

    /** @brief  Cancel edit mode.
     *  @param  squelchEvent    If true, do NOT trigger the 'cancel-edit'
     *                          event [ false ];
     */
    cancelEdit: function(squelchEvent) {
        var self    = this;
        var opts    = self.options;

        if (! self.editing) { return self; }
        self.editing = false;

        self.$editArea.hide( );
        self.$comment.show( );

        /* Note: Do NOT use show() -- it will add a direct style setting which
         *       will override any CSS rules.  We simply want to remove the
         *       'display:none' style added by .hide() in edit().
         */
        self.$mainButtons.css('display', '');

        if (squelchEvent !== true)
        {
            self._trigger('cancel-edit');
        }

        return self;
    },

    /** @brief  Save any changes and cancel edit mode. */
    save: function() {
        var self    = this;
        var opts    = self.options;

        opts.comment.setText( self.$edit.val() );

        self.$comment.text( opts.comment.getText() );

        // Cancel the edit WITHOUT triggering the 'cancel-edit' event
        self.cancelEdit( true );

        self._trigger('change', null, 'commentSaved');
        self._trigger('saved',  null, opts.comment);

        return self;
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
                break;
            }
        });

        /*****************************************************
         * Handle 'keyup' in the edit element.
         *
         */
        self.$editArea.bind('keyup.ui-comment', function(e) {
            // Special keys
            switch (e.keyCode)
            {
            case $.ui.keyCode.ESCAPE:   // 27
                self.cancelEdit();
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
     *
     *  @return The new ui.note instance
     */
    _addNote: function( $group, note, hide ) {
        var self    = this;
        var opts    = self.options;

        // Generate a ui.note widget at the same vertical offset as $group.
        var $note   = $('<div />').note({
                        container:  opts.notesPane,
                        note:       note,
                        position:   { of:$group },
                        hidden:     (hide ? true : false)
                      });

        self.notes[ $note.note('id') ] = $note;

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

        return $note;
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

                // Remove any remaining rangy selections.
                rangy.getSelection().removeAllRanges();

                var note    = { id: self.notes.length };
                var $note   = self._addNote( $group, note );

                if ($.ui.sentence.options.quickTag !== true)
                {
                    // Edit the first (empty) command
                    $note.note('editComment');
                }
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

// Global sentence options (shared by all ui.sentence instance).
$.ui.sentence.options = {
    quickTag:   false
};


}(jQuery));

/** @file
 *
 *  Provide a UI overlay (ui.contentOverlay) over the target content element to
 *  allow highlighting of a content area without modifying it directly.
 *
 *  Also provide an overlay group (ui.overlayGroup) to represent a single
 *  overlay within ui.contentOverlay.
 *
 *  Requires:
 *      jquery.js
 *      jquery-ui.js
 *
 *      rangy.js
 */
/*jslint nomen:false, laxbreak:true, white:false, onevar:false */
/*global jQuery:false */
(function($) {

$.widget("ui.contentOverlay", {
    version: "0.0.1",

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'contentOverlay-change' instead of 'contentOverlaychange'.
     */
    widgetEventPrefix:    'contentOverlay-',

    options: {
        /* Valid types for addOverlay() along with the associated cssClass to
         * apply to the group as well as a selector for controls to be
         * presented for that group
         */
        types:      {
            selection:  {
                cssClass:   'selected',
                template:   '#tmpl-overlay-controls'
            },
            tag:        {
                cssClass:   'tagged',
                template:   '#tmpl-overlay-remove-controls'
            },
        }
    },

    /** @brief  Initialize a new instance.
     */
    _init: function() {
        var self     = this;
        var opts     = this.options;

        self.$groups = $(); // initialize as an empty set

        rangy.init();

        // Interaction events
        self._widgetInit()
            ._eventsBind();
    },

    /************************
     * Public methods
     *
     */

    /** @brief  Refresh after some DOM change that would alter overlay
     *          positioning (i.e. expand/collapse of the content element).
     */
    refresh: function() {
        var self    = this;
        var opts    = self.options;

        self.$groups = self.$overlay.find('.group');
        self.$groups.overlayGroup('refresh');
    },

    /** @brief  Add a new overlay.
     *  @param  range   A range either as a rangy WrappedRange object OR
     *                  as a string of the form:
     *                          sentence/child:offset,child:offset
     *  @param  type    The overlay type (from $.ui.overlayGroup.types);
     *
     *  @return The new overlayGroup.
     */
    addOverlay: function(range, type) {
        var self        = this;
        var opts        = self.options;
        var typeInfo    = $.ui.overlayGroup.types[ type ];
        if (typeInfo === undefined)
        {
            // Invalid type
            return;
        }

        // Create an overlay group and add an element for each segment.
        var $group  = $('<div />')
                        .appendTo( self.$overlay )
                        .overlayGroup({
                            cssClass:   typeInfo.cssClass,
                            template:   typeInfo.template,
                            content:    self.element,
                            range:      range
                        });

        // Update our list of contained groups
        self.$groups = self.$overlay.find('.group');

        return $group;
    },

    /** @brief  Remove all overlays of the given type.
     *  @param  type    The overlay type (from $.ui.overlayGroup.types);
     *                  If not provided, remove ALL overlays;
     */
    removeAll: function(type) {
        var self        = this;
        var opts        = self.options;

        // If there are no groups, return now.
        if (self.$groups.length < 1)    { return; }

        var $groups     = self.$groups;
        if (type)
        {
            var typeInfo    = $.ui.overlayGroup.types[ type ];
            if (typeInfo === undefined)
            {
                // Invalid type
                return;
            }

            $groups = $groups.filter('.'+ typeInfo.cssClass);
        }

        $groups.overlayGroup('destroy');
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

        self.$overlay = $('<div />')
                            .addClass('overlay')
                            .insertBefore( self.element );

        return self;
    },

    /** @brief  Destroy the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetClean: function() {
        var self    = this;
        var opts    = self.options;

        self.removeAll();
        self.$overlay.remove();

        return self;
    },

    /** @brief  Bind any relevant event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsBind: function() {
        var self    = this;
        var opts    = self.options;

        /*************************************************************
         * Catch any mousedown events that reach 'document' and,
         * when seen, remove any current selection within this
         * overlay.
         */
        self._mouseDown = function(e) {
            self.removeAll('selection');
        };

        $(document).bind('mousedown', self._mouseDown);

        /*************************************************************
         * Since overlays are absolutely positioned BELOW the content,
         * in order to recognize hovers and clicks on an overlay, we
         * must monitor events in the primary content area and adjust
         * them for the overlay.
         *
         * For hover, this requires a mouse movement handler that
         * performs hit testing on the overlay groups.
         *
         */
        self.element.bind('mousemove mouseleave mousedown mouseup click',
                           function(e) {

            // Does this mouse event hit any of our overlays?
            var hit     = null;
            self.$groups.each(function() {
                hit = $(this).overlayGroup('hitTest', e);

                if (hit !== null)   { return false; }
            });

            if ( (hit === null) && (e.type === 'mouseup') )
            {
                /* If there was no hit AND this is a mouseup event,
                 * see if we have a rangy selection.
                 */
                var sel     = rangy.getSelection();
                var strSel  = sel.toString();

                // Remove any existing selection overlay
                self.removeAll('selection');

                if (strSel.length > 0)
                {
                    /* Ensure that the wrappedRange has a start and end element
                     * share the same grand-parent (content area).  If not,
                     * contract the range and invoke addOverlay() on the proper
                     * ui.contentOverlay.
                     */
                    var type            = 'selection';
                    var range           = sel.getRangeAt(0);
                    var $start          = $(range.startContainer);
                    var $end            = $(range.endContainer);
                    var $ancestorStart  = $start.parent().parent();
                    var $ancestorEnd    = $end.parent().parent();
                    var $group;

                    if ($ancestorStart[0] !== $ancestorEnd[0])
                    {
                        /* Contract the range to end with the last offset
                         * within the last child of $ancestorStart.
                         */
                        $end = $ancestorStart.children().last();

                        range.setEnd($end[0].childNodes[0],
                                     $end.text().length);

                        if ($ancestorStart[0] !== self.element[0])
                        {
                            /* Reset the selection to include JUST the adjusted
                             * range
                             */
                            sel.setSingleRange( range );

                            /* Inovke addOverlay() on the ui.contentOverlay
                             * widget associated with $ancestorStart
                             */
                            $group = $ancestorStart
                                        .contentOverlay('addOverlay',
                                                        range, type);
                        }
                    }

                    if (! $group)
                    {
                        /* Range adjustment did NOT result in the creation of
                         * an ui.overlayGroup by another ui.contentOverlay, so
                         * create a new ui.overlayGroup now that is connected
                         * with THIS ui.contentOverlay widget.
                         */
                        $group = self.addOverlay(range, type);
                    }

                    // Squelch this 'mouseup' event
                    e.preventDefault();
                    e.stopPropagation();
                    return false;
                }
            }
        });

        /*************************************************************
         * Handle maintenance events from ui.overlayGroup.
         *
         */
        self.$overlay.bind('overlaygroup-destroyed', function(e) {
            // Remove the group element that we created
            var $group  = $(e.target);
            $group.remove();

            // Update our list of contained groups
            self.$groups = self.$overlay.find('.group');
        });

        return self;
    },

    /** @brief  Unbind any bound event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsUnbind: function() {
        var self    = this;

        $(document).unbind('mousedown', self._mouseDown);

        self.element.unbind('mousemove mouseleave mousedown mouseup click');
        self.$overlay.unbind('overlaygroup-destroyed');

        return self;
    }
});

/****************************************************************************
 * An overlay group, possibly with overlay controls.
 *
 */
$.widget("ui.overlayGroup", {
    version: "0.0.1",

    /* Change the prefix used by ui.widget._trigger() for events so we can bind
     * to events like 'overlayGroup-change' instead of 'overlayGroupchange'.
     */
    widgetEventPrefix:    'overlayGroup-',

    options: {
        cssClass:   'selected',
        template:   '#tmpl-overlay-controls',

        segments:   [],     /* An array of positions representing contiguous,
                             * per-"line" areas within the overlay group.
                             * Each entry should have the form:
                             *      { top:      position value,
                             *        left:     position value,
                             *        height:   size value,
                             *        width:    size value }
                             */

        content:    null,   // The jQuery/DOM element OR selector of the
                            // overlayed content area

        range:      null,   /* The serialized rangy range that fully defines
                             * this group within the context of 'content'.
                             */

        /* How much of a delta should be allowed between mouse events before
         * calling it a hover?
         */
        hoverDelta: 5
    },

    /** @brief  Initialize a new instance.
     *
     *  Valid options:
     *      cssClass    The css class to apply to this overlay group;
     *      template    If provided, a selector for the template to use
     *                  for overlay controls;
     *      segments    An array of positions representing contiguous,
     *                  per-"line" areas within the overlay group.
     *                  Each entry should have the form:
     *                       { top:      position value,
     *                         left:     position value,
     *                         height:   size value,
     *                         width:    size value }
     *
     *      range       The serialized rangy range that fully defines this
     *                  group within the context of 'content' of the form:
     *                      { start: serialized-start-position,
     *                        end:   serialized-end-position }
     *
     *      content     The jQuery/DOM element OR selector of the overlayed
     *                  content area [ the '.content' sibling of our parent ];
     *
     *      hoverDelta  How much of a delta should be allowed between mouse
     *                  events before calling it a hover [ 2 ];
     */
    _init: function() {
        var self      = this;
        var opts      = this.options;

        if ((opts.range !== null) &&
            (opts.range instanceof rangy.WrappedRange))
        {
            // Serialize the range
            self.wrappedRange = opts.range;
        }

        // Interaction events
        self._widgetInit()
            ._eventsBind();
    },

    /** @brief  Destroy this widget.
     *
     *  @return this for a fluent interface.
     */
    destroy: function() {
        var self    = this;

        if (self._destroyed)    { return; }

        self._eventsUnbind()
            ._widgetClean();

        self.element.empty();

        self._destroyed = true;
        self._trigger('destroyed');

        return self;
    },

    /** @brief  Serialize this group.
     *
     *  @return A serialized version of this group.
     */
    serialize: function() {
        var self        = this;
        var opts        = self.options;

        return opts.range;
    },

    /** @brief  Unserialize this group.
     *  @param  group   The serialized version (from serialize());
     *
     *  @return this for a fluent interface.
     */
    unserialize: function(group) {
        var self    = this;
        var opts    = self.options;

        opts.range = group;

        return this;
    },


    /** @brief  Retrieve the associated control element (if any).
     *
     *  @return The associated control element (or undefined).
     */
    getControl: function() {
        return this.$ctl;
    },

    /** @brief  Refresh after some DOM change that would alter overlay
     *          positioning (i.e. expand/collapse of the content element).
     */
    refresh: function() {
        var self    = this;
        var opts    = self.options;

        /********************************************************************
         * Measure the location of the selection, breaking it into segments
         * according to "lines".
         *
         * Start by locating the absolute offsets into the *text* of the
         * content area, generating measurement elements ($pre, $sel),
         * and extracting the selected *text* (strSel).
         */
        var range       = self.wrappedRange;
        var strFull     = self.$content.text();
        var $start      = $(range.startContainer).parent();
        var $end        = $(range.endContainer).parent();

        // All spans within the content
        var $text       = self.$content.children();

        // All spans BEFORE the startContainer
        var $toStart    = $text.slice(0, $text.index($start) );
        var offsetStart = $toStart.text().length + range.startOffset;

        // All spans BEFORE the endContainer
        var $toEnd      = $text.slice(0, $text.index($end) );
        var offsetEnd   = $toEnd.text().length + range.endOffset;

        // The selected string
        var strSel      = strFull.substr(offsetStart,
                                         (offsetEnd - offsetStart));

        // Elements to measure offsets
        var $pre        = $('<span />')
                            .addClass('text')
                            .css('visibility', 'hidden')
                            .text( strFull.substr(0, offsetStart ) )
                            .appendTo(self.$overlay);
        var $sel        = $('<span />')
                            .addClass('text')
                            .css('visibility', 'hidden')
                            .appendTo(self.$overlay);

        /********************************************************************
         * Split the selected text into words and add each as a separate,
         * measureable element to $sel.
         */
        var re  = /([\w’']+)(\W+)?/i;
        var parts;
        while ( (parts = re.exec(strSel)) )
        {
            // Create elements for the word and word separator.
            $('<span />')
                .text(parts[1])
                .appendTo($sel);

            if (parts[2])
            {
                $('<span />')
                    .text(parts[2])
                    .appendTo($sel);
            }

            // Remove this word and word separator
            strSel = strSel.substr(parts[1].length +
                                   (parts[2] ? parts[2].length : 0));
        }

        /********************************************************************
         * Using our constructed selection measurement element ($sel),
         * generate overlay segments by grouping words based upon their top
         * offsets.  This results in one segment per "line" of text.
         */
        var base        = self.$content.offset();
        var segments    = [];
        var segment;        // Current segment
        var lastOffset;

        $sel.children().each( function() {
            var $word   = $(this);
            var offset  = $word.offset();
            if ( (! lastOffset) || (offset.top !== lastOffset.top))
            {
                // New segment
                if (segment)
                {
                    if ((segment.width < 1) && (segment.height < 1))
                    {
                        /* Remove empty segments -- can happen if a selection
                         * crosses a line boundry.
                         */
                        segments.pop();
                    }
                }

                // Begin the new segment and add it to the list
                segment = {
                    top:    offset.top  - base.top,
                    left:   offset.left - base.left,
                    width:  $word.width(),
                    height: $word.height()
                };

                segments.push( segment );
            }
            else
            {
                // Same "line" -- add the width to the current segment
                segment.width += $word.width();
            }

            lastOffset = offset;
        });

        // Remove our measurement elements
        $pre.remove();
        $sel.remove();

        /* Do NOT remove the rangy selection.  Let our parent do that if needed
         * since a selection MAY be represented by a native selection object in
         * order to ensure we have proper selection coloring (e.g. grey with
         * revered text) without the need to insert disruptive elements.  The
         * generated overlay group elements will be used for hit testing as
         * well as a positining anchor for any overlay controls.
         *
         *  rangy.getSelection().removeAllRanges();
         */
 
        /********************************************************************
         * Create an overlay element for every segment
         *
         * In the process, generate an 'extents' object containing the
         * maximal outer boundaries of the full group.
         */
        self.element.empty();

        var extent  = {
            top:    99999,
            left:   99999,
            bottom: 0,
            right:  0
        };
        $.each(segments, function() {
            var segment = this;

            // Update our extent
            extent.top    = Math.min(extent.top,    segment.top);
            extent.left   = Math.min(extent.left,   segment.left);
            extent.bottom = Math.max(extent.bottom, segment.top +
                                                    segment.height);
            extent.right  = Math.max(extent.right,  segment.left +
                                                    segment.width);

            // Expand the segment slightly to provide a better enclosure
            segment.top  -= 1; segment.height += 2;
            //segment.left -= 2; segment.width  += 4;

            // Create the overly element
            $('<div />') 
                .addClass('text '+ opts.cssClass)
                //.css('position', 'absolute')
                //.css('display',  'block')
                .css( segment )
                .data('contentOverlay-segment', segment)
                .appendTo( self.element );
        });
        opts.extent = extent;

        self.$segments = self.element.children();

        if (self.$ctl)
        {
            // Adjust our control
            var pos     = (self.$segments.length > 0
                                ? self.$segments.position()
                                : self.element.position());

            pos.top -= self.$ctl.height();
            self.$ctl.css( pos );
        }
    },

    /** @brief  Change the type of this overlay group.
     *  @param  type    The overlay type (from $.ui.overlayGroup.types);
     */
    changeType: function(type) {
        var self        = this;
        var opts        = self.options;
        var typeInfo    = $.ui.overlayGroup.types[ type ];
        if (typeInfo === undefined)
        {
            // Invalid type
            return;
        }

        // Change the css class and control template
        self._setOption('cssClass', typeInfo.cssClass);
        self._setOption('template', typeInfo.template);
    },

    /** @brief  Given a mouse event, see if the pointer is within this overlay
     *          group or it's associated overlay control.
     *  @param  e       The mouse event;
     *
     *  @return Hit type ('element', 'control', or null if no hit).
     */
    hitTest: function(e) {
        var self    = this;
        var opts    = self.options;
        var hit     = null;
        var $group  = self.element;

        self.$segments.each(function() {
            var $el     = $(this);
            var segment = $el.data('contentOverlay-segment');
            if (! segment) { return; }

            var right   = segment.left + segment.width;
            var bottom  = segment.top  + segment.height;

            /* Normalize the event's offsetX/offsetY
             * (Firefox will have an undefined offsetX/offsetY,
             *  Chrome  sets offsetX/offsetY to the offset of the event from
             *          the target element).
             */
            var eOffset = {
                x:  (e.offsetX !== undefined
                        ? e.offsetX
                        : e.pageX - $(e.target).offset().left),
                y:  (e.offsetY !== undefined
                        ? e.offsetY
                        : e.pageY - $(e.target).offset().top)
            };

            if (e.offsetX === undefined)
            {
                // Include the normalized offset information in the event
                e.offsetX = eOffset.x;
                e.offsetY = eOffset.y;
            }

            /*
            console.log('ui.overlayGroup::hitTest: '
                          + 'eOffset[ '+ eOffset.x +', '+ eOffset.y +' ], '
                          + 'group[ '+ $group.attr('class') +' ], '
                          + 'segment[ '+ segment.left +', '
                          +              segment.top +' - '
                          +              right +', '
                          +              bottom +' ]');
            // */

            if ((eOffset.x >= segment.left) && (eOffset.x <= right) &&
                (eOffset.y >= segment.top)  && (eOffset.y <= bottom))
            {
                // HIT -- within a segment.
                hit = {
                    type:   'element',
                    $el:    $el,
                    $group: $group
                };
                return false;
            }
        });

        /* If we have an associated control, we need to adjust the control
         * based upon hit or miss.
         */
        if (self.$ctl)
        {
            if (hit === null)
            {
                /* We don't yet have a hit.  See if the event occurred within
                 * our control.
                 */
                var segment     = self.$ctl.offset();
    
                segment.top    -= 2; segment.height = self.$ctl.height() + 4;
                segment.left   -= 2; segment.width  = self.$ctl.width()  + 4;

                right           = segment.left + segment.width;
                bottom          = segment.top  + segment.height;
    
                if ((e.pageX >= segment.left) && (e.pageX <= right) &&
                    (e.pageY >= segment.top)  && (e.pageY <= bottom))
                {
                    // HIT -- within the control
                    hit = {
                        type:   'control',
                        $el:    self.$ctl,
                        $group: $group
                    };
                }
            }

            if (hit !== null)
            {
                // We have a hit on this overlayGroup and we have a control.

                /**************************************************************
                 * This event hit within this group.
                 *
                 */
                if ( // Always squelch (mousemove)
                     (e.type === 'mousemove')                                ||
                     // For 'control', squelch (mousedown, mouseup)
                     ((hit.type === 'control') &&
                      ((e.type  === 'mousedown') || (e.type === 'mouseup'))) )
                {
                    // Squelch all mouse events EXCEPT 'click'
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();

                    /* If this is a mousemove event and the last location was
                     * nearly the same as this AND we haven't triggered a hover
                     * event, trigger one now.
                     */
                    if (! self.hovering)
                    {
                        var last    = self.lastEvent;
                        if (last &&
                            (Math.abs(last.pageX - e.pageX)
                                                    < opts.hoverDelta) &&
                            (Math.abs(last.pageY - e.pageY)
                                                    < opts.hoverDelta) )
                        {
                            // Trigger a hover-in event
                            self.hovering = true;
                            self._trigger('hover-in', e, hit);
                        }
                    }
                }
                else if ((hit.type === 'control') && (e.type === 'click'))
                {
                    /*
                    console.log('ui.overlayGroup::hitTest: '
                                + 'type[ '+ e.type +' ], '
                                + 'target[ '+ $(e.target).attr('class') +' ]');
                    // */

                    /* Trigger a new event on our group that references
                     * the click target
                     */
                    self._trigger('action', null, e.target);

                    // Squelch the current event
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }
                else if (e.type === 'click')
                {
                    // Trigger a new click event on our group.
                    self.element.click();

                    // Squelch the original event
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                }

                self.lastEvent = e;
            }
            else if (self.hovering)
            {
                // Trigger a hover-out
                self._trigger('hover-out', null);

                self.hovering = false;
            }
        }

        return hit;
    },

    /************************
     * "Private" methods
     *
     */

    /** @brief  Override widget._setOption() to handle additional functionality
     *  @param  key     The property being set;
     *  @param  value   The new property value;
     */
    _setOption: function(key, value) {
        var self    = this;
        var opts    = self.options;

        switch (key)
        {
        case 'cssClass':
            self.element
                    .removeClass(opts.cssClass)
                    .addClass( value );
            self.element.children()
                    .removeClass(opts.cssClass)
                    .addClass( value );

            if (self.$ctl)
            {
                self.$ctl.removeClass(opts.cssClass)
                         .addClass( value );
            }
            break;

        case 'template':
            if (self.$ctl)  { self.$ctl.remove(); }

            /* Create a new overlay control element and append it to the
             * content area.
             */
            var pos     = (self.$segments.length > 0
                                ? self.$segments.position()
                                : self.element.position());
            self.$ctl   = $( value )
                            .tmpl()
                            .addClass('overlay-controls '+ opts.cssClass)
                            .hide()
                            .appendTo( self.$content );

            pos.top -= self.$ctl.height();
            self.$ctl.css( pos );

            // Give the group and control knowledge of one another
            self.$ctl.data(   'contentOverlay-group',   self.element);
            self.element.data('contentOverlay-control', self.$ctl);
            break;

        case 'content':
            self.$content = $( value );
            if (self.$ctl)
            {
                // Move the exising controls to the new content area
                self.$ctl.appendTo( self.$content );
            }

            if ((! self.wrappedRange) && (opts.range !== null))
            {
                // Attempt to generate a wrappedRange from opts.range
                var rangeStart,
                    rangeEnd;

                if (opts.range instanceof rangy.WrappedRange)
                {
                    self.wrappedRange = opts.range;
                }
                else if (typeof opts.range === 'string')
                {
                    var re      = /^([0-9\/]+:[0-9]+),([0-9\/]+:[0-9]+)$/;
                    var ranges  = range.match( re );

                    rangeStart  = ranges[1];
                    rangeEnd    = ranges[2];
                }
                else if ($.isPlainObject( opts.range ))
                {
                    /* Allow a range object of the form:
                     *  { start:    serialized-range-string,
                     *    end:      serialized-range-string}
                     */
                    rangeStart = opts.range.start;
                    rangeEnd   = opts.range.end;
                }

                if (rangeStart && rangeEnd)
                {
                    var start   = rangy.deserializePosition(
                                    rangeStart,
                                    self.$content[0]);
                    var end     = rangy.deserializePosition(
                                    rangeEnd,
                                    self.$content[0]);

                    self.wrappedRange = rangy.createRange();

                    self.wrappedRange.setStart(start.node, start.offset);
                    self.wrappedRange.setEnd(end.node, end.offset);
                }
            }

            if (self.wrappedRange)
            {
                // Serialize the range within the context of self.$content
                opts.range = {
                    start:  rangy.serializePosition(
                                            self.wrappedRange.startContainer,
                                            self.wrappedRange.startOffset,
                                            self.$content[0]),
                    end:    rangy.serializePosition(
                                            self.wrappedRange.endContainer,
                                            self.wrappedRange.endOffset,
                                            self.$content[0])
                };
            }

            // (Re)generate our segments
            self.refresh();
            break;
        }

        $.Widget.prototype._setOption.apply( self, arguments );
    },

    /** @brief  Create the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetInit: function() {
        var self    = this;
        var opts    = self.options;

        self.element.addClass('group');
        self.$overlay = self.element.parent();

        /* Ensure our initial options are properly reflected in our operating
         * state by forcing calls to _setOption()
         */
        if (opts.cssClass)  { self._setOption('cssClass', opts.cssClass); }
        if (opts.content)   { self._setOption('content',  opts.content);  }
        if (opts.template)  { self._setOption('template', opts.template); }

        return self;
    },

    /** @brief  Destroy the widget.
     *
     *  @return this for a fluent interface.
     */
    _widgetClean: function() {
        var self    = this;
        var opts    = self.options;

        if (self.$ctl)  { self.$ctl.remove(); }

        self.element
                .removeClass(opts.cssClass)
                .removeClass('group');

        return self;
    },

    /** @brief  Bind any relevant event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsBind: function() {
        var self    = this;
        var opts    = self.options;

        /** @brief  handle a 'hover-in' event triggered on the element of this
         *          widget.
         *  @param  e       The triggered event;
         *  @param  hit     The hit object generated via hitTest() that
         *                  indicates the hit type ('element' | 'control') as
         *                  well as the specific segment element;
         */
        var hoverIn = function(e, hit) {
            /* The overlay control is not currently visible.
             *
             * Show it now positioned near the pointer.
             */
            var ctlHeight   = self.$ctl.height();
            var ctlWidth    = self.$ctl.width();
            var elPos       = hit.$el.position();
            var css         = 'ui-corner-top';
            elPos.bottom    = elPos.top  + hit.$el.height();
            elPos.right     = elPos.left + hit.$el.width();

            var pos         = {
                top:    elPos.top - ctlHeight,
                left:   e.offsetX - (ctlWidth / 2)
            };
            if (pos.left < elPos.left)
            {
                // Ctl will be left of the segment -- adjust
                pos.left = elPos.left;
            }

            var posBottom = pos.top  + ctlHeight;
            var posRight  = pos.left + ctlWidth;
            if (posRight > (elPos.right - 4))
            {
                // Ctl will be right of the segment -- adjust
                pos.left  = elPos.right - ctlWidth - 4;
            }

            /* If we have multiple segments (i.e. multiple lines),
             * see if we should align to the top or bottom.
             */
            if ((self.$segments.length > 1) &&
                (e.offsetY > ((opts.extent.bottom - opts.extent.top) / 2) - 4))
            {
                /* Bottom - Position the control along the bottom of the
                 *          segment
                 */
                pos.top = posBottom + ctlHeight - 2;
                css     = 'ui-corner-bottom';
            }

            // /*
            self.$ctl.css( pos )
                     .removeClass('ui-corner-bottom ui-corner-top')
                     .addClass( css )
                     .show();
            // */
            /*
            self.$ctl.css( 'top',  pos.top )
                     .css( 'left', pos.left )
                     .show();
            // */
        };
        var hoverOut    = function(e) {
            self.$ctl.hide();
        };


        self.element.bind('overlaygroup-hover-in.overlayGroup',  hoverIn);
        self.element.bind('overlaygroup-hover-out.overlayGroup', hoverOut);

        //opts['hover-in']  = hoverIn;
        //opts['hover-out'] = hoverOut;

        return self;
    },

    /** @brief  Unbind any bound event handlers.
     *
     *  @return this for a fluent interface.
     */
    _eventsUnbind: function() {
        var self    = this;

        return self;
    }
});

/* Valid types for addOverlay() along with the associated cssClass to
 * apply to the group as well as a selector for controls to be
 * presented for that group
 */
$.ui.overlayGroup.types = {
    selection:  {
        cssClass:   'selected',
        template:   '#tmpl-overlay-controls'
    },
    tag:        {
        cssClass:   'tagged',
        template:   '#tmpl-overlay-remove-controls'
    },
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

        quickTag:       true,       // Using quick tag?

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
        self.$options   = self.$control.find('.options :checkbox');

        /*********************************************************
         * controls:threshold
         *
         */
        self.$control.find('.buttons .expansion').buttonset();

        /*********************************************************
         * controls:filters
         *
         */
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

        /*********************************************************
         * controls:options
         *
         */
        var globalOpts  = self._getOptions();
        var $quickTag   = self.$options.filter('#options-quickTag');

        $.ui.sentence.options.quickTag = globalOpts.quickTag;

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
            checked:    (! globalOpts.quickTag )
        });


        /*********************************************************
         * Show the initialized control.
         *
         */
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
        if (state)
        {
            opts.threshold.min = state.threshold.min;
            opts.threshold.max = state.threshold.max;
            opts.filter        = state.filter;
            
            self.state         = (state.state ? state.state : []);
        }

        // Renter the XML
        self.renderXml( self.metadata );

        // Find all sentences and bucket them based upon 'rank'
        self.$p     = self.element.find('p');
        self.$s     = self.$p.find('.sentence');
        self.$kws   = self.element.find('.keyword');
        self.ranks  = [];

        /* Instantiate the ui.sentence widgets using any parallel serialized
         * state.
         */
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
                            var $s          = $(this);
                            var rank        = parseFloat($s.attr('rank'));

                            /* If there is one or more <w> element that does
                             * NOT have a 'keyword' attribute, don't create
                             * elements for raw text, just for <w> elements.
                             */
                            var ignoreText  = ($s.find('w:not([keyword])')
                                                                .length > 0);
                            if (isNaN(rank))    { rank = 0; }

                            /* Treat the rank as an integer percentile
                             * (0 ..  100).
                             */
                            rank = parseInt(rank * 100, 10);

                            var $sEl = $('#tmpl-sentence')
                                            .tmpl( {rank: rank} )
                                            .appendTo($p);
                            var $sC  = $sEl.find('.content');

                            /* Mark the sentence with information about whether
                             * it contains ONLY word elements or if text spans
                             * contain multiple words.
                             */
                            $sEl.attr('wordElements', ignoreText);

                            $sEl.find('.rank')
                                    .css('opacity', opts.rankOpacity);

                            // Assemble the HTML from the XML
                            $.each(this.childNodes, function() {
                                var $node   = $(this);
                                switch (this.nodeName)
                                {
                                case '#text':
                                    if (ignoreText === true)
                                    {
                                        // Ignore
                                        return;
                                    }
                                    // Fall through

                                case 'w':
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

    /** @brief  Retrieve global options.
     */
    _getOptions: function() {
        var self    = this;
        var opts    = self.options;
        
        var globalOpts  = $.jStorage.get('options:/');
        if (! globalOpts)
        {
            globalOpts = {
                quickTag:   false
            };
        }

        return globalOpts;
    },

    /** @brief  Store the current global options.
     */
    _putOptions: function(url) {
        var self    = this;
        var opts    = self.options;

        if (self._noPut === true)   { return; }
        
        // Remember the current settings
        var opts   = {
            quickTag:   opts.quickTag
        };
        
        $.jStorage.set('options:/', opts);
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
         * Handle changes to the filter and option controls (triggered
         * by the ui.checkbox widget).
         *
         */
        $gp.delegate('.controls .filter, .controls .options', 'change',
                     function(e, type) {
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

            case 'quickTag':
                /* Since we use the 'quickTag' icon as an indicator, the logic
                 * is a little backwards.  If the checkbox is NOT checked,
                 * we're in 'quick' mode, otherwise, 'normal' mode.
                 */
                opts.quickTag = (! $el.checkbox('val') );
                $.ui.sentence.options.quickTag = opts.quickTag;
                self._putOptions();
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
                /* Notify all following sentences to synchronize their note
                 * positions.
                 */
                self.$s.slice(idex + 1).each(function() {
                    $(this).sentence('syncNotePositions');
                });
                break;

            case 'starred':
            case 'unstarred':
            case 'noteAdded':
            case 'noteRemoved':
            case 'commentAdded':    // Reflected from ui.note via ui.sentence
            case 'commentRemoved':  // Reflected from ui.note via ui.sentence
            case 'commentSaved':    // Reflected from ui.note via ui.sentence
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

        quickTag:       true,       // Using quick tag?

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
        self.$options   = self.$control.find('.options :checkbox');

        /*********************************************************
         * controls:threshold
         *
         */
        self.$control.find('.buttons .expansion').buttonset();

        /*********************************************************
         * controls:filters
         *
         */
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

        /*********************************************************
         * controls:options
         *
         */
        var globalOpts  = self._getOptions();
        var $quickTag   = self.$options.filter('#options-quickTag');

        $.ui.sentence.options.quickTag = globalOpts.quickTag;

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
            checked:    (! globalOpts.quickTag )
        });


        /*********************************************************
         * Show the initialized control.
         *
         */
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
        if (state)
        {
            opts.threshold.min = state.threshold.min;
            opts.threshold.max = state.threshold.max;
            opts.filter        = state.filter;
            
            self.state         = (state.state ? state.state : []);
        }

        // Renter the XML
        self.renderXml( self.metadata );

        // Find all sentences and bucket them based upon 'rank'
        self.$p     = self.element.find('p');
        self.$s     = self.$p.find('.sentence');
        self.$kws   = self.element.find('.keyword');
        self.ranks  = [];

        /* Instantiate the ui.sentence widgets using any parallel serialized
         * state.
         */
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
                            var $s          = $(this);
                            var rank        = parseFloat($s.attr('rank'));

                            /* If there is one or more <w> element that does
                             * NOT have a 'keyword' attribute, don't create
                             * elements for raw text, just for <w> elements.
                             */
                            var ignoreText  = ($s.find('w:not([keyword])')
                                                                .length > 0);
                            if (isNaN(rank))    { rank = 0; }

                            /* Treat the rank as an integer percentile
                             * (0 ..  100).
                             */
                            rank = parseInt(rank * 100, 10);

                            var $sEl = $('#tmpl-sentence')
                                            .tmpl( {rank: rank} )
                                            .appendTo($p);
                            var $sC  = $sEl.find('.content');

                            /* Mark the sentence with information about whether
                             * it contains ONLY word elements or if text spans
                             * contain multiple words.
                             */
                            $sEl.attr('wordElements', ignoreText);

                            $sEl.find('.rank')
                                    .css('opacity', opts.rankOpacity);

                            // Assemble the HTML from the XML
                            $.each(this.childNodes, function() {
                                var $node   = $(this);
                                switch (this.nodeName)
                                {
                                case '#text':
                                    if (ignoreText === true)
                                    {
                                        // Ignore
                                        return;
                                    }
                                    // Fall through

                                case 'w':
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

    /** @brief  Retrieve global options.
     */
    _getOptions: function() {
        var self    = this;
        var opts    = self.options;
        
        var globalOpts  = $.jStorage.get('options:/');
        if (! globalOpts)
        {
            globalOpts = {
                quickTag:   false
            };
        }

        return globalOpts;
    },

    /** @brief  Store the current global options.
     */
    _putOptions: function(url) {
        var self    = this;
        var opts    = self.options;

        if (self._noPut === true)   { return; }
        
        // Remember the current settings
        var opts   = {
            quickTag:   opts.quickTag
        };
        
        $.jStorage.set('options:/', opts);
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
         * Handle changes to the filter and option controls (triggered
         * by the ui.checkbox widget).
         *
         */
        $gp.delegate('.controls .filter, .controls .options', 'change',
                     function(e, type) {
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

            case 'quickTag':
                /* Since we use the 'quickTag' icon as an indicator, the logic
                 * is a little backwards.  If the checkbox is NOT checked,
                 * we're in 'quick' mode, otherwise, 'normal' mode.
                 */
                opts.quickTag = (! $el.checkbox('val') );
                $.ui.sentence.options.quickTag = opts.quickTag;
                self._putOptions();
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
                /* Notify all following sentences to synchronize their note
                 * positions.
                 */
                self.$s.slice(idex + 1).each(function() {
                    $(this).sentence('syncNotePositions');
                });
                break;

            case 'starred':
            case 'unstarred':
            case 'noteAdded':
            case 'noteRemoved':
            case 'commentAdded':    // Reflected from ui.note via ui.sentence
            case 'commentRemoved':  // Reflected from ui.note via ui.sentence
            case 'commentSaved':    // Reflected from ui.note via ui.sentence
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
