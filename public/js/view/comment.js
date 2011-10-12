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
    app.View.Comment = app.View.Selection.extend({
        viewName:   'Comment',
        className:  'comment',
        template:   _.template($('#template-comment').html()),

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

            return self;
        },

        /** @brief  Refresh our view due to a change to the underlying model.
         */
        refresh: function() {
            var self    = this;

            return self;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */
    });

 }).call(this);

