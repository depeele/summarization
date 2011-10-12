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

        initialize: function(spec) {
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
                self.set({sections: new app.Model.Sections(sections)});
            }

            if ((! notes) || ! (notes instanceof app.Model.Notes))
            {
                self.set({notes: new app.Model.Notes(notes)});
            }
        },

        /** @brief  Add a new Model.Note instance to the notes collection.
         *  @param  note    The Model.Note instance to add;
         */
        addNote: function(note) {
            var self    = this;
            var notes   = self.get('notes');

            notes.add( note );
        }
    });

    app.Model.Docs  = Backbone.Collection.extend({
        model:  app.Model.Document,

        initialize: function() {
        }
    });

 }).call(this);
