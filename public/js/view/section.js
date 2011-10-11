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
    var app         = this.app || (module ? module.exports : this);
    if (! app.View)     { app.View  = {}; }

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

            self.$el.attr('id',   self.model.cid);
            self.$el.attr('rank', rank);
            self.$el.html( self.template( self.model.toJSON() ) );

            // Store a reference to this view instance
            self.$el.data('View:Section', self);

            self.$paragraphs = self.$el.find('.paragraphs:first');

            // Append a view of each paragraph
            self.model.get('paragraphs').each(function(model) {
                var view = new app.View.Paragraph({model:model});

                self.$paragraphs.append( view.render().el );
            });

            return self;
        }
    });

 }).call(this);
