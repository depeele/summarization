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

            'click .buttons button':    '_buttonClick',

            'overlay:position':         'reposition'
        }),

        /** @brief  Initialize this view. */
        initialize: function() {
            var self    = this,
                opts    = self.options;

            /*
            console.log("View::Note:initialize()[%s]:",
                        self.model.cid);
            // */

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

            /*
            console.log("View::Note:render()[%s]:",
                        self.model.cid);
            // */

            self.$el = $(self.el);
            self.$el.attr('id', self.model.cid);
           
            /* Now, perform any additional rendering needed to fully present
             * this note and all associated comments.
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
            self.__focus      = _.bind(self.focus,      self);
            self.__reposition = _.bind(self.reposition, self);
            if ($.isArray(self.rangeViews))
            {
                // Add a click delegate for all range views.
                var events  = 'click.'+ self.viewName;
                $.each(self.rangeViews, function(idex, view) {
                    // Bind to mouse events on this range view
                    $(view.el).delegate('.selected',  events,
                                        self.__focus);

                    $(view.el).bind('overlay:position', self.__reposition);
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

            /*
            console.log("View::Note:remove()[%s]:",
                        self.model.cid);
            // */

            $(document).unbind('click.viewNote', self._docClick);

            if ($.isArray(self.rangeViews))
            {
                // undelegate events we've bound to the range views.
                var events  = 'click.'+ self.viewName;
                $.each(self.rangeViews, function(idex, view) {
                    // Bind to mouse events on this range view
                    $(view.el).undelegate('.selected',  events,
                                          self.__focus);
                    $(view.el).unbind('overlay:position', self.__reposition);
                });
            }

            self.$el.slideUp( app.config.animSpeed, function() {
                self.$buttons.button('destroy');
                app.View.Selection.prototype.remove.call(self);
            });

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

            if (self.$el.hasClass('note-active'))
            {
                // Already actived
                /*
                console.log("View:Note::activate()[%s]: already active",
                            self.model.cid);
                // */

                if ($.isFunction(cb))   { cb.call(self); }
                return self;
            }

            /*
            console.log("View:Note::activate()[%s]", self.model.cid);
            // */

            // Ensure proper reply input/button state by initially blurring
            self.$reply.blur();

            /* NOTE: Popping to the top immediately relies on a z-index set for
             *       .note in both normal and activated states, with the
             *       activated state at a higher z-index.
             */
            var zIndex  = parseInt(self.$el.css('z-index'), 10);
            self.$el
                    .css('z-index', zIndex + 1) // pop to the top immediately...
                    .addClass('note-active', app.config.animSpeed,
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
                opts    = self.options,
                $note   = ( e && (e.type === 'click')
                              ? $(e.target).parents('.note')
                              : [] );

            if ($note[0] === self.$el[0])
            {
                /* This is from a click event that originated within THIS note
                 * and has propagated up to our _docClick handler (established
                 * in initialize()).  Ignore it.
                 */
                /*
                console.log("View:Note::deactivate()[%s]: -- ignore",
                            self.model.cid);
                // */
                return;
            }

            /*
            console.log("View:Note::deactivate()[%s]", self.model.cid);
            // */

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
            self.$el.removeClass('note-active', app.config.animSpeed,
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

            /*
            console.log("View:Note::show()[%s]", self.model.cid);
            // */

            self.$el.fadeIn( app.config.animSpeed, function() {
                self._isVisible = true;
                self.reposition();

                if ($.isFunction(cb))   { cb.apply(self); }
            });

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

            /*
            console.log("View:Note::hide()[%s]", self.model.cid);
            // */

            self.$el.fadeOut( app.config.animSpeed, function() {
                self._isVisible = false;

                if ($.isFunction(cb))   { cb.apply(self); }
            });

            return self;
        },

        /** @brief  Focus on the input area.
         *
         *  @return this    for a fluent interface
         */
        focus: function() {
            var self    = this,
                opts    = self.options;

            /*
            console.log("View:Note::focus()[%s]", self.model.cid);
            // */

            self.$reply.trigger('focus');

            return self;
        },

        /** @brief  Adjust our position.
         *
         *  @return this    for a fluent interface
         */
        reposition: function() {
            var self    = this,
                opts    = self.options;
            
            /*
            console.log("View:Note::reposition()[%s]", self.model.cid);
            // */

            self.$el.position( opts.position );

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

            /*
            console.log("View:Note::editComment()[%s]", self.model.cid);
            // */

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

            /*
            console.log("View:Note::_showControl()[%s]", self.model.cid);
            // */

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

            /*
            console.log("View:Note::_hideControl()[%s]", self.model.cid);
            // */

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

            if (self._isVisible !== true)   { return; }

            if (true)
            {

            // (Re)generate our segments.
            var segments    = self._boundingSegments(true);

            } else {

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

            }

            if (opts.noPositionAnimation === true)
            {
                self.$el.css( 'top', to.top );
            }
            else
            {
                // Only allow one positioning to be in-progress at a time.
                if (self._isPositioning)
                {
                    // Terminate the previous animation.
                    self.$el.stop();

                    self._isPositioning = false;
                }

                // Mark a new position target and begin animation
                self._isPositioning = true;
                self.$el.animate( {top: to.top}, {
                    duration: app.config.animSpeed,
                    complete: function() {
                        self._isPositioning = false;
                    }
                });
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

            /*
            console.log("View:Note::_keyup()[%s]", self.model.cid);
            // */

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

            /*
            console.log("View:Note::_focusChange()[%s]: type[ %s ]",
                        self.model.cid, e.type);
            // */

            switch (e.type)
            {
            case 'focusin':
            case 'focus':
                if (! self.hasFocus())
                {
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
                }
                break;

            case 'focusout':
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

            /*
            console.log("View:Note::_buttonClick()[%s]: type[ %s ]",
                        self.model.cid, e.type);
            // */

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
                    self.model.destroy();
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

            /*
            console.log('View.Note::_controlClick(): '
                        +   'name[ '+ name +' ]');
            // */

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

            /*
            console.log("View:Note::_commentAdded()[%s]",
                        self.model.cid);
            // */

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

            /*
            console.log("View:Note::_commentRemoved()[%s]",
                        self.model.cid);
            // */

            /* The associated View.Comment instance should notice the deletion
             * of it's underlying model and remove itself.
             *
             * If there are no (more) comments, self-destruct!
             */
            if (self.model.commentCount() < 1)
            {
                self.model.destroy();
            }
        },

        /** @brief  Retrieve the bounding segments of the selection.
         *  @param  force   If true, force a re-computation, otherwise, if we
         *                  have cached values, return them;
         *
         *  The bounds of any selection can be defined by 3 contiguous
         *  segments:
         *      +------------------------------------------+
         *      |                                          |
         *      |          +-----------------------------+ |
         *      |          | 1                           | |
         *      | +--------+-----------------------------+ |
         *      | |          2                           | |
         *      | +-------------------------+------------+ |
         *      | |          3              |              |
         *      | +-------------------------+              |
         *      |                                          |
         *      +------------------------------------------+
         *
         *  @return The bounding segments, each in the form:
         *              { top:, right:, bottom:, left: }
         */
        _boundingSegments: function(force) {
            var self            = this;

            if ( (force !== true) && self._cacheSegments)
            {
                return self._cacheSegments;
            }

            /* Wrap the children of our rangeView elements in '.segment'
             * wrappers based upon which elements are within the same parent
             * (and on the same line).
             */
            var segments    = [];
            $.each(self.rangeViews, function() {
                var $range      = $(this.el),
                    $selected   = $range.find('.selected'),
                    base        = $range.offset(),
                    $segment    = $(),
                    segment,
                    lastOffset;

                // Ensure that all our positioning elements are shown
                $range.children().show();

                // Compensate for any padding on '.selected'
                base.top += $selected.position().top;

                $selected.children().each(function() {
                    var $el     = $(this),
                        offset  = $el.offset();
                    if ( (! lastOffset) || (offset.top !== lastOffset.top) )
                    {
                        // New segment
                        if ( segment                &&
                            (segment.width  < 1)    &&
                            (segment.height < 1) )
                        {
                            /* Remove empty segments -- can happen if a
                             * selection crosses a line boundry.
                             */
                            segments.pop();
                        }

                        // Begin a new segment
                        segment = {
                            top:        offset.top  - base.top,
                            left:       offset.left - base.left,
                            width:      $el.width(),
                            height:     $el.height(),
                            $container: $selected,
                            $el:        $()
                        };

                        segments.push( segment );
                    }
                    else
                    {
                        // Same "line" -- add the width to the current segment
                        segment.width += $el.width();
                    }

                    segment.$el = segment.$el.add( $el );

                    lastOffset = offset;

                });

                /* Ensure that positioning elements other than '.selected' are
                 * hidden.
                 */
                $range.find('.before,.after').hide();
            });

            // Now, wrap each segment in a positioned wrapper
            $.each(segments, function() {
                var segment = this;

                $('<span />')
                    .addClass('segment')
                    .css({
                        top:    segment.top,
                        left:   segment.left,
                        width:  segment.width,
                        height: segment.height
                    })
                    .append( segment.$el )
                    .appendTo( segment.$container );
            });

            self._cacheSegments = segments;

            return segments;
        }
    });

 }).call(this);
