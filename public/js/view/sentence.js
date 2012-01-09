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
    app.View.Sentence   = Backbone.View.extend( {
        tagName:    'span',
        className:  'sentence',
        template:   _.template($('#template-sentence').html()),

        /* This selector determines which elements will be given a CSS class
         * corresponding to the 'data-type' value.
         *
         * NOTE: If this is an array, it will be reduced to a comma-separated
         *       string in initialize().
         */
        atoms:      [ '[data-type=keyphrase]',
                      '[data-type=word]',
                      '[data-type=ws]',
                      '[date-type=punc]' ],

        events: {
            'sentence:expand':              'expand',
            'sentence:collapse':            'collapse',
            'sentence:toggle':              'toggle',

            'sentence:expansionExpand':     'expansionExpand',
            'sentence:expansionCollapse':   'expansionCollapse',
            'sentence:expansionToggle':     'expansionToggle',

            'click':                        'expansionToggle'
        },

        initialize: function() {
            var self    = this;

            if (_.isArray(self.atoms))
            {
                self.atoms = self.atoms.join(',');
            }
        },

        /** @brief  (Re)render the contents of the paragraph item. */
        render:     function() {
            var self    = this,
                opts    = self.options;

            self.$el    = $(this.el);

            self.$el.data('View:Sentence', self);

            if (self.model)
            {
                var rank    = Math.floor( self.model.get('rank') * 100 );

                self.$el.attr('data-id',   self.model.cid);
                self.$el.attr('data-type', 'sentence');
                if (! isNaN(rank))  { self.$el.attr('data-rank', rank); }

                self.$el.html( self.template( self.model.toJSON() ) );
            }
            else
            {
                /* Modify the rendering for this sentence to conform to our
                 * template.
                 *
                 * In general, add a CSS class to each atom of the type:
                 *      sentence, word, ws, punc
                 */
                var data        = {
                        id:     self.$el.data('id'),
                        rank:   self.$el.data('rank'),
                        tokens: []
                    },
                    $el         = $( self.template( data ) );

                // First, make sure each atom has an appropriate CSS class
                self.$el.find( self.atoms ).each(function() {
                    var $token  = $(this),
                        type    = $token.data('type');

                    $token.addClass( type );
                });

                /* Now, detach the top-level children and append them, in
                 * order, to our generated view.
                 */
                $el.filter('.content').append( self.$el.children().detach() );

                self.$el.empty()
                        .addClass( self.className )
                        .append( $el );
            }

            return self;
        },

        /*****************************************************
         * Theshold-based visibility expansions.
         *
         */

        /** @brief  Expand this sentence. */
        expand: function(e) {
            var self    = this;
            if (! this.$el.hasClass('expanded'))
            {
                this.$el.addClass('expanded', app.config.animSpeed,
                                  function() {
                    self.$el.trigger('sentence:expanded');
                });
            }
        },

        /** @brief  Collapse this sentence. */
        collapse: function(e) {
            var self    = this;
            if (this.$el.hasClass('expanded'))
            {
                this.$el.removeClass('expanded', app.config.animSpeed,
                                     function() {
                    self.$el.trigger('sentence:collapsed');
                });
            }
        },

        /** @brief  Toggle this sentence expand/collapse. */
        toggle: function(e) {
            if (this.$el.hasClass('expanded'))  { this.collapse(e); }
            else                                { this.expand(e); }
        },

        /*****************************************************
         * Temporary expansions due to user interaction.
         *
         */

        /** @brief  Expand this sentence as an expansion.
         *  @param  e   The triggering event;
         */
        expansionExpand: function(e) {
            var self    = this;
            if (! this.$el.hasClass('expansion'))
            {
                this.$el.addClass('expansion', app.config.animSpeed,
                                  function() {
                    self.$el.trigger('sentence:expansionExpanded');
                });

                // Mark this event as "handled"
                if (e) { e.stopPropagation(); }
            }
        },

        /** @brief  Collapse this sentence expansion.
         *  @param  e   The triggering event;
         */
        expansionCollapse: function(e) {
            var self    = this;
            if (this.$el.hasClass('expansion'))
            {
                this.$el.removeClass('expansion', app.config.animSpeed,
                                     function() {
                    self.$el.trigger('sentence:expansionCollapsed');
                });

                // Mark this event as "handled"
                if (e) { e.stopPropagation(); }
            }
        },

        /** @brief  Toggle this sentence iff collapsed to use 'expansion'.
         *  @param  e   The triggering event;
         */
        expansionToggle: function(e) {
            if (this.$el.hasClass('expanded'))
            {
                // Ignore a click in this expanded sentence.
                return;
            }

            if (this.$el.hasClass('expansion')) { this.expansionCollapse(e); }
            else                                { this.expansionExpand(e); }
        }
    });

 }).call(this);
