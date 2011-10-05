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

    var Backbone    = this.Backbone;
    var User        = this.User;
    if (typeof require !== 'undefined')
    {
        if (!Backbone) { Backbone = require('../backbone.js'); }
        if (!User)
        {
            var tModule = require('./user.js');
            User        = tModule.User;
        }
    }

    this.Comment    = Backbone.Model.extend({
        defaults:   {
            id:         null,
            author:     null,
            text:       '',
            created:    null
        },

        initialize: function(spec) {
            var author  = this.get('author');
            var created = this.get('created');
            if ( ! (author instanceof User) )
            {
                this.set({'author': new User(author)});
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

    this.Comments   = Backbone.Collection.extend({
        model:  this.Comment,

        initialize: function() {
        }
    });

 }).call(this);
