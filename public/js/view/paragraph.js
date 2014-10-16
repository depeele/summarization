/** @file
 *
 *  Backbone View for a paragraph.
 *
 *  Requires:
 *      backbone.js
 *      model/paragraph.js
 *      view/paragraph.js
 *      jquery.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.View)     { app.View  = {}; }

    var $               = jQuery.noConflict();

    app.View.Paragraph  = Backbone.View.extend( {
        tagName:    'p',
        template:   _.template($('#template-paragraph').html()),

        events: {
            'paragraph:collapseCheck':              'collapseCheck',
            'sentence:expanded .sentence':          'collapseCheck',
            'sentence:collapsed .sentence':         'collapseCheck',
            'sentence:expansionExpanded .sentence': 'collapseCheck',
            'sentence:expansionCollapsed .sentence':'collapseCheck',

            'click':                                'toggle'
        },

        /** (Re)render our template with the provided data.
         *  @method renderTemplate
         *  @param  data    The data with which to render {Object};
         *
         *  @return The rendered HTML {String};
         */
        renderTemplate: function(data) {
            var self    = this,
                html;

            try {
                html = self.template( data );
            } catch(e) {
                html = "<div class='error'>View.Paragraph: Error rendering: "
                     + e +"</div>";
            }

            return html;
        },

        /** @brief  (Re)render the contents of the paragraph item. */
        render:     function() {
            var self    = this,
                opts    = self.options;

            self.$el        = $(this.el);

            self.$el.data('View:Paragraph', self);

            if (self.model)
            {
                var rank    = Math.floor( self.model.get('rank') * 100 );

                self.$el.attr('data-id',   self.model.cid);
                self.$el.attr('data-type', 'paragraph');
                if (! isNaN(rank))  { self.$el.attr('data-rank', rank); }

                self.$el.html( self.renderTemplate( self.model.toJSON() ) );

                var $sentences  = self.$el.find('.sentences:first');

                // Append a view of each paragraph
                self.model.get('sentences').each(function(model) {
                    var view = new app.View.Sentence({model:model});

                    $sentences.append( view.render().el );
                });
            }
            else
            {
                /* Include the paragraph template and "render" all paragraphs
                 * into the paragraphs container.
                 */
                self.$el.append( self.renderTemplate() )
                        .addClass( self.className );

                var $sentences  = self.$el.find('.paragraphs:first');

                self.$el.children('.sentence,[data-type=sentence]').each(
                                  function() {
                    var view    = new app.View.Sentence({el:this}),
                        $s      = $(view.render().el);

                    $sentences.append( $s );
                });
            }

            return self;
        },

        /** @brief  Toggle un-expanded sentences as expansions.
         *  @param  e   The triggering event;
         */
        toggle: function(e) {
            var self    = this,
                $s      = $(e.target);

            if (! $s.hasClass('sentence'))  { $s = $s.parents('.sentence'); }

            if ($s.hasClass('expanded'))
            {
                // Ignore clicks within an expanded sentence.
                return;
            }

            /* This was NOT a click on an expanded sentence so grab all
             * sentences that are NOT 'expanded'
             */
            $s = self.$el.find('.sentence:not(.expanded)');
            if ($s.filter('.expansion').length > 0)
            {
                // There are some sentences that are expansions -- collapse all
                $s.trigger('sentence:expansionCollapse');
            }
            else
            {
                // There are no sentences that are expansions -- expand all
                $s.trigger('sentence:expansionExpand');
            }

            self.collapseCheck();
        },

        /** @brief  Check to see whether we have any expanded sentences. */
        collapseCheck: function() {
            var $s  = this.$el.find('.sentence.expanded,.sentence.expansion');
            if ($s.length > 0)
            {
                // Yes - there is at least one
                this.$el.removeClass('collapsed');
            }
            else
            {
                // No - collapse this paragraph
                this.$el.addClass('collapsed');
            }
        }
    });

 }).call(this);
