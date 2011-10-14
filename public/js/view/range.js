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

    var $           = jQuery.noConflict();

    /** @brief  A View for a single app.Model.Range */
    app.View.Range  = Backbone.View.extend({
        tagName:    'span',
        className:  'range',

        initialize: function() {
        },

        /** @brief  Override so we can destroy the range model since it isn't
         *          needed without the view.
         *  @param  keepModel   if true, do NOT destroy the underlying model;
         */
        remove: function(keepModel) {
            var self    = this;

            if (keepModel !== true) { self.model.destroy(); }

            self.$el.fadeOut( app.options.get('animSpeed'), function() {
                Backbone.View.prototype.remove.call(self);
            });

            return self;
        },

        /** @brief  (Re)render the contents of the range item. */
        render:     function() {
            var self    = this;
            self.$s     = $( '#'+ self.model.get('sentenceId') );

            self.$el = $(this.el);

            // ALWAYS include 'range' as a class
            self.$el.addClass('range');
            self.$el.attr('id', self.model.cid);
            self.$el.empty();

            // Store a reference to this view instance
            self.$el.data('View:Range', self);

            // Locate the content and overlay elements of the target sentence.
            self.$sOverlay = self.$s.find('.overlay');
            self.$sContent = self.$s.find('.content');

            /* Move this element into the overlay area of self.$s.  Needed to
             * ensure that our measurments are within the context of the target
             * sentence.
             */
            self.$sOverlay.append( self.$el );

            /******************************************************************
             * Break the selection into $before, $selected, and $after.
             *
             */
            var strFull     = self.$sContent.text();
            var start       = self.model.get('offsetStart');
            var end         = self.model.get('offsetEnd');
            var strSelection= strFull.substr(start, end - start);

            var $before     = $('<span />')
                                .addClass('before')
                                .text( strFull.substr(0, start) )
                                .appendTo( self.$el );
            var $selected   = $('<span />')
                                .addClass('selected')
                                .text( strFull.substr(start, end - start ) )
                                .appendTo( self.$el );
            var $after      = $('<span />')
                                .addClass('after')
                                .text( strFull.substr(end) )
                                .appendTo( self.$el );

            /* Add measurement elements to the beginning and end of $selected
             * to make it easier for others to determine the edges of this
             * range.  The CSS for .measure should set the display to
             * 'inline-block' and width to '0px'.
             */
            $('<span />')
                .addClass('measure measure-start')
                .text('|')
                .prependTo( $selected );
            $('<span />')
                .addClass('measure measure-end')
                .text('|')
                .appendTo( $selected );

            return self;
        }
    });

 }).call(this);
