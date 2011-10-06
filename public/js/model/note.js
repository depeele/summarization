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
    var app         = this.app = (this.app || {Model:{}, View:{}});
    var _           = this._;
    var Backbone    = this.Backbone;
    if (typeof require !== 'undefined')
    {
        if (!_)        { _        = require('../underscore.js'); }
        if (!Backbone) { Backbone = require('../backbone.js'); }
        if (!app.Model.Comments)
        {
            var tModule = require('./comment.js');
            _.extend(app, tModule.app);
        }
    }

    app.Model.Note  = Backbone.Model.extend({
        defaults: {
            id:         null,
            // Position within the document to highlight for this note
            highlight:  {
                start:  null,
                end:    null
            },
            // Comments associated with this note
            comments:   null
        },

        initialize: function(spec) {
            var comments    = this.get('comments');
            if ( ! (comments instanceof app.Model.Comments) )
            {
                this.set({'comments': new app.Model.Comments(comments)});
            }
        }
    });

    app.Model.Notes = Backbone.Collection.extend({
        model:  app.Model.Note,

        initialize: function() {
        }
    });

 }).call(this);
