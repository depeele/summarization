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
        tagName:    'span',
        className:  'sentence',
        template:   _.template($('#template-sentence').html()),

        /* Set the name of the click event that will be fired by
         * app.Helper.click
         */
        clickEvent: 'sentence:click',

        events: {
            'sentence:expand':              'expand',
            'sentence:collapse':            'collapse',
            'sentence:toggle':              'toggle',

            'sentence:expansionExpand':     'expansionExpand',
            'sentence:expansionCollapse':   'expansionCollapse',
            'sentence:expansionToggle':     'expansionToggle',
            'sentence:click':               'expansionToggle'
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
                this.$el.addClass('expanded', app.Option.animSpeed,
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
                this.$el.removeClass('expanded', app.Option.animSpeed,
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

        /** @brief  Expand this sentence as an expansion. */
        expansionExpand: function(e) {
            var self    = this;
            if (! this.$el.hasClass('expansion'))
            {
                this.$el.addClass('expansion', app.Option.animSpeed,
                                  function() {
                    self.$el.trigger('sentence:expansionExpanded');
                });

                // Mark this event as "handled" by stopping its propagation
                if (e)  { e.stopPropagation(); }
            }
        },

        /** @brief  Collapse this sentence expansion. */
        expansionCollapse: function(e) {
            var self    = this;
            if (this.$el.hasClass('expansion'))
            {
                this.$el.removeClass('expansion', app.Option.animSpeed,
                                     function() {
                    self.$el.trigger('sentence:expansionCollapsed');
                });

                // Mark this event as "handled" by stopping its propagation
                if (e)  { e.stopPropagation(); }
            }
        },

        /** @brief  Toggle this sentence iff collapsed to use 'expansion'. */
        expansionToggle: function(e) {
            if (this.$el.hasClass('expanded'))
            {
                // Mark this event as "handled" by stopping its propagation
                if (e)  { e.stopPropagation(); }
                return;
            }

            if (this.$el.hasClass('expansion')) { this.expansionCollapse(e); }
            else                                { this.expansionExpand(e); }
        }
    });

    app.View.Sentence   = Backbone.View.extend( viewPrototype );

 }).call(this);
