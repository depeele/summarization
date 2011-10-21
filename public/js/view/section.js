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

        /** @brief  (Re)render the contents of the section item. */
        render:     function() {
            var self    = this,
                opts    = self.options;

            self.$el         = $(this.el);

            self.$el.data('View:Section', self);

            if (self.model)
            {
                var rank    = Math.floor( self.model.get('rank') * 100 );

                self.$el.attr('data-id',   self.model.cid);
                self.$el.attr('data-type', 'section');
                if (! isNaN(rank))  { self.$el.attr('data-rank', rank); }

                self.$el.html( self.template( self.model.toJSON() ) );

                var $paragraphs = self.$el.find('.paragraphs:first');

                // Append a view of each paragraph
                self.model.get('paragraphs').each(function(model) {
                    var view = new app.View.Paragraph({model:model});

                    $paragraphs.append( view.render().el );
                });
            }
            else
            {
                /* Include the section template and "render" all paragraphs
                 * into the paragraphs container.
                 */
                self.$el.append( self.template() )
                        .addClass( self.className );

                var $paragraphs = self.$el.find('.paragraphs:first');

                self.$el.children('p,[data-type=paragraph]').each(function() {
                    var view    = new app.View.Paragraph({el:this}),
                        $p      = $(view.render().el);

                    $paragraphs.append( $p );
                });
            }

            return self;
        }
    });

 }).call(this);
