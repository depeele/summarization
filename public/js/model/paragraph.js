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

    var Backbone    = this.Backbone;
    var Sentences   = this.Sentences;
    if (typeof require !== 'undefined')
    {
        if (!Backbone) { Backbone = require('../backbone.js'); }
        if (!Sentences)
        {
            var tModule = require('./sentence.js');
            Sentences   = tModule.Sentences;
        }
    }

    this.Paragraph  = Backbone.Model.extend({
        defaults: {
            id:         null,
            rank:       0.0,
            sentences:  null
        },

        initialize: function(spec) {
            var sentences   = this.get('sentences');
            if (! (sentences instanceof Sentences))
            {
                this.set({'sentences': new Sentences(sentences)});
            }
        }
    });

    this.Paragraphs = Backbone.Collection.extend({
        model:  this.Paragraph,

        initialize: function() {
        }
    });

 }).call(this);
