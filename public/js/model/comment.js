/** @file
 *
 *  Backbone Model for a comment or collection of comments.
 *
 *  Requires:
 *      backbone.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.Model)    { app.Model = {}; }

    var _           = this._;
    var Backbone    = this.Backbone;
    if (typeof require !== 'undefined')
    {
        if (!_)        { _        = require('../underscore.js'); }
        if (!Backbone) { Backbone = require('../backbone.js'); }
        if (!app.Model.User)
        {
            var tModule     = require('./user.js');
            _.extend(app, tModule);
        }
    }

    app.Model.Comment   = Backbone.Model.extend({
        defaults:   {
            id:         null,
            author:     null,
            text:       '',
            created:    null
        },

        initialize: function(spec) {
            var author  = this.get('author');
            var created = this.get('created');
            if ( ! (author instanceof app.Model.User) )
            {
                this.set({'author': new app.Model.User(author)});
            }

            if ( ! (created instanceof Date) )
            {
                created = (created
                            ? new Date(created)
                            : new Date());

                this.set({'created': created});
            }
        }
    });

    app.Model.Comments  = Backbone.Collection.extend({
        model:  app.Model.Comment,

        initialize: function() {
        }
    });

 }).call(this);
