/** @file
 *
 *  Backbone View for a range.
 *
 *  Requires:
 *      jquery.js
 *      backbone.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.View)     { app.View  = {}; }

    var $       = jQuery.noConflict();

    /** @brief  A View for a single app.Model.Range
     *
     *  For this version, offsets represent the token index within the target
     *  sentence.
     *
     * Note that we only allow highlighting of '.word', '.ws', and '.punc'
     * atoms (at any level below '.content').
     */
    app.View.Range  = Backbone.View.extend({
        el:         {},     /* Do NOT create an element.  This is really a
                             * pseudo view "overlayed" onto a View.Sentence.
                             */
        tagName:    'span',
        className:  'range',
        atoms:      '.word,.ws,.punc',  // atom selector

        /** @brief  (Re)render the contents of the range item. */
        render:     function() {
            var self    = this,
                opts    = self.options;

            // Locate the target sentence.
            self.$s     = $( '#'+ self.model.get('sentenceId') );
            self.$el    = self.$s.find('.content');

            /******************************************************************
             * Mark all tokens from offsetStart to offsetEnd with
             *
             */
            var end     = self.model.get('offsetEnd'),
                $tokens = self.$el.find( self.atoms ),
                classes = 'range '+ self.className; // ALWAYS include 'range'
            for (var idex = self.model.get('offsetStart'); idex <= end; idex++)
            {
                var $token = $tokens.eq(idex);
                $token.addClass( classes )
                      .data('View:Range', self);
            }

            return self;
        },

        /** @brief  Override so we can destroy the range model since it isn't
         *          needed without the view.
         *  @param  keepModel   if true, do NOT destroy the underlying model;
         */
        remove: function(keepModel) {
            var self    = this;

            if (keepModel !== true) { self.model.destroy(); }

            /******************************************************************
             * Unmark all tokens from offsetStart to offsetEnd with
             *
             */
            var end     = self.model.get('offsetEnd'),
                $tokens = self.$el.find( self.atoms ),
                classes = 'range '+ self.className; // ALWAYS include 'range'
            for (var idex = self.model.get('offsetStart'); idex <= end; idex++)
            {
                var $token = $tokens.eq(idex);
                $token.removeClass( classes )
                      .removeData('View:Range');
            }

            return Backbone.View.prototype.remove.call(self);
        },

        /** @brief  Retrieve the first/starting token in the range.
         *
         *  @return The first/starting token.
         */
        start: function() {
            var self    = this,
                $tokens = self.$el.find( self.atoms ),
                $token  = $tokens.eq( self.model.get('offsetStart') );

            return $token;
        },

        /** @brief  Retrieve the last/ending token in the range.
         *
         *  @return The last/ending token.
         */
        end: function() {
            var self    = this,
                $tokens = self.$el.find( self.atoms ),
                $token  = $tokens.eq( self.model.get('offsetEnd') );

            return $token;
        },

        /** @brief  Retrieve the tokens involved in this range.
         *
         *  @return A set of all tokens involved.
         */
        getElements: function() {
            var self    = this,
                $tokens = self.$el.find( self.atoms ),
                start   = self.model.get('offsetStart'),
                end     = self.model.get('offsetEnd'),
                $res    = $tokens.filter(function(idex) {
                            return ((idex >= start) && (idex <= end));
                          });

            return $res;
        }
    });

 }).call(this);
