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
    var app         = this.app = (this.app || {Model:{}, View:{}});
    var _           = this._;
    var Backbone    = this.Backbone;
    if (typeof require !== 'undefined')
    {
        if (!_)        { _        = require('../underscore.js'); }
        if (!Backbone) { Backbone = require('../backbone.js'); }
        if (!app.Model.Sections)
        {
            var tModule = require('./section.js');
            _.extend(app, tModule.app);
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
            sections:   null
        },

        initialize: function(spec) {
            var published   = this.get('published');
            var sections    = this.get('sections');
            if ( ! (published instanceof Date) )
            {
                published = (published
                            ? new Date(published)
                            : new Date());

                this.set({'published': published});
            }

            if (! (sections instanceof app.Model.Sections))
            {
                this.set({'sections': new app.Model.Sections(sections)});
            }
        }
    });

    app.Model.Docs  = Backbone.Collection.extend({
        model:  app.Model.Document,

        initialize: function() {
        }
    });

 }).call(this);
