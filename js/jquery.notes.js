/** @file
 *
 *  A jQuery class/object representing a selected portion of an article DOM
 *  along with any notes and tags associated with that selected portion.
 *
 *  Requires:
 *      jquery.js
 *      rangy.js
 *      rangy/serializer.js
 */
(function($) {

/******************************************************************************
 * User
 *
 */

/** @brief  A single, uniquely identifiable user.
 *  @param  props   The properties of this user:
 *                      id:         The Unique ID of the user;
 *                      name:       The user name;
 *                      fullName:   The user's full name;
 */
$.User  = function(props) {
    var defaults    = {
        id:         null,
        name:       null,
        fullName:   null
    };

    return this.init( $.extend(defaults, true, props || {}) );
};

$.User.prototype = {
    /** @brief  Initialize a new User instance.
     *  @param  props   The properties of this note:
     *                      id:         The Unique ID of the user;
     *                      name:       The user name;
     *                      fullName:   The user's full name;
     */
    init: function(props) {
        this.props = props;

        return this;
    },

    serialize: function() {
        return this.props;
    },

    destroy: function() {
        var self    = this;
        var props   = self.props;

        delete props.id;
        delete props.name;
        delete props.fullName;
    }
};

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
        text:   null,
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

        if ( (this.props.author !== null) &&
             (! this.props.author instanceof $.User) )
        {
            this.props.author = new $.User( this.props.author );
        }

        return this;
    },

    serialize: function() {
        return this.props;
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
            if (! note instanceof $.Note)   { note = new $.Note(note); }

            noteInstances.push( note );
        });
        this.props.notes = noteInstances;

        return this;
    },

    /** @brief  Add a new note to this set of notes.
     *  @param  note    a $.Note instance or properties to create one.
     *
     *  @return this for a fluent interface.
     */
    addNote: function(note) {
        if (! note instanceof $.Note)   { note = new $.Note(note); }

        this.props.notes.push(note);

        return this;
    },

    getId: function() {
        return this.props.id;
    },
    getRange: function() {
        return this.props.range;
    },
    getNotes: function() {
        return this.props.notes;
    },
    getNote: function(idex) {
        idex = idex || 0;
        return this.props.notes[idex];
    },
    getTags: function() {
        return this.props.tags;
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
    },
};

 }(jQuery));
