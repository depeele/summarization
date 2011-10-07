/** @file
 *
 *  Backbone Model for a sentence or collection of sentences.
 *
 *  Requires:
 *      backbone.js
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
    }

    app.Model.Sentence  = Backbone.Model.extend({
        defaults: {
            id:         null,
            rank:       0.0,
            content:    null
        },

        initialize: function(spec) {
        }
    });

    app.Model.Sentences = Backbone.Collection.extend({
        model:  app.Model.Sentence,

        initialize: function() {
        }
    });

 }).call(this);
