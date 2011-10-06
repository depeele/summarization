/** @file
 *
 *  Backbone View for a document.
 *
 *  Requires:
 *      backbone.js
 *      view/section.js
 *      jquery.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app = (this.app || {Model:{}, View:{}});
    var $           = jQuery.noConflict();
    app.View.Doc    = Backbone.View.extend({
        tagName:    'article',
        template:   _.template($('#template-doc').html()),

        initialize: function() {
            this.$el = $(this.el);
        },

        /** @brief  (Re)render the contents of the document item. */
        render:     function() {
            var self    = this;

            self.$el.html( self.template( self.model.toJSON() ) );

            // Append a view of each section
            self.model.get('sections').each(function(model) {
                var view    = new app.View.Section({model:model});

                self.$el.append( view.render().el );
            });

            return self;
        }
    });

 }).call(this);
