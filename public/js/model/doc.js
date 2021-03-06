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
            var self        = this,
                published   = self.get('published'),
                sections    = self.get('sections'),
                notes       = self.get('notes');
            if (! _.isDate(published)) {
                if (_.isObject(published)) {
                    published = published.date +' '+ published.time;
                }

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

                // Fetch ALL notes and then filter to JUST this document
                //notes.fetch({docId: self.get('url')});
                notes.fetch();

                var url     = self.get('url'),
                    models  = notes.filter(function(model) {
                                return (model.get('docId') === url);
                              });

                notes.reset( models );

                //self.set({notes: new app.Model.Notes(notes)});
                self.set({notes: notes}, {silent: true});
            }

            self.__notesChanged    = _.bind(self._notesChanged,    self);

            notes.bind('add',             self.__notesChanged);
            notes.bind('change',          self.__notesChanged);
        },

        /** @brief  Add a new Model.Note instance to the notes collection.
         *  @param  note    The Model.Note instance to add;
         */
        addNote: function(note) {
            var self    = this,
                notes   = self.get('notes');

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

        /** @brief  Retrieve all hash tags from the comments of every note
         *          currently attached to this document.
         *
         *  @return An array of hashTag strings (may be empty).
         */
        getHashtags: function() {
            var self        = this,
                notes       = self.get('notes'),
                hashTags    = [];
        
            notes.each(function(note) {
                hashTags = _.union(hashTags, note.getHashtags() );
            });

            // Return a sorted array.
            return hashTags.sort();
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Proxy any events from our notes instance.
         *  @param  note    The note that was changed;
         *  @param  notes   The notes collection containing 'note';
         *  @param  options Options passed with the set that caused the change;
         */
        _notesChanged: function(note, notes, options) {
            var self    = this;

            // /*
            console.log("Model:Doc::_notesChanged()[%s]: note[ %s ]",
                        self.cid, note.cid);
            // */

            // For any change, save the note
            note.save();

            // :TODO: Grab hashTags from all notes
        }
    });

    app.Model.Docs  = Backbone.Collection.extend({
        model:  app.Model.Document
    });

 }).call(this);
