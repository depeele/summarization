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

    var Backbone    = this.Backbone;
    if (!Backbone && (typeof require !== 'undefined'))
    {
        Backbone = require('../backbone.js');
    }

    this.Sentence   = Backbone.Model.extend({
        defaults: {
            id:         null,
            rank:       0.0,
            content:    null
        },

        initialize: function(spec) {
        }
    });

    this.Sentences  = Backbone.Collection.extend({
        model:  this.Sentence,

        initialize: function() {
        }
    });

 }).call(this);
