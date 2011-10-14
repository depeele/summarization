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
            this.$el = $(this.el);

            /*
            this.$el.bind('sentence:expand',   _.bind(this.expand, this));
            this.$el.bind('sentence:collapse', _.bind(this.collapse, this));
            this.$el.bind('sentence:toggle',   _.bind(this.toggle, this));
            this.$el.bind('click',             _.bind(this.expansionToggle,
                                                      this));
            // */
        },

        /** @brief  (Re)render the contents of the paragraph item. */
        render:     function() {
            var self    = this;
            var rank    = Math.floor( self.model.get('rank') * 100 );

            self.$el.attr('id',   self.model.cid);
            self.$el.attr('rank', rank);
            self.$el.html( self.template( self.model.toJSON() ) );

            // Store a reference to this view instance
            self.$el.data('View:Sentence', self);

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
                this.$el.addClass('expanded', app.options.get('animSpeed'),
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
                this.$el.removeClass('expanded', app.options.get('animSpeed'),
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
                this.$el.addClass('expansion', app.options.get('animSpeed'),
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
                this.$el.removeClass('expansion', app.options.get('animSpeed'),
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
                // Mark this event as "handled"
                if (e) { e.stopPropagation(); }

                return;
            }

            if (this.$el.hasClass('expansion')) { this.expansionCollapse(e); }
            else                                { this.expansionExpand(e); }
        }
    });

 }).call(this);
