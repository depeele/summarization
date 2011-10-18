/** @file
 *
 *  Backbone Model for a user or collection of users.
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

    app.Model.User  = Backbone.Model.extend({
        defaults:   {
            id:         null,
            name:       'anonymous',
            fullName:   'Anonymous',
            avatarUrl:  'images/avatar.jpg'
        }
    });

    app.Model.Users = Backbone.Collection.extend({
        model:  app.Model.User
    });

 }).call(this);
