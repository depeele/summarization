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

        /** @brief  (Re)render the contents of the range item. */
        render:     function() {
            var self    = this;
            self.$s     = $( '#'+ self.model.get('sentenceId') );

            self.$el = $(this.el);
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

            return self;
        }
    });

 }).call(this);
