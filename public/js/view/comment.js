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
            'click .buttons button':    '_buttonClick',

            'comment:edit':             '_edit',
            'comment:delete':           '_destroy',
            'comment:save':             '_save',
            'comment:cancel':           '_cancelEdit'
        },

        /** @brief  Initialize this view. */
        initialize: function() {
            // Bind to changes to our underlying model
            this.model.bind('destroy', _.bind(this.remove,  this));
            this.model.bind('change',  _.bind(this.refresh, this));
        },

        /** @brief  Render this view. */
        render: function() {
            var self    = this;

            self.$el = $(self.el);
            self.$el.attr('id', self.model.cid);
            self.$el.html( self.template( self.model.toJSON() ) );

            // Store a reference to this view instance
            self.$el.data('View:Doc', self);

            self.$created     = self.$el.find('.created');
            self.$text        = self.$el.find('.text');
            self.$editArea    = self.$el.find('.edit');
            self.$edit        = self.$editArea.find('textarea');
            self.$buttons     = self.$el.find('.buttons button');
            self.$mainButtons = self.$el.find('.buttons:last');

            self.$buttons.button();

            return self;
        },

        /** @brief  Override so we can properly destruct.
         */
        remove: function() {
            var self    = this,
                opts    = self.options;

            $(document).unbind('.viewNote');

            self.$el.slideUp(function() {
                self.$buttons.button('destroy');

                Backbone.View.prototype.remove.call(self);
            });
        },

        /** @brief  Refresh our view due to a change to the underlying model.
         */
        refresh: function() {
            var self    = this;

            self.$created.text( $.prettyDate(self.model.get('created')) );
            self.$text.text( self.model.get('text') );

            return self;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Put this comment in edit mode.
         *  @param  e   The triggering event;
         *
         */
        _edit: function(e) {
            var self    = this,
                opts    = self.options;

            if (self.editing)   { return self; }
            self.editing = true;

            self.$text.hide( );
            self.$mainButtons.hide( );

            self.$edit.val( self.$text.text() );
            self.$editArea.show();
            self.$edit.focus();

            return self;
        },

        /** @brief  Destroy the underlying model (and thus this instance).
         *  @param  e   The triggering event;
         *
         *  @return this    for a fluent interface;
         */
        _destroy: function(e) {
            var self    = this,
                opts    = self.options;

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

            if (! self.editing) { return self; }
            self.editing = false;

            self.$editArea.hide();
            self.$text.show( );

            /* Note: Do NOT use show() -- it will add a direct style setting
             *       which will override any CSS rules.  We simply want to
             *       remove the 'display:none' style added by .hide() in
             *       edit().
             */
            self.$mainButtons.css('display', '');

            return self;
        },

        /** @brief  Handle 'keyup' within the edit area.
         *  @param  e       The triggering event.
         */
        _keyup: function(e) {
            var self    = this,
                opts    = self.options;

            // Special keys
            switch (e.keyCode)
            {
            case $.ui.keyCode.ESCAPE:   // 27
                self._cancelEdit();
                break;
            }
        },

        /** @brief  Handle a button click (save/cancel).
         *  @param  e       The triggering event.
         */
        _buttonClick: function(e) {
            var self    = this,
                opts    = self.options,
                $button = $(e.target).parent();

            switch ($button.attr('name'))
            {
            case 'edit':
                self._edit();
                break;

            case 'delete':
                self._destroy();
                break;

            case 'save':
                self._save();
                break;

            case 'cancel-edit':
                self._cancelEdit();
                break;
            }
        },

    });

 }).call(this);

