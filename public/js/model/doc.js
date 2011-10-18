/** @file
 *
 *  Backbone Model for a document or collection of documents.
 *
 *  Requires:
 *      backbone.js
 *      model/section.js
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
        if (!app.Model.Sections)
        {
            var tModule = require('./section.js');
            _.extend(app, tModule);
        }
        if (!app.Model.Notes)
        {
            var tModule = require('./note.js');
            _.extend(app, tModule);
        }
    }

    app.Model.Doc   = Backbone.Model.extend({
        defaults: {
            id:         null,
            type:       'text/html',
            url:        null,
            title:      null,
            author:     null,
            published:  null,
            rank:       0.0,
            keywords:   null,
            sections:   null,
            notes:      null
        },

        initialize: function() {
            var self        = this;
            var published   = self.get('published');
            var sections    = self.get('sections');
            var notes       = self.get('notes');
            if ((! published) || ! (published instanceof Date) )
            {
                published = (published
                            ? new Date(published)
                            : new Date());

                self.set({published: published});
            }

            if ((! sections) || ! (sections instanceof app.Model.Sections))
            {
                sections = new app.Model.Sections(sections);
                self.set({sections: sections});
            }

            if ((! notes) || ! (notes instanceof app.Model.Notes))
            {
                notes = new app.Model.Notes();
                notes.fetch({docId: self.get('url')});

                //self.set({notes: new app.Model.Notes(notes)});
                self.set({notes: notes}, {silent: true});
            }

            notes.bind('add',    _.bind(self._notesChanged, self));
            notes.bind('change', _.bind(self._notesChanged, self));
        },

        /** @brief  Add a new Model.Note instance to the notes collection.
         *  @param  note    The Model.Note instance to add;
         */
        addNote: function(note) {
            var self    = this;
            var notes   = self.get('notes');

            /*
            console.log("Model:Doc::addNote()[%s]",
                        self.cid);                        
            // */

            // If this note has no comments, add a single, empty comment now.
            if (note.commentCount() < 1)
            {
                note.addComment( new app.Model.Comment() );
            }

            note.set({docId: self.get('url')});

            /* :NOTE: This will trigger an 'add' event on Model.Comments which
             *        will be proxied as a 'change' event on Model.Note which
             *        will be handled by our _notesChanged() method causing the
             *        Model.Note to be saved.
             */
            notes.add( note );
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Proxy any events from our notes instance.
         *  @param  eventName   The event;
         */
        _notesChanged: function(note, notes, options) {
            var self    = this;

            // /*
            console.log("Model:Doc::_notesChanged()[%s]: note[ %s ]",
                        self.cid, note.cid);
            // */

            // For any change, save the note
            note.save();
        }
    });

    app.Model.Docs  = Backbone.Collection.extend({
        model:  app.Model.Document
    });

 }).call(this);
