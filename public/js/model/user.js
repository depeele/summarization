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

    var Backbone    = this.Backbone;
    if (!Backbone && (typeof require !== 'undefined'))
    {
        Backbone = require('../backbone.js');
    }

    this.User        = Backbone.Model.extend({
        defaults:   {
            id:         null,
            name:       'anonymous',
            fullName:   'Anonymous',
            avatarUrl:  'images/avatar.jpg'
        },

        // id, name, fullName, avatarUrl
        initialize: function(spec) {
        }
    });

    this.Users       = Backbone.Collection.extend({
        model:  this.User,

        initialize: function() {
        }
    });

 }).call(this);
