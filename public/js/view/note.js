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
    app.View.Note = app.View.Selection.extend({
        viewName:   'Note',
        className:  'note',
        template:   _.template($('#template-note').html()),

        /** @brief  Initialize this view. */
        initialize: function() {
            // Cache the ranges from our model.
            this.ranges     = this.model.get('ranges');
            this.rangeViews = null;

            // Bind to changes to our underlying model
            this.model.bind('destroy', _.bind(this.remove,  this));
            this.model.bind('change',  _.bind(this.refresh, this));

            var comments    = this.model.get('comments');

            comments.bind('add',    _.bind(this._commentAdded,   this));
            comments.bind('remove', _.bind(this._commentRemoved, this));
        },

        /** @brief  Render this view. */
        render: function() {
            var self    = this;

            self.$el = $(self.el);

            /* Allow View.Selection to render our template as well as any range
             * views.
             */
            app.View.Selection.prototype.render.call( self );

            /* Now, perform any additional rendering needed to fully present
             * this not and all associated comments.
             */
            self.$comments = self.$el.find('.note-body');

            self.model.get('comments').each(function(model) {
                /* Invoke the routing that is normally triggered when a new
                 * comment is added.
                 */
                self._commentAdded(model, self.model);
            });

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

        /** @brief  Handle click events on our control element.
         *  @param  e       The triggering event which SHOULD include an
         *                  'originalEvent' that can be used to identify the
         *                  originating target;
         */
        _controlClick: function(e) {
            var self    = this;
            var $el     = $(e.originalEvent.target);
            var name    = $el.attr('name');

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
            var self    = this;

            // Create a new View.Comment to associate with this new model
            var view    = new app.View.Comment({model: comment});
            self.$comments.append( view.render().el );
        },

        /** @brief  A comment has been removed from our underlying model.
         *  @param  comment    The Model.Comment instance being removed;
         *  @param  comments   The containing collection (Model.Comments);
         *  @param  options Any options used with remove();
         */
        _commentRemoved: function(comment, comments, options) {
            var self    = this;

            /* The associated View.Comment instance should notice the deletion
             * of it's underlying model and remove itself.
             */
        }
    });

 }).call(this);
