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
    var app             = this.app = (this.app || {Model:{}, View:{}});
    var $               = jQuery.noConflict();
    app.View.Paragraph  = Backbone.View.extend({
        tagName:    'p',
        template:   _.template($('#template-paragraph').html()),

        events: {
            'paragraph:collapseCheck':              'collapseCheck',
            'sentence:expanded .sentence':          'collapseCheck',
            'sentence:collapsed .sentence':         'collapseCheck',
            'sentence:expansionExpanded .sentence': 'collapseCheck',
            'sentence:expansionCollapsed .sentence':'collapseCheck',

            'paragraph:click':                      'toggle',

            /* Track mouse events to fuse a single click event iff the mouse
             * was IN this paragraph on mousedown AND mouseup/click.
             */
            'mousedown':                            'trackClick',
            'click':                                'trackClick',
            'mouseenter':                           'trackClick',
            'mouseleave':                           'trackClick',
            'dblclick':                             'trackClick'
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

            // Append a view of each paragraph
            self.model.get('sentences').each(function(model) {
                var view = new app.View.Sentence({model:model});

                self.$el.append( view.render().el );
            });

            return self;
        },

        /** @brief  Monitor mouseDown/Up for clicks WITHIN this paragraph. */
        trackClick: function(e) {
            var self    = this;

            switch (e.type)
            {
            case 'mousedown':
                self._clickDown = e;
                break;

            case 'click':
                if (self._clickDown !== null)
                {
                    /* We've seen a mousedown WITHIN this paragraph.  If this
                     * 'up' event is NEAR the 'down' event, it is a potential
                     * click.
                     */
                    var delta   = {
                        x:  Math.abs( self._clickDown.pageX - e.pageX ),
                        y:  Math.abs( self._clickDown.pageY - e.pageY )
                    };

                    if ((delta.x < 10) && (delta.y < 10))
                    {
                        /* In order to avoid squelching double-clicks, wait a
                         * short time to see if there is an additional 'down'
                         * event.
                         */
                        var orig    = self._clickDown;
                        setTimeout(function() {
                            if (orig === self._clickDown)
                            {
                                self.$el.trigger('paragraph:click');
                            }

                            self._clickDown = null;
                        }, 150);
                        return;
                    }
                }

                // Fallthrough to reset the click state

            case 'dblclick':
            case 'mouseenter':
            case 'mouseleave':
                self._clickDown = null;
                break;
            }
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

 }).call(this);
