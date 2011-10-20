/** @file
 *
 *  Backbone Model for user options.
 *
 *  Requires:
 *      backbone.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.Model)    { app.Model = {}; }

    var Backbone    = this.Backbone;
    if (!Backbone && (typeof require !== 'undefined'))
    {
        Backbone = require('../backbone.js');
    }

    app.Model.Options  = Backbone.Model.extend({
        defaults:   {
            id:         null,
            quickTag:   true            // Quick tagging?
        },

        localStorage:   new this.LocalStore( app.config.table.options.name ),
        sync:           this.LocalStore.prototype.sync,

        initialize: function() {
            var self    = this,
                id      = self.get('id');
            
            // Make sure we fetch the actual record if it exists.
            if (id !== null)
            {
                self.fetch({id: id});
            }
        }
    });

 }).call(this);
