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
    app.View.Range  = Backbone.View.extend({
        tagName:    'div',
        template:   _.template($('#template-range').html()),

        initialize: function() {
            this.$el = $(this.el);
        },

        /** @brief  (Re)render the contents of the range item. */
        render:     function() {
            var self    = this;
            var $s      = $( self.model.get('sentenceId') );

            self.$el.attr('id', self.model.cid);
            self.$el.html( self.template( self.model.toJSON() ) );

            // :TODO: Move this element into the overlay area of $s.

            return self;
        }
    });

 }).call(this);
