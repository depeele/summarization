/** @file
 *
 *  Backbone Model for a note or collection of notes.
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
        if (!app.Model.Comments)
        {
            var tModule = require('./comment.js');
            _.extend(app, tModule);
        }

        if (!app.Model.Ranges)
        {
            var tModule = require('./range.js');
            _.extend(app, tModule);
        }
    }

    app.Model.Note  = Backbone.Model.extend({
        defaults: {
            id:         null,
            docId:      null,   /* The url of the document with which this note
                                 * is associated.
                                 */
            ranges:     null,

            // Comments associated with this note
            comments:   null
        },

        localStorage:   new this.LocalStore( app.config.table.notes.name ),
        sync:           this.LocalStore.prototype.sync,

        initialize: function() {
            var self    = this,
                id      = self.get('id');
            
            // Make sure we fetch the actual record if it exists.
            if (id !== null)
            {
                self.fetch({id: id});
            }

            var comments    = self.get('comments'),
                ranges      = self.get('ranges');
            if ((! comments) || ! (comments instanceof app.Model.Comments))
            {
                comments = new app.Model.Comments( comments );
                self.set({comments: comments});
            }

            if ((! ranges) || ! (ranges instanceof app.Model.Ranges))
            {
                ranges = new app.Model.Ranges(ranges);
                self.set({ranges: ranges});
            }

            // Bind to changes to comments
            comments.bind('all', _.bind(self._commentsProxy, self));
        },

        /** @brief  Retrieve the count of comments.
         *  
         *  @return The count of comments.
         */
        commentCount: function() {
            return this.get('comments').length;
        },

        /** @brief  Add a new comment to this note.
         *  @param  comment     The new Model.Comment instance to add.
         */
        addComment: function(comment) {
            var self        = this,
                comments    = self.get('comments');

            /*
            console.log("Model:Note::addComment()[%s]: comment[ %s ]",
                        self.cid, comment.cid);
            // */

            comments.add( comment );
        },

        /** @brief  Retrieve all hash tags from the comments of this note.
         *
         *  @return An array of hashTag strings (may be empty).
         */
        getHashtags: function() {
            var self        = this,
                comments    = self.get('comments'),
                hashTags    = [];
        
            comments.each(function(comment) {
                hashTags = hashTags.concat( comment.getHashtags() );
            });

            return hashTags;
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Proxy any events from our comments instance.
         *  @param  eventName   The event;
         *  @param  model       The model triggering this event;
         *  @param  val         ASSUMING set(), the new value;
         *  @param  options     ASSUMING set(), the set options;
         */
        _commentsProxy: function(eventName, model, val, options) {
            var self    = this;

            switch (eventName)
            {
            case 'add':
            case 'change':
            case 'destroy':
                self.trigger( 'change', self, self.collection );
                break;
            }
        }
    });

    app.Model.Notes = Backbone.Collection.extend({
        model:          app.Model.Note,
        localStorage:   app.Model.Note.prototype.localStorage,
        sync:           app.Model.Note.prototype.sync
    });

 }).call(this);
