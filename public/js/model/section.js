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

    var Backbone    = this.Backbone;
    var Paragraphs  = this.Paragraphs;
    if (typeof require !== 'undefined')
    {
        if (!Backbone) { Backbone = require('../backbone.js'); }
        if (!Paragraphs)
        {
            var tModule = require('./paragraph.js');
            Paragraphs  = tModule.Paragraphs;
        }
    }

    this.Section    = Backbone.Model.extend({
        defaults: {
            id:         null,
            rank:       0.0,
            paragraphs: null
        },

        initialize: function(spec) {
            var paragraphs  = this.get('paragraphs');
            if (! (paragraphs instanceof Paragraphs))
            {
                this.set({'paragraphs': new Paragraphs(paragraphs)});
            }
        }
    });

    this.Sections   = Backbone.Collection.extend({
        model:  this.Section,

        initialize: function() {
        }
    });

 }).call(this);
