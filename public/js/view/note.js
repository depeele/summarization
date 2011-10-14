/** @file
 *
 *  An extension of app.View.Selection that provides a view for a single note.
 *
 *  Requires:
 *      jquery.js
 *      backbone.js
 *      view/selection.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.View)     { app.View  = {}; }

    var $           = jQuery.noConflict();

    /** @brief  A View for a combination of app.Model.Ranges and app.Model.Note
     *          instances.
     *
     *  This View inherits from app.View.Selection.
     *
     *  Set 'model' in the constructor options to establish the Model.Note
     *  instance to use for this view.
     */
    //app.View.Note = $.extend(true, {}, app.View.Selection,
    app.View.Note = app.View.Selection.extend({
        viewName:   'Note',
        className:  'note',
        template:   _.template($('#template-note').html()),

        options:    {
            // Positioning information
            position:   {
                my:     'top',
                at:     'top',
                of:     null,   /* The selector for the element we should sync
                                 * with
                                 * (e.g. the tagged/selected text within a
                                 *       sentence).
                                 */

                using:  null    /* A movement function. Defaults to a custom
                                 * function that works to avoid note
                                 * collisions.
                                 */
            },

            hidden:     false,  // Initially hidden?
        },

        // Make sure we include the events of our super-class
        events: _.extend({}, app.View.Selection.prototype.events, {
            'click':                    'activate',

            'keyup .note-reply':        '_keyup',
            'focus .note-reply':        '_focusChange',
            'blur  .note-reply':        '_focusChange',

            'click .buttons button':    '_buttonClick'
        }),

        /** @brief  Initialize this view. */
        initialize: function() {
            var self    = this,
                opts    = self.options;

            /* Backbone does NOT fully extend options since it uses _.extend()
             * which does NOT provide a deep copy, leaving the contents of
             * 'position' directly connected to the prototype.  We need to
             * extend it manually.
             *
             * If we don't do this, only the first note will be properly
             * positioned.
             */
            opts.position = _.extend({}, opts.position);

            // Invoke our super-class
            app.View.Selection.prototype.initialize.call( self );

            // Cache the ranges from our model.
            self.ranges     = self.model.get('ranges');
            self.rangeViews = null;

            // Bind to changes to our underlying model
            self.model.bind('destroy', _.bind(self.remove,  self));
            self.model.bind('change',  _.bind(self.refresh, self));

            var comments    = self.model.get('comments');

            comments.bind('add',    _.bind(self._commentAdded,   self));
            comments.bind('remove', _.bind(self._commentRemoved, self));

            if (opts.position.using === null)
            {
                opts.position.using = _.bind(self._positioning, self);
            }

            /* Bind to click at the document level.  Generate a bound
             * _docClick() for THIS instance so we can unbind JUST THIS
             * handler when this instance is removed.
             */
            self._docClick = _.bind(self.deactivate, self);
            $(document).bind('click.viewNote', self._docClick);
        },

        /** @brief  Render this view.
         *
         *  @return this    for a fluent interface
         */
        render: function() {
            var self    = this,
                opts    = self.options;

            self.$el = $(self.el);
           
            /* Now, perform any additional rendering needed to fully present
             * this not and all associated comments.
             */
            if (opts.hidden === true)
            {
               self.$el.hide();
            }
 
            /* Allow View.Selection to render our template as well as any range
             * views.
             */
            app.View.Selection.prototype.render.call( self );

            self.$body    = self.$el.find('.note-body');
            self.$reply   = self.$el.find('.note-reply');
            self.$input   = self.$el.find('.note-input-pane');
            self.$buttons = self.$input.find('.buttons button');

            self.$buttons.button(); 

            self.model.get('comments').each(function(model) {
                /* Invoke the routing that is normally triggered when a new
                 * comment is added.
                 */
                self._commentAdded(model, self.model);
            });

            // Add click handlers for the range views to set focus 
            self.__focus = _.bind(self.focus, self);
            if ($.isArray(self.rangeViews))
            {
                /* We're inheriting a "collection" of range views so we need to
                 * delegate events.
                 */
                var events  = 'click.'+ self.viewName;
                $.each(self.rangeViews, function(idex, view) {
                    // Bind to mouse events on this range view
                    $(view.el).delegate('.selected',  events,
                                        self.__focus);
                });
            }

            if (opts.position.of === null)
            {
                opts.position.of = $( _.first(self.rangeViews).el )
                                        .find('.selected');
            }

            if (opts.hidden !== true)
            {
                self.$el.position( opts.position );
            }

            return self;
        },

        /** @brief  Override so we can unbind events bound in initialize().
         */
        remove: function() {
            var self    = this,
                opts    = self.options;

            $(document).unbind('click.viewNote', self._docClick);

            if ($.isArray(self.rangeViews))
            {
                /* We're inheriting a "collection" of range views so we need to
                 * delegate events.
                 */
                var events  = 'click.'+ self.viewName;
                $.each(self.rangeViews, function(idex, view) {
                    // Bind to mouse events on this range view
                    $(view.el).undelegate('.selected',  events,
                                          self.__focus);
                });
            }

            self.$buttons.button('destroy');

            return app.View.Selection.prototype.remove.call(this);
        },

        /** @brief  Refresh our view due to a change to the underlying model.
         *
         *  @return this    for a fluent interface
         */
        refresh: function() {
            var self    = this,
                opts    = self.options;

            return self;
        },

        /** @brief  Mark this instance as 'active'
         *  @param  e       The triggering event.
         *  @param  cb      If a function is provided, invoke this callback
         *                  when the note is fully activated;
         *
         *  @return this    for a fluent interface
         */
        activate: function(e, cb) {
            var self    = this,
                opts    = self.options;

            if (e && (e.type === 'click'))
            {
                // Mark this click as 'handled'
                e.stopPropagation();
            }

            if (self.$el.hasClass('note-active'))
            {
                // Already actived
                if ($.isFunction(cb))   { cb.call(self); }
                return self;
            }

            // Ensure proper reply input/button state by initially blurring
            self.$reply.blur();

            /* NOTE: Popping to the top immediately relies on a z-index set for
             *       .note in both normal and activated states, with the
             *       activated state at a higher z-index.
             */
            var zIndex  = parseInt(self.$el.css('z-index'), 10);
            self.$el
                    .css('z-index', zIndex + 1) // pop to the top immediately...
                    .addClass('note-active', app.Option.animSpeed,
                              function() {
                                // ...then remove the hard z-index and let
                                //    the CSS take over.
                                self.$el.css('z-index', '');

                                if ($.isFunction(cb))   { cb.call(self); }
                    });

            return self;
        },

        /** @brief  Mark this instance as 'inactive'
         *  @param  e       The triggering event.
         *  @param  cb      If a function is provided, invoke this callback
         *                  when the note is fully deactivated;
         *
         *  @return this    for a fluent interface
         */
        deactivate: function(e, cb) {
            var self    = this,
                opts    = self.options;

            if ((! self.$el.hasClass('note-active')) ||
                self.deactivating ||
                self.hasFocus())
            {
                // Already deactived (or has active focus)
                if ($.isFunction(cb))   { cb.call(self); }
                return self;
            }
            self.deactivating = true;

            // Cancel any comment that is currently being edited
            self.$body.find('.comment').trigger('cancel');

            // And close ourselves up
            self.$el.removeClass('note-active', app.Option.animSpeed,
                                 function() {
                                    self.deactivating = false;
                                    if ($.isFunction(cb))   { cb.call(self); }
            });

            return self;
        },

        /** @brief  Show this note container.
         *  @param  cb      If a function is provided, invoke this callback
         *                  when the note is fully presented;
         *
         *  @return this    for a fluent interface
         */
        show: function(cb) {
            var self    = this,
                opts    = self.options;

            self.$el.fadeIn( app.Option.animSpeed, cb )
                    .position( opts.position );

            return self;
        },

        /** @brief  Hide this note container.
         *  @param  cb      If a function is provided, invoke this callback
         *                  when the note is fully hidden;
         *
         *  @return this    for a fluent interface
         */
        hide: function(cb) {
            var self    = this,
                opts    = self.options;

            self.$el.fadeOut( app.Option.animSpeed, cb );

            return self;
        },

        /** @brief  Focus on the input area.
         *
         *  @return this    for a fluent interface
         */
        focus: function() {
            var self    = this,
                opts    = self.options;

            self.$reply.trigger('focus');

            return self;
        },

        /** @brief  Does this note currently have focus?
         *
         *  @return true | false
         */
        hasFocus: function() {
            var self    = this,
                opts    = self.options;

            /* If our $input is hidden, we're currently editing a comment and
             * so vicariously have focus
             */
            return ( self.$input.is(':hidden') ||
                     self.$reply.is(':focus') );
        },

        /** @brief  Activate editing on the targeted comment.
         *  @param  comment     The desired comment (by index) [ 0 ];
         *
         *  @return this    for a fluent interface
         */
        editComment: function(comment) {
            var self        = this,
                opts        = self.options;
                $comment    = self.$body.find('.comment')
                                    .eq( (comment ? comment : 0) );

            if ($comment.length > 0)
            {
                self.activate(undefined, function() {
                    $comment.trigger('comment:edit');
                });
            }

            return self;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Over-ride our super-class so we can also activate the note. 
         *  @param  coords      An object of { x: , y: } coordinates;
         *
         *  @return The offset, or null.
         */
        _showControl: function( coords ) {
            var self    = this;

            //app.View.Selection.prototype._showControl.call( self, coords );
            var res     = app.View.Selection.prototype
                                ._showControl.apply( self, arguments );

            // Activate this note
            self.activate();

            return res;
        },

        /** @brief  Hide the control.
         *
         *  This is a method so sub-classes can override.
         */
        _hideControl: function( ) {
            var self    = this;
            var res     = app.View.Selection.prototype
                                ._hideControl.apply( self, arguments );

            // Deactivate this note
            self.deactivate();

            return res;
        },

        /** @brief  Position animation function.
         *  @param  to      The position we're animating to.
         *
         *  A custom movement function used with $.position() that works to
         *  avoid note collisions.
         *
         *  Position animation can be disabled by setting the
         *  'noPositionAnimation' option to true.
         */
        _positioning: function( to ) {
            var self        = this,
                opts        = self.options;
                myExtent    = self.$el.offset(),
                newTop      = myExtent.top + to.top,
                newBot      = newTop + self.$el.height(),
                myId        = self.$el.attr('id');

            self.$el.parent().find('.note').each(function() {
                var $note   = $(this);
                if (myId === $note.attr('id'))  { return; }

                var pos     = $note.offset(),
                    extent  = {
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

            if (opts.noPositionAnimation === true)
            {
                self.$el.css( 'top', to.top );
            }
            else
            {
                self.$el.animate( {top: to.top}, app.Option.animSpeed );
            }
        },

        /** @brief  Handle 'keyup' within the reply area to
         *          enable/disable the reply button based upon whether the new
         *          content is empty.
         *  @param  e       The triggering event.
         */
        _keyup: function(e) {
            var self    = this,
                opts    = self.options,
                $reply  = self.$buttons.filter('[name=reply]');

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
        },

        /** @brief  Handle 'focus/blur' within the reply area.
         *  @param  e       The triggering event.
         */
        _focusChange: function(e) {
            var self    = this,
                opts    = self.options,
                $reply  = self.$buttons.filter('[name=reply]');

            switch (e.type)
            {
            case 'focusin':
            case 'focus':
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
                self.$buttons.show();
                break;

            case 'blur':
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
                    if (self.model.commentCount() > 0)
                    {
                        self.$buttons.hide();
                    }
                }
                break;
            }
        },

        /** @brief  Handle a button click (reply/cancel) within the input pane.
         *  @param  e       The triggering event.
         */
        _buttonClick: function(e) {
            var self    = this,
                opts    = self.options,
                $button = $(e.target).parent();

            switch ($button.attr('name'))
            {
            case 'reply':
                // Add a new comment
                var comment = new app.Model.Comment({text: self.$reply.val()});
                self.model.addComment(comment);
                self.$reply.val('');
                break;

            case 'cancel-reply':
                self.$reply.val('');
                self.$reply.blur();

                // If there are no (more) comments, self-destruct!
                if (self.model.commentCount() < 1)
                {
                    self.remove();
                }
                break;
            }
        },

        /** @brief  Handle click events on our range-control element.
         *  @param  e       The triggering event which SHOULD include an
         *                  'originalEvent' that can be used to identify the
         *                  originating target;
         */
        _controlClick: function(e) {
            var self    = this,
                opts    = self.options,
                $el     = $(e.originalEvent.target),
                name    = $el.attr('name');

            console.log('View.Note::_controlClick(): '
                        +   'name[ '+ name +' ]');

            switch (name)
            {
            case 'note-remove':
                /* Destroy the underlying note which will trigger a 'destroy'
                 * event on our model (which we're monitoring -- see
                 * initialize()).  This event will cause the invocation of our
                 * remove() method, essentially causing this view to remove
                 * itself.
                 */
                self.model.destroy();
                break;
            }
        },

        /** @brief  A comment has been added to our underlying model.
         *  @param  comment     The Model.Comment instance being added;
         *  @param  comments    The containing collection (Model.Comments);
         *  @param  options Any options used with add();
         */
        _commentAdded: function(comment, comments, options) {
            var self    = this,
                opts    = self.options,
                view    = new app.View.Comment({model: comment});

            self.$body.append( view.render().el );
        },

        /** @brief  A comment has been removed from our underlying model.
         *  @param  comment    The Model.Comment instance being removed;
         *  @param  comments   The containing collection (Model.Comments);
         *  @param  options Any options used with remove();
         */
        _commentRemoved: function(comment, comments, options) {
            var self    = this,
                opts    = self.options;

            /* The associated View.Comment instance should notice the deletion
             * of it's underlying model and remove itself.
             *
             * If there are no (more) comments, self-destruct!
             */
            if (self.model.commentCount() < 1)
            {
                self.remove();
            }
        }
    });

 }).call(this);
