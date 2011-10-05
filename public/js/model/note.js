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

    var Backbone    = this.Backbone;
    var Comments    = this.Comments;
    if (typeof require !== 'undefined')
    {
        if (!Backbone) { Backbone = require('../backbone.js'); }
        if (!Comments)
        {
            var tModule = require('./comment.js');
            Comments    = tModule.Comments;
        }
    }

    this.Note   = Backbone.Model.extend({
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
            if ( ! (comments instanceof Comments) )
            {
                this.set({'comments': new Comments(comments)});
            }
        }
    });

    this.Notes  = Backbone.Collection.extend({
        model:  this.Note,

        initialize: function() {
        }
    });

 }).call(this);
