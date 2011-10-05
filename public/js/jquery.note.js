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

/********************************************************
 * Unique array sorting
 *
 */
var hasDuplicates   = false;
var sortCompare     = function( a, b ) {
    if ( a === b )
    {
        hasDuplicates = true;
        return 0;
    }

    return ( (a < b) ? -1 : 1 );
};

/** @brief  Perform a unique sort on the given array.
 *  @param  ar      The array to sort;
 *
 *  @return The sorted array with duplicates removed.
 */
$.uniqueSort = function( ar ) {
    hasDuplicates = false;
    ar.sort( sortCompare );

    if (hasDuplicates)
    {
        for (var idex = 1; idex < ar.length; idex++)
        {
            if (ar[idex] === ar[idex - 1])
            {
                ar.splice( idex--, 1 );
            }
        }
    }

    return ar;
};

/******************************************************************************
 * Note
 *
 */

/** @brief  A note comprised of one or more comments and tags.  */
$.Note = function(props) {
    var defaults    = {
        id:         null,
        comments:   [],
        tags:       null
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
        var self   = this;
        self.props = {};

        $.each(props, function(key,val) {
            self.set(key, val);
        });

        return self;

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

    /** @brief  Generic getting of a property.
     *  @param  key     The property to get;
     *
     *  @return The value of the property (or undefined if invalid).
     */
    get:   function(key)
    {
        var res;
        var method  = 'get'+ key[0].toUpperCase() + key.substr(1);

        if ($.isFunction( self[method] ))
        {
            res = self[method](val);
        }

        return res;
    },

    /** @brief  Generic setting of a property.
     *  @param  key     The property to set;
     *  @param  val     The property value;
     */
    set:   function(key, val)
    {
        var self    = this;
        var method  = 'set'+ key[0].toUpperCase() + key.substr(1);

        if ($.isFunction( self[method] ))
        {
            self[method](val);
        }
    },

    getId:          function()  { return this.props.id; },
    getComments:    function()  { return this.props.comments; },
    getCommentCount:function()  { return this.props.comments.length; },

    getTags: function()
    {
        var self    = this;
        //if (! self.props.tags)
        {
            // Create a full set of tags from all comments.
            self.props.tags = [];

            $.each(self.props.comments, function() {
                self.props.tags = self.props.tags.concat( this.getTags() );
            });

            self.props.tags = $.uniqueSort( self.props.tags );
        }

        return self.props.tags;
    },

    getTagCount: function()
    {
        return this.getTags().length;
    },

    /** @brief  (Re)set the id.
     *  @param  id      The new id;
     */
    setId: function(id)
    {
        this.props.id = id;
    },

    /** @brief  (Re)set all comments.
     *  @param  comments    An array of $.Comment instances
     *                      (or serialized versions);
     */
    setComments: function(comments)
    {
        var self    = this;

        self.props.comments = [];
        self.props.tags     = [];
        $.each(comments, function() {
            self.addComment(this);
        });

        if (self.props.comments.length < 1)
        {
            // Create a single, empty comment
            self.addComment( new $.Comment() );
        }
    },

    /** @brief  Add a new comment to this note.
     *  @param  comment A $.Comment instance or properties to create one.
     *
     *  @return The comment instance that was added.
     */
    addComment: function(comment) {
        if ($.isPlainObject(comment))   { comment = new $.Comment(comment); }

        this.props.tags = $.uniqueSort( this.getTags()
                                            .concat( comment.getTags() ) );
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

                /* Clear our 'tags' since removing exactly this set isn't
                 * straight forward.  If the tags are needed, they will be
                 * recreated on the next call to getTags().
                 */
                self.props.tags = null;
            }
        }

        return self;
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
            tags:       this.getTags()
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
        tags:   [],
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
        var self   = this;
        self.props = {};

        $.each(props, function(key,val) {
            self.set(key, val);
        });

        return self;
    },

    /** @brief  Generic getting of a property.
     *  @param  key     The property to get;
     *
     *  @return The value of the property (or undefined if invalid).
     */
    get:   function(key)
    {
        var res;
        var method  = 'get'+ key[0].toUpperCase() + key.substr(1);

        if ($.isFunction( self[method] ))
        {
            res = self[method](val);
        }

        return res;
    },

    /** @brief  Generic setting of a property.
     *  @param  key     The property to set;
     *  @param  val     The property value;
     */
    set:   function(key, val)
    {
        var self    = this;
        var method  = 'set'+ key[0].toUpperCase() + key.substr(1);

        if ($.isFunction( self[method] ))
        {
            self[method](val);
        }
    },

    getAuthor:  function() { return this.props.author; },
    getText:    function() { return this.props.text; },
    getTags:    function() { return this.props.tags; },
    getTagCount:function() { return this.props.tags; },
    getCreated: function() { return this.props.created; },

    setAuthor:   function(author)
    {
        if ( (! author) || (! (author instanceof $.User)) )
        {
            author = new $.User( author );
        }

        this.props.author = author;
    },

    setText:   function(text)
    {
        var tags    = [];
        this.props.text = text;

        if (text)
        {
            var matches = text.match(/#[\w\._\-]+/g);

            $.each(matches, function(idex, str) {
                tags.push( str.substr(1) );
            });
        }

        this.props.tags = tags;
    },

    setCreated: function(created)
    {
        if (! created)  { return; }

        if (! (created instanceof Date))
        {
            try {
                created = new Date(created);
            } catch(e) {}
        }

        this.props.created = created;
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
