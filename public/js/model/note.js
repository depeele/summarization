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
            ranges:     null,

            // Comments associated with this note
            comments:   null
        },

        initialize: function(spec) {
            var comments    = this.get('comments');
            var ranges      = this.get('ranges');
            if ((! comments) || ! (comments instanceof app.Model.Comments) )
            {
                this.set({comments: new app.Model.Comments(comments)});
            }

            if ((! ranges) || ! (ranges instanceof app.Model.Ranges) )
            {
                this.set({ranges: new app.Model.Ranges(ranges)});
            }
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
            var self        = this;
            var comments    = self.get('comments');

            comments.add( comment );
        }
    });

    app.Model.Notes = Backbone.Collection.extend({
        model:  app.Model.Note,

        initialize: function() {
        }
    });

 }).call(this);
