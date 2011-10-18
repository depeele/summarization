/** @file
 *
 *  Backbone Model for a paragraph or collection of paragraphs.
 *
 *  Requires:
 *      backbone.js
 *      model/sentence.js
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
        if (!app.Model.Sentences)
        {
            var tModule = require('./sentence.js');
            _.extend(app, tModule);
        }
    }

    app.Model.Paragraph = Backbone.Model.extend({
        defaults: {
            id:         null,
            rank:       0.0,
            sentences:  null
        },

        initialize: function() {
            var sentences   = this.get('sentences');
            if (! (sentences instanceof app.Model.Sentences))
            {
                sentences = new app.Model.Sentences(sentences);
                this.set({'sentences': sentences});
            }
        }
    });

    app.Model.Paragraphs    = Backbone.Collection.extend({
        model:  app.Model.Paragraph
    });

 }).call(this);
