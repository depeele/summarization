/** @file
 *
 *  jQuery class/objects representing a single, user-generated note as well as
 *  a group of one or more comments.
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

/** @brief  A note comprised of one or more comments and tags.  */
$.Note = function(props) {
    var defaults    = {
        id:         null,
        comments:   [],
        tags:       []
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Note.prototype = {
    /** @brief  Initialize a new Note instance.
     *  @param  props   The properties of this instance:
     *                      id:         The unique id of this instance;
     *                      comments:   An array of $.Comment objects,
     *                                  serialized $.Comment objects, or empty
     *                                  to initialize an empty set;
     *                      tags:       An array of tag strings;
     */
    init: function(props) {
        this.props = props;

        var commentInstances    = [];
        $.each(this.props.comments, function() {
            var comment = this;
            if ($.isPlainObject(comment))  { comment = new $.Comment(comment); }

            commentInstances.push( comment );
        });

        if (commentInstances.length < 1)
        {
            // Create a single, empty comment
            commentInstances.push( new $.Comment() );
        }

        this.props.comments = commentInstances;

        return this;
    },

    /** @brief  Add a new comment to this note.
     *  @param  comment A $.Comment instance or properties to create one.
     *
     *  @return The comment instance that was added.
     */
    addComment: function(comment) {
        if ($.isPlainObject(comment))   { comment = new $.Comment(comment); }

        this.props.comments.push(comment);

        return comment;
    },

    /** @brief  Remove a comments from this note.
     *  @param  comment A $.Comment instance to remove.
     *
     *  @return this for a fluent interface.
     */
    removeComment: function(comment) {
        var self    = this;
        if (comment instanceof $.Comment)
        {
            var targetIdex  = -1;
            $.each(self.props.comments, function(idex) {
                if (this === comment)
                {
                    targetIdex = idex;
                    return false;
                }
            });

            if (targetIdex >= 0)
            {
                self.props.comments.splice(targetIdex, 1);
                comment.destroy();
            }
        }

        return self;
    },

    getId: function()           { return this.props.id; },
    getComments: function()     { return this.props.comments; },
    getCommentCount: function() { return this.props.comments.length; },
    getTags: function()         { return this.props.tags; },

    getComment: function(idex) {
        idex = idex || 0;
        return this.props.comments[idex];
    },
    getTag: function(idex) {
        idex = idex || 0;
        return this.props.tags[idex];
    },

    /** @brief  Return a serialized version of this instance suitable
     *          for creating a duplicate instance via our constructor.
     *
     *  @return The serialized version
     */
    serialize: function() {
        var serialized  = {
            id:         this.props.id,
            comments:   [],
            tags:       this.props.tags
        };

        $.each(this.props.comments, function() {
            serialized.comments.push( this.serialize() );
        });

        return serialized;
    },

    /** @brief  Destroy this instance.
     */
    destroy: function() {
        var self    = this;
        var props   = self.props;
        if ($.isArray(props.comments))
        {
            $.each(props.comments, function() {
                this.destroy();
            });
        }

        delete props.comments;
        delete props.tags;
    }
};

/******************************************************************************
 * Comment
 *
 */

/** @brief  A single, attributable comment.
 *  @param  props   The properties of this comment:
 *                      author:     The $.User instance or serialize $.User
 *                                  representing the author of this comment;
 *                      text:       The text of this comment;
 *                      created:    The date/time the comment was created;
 */
$.Comment  = function(props) {
    var defaults    = {
        author: null,
        text:   '',
        created:new Date()
    };

    return this.init( $.extend(defaults, true, props || {}) );
};
$.Comment.prototype = {
    /** @brief  Initialize a new Comment instance.
     *  @param  props   The properties of this comment:
     *                      author:     The Unique ID of the author
     *                      text:       The text of this comment
     *                      created:    The date/time the comment was created
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

    /** @brief  Return a serialized version of this instance suitable
     *          for creating a duplicate instance via our constructor.
     *
     *  @return The serialized version.
     */
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

 }(jQuery));
