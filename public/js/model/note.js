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
    var app         = this.app = (this.app || {Model:{},      View:{},
                                               Controller:{}, Helper:{}});
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

        if (!app.Model.Position)
        {
            var tModule = require('./position.js');
            _.extend(app, tModule.app);
        }
    }

    app.Model.Note  = Backbone.Model.extend({
        defaults: {
            id:         null,

            /* Position within the document of the content highlight associated
             * with this note.
             */
            position:   {
                start:  {
                    sentence:   null,   /* The app.Model.Sentence instance or
                                         * identifier.
                                         */
                    relativePos:null    /* Serialized position rooted in the
                                         * identified sentence.
                                         */
                },
                end:    {
                    sentence:   null,   /* The app.Model.Sentence instance or
                                         * identifier.
                                         */
                    relativePos:null    /* Serialized position rooted in the
                                         * identified sentence.
                                         */
                }
            },

            // Comments associated with this note
            comments:   null
        },

        initialize: function(spec) {
            var comments    = this.get('comments');
            var position    = this.get('position');
            if ((! comments) || ! (comments instanceof app.Model.Comments) )
            {
                this.set({comments: new app.Model.Comments(comments)});
            }

            if ((! position) || ! (position instanceof app.Model.Position) )
            {
                this.set({position: new app.Model.Position(position)});
            }
        }
    });

    app.Model.Notes = Backbone.Collection.extend({
        model:  app.Model.Note,

        initialize: function() {
        }
    });

 }).call(this);
