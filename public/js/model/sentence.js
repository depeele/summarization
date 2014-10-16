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
        constructor: function(attrs, opts) {    // To create the Model
            var self    = this;

            if (_.isObject(attrs)           &&
                ! _.isArray(attrs.tokens)) {

                if (_.isString(attrs.content)) {
                    attrs.tokens = _generateTokens(attrs.content);

                } else if (_.isString(attrs.html)) {
                    attrs.tokens = _generateTokens(attrs.html);
                }
            }

            return Backbone.Model.call(self, attrs, opts);
        },
        /*
        initialize: function(attrs, opts) {     // AFTER the Model is created
            return this;
        },
        // */
        parse: function(rsp, xhr) {

            return rsp;
        }
    });

    app.Model.Sentences = Backbone.Collection.extend({
        model:  app.Model.Sentence
    });

    /**********************
     * Private helper
     */
    var tokenId = 0;

    function _processToken(state, word) {
        var state   = this,
            type    = 'word',
            parts, value, next, res;

        if (state.inTag) {
            parts =
                word.match(/^keyword='([^']+)'>([^<]+)<\/w>([^a-z0-9])?$/i);

            if (parts) {
                value = parts[1];
                word = parts[2];

                if (parts[3]) {
                    next = parts[3];
                }
            }
            state.inTag = false;

        } else if (word === '<w') {
            state.inTag = true;
            return;

        } else if (word.match(/\s+/)) {
            type = 'ws';
        } else if (word.match(/^[^a-z0-9]+$/i)) {
            type = 'punc';
        }

        res = {
            id:     't'+ tokenId++,
            type:   type,
            content:word,
            value:  value
        };

        if (next) {
            res = [ res ];
            res.push( _processToken(state, next) );
        }

        return res;
    }

    function _generateTokens(str) {
        // Split the HTML into tokens
        var words   = str.split(/\s+/),
            tokens  = [],
            state   = {
                inTag:  false
            };

        _.forEach(words, function(word) {
            var res = _processToken(state, word);

            _.forEach( (_.isArray(res) ? res : [ res ]), function(token) {
                if (token == null)  { return; }

                tokens.push( token );
            });
        });

        return tokens;
    }


 }).call(this);
