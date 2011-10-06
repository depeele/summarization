/** @file
 *
 *  Backbone Model for a sentence-based start and end position.
 *
 *  Requires:
 *      backbone.js
 *      model/sentence.js
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
        if (!app.Model.Sentence)
        {
            var tModule = require('./sentence.js');
            _.extend(app, tModule.app);
        }
    }

    app.Model.Position  = Backbone.Model.extend({
        defaults: {
            id:         null,
            start:      {
                sentence:       null,
                relaltivePos:   null    /* Serialize position rooted in
                                         * 'sentence'
                                         */
            },
            end:        {
                sentence:       null,
                relaltivePos:   null    /* Serialize position rooted in
                                         * 'sentence'
                                         */
            }
        },

        initialize: function(spec) {
            var start   = this.get('start');
            var end     = this.get('end');
            if ((! start.sentence) ||
                ! (start.sentence instanceof app.Model.Sentence) )
            {
                start.sentence = new app.Model.Sentence(start.sentence);

                this.set({start: start});
            }

            if ((! end.sentence) ||
                ! (end.sentence instanceof app.Model.Sentence) )
            {
                end.sentence = new app.Model.Sentence(end.sentence);

                this.set({end: end});
            }
        }
    });

 }).call(this);
