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

    // Mix the click helper into this view
    var viewPrototype   = $.extend(true, {}, app.Helper.click, {
        tagName:    'p',
        template:   _.template($('#template-paragraph').html()),

        /* Set the name of the click event that will be fired by
         * app.Helper.click
         */
        clickEvent: 'paragraph:click',

        events: {
            'paragraph:collapseCheck':              'collapseCheck',
            'sentence:expanded .sentence':          'collapseCheck',
            'sentence:collapsed .sentence':         'collapseCheck',
            'sentence:expansionExpanded .sentence': 'collapseCheck',
            'sentence:expansionCollapsed .sentence':'collapseCheck',

            'paragraph:click':                      'toggle'
        },

        initialize: function() {
            this.$el        = $(this.el);
        },

        /** @brief  (Re)render the contents of the paragraph item. */
        render:     function() {
            var self    = this;
            var rank    = Math.floor( self.model.get('rank') * 100 );

            self.$el.attr('id',   self.model.cid);
            self.$el.attr('rank', rank);
            self.$el.html( self.template( self.model.toJSON() ) );

            // Store a reference to this view instance
            self.$el.data('View:Paragraph', self);

            self.$sentences = self.$el.find('.sentences:first');

            // Append a view of each paragraph
            self.model.get('sentences').each(function(model) {
                var view = new app.View.Sentence({model:model});

                self.$sentences.append( view.render().el );
            });

            return self;
        },

        /** @brief  Toggle un-expanded sentences as expansions. */
        toggle: function() {
            var self    = this;
            var $s      = self.$el.find('.sentence:not(.expanded)');
            if ($s.filter('.expansion').length > 0)
            {
                // Some are expansions, collapse all
                $s.trigger('sentence:expansionCollapse');
            }
            else
            {
                // There are no expansions, expand all
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

    app.View.Paragraph  = Backbone.View.extend( viewPrototype );

 }).call(this);
