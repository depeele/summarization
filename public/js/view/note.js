/** @file
 *
 *  An extension of app.View.Selection that provides a view for a single note.
 *
 *  Requires:
 *      jquery.js
 *      backbone.js
 *      view/selection.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.View)     { app.View  = {}; }

    var $           = jQuery.noConflict();

    /** @brief  A View for a app.Model.Ranges instance. */
    app.View.Note = app.View.Selection.extend({
        viewName:   'Note',
        className:  'note',
        template:   _.template($('#template-note').html()),

        render: function() {
            var self    = this;

            app.View.Selection.prototype.render.call( self );

            return self;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Handle control:click events.
         *  @param  e       The triggering event which SHOULD include an
         *                  'originalEvent' that can be used to identify the
         *                  originating target;
         */
        _controlClick: function(e) {
            var self    = this;
            var $el     = $(e.originalEvent.target);
            var name    = $el.attr('name');

            console.log('View.Note::_controlClick(): '
                        +   'name[ '+ name +' ]');

            switch (name)
            {
            case 'note-add':
                // :TODO: Convert this Selection view to a Note view.
                break;
            }
        }
    });

 }).call(this);
