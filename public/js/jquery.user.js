/** @file
 *
 *  A jQuery class/object representing a uniquely identifiable user.
 *
 *  Requires:
 *      jquery.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global jQuery:false */
(function($) {

/** @brief  A single, uniquely identifiable user.
 *  @param  props   The properties of this user:
 *                      id:         The Unique ID of the user;
 *                      name:       The user name;
 *                      fullName:   The user's full name;
 *                      avatarUrl:  The URL to the user's avatar image;
 */
$.User  = function(props) {
    var defaults    = {
        id:         null,
        name:       'anonymous',
        fullName:   'Anonymous',
        avatarUrl:  'images/avatar.jpg'
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

    getId:          function() { return this.props.id; },
    getName:        function() { return this.props.name; },
    getFullName:    function() { return this.props.fullName; },
    getAvatarUrl:   function() { return this.props.avatarUrl; },

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

 }(jQuery));
