/** @file
 *
 *  Backbone Model for a section or collection of sections.
 *
 *  Requires:
 *      backbone.js
 *      model/paragraph.js
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
        if (!app.Model.Paragraphs)
        {
            var tModule = require('./paragraph.js');
            _.extend(app, tModule);
        }
    }

    app.Model.Section   = Backbone.Model.extend({
        defaults: {
            id:         null,
            rank:       0.0,
            paragraphs: null
        },

        initialize: function(spec) {
            var paragraphs  = this.get('paragraphs');
            if (! (paragraphs instanceof app.Model.Paragraphs))
            {
                this.set({'paragraphs': new app.Model.Paragraphs(paragraphs)});
            }
        }
    });

    app.Model.Sections  = Backbone.Collection.extend({
        model:  app.Model.Section,

        initialize: function() {
        }
    });

 }).call(this);
