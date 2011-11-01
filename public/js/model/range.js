/** @file
 *
 *  Backbone Model for a sentence-based ranges.
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
    }

    /** @brief  A range within a single sentence. */
    app.Model.Range = Backbone.Model.extend({
        defaults: {
            id:         null,
            sentenceId: null,   // The id of the sentence that roots this range
            offsetStart:null,   // The starting offset within the sentence
            offsetEnd:  null    // The ending   offset within the sentence
        },

        setStart: function(offset) {
            this.set({offsetStart: offset});
        },

        setEnd: function(offset) {
            this.set({offsetEnd: offset});
        },

        setOffsets: function(start, end) {
            this.set({offsetStart: start,
                      offsetEnd:   end});
        },

        isEmpty: function() {
            var sid     = this.get('sentenceId'),
                start   = this.get('offsetStart'),
                end     = this.get('offsetEnd');

            return ( sid && (end < start));
        },

        /** @brief  Retrieve a rangy range that represents this range within
         *          the the current document.
         */
        rangy: function( ) {
            var $s      = $( this.get('sentenceId') );
            if ( (! $s) || ($s.length < 1) )
            {
                return null;
            }

            var $content    = $s.find('.content');
            var start       = this.get('offsetStart');
            var end         = this.get('offsetEnd');

            var range   = new rangy.WrappedRange();
            range.setStart($content[0].childNodes[0], start);
            range.setEnd(  $content[0].childNodes[0], end);

            return range;
        }
    });

    /** @brief  A collection of ranges within mutliple sentences. */
    app.Model.Ranges    = Backbone.Collection.extend({
        model:  app.Model.Range,

        /** @brief  Retrieve all sentences represented by these ranges.
         */
        getSentences: function() {
            var $s  = $();  // Create an empty set

            this.map(function( range ) {
                $s.push( $( range.get('sentenceId') ) );
            });

            return $s;
        }
    });

 }).call(this);
