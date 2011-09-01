/** @file
 *
 *  jQuery class/objects representing a single, user-generated note as well as
 *  a group of one or more notes.
 *
 *  Requires:
 *      jquery.js
 *      jquery.user.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global jQuery:false */
(function($) {

/******************************************************************************
 * Note
 *
 */

/** @brief  A single, attributable note/comment.
 *  @param  props   The properties of this note:
 *                      author:     The $.User instance or serialize $.User
 *                                  representing the author of this note;
 *                      text:       The text of this note;
 *                      created:    The date/time the note was created;
 */
$.Note  = function(props) {
    var defaults    = {
        author: null,
        text:   '',
        created:new Date()
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Note.prototype = {
    /** @brief  Initialize a new Note instance.
     *  @param  props   The properties of this note:
     *                      author:     The Unique ID of the author
     *                      text:       The text of this note
     *                      created:    The date/time the note was created
     */
    init: function(props) {
        this.props = props;

        if ( (this.props.author === null) ||
             ($.isPlainObject(this.props.author)) )
        {
            this.props.author = new $.User( this.props.author );
        }

        return this;
    },

    getAuthor: function() { return this.props.author; },
    getText:   function() { return this.props.text; },
    getCreated:function() { return this.props.created; },

    setText:   function(text)
    {
        this.props.text = text;
    },

    serialize: function() {
        var serialized  = {
            author: (this.props.author
                        ? this.props.author.serialize()
                        : null),
            text:   this.props.text,
            created:this.props.created
        };

        return serialized;
    },

    destroy: function() {
        var self    = this;
        var props   = self.props;

        if (props.author && (props.author instanceof $.User))
        {
            props.author.destroy();
        }

        delete props.author;
        delete props.text;
        delete props.created;
    }
};

/******************************************************************************
 * Notes
 *
 */

/** @brief  Notes and tags associated with a particular range within
 *          a document.
 */
$.Notes = function(props) {
    var defaults    = {
        id:     null,
        range:  null,
        notes:  [],
        tags:   []
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Notes.prototype = {
    /** @brief  Initialize a new Notes instance.
     *  @param  props   The properties of this instance:
     *                      id:         The unique id of this instance;
     *                      range:      The range that this set of notes should
     *                                  be associated with
     *                                  (from summary._generateRange());
     *                      notes:      An array of $.Note objects,
     *                                  serialized $.Note objects, or empty
     *                                  to initialize an empty notes set;
     *                      tags:       An array of tag strings;
     */
    init: function(props) {
        this.props = props;

        var noteInstances   = [];
        $.each(this.props.notes, function() {
            var note    = this;
            if ($.isPlainObject(note))  { note = new $.Note(note); }

            noteInstances.push( note );
        });

        if (noteInstances.length < 1)
        {
            // Create a single, empty note
            noteInstances.push( new $.Note() );
        }

        this.props.notes = noteInstances;

        return this;
    },

    /** @brief  Add a new note to this set of notes.
     *  @param  note    a $.Note instance or properties to create one.
     *
     *  @return The note instance that was added.
     */
    addNote: function(note) {
        if ($.isPlainObject(note))      { note = new $.Note(note); }

        this.props.notes.push(note);

        return note;
    },

    /** @brief  Remove a note from this set of notes.
     *  @param  note    a $.Note instance to remove.
     *
     *  @return this for a fluent interface.
     */
    removeNote: function(note) {
        var self    = this;
        if (note instanceof $.Note)
        {
            var targetIdex  = -1;
            $.each(self.props.notes, function(idex) {
                if (this === note)
                {
                    targetIdex = idex;
                    return false;
                }
            });

            if (targetIdex >= 0)
            {
                self.props.notes.splice(targetIdex, 1);
                note.destroy();
            }
        }

        return self;
    },

    getId: function()           { return this.props.id; },
    getRange: function()        { return this.props.range; },
    getNotes: function()        { return this.props.notes; },
    getNotesCount: function()   { return this.props.notes.length; },
    getTags: function()         { return this.props.tags; },

    getNote: function(idex) {
        idex = idex || 0;
        return this.props.notes[idex];
    },
    getTag: function(idex) {
        idex = idex || 0;
        return this.props.tags[idex];
    },

    /** @brief  Serialize this instance.
     *
     *  @return The serialize 
     */
    serialize: function() {
        var serialized  = {
            id:     this.props.id,
            range:  this.props.range,
            notes:  [],
            tags:   this.props.tags
        };

        $.each(this.props.notes, function() {
            serialized.notes.push( this.serialize() );
        });

        return serialized;
    },

    /** @brief  Destroy this instance.
     */
    destroy: function() {
        var self    = this;
        var props   = self.props;
        $.each(props.notes, function() {
            this.destroy();
        });

        delete props.range;
        delete props.notes;
        delete props.tags;
    }
};

 }(jQuery));
