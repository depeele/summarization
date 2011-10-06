/** @file
 *
 *  Backbone View for a section.
 *
 *  Requires:
 *      backbone.js
 *      view/paragraph.js
 *      jquery.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app             = this.app = (this.app || {Model:{}, View:{}});
    var $               = jQuery.noConflict();
    app.View.Section    = Backbone.View.extend({
        tagName:    'section',
        template:   _.template($('#template-section').html()),

        initialize: function() {
            this.$el = $(this.el);
        },

        /** @brief  (Re)render the contents of the section item. */
        render:     function() {
            var self    = this;
            var rank    = Math.floor( self.model.get('rank') * 100 );

            self.$el.attr('rank', rank);
            self.$el.html( self.template( self.model.toJSON() ) );

            // Append a view of each paragraph
            self.model.get('paragraphs').each(function(model) {
                var view = new app.View.Paragraph({model:model});

                self.$el.append( view.render().el );
            });

            return self;
        }
    });

 }).call(this);
