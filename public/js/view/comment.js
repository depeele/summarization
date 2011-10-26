/** @file
 *
 *  Backbone View for a single comment.
 *
 *  Requires:
 *      jquery.js
 *      backbone.js
 *      view/comment.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.View)     { app.View  = {}; }

    var $           = jQuery.noConflict();

    /** @brief  A View for a single app.Model.Comment instance.
     *
     *  Set 'model' in the constructor options to establish the Model.Comment
     *  instance to use for this view.
     */
    app.View.Comment = Backbone.View.extend({
        className:  'comment',
        template:   _.template($('#template-comment').html()),

        events: {
            'cancel':                   '_cancelEdit',

            'keyup .edit':              '_keyup',
            'focus .edit':              '_focusChange',
            'blur  .edit':              '_focusChange',

            'click .buttons button':    '_buttonClick',

            'comment:edit':             '_edit',
            'comment:delete':           '_destroy',
            'comment:save':             '_save',
            'comment:cancel':           '_cancelEdit'
        },

        /** @brief  Initialize this view. */
        initialize: function() {
            var self    = this;

            // Bind to changes to our underlying model
            self.__destroy = _.bind(self.remove,  self);
            self.__change  = _.bind(self.refresh, self);

            self.model.bind('destroy', self.__destroy);
            self.model.bind('change',  self.__change);
        },

        /** @brief  Render this view. */
        render: function() {
            var self    = this;

            self.$el = $(self.el);
            self.$el.attr('id', self.model.cid);
            self.$el.html( self.template( self.model.toJSON() ) );

            // Store a reference to this view instance
            self.$el.data('View:Comment', self);

            self.$created     = self.$el.find('.created');
            self.$text        = self.$el.find('.text');
            self.$editArea    = self.$el.find('.edit');
            self.$edit        = self.$editArea.find('textarea');
            self.$buttons     = self.$el.find('.buttons button');

            self.$editButtons = self.$el.find('.buttons.editing');
            self.$viewButtons = self.$el.find('.buttons.viewing');

            self.$buttons.button();

            return self;
        },

        /** @brief  Override so we can properly destruct.
         */
        remove: function() {
            var self    = this,
                opts    = self.options;

            self.model.unbind('destroy', self.__destroy);
            self.model.unbind('change',  self.__change);

            self.$el.slideUp(function() {
                self.$buttons.button('destroy');

                Backbone.View.prototype.remove.call(self);
            });
        },

        /** @brief  Refresh our view due to a change to the underlying model.
         */
        refresh: function() {
            var self    = this;

            /*
            console.log("View:Comment::refresh()[%s]",
                        self.model.cid);
            // */

            self.$created.text( $.prettyDate(self.model.get('created')) );
            self.$text.text( self.model.get('text') );

            return self;
        },

        /** @brief  Is this comment currently being edited?
         *
         *  @return true | false
         */
        isEditing: function() {
            var self    = this;

            return self._editing;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Focus on the edit area.
         *  @param  e   The triggering event;
         *
         */
        _focus: function(e) {
            var self    = this,
                opts    = self.options;

            if (! self._editing) { return self; }
            
            /*
            console.log("View:Comment::_focus()[%s]",
                        self.model.cid);
            // */

            self.$edit.focus();
        },

        /** @brief  Put this comment in edit mode.
         *  @param  e   The triggering event;
         *
         */
        _edit: function(e) {
            var self    = this,
                opts    = self.options;

            if (self._editing)  { return self; }

            /*
            console.log("View:Comment::_edit()[%s]",
                        self.model.cid);
            // */

            self._editing = true;

            self.$edit.val( self.$text.text() );

            self.$text.hide( );
            self.$editArea.show();

            /* We use CSS and inherent z-index to hide/present the edit
             * buttons, which SHOULD occur BEFORE the view buttons in the HTML.
             */
            self.$viewButtons.hide( );
            //self.$editButtons.show( );

            return self._focus(e);
        },

        /** @brief  Destroy the underlying model (and thus this instance).
         *  @param  e   The triggering event;
         *
         *  @return this    for a fluent interface;
         */
        _destroy: function(e) {
            var self    = this,
                opts    = self.options;

            /*
            console.log("View:Comment::_destroy()[%s]",
                        self.model.cid);
            // */

            self.model.destroy();

            return self;
        },

        /** @brief  Save any changes and cancel edit mode.
         *  @param  e   The triggering event;
         *
         *  @return this    for a fluent interface;
         */
        _save: function(e) {
            var self    = this,
                opts    = self.options;

            /*
            console.log("View:Comment::_save()[%s]",
                        self.model.cid);
            // */

            self.model.set( {text: self.$edit.val()} );

            // Cancel the edit
            self._cancelEdit();

            return self;
        },

        /** @brief  If we're in edit mode, cancel the edit.
         *  @param  e   The triggering event;
         *
         *  @return this    for a fluent interface;
         */
        _cancelEdit: function(e) {
            var self    = this,
                opts    = self.options;

            if (! self._editing)    { return self; }

            /*
            console.log("View:Comment::_cancelEdit()[%s]",
                        self.model.cid);
            // */

            self._editing = false;

            self.$editArea.hide();
            self.$text.show( );

            /* We use CSS and inherent z-index to hide/present the edit
             * buttons, which SHOULD occur BEFORE the view buttons in the HTML.
             *
             * Because of this, do NOT use self.$viewButtons.show() since it
             * will add direct styling which will override our CSS rules.  We
             * simply want to remove the 'display:none' direct style added by
             * .hide() in _edit().
             */
            //self.$editButtons.hide();
            self.$viewButtons.css('display', '');

            return self;
        },

        /** @brief  Handle 'keyup' within the edit area.
         *  @param  e       The triggering event.
         */
        _keyup: function(e) {
            var self    = this,
                opts    = self.options,
                $save   = self.$buttons.filter('[name=save]');

            // Special keys
            switch (e.keyCode)
            {
            case $.ui.keyCode.ESCAPE:   // 27
                self._cancelEdit();
                break;
            }

            // If the current value differs from the model, enable save.
            var valEdit = self.$edit.val(),
                valCur  = self.model.get('text');
            if ( self._editing          && 
                 (valEdit.length > 0)       &&
                 (valEdit !== valCur) )
            {
                $save.button('enable');
            }
            else
            {
                $save.button('disable');
            }
        },

        /** @brief  Handle 'focus/blur' within the edit area.
         *  @param  e       The triggering event.
         */
        _focusChange: function(e) {
            var self    = this,
                opts    = self.options,
                $save   = self.$buttons.filter('[name=save]'),
                valEdit = self.$edit.val(),
                valCur  = self.model.get('text');

            switch (e.type)
            {
            case 'focusin':
            case 'focus':
                /*
                console.log("View:Comment::_focusChange()[%s]: type[ %s ]",
                            self.model.cid, e.type);
                // */
                if ( (valEdit.length > 0) && (valEdit !== valCur) )
                {
                    $save.button('enable');
                }
                else
                {
                    $save.button('disable');
                }
                break;

            case 'focusout':
            case 'blur':
                if ( (valEdit.length > 0) && (valEdit !== valCur) )
                {
                    // Leave the save/cancel buttons visible
                }
                else
                {
                    // cancel editing
                    self._cancelEdit();
                }
                break;
            }
        },


        /** @brief  Handle a button click (save/cancel).
         *  @param  e       The triggering event.
         */
        _buttonClick: function(e) {
            var self    = this,
                opts    = self.options,
                $button = $(e.target);
            
            if (! $button.is('button'))
            {
                $button = $button.parents('button:first');
            }

            /*
            console.log("View:Comment::_buttonClick()[%s]: button[ %s ]",
                        self.model.cid,
                        $button.attr('name'));
            // */

            switch ($button.attr('name'))
            {
            case 'edit':
                self._edit(e);
                break;

            case 'delete':
                self._destroy(e);
                break;

            case 'save':
                self._save(e);
                break;

            case 'cancel-edit':
                self._cancelEdit(e);
                break;
            }
        },

    });

 }).call(this);
