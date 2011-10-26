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

        initialize: function() {
            var self    = this,
                author  = self.get('author'),
                created = self.get('created');
            if ( ! (author instanceof app.Model.User) )
            {
                author = new app.Model.User(author);
                self.set({'author': author});
            }

            if ( ! (created instanceof Date) )
            {
                created = (created
                            ? new Date(created)
                            : new Date());

                self.set({'created': created});
            }
        },

        /** @brief  Retrieve an array of hashTags within the text of this
         *          comment.
         *
         *  @return An array of hashTags strings (may be empty).
         */
        getHashtags: function() {
            var self        = this,
                hashTags    = self.get('text').match(/(?:#)([^#\s,;\.]+)/g);

            hashTags = (hashTags === null
                            ? []
                            : hashTags);

            return _.map(hashTags, function(hashTag) {
                        return hashTag.substr(1);
                   });
        },

        /** @brief  Does this comment have any of the given hashTags?
         *  @param  hashTags    An array of hashTag strings;
         *
         *  @return true | false
         */
        hasHashtag: function(hashTags) {
            var self    = this,
                myTags  = self.getHashtags();

            return (myTags.length < 1
                        ? false
                        : _.reduce(hashTags, function(res, hashTag) {
                                return (res || (myTags.indexOf(hashTag) >= 0));
                          }, false, self));
        }
    });

    app.Model.Comments  = Backbone.Collection.extend({
        model:  app.Model.Comment
    });

 }).call(this);
