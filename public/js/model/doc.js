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

    var Backbone    = this.Backbone;
    var Sections    = this.Sections;
    if (typeof require !== 'undefined')
    {
        if (!Backbone) { Backbone = require('../backbone.js'); }
        if (!Sections)
        {
            var tModule = require('./section.js');
            Sections   = tModule.Sections;
        }
    }

    this.Doc    = Backbone.Model.extend({
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

            if (! (sections instanceof Sections))
            {
                this.set({'sections': new Sections(sections)});
            }
        }
    });

    this.Docs   = Backbone.Collection.extend({
        model:  this.Document,

        initialize: function() {
        }
    });

 }).call(this);
