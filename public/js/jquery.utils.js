/** @file
 *
 *  jQuery Utilities/extensions
 *
 */
(function($) {

    /*************************************************************************
     * String extensions
     *
     */

    /** @brief  Left pad the provided string to the specified number of
     *          characters using the provided padding character.
     *  @param  str         The string to pad;
     *  @param  numChars    The total number of charcters desired [ 2 ];
     *  @param  padChar     The desired padding character         [ '0' ];
     *
     *  @return A new, padded string.
     */
    $.padString = function(str, numChars, padChar) {
        numChars = numChars || 2;
        padChar  = padChar  || '0';

        // Ensure 'str' is actually a string
        str = ''+ str;

        while (str.length < numChars)
        {
            str = padChar + str;
        }

        return str;
    };

    /*************************************************************************
     * Date extensions
     *
     */

    /** @brief  Month Strings. */
    $.months    = [
        "January",      "Febrary",  "March",    "April",
        "May",          "June",     "July",     "August",
        "September",    "October",  "November", "December"
    ];


    /** @brief  Convert a Date instance to a client-localized string of the
     *          form:
     *              YYYY-MM-DD g:mm a
     *  @param  date        The Date instance to convert.  If not provided, use
     *                      the current date/time.
     *
     *  @param  timeOnly    Exclude the date information? [ false ]
     *
     *  @return The string representation of the given date.
     */
    $.date2str = function(date, timeOnly) {
        if (date === undefined)
        {
            date = new Date();
        }
        if ( ! (date instanceof Date) )
        {
            date = new Date(date);
        }

        var dateStr     = $.months[date.getMonth()]  //.substr(0,3)
                        +' '+  date.getDate()
                        +' '+ date.getFullYear()
                        +', ';
        var hour        = date.getHours();
        var meridian    = 'am';
        if (hour === 0)
        {
            hour     = 12;
        }
        else if (hour === 12)
        {
            meridian = 'pm';
        }
        else if (hour > 12)
        {
            hour     -= 12;
            meridian  = 'pm';
        }

        /* Using a string for padding works here because we'll only ever need
         * to add 1 character at most.
         *
         * We use the span to try and ensure that we'll always align properly
         * since the only value that MIGHT be in the empty field is 1.
         */
        dateStr += hour
                +':'+ $.padString(date.getMinutes())
                +' '+ meridian;

        return dateStr;
    };

    /** @brief  Convert the given string into a Date instance.
     *  @param  str     The date string to convert
     *                      (MUST be GMT in the form 'YYYY-MM-DD HH:MM:SS')
     *
     *  @return The Date instance (null if invalid).
     */
    $.str2date = function(str) {
        // Ensure 'str' is a string
        str = ''+str;

        var parts       = str.split(' ');
        var dateParts   = parts[0].split('-');
        var timeParts   = parts[1].split(':');
        var date        = new Date();

        date.setUTCFullYear(dateParts[0] );
        date.setUTCMonth(   parseInt(dateParts[1], 10) - 1 );
        date.setUTCDate(    dateParts[2] );
        date.setUTCHours(   timeParts[0] );
        date.setUTCMinutes( timeParts[1] );
        date.setUTCSeconds( timeParts[2] );

        return date;
    };

    /** @brief  Given a number, return the ordinal suffix for that number.
     *  @param  num     The number.
     *
     *  @return The number with the appropriate ordinal suffix string.
     */
    $.ordinal = function(num) {
        var suffix  = 'th';
        if ( ((num % 100) < 11) || ((num % 100) > 13) )
        {
            switch (num % 10)
            {
            case 1: suffix = 'st';  break;
            case 2: suffix = 'nd';  break;
            case 3: suffix = 'rd';  break;
            }
        }

        return num +'<sup>'+ suffix +'</sup>';
    };

    /** @brief  Takes a date/time and returns a string representing how long
     *          ago the date occurred.
     *  @param  date        The Date instance or ISO Date string to convert.
     *                      If not provided, use the current date/time.
     *
     *  @return The date string.
     */
    $.prettyDate = function(date) {
        if (date === undefined)
        {
            date = new Date();
        }
        if ( ! (date instanceof Date) )
        {
            date = new Date(date);
        }
        var diff    = (( (new Date()).getTime() - date.getTime()) / 1000);
        var dayDiff = Math.floor(diff / 86400);

        if ( isNaN(dayDiff) || (dayDiff < 0) || (dayDiff >= 31))
        {
            var day = date.getDate();

            return $.months[date.getMonth()]  //.substr(0,3)
                    +' '+  $.ordinal(day)
                    +', '+ date.getFullYear();
        }

        return dayDiff == 0 && (
                    diff < 60    && "just now"                               ||
                    diff < 120   && "1 minute ago"                           ||
                    diff < 3600  && Math.floor( diff / 60 )  +" minutes ago" ||
                    diff < 7200  && "1 hour ago"                             ||
                    diff < 86400 && Math.floor( diff / 3600) +" hours ago")  ||
               dayDiff == 1      && "Yesterday"                              ||
               dayDiff <  7      && dayDiff                  +" days ago"    ||
               dayDiff <  14     && "1 week ago"                             ||
               dayDiff <  31     && Math.ceil( dayDiff/ 7 )  +" weeks ago";
    };

    /* Borrowed from jQuery UI Position 1.8.16
     *
     * Copyright 2011, AUTHORS.txt (http://jqueryui.com/about)
     * Dual licensed under the MIT or GPL Version 2 licenses.
     * http://jquery.org/license
     *
     * http://docs.jquery.com/UI/Position
     */
    $.ui = $.ui || {};
    
    var horizontalPositions = /left|center|right/,
        verticalPositions = /top|center|bottom/,
        center = "center",
        _position = $.fn.position,
        _offset = $.fn.offset;
    
    $.fn.position = function( options ) {
        if ( !options || !options.of ) {
            return _position.apply( this, arguments );
        }
    
        // make a copy, we don't want to modify arguments
        options = $.extend( {}, options );
    
        var target = $( options.of ),
            targetElem = target[0],
            collision = ( options.collision || "flip" ).split( " " ),
            offset = options.offset ? options.offset.split( " " ) : [ 0, 0 ],
            targetWidth,
            targetHeight,
            basePosition;
    
        if ( targetElem.nodeType === 9 ) {
            targetWidth = target.width();
            targetHeight = target.height();
            basePosition = { top: 0, left: 0 };
        // TODO: use $.isWindow() in 1.9
        } else if ( targetElem.setTimeout ) {
            targetWidth = target.width();
            targetHeight = target.height();
            basePosition = { top: target.scrollTop(), left: target.scrollLeft() };
        } else if ( targetElem.preventDefault ) {
            // force left top to allow flipping
            options.at = "left top";
            targetWidth = targetHeight = 0;
            basePosition = { top: options.of.pageY, left: options.of.pageX };
        } else {
            targetWidth = target.outerWidth();
            targetHeight = target.outerHeight();
            basePosition = target.offset();
        }
    
        // force my and at to have valid horizontal and veritcal positions
        // if a value is missing or invalid, it will be converted to center 
        $.each( [ "my", "at" ], function() {
            var pos = ( options[this] || "" ).split( " " );
            if ( pos.length === 1) {
                pos = horizontalPositions.test( pos[0] ) ?
                    pos.concat( [center] ) :
                    verticalPositions.test( pos[0] ) ?
                        [ center ].concat( pos ) :
                        [ center, center ];
            }
            pos[ 0 ] = horizontalPositions.test( pos[0] ) ? pos[ 0 ] : center;
            pos[ 1 ] = verticalPositions.test( pos[1] ) ? pos[ 1 ] : center;
            options[ this ] = pos;
        });
    
        // normalize collision option
        if ( collision.length === 1 ) {
            collision[ 1 ] = collision[ 0 ];
        }
    
        // normalize offset option
        offset[ 0 ] = parseInt( offset[0], 10 ) || 0;
        if ( offset.length === 1 ) {
            offset[ 1 ] = offset[ 0 ];
        }
        offset[ 1 ] = parseInt( offset[1], 10 ) || 0;
    
        if ( options.at[0] === "right" ) {
            basePosition.left += targetWidth;
        } else if ( options.at[0] === center ) {
            basePosition.left += targetWidth / 2;
        }
    
        if ( options.at[1] === "bottom" ) {
            basePosition.top += targetHeight;
        } else if ( options.at[1] === center ) {
            basePosition.top += targetHeight / 2;
        }
    
        basePosition.left += offset[ 0 ];
        basePosition.top += offset[ 1 ];
    
        return this.each(function() {
            var elem = $( this ),
                elemWidth = elem.outerWidth(),
                elemHeight = elem.outerHeight(),
                marginLeft = parseInt( $.curCSS( this, "marginLeft", true ) ) || 0,
                marginTop = parseInt( $.curCSS( this, "marginTop", true ) ) || 0,
                collisionWidth = elemWidth + marginLeft +
                    ( parseInt( $.curCSS( this, "marginRight", true ) ) || 0 ),
                collisionHeight = elemHeight + marginTop +
                    ( parseInt( $.curCSS( this, "marginBottom", true ) ) || 0 ),
                position = $.extend( {}, basePosition ),
                collisionPosition;
    
            if ( options.my[0] === "right" ) {
                position.left -= elemWidth;
            } else if ( options.my[0] === center ) {
                position.left -= elemWidth / 2;
            }
    
            if ( options.my[1] === "bottom" ) {
                position.top -= elemHeight;
            } else if ( options.my[1] === center ) {
                position.top -= elemHeight / 2;
            }
    
            // prevent fractions (see #5280)
            position.left = Math.round( position.left );
            position.top = Math.round( position.top );
    
            collisionPosition = {
                left: position.left - marginLeft,
                top: position.top - marginTop
            };
    
            $.each( [ "left", "top" ], function( i, dir ) {
                if ( $.ui.position[ collision[i] ] ) {
                    $.ui.position[ collision[i] ][ dir ]( position, {
                        targetWidth: targetWidth,
                        targetHeight: targetHeight,
                        elemWidth: elemWidth,
                        elemHeight: elemHeight,
                        collisionPosition: collisionPosition,
                        collisionWidth: collisionWidth,
                        collisionHeight: collisionHeight,
                        offset: offset,
                        my: options.my,
                        at: options.at
                    });
                }
            });
    
            if ( $.fn.bgiframe ) {
                elem.bgiframe();
            }
            elem.offset( $.extend( position, { using: options.using } ) );
        });
    };
    
    $.ui.position = {
        fit: {
            left: function( position, data ) {
                var win = $( window ),
                    over = data.collisionPosition.left + data.collisionWidth - win.width() - win.scrollLeft();
                position.left = over > 0 ? position.left - over : Math.max( position.left - data.collisionPosition.left, position.left );
            },
            top: function( position, data ) {
                var win = $( window ),
                    over = data.collisionPosition.top + data.collisionHeight - win.height() - win.scrollTop();
                position.top = over > 0 ? position.top - over : Math.max( position.top - data.collisionPosition.top, position.top );
            }
        },
    
        flip: {
            left: function( position, data ) {
                if ( data.at[0] === center ) {
                    return;
                }
                var win = $( window ),
                    over = data.collisionPosition.left + data.collisionWidth - win.width() - win.scrollLeft(),
                    myOffset = data.my[ 0 ] === "left" ?
                        -data.elemWidth :
                        data.my[ 0 ] === "right" ?
                            data.elemWidth :
                            0,
                    atOffset = data.at[ 0 ] === "left" ?
                        data.targetWidth :
                        -data.targetWidth,
                    offset = -2 * data.offset[ 0 ];
                position.left += data.collisionPosition.left < 0 ?
                    myOffset + atOffset + offset :
                    over > 0 ?
                        myOffset + atOffset + offset :
                        0;
            },
            top: function( position, data ) {
                if ( data.at[1] === center ) {
                    return;
                }
                var win = $( window ),
                    over = data.collisionPosition.top + data.collisionHeight - win.height() - win.scrollTop(),
                    myOffset = data.my[ 1 ] === "top" ?
                        -data.elemHeight :
                        data.my[ 1 ] === "bottom" ?
                            data.elemHeight :
                            0,
                    atOffset = data.at[ 1 ] === "top" ?
                        data.targetHeight :
                        -data.targetHeight,
                    offset = -2 * data.offset[ 1 ];
                position.top += data.collisionPosition.top < 0 ?
                    myOffset + atOffset + offset :
                    over > 0 ?
                        myOffset + atOffset + offset :
                        0;
            }
        }
    };
    
    // offset setter from jQuery 1.4
    if ( !$.offset.setOffset ) {
        $.offset.setOffset = function( elem, options ) {
            // set position first, in-case top/left are set even on static elem
            if ( /static/.test( $.curCSS( elem, "position" ) ) ) {
                elem.style.position = "relative";
            }
            var curElem   = $( elem ),
                curOffset = curElem.offset(),
                curTop    = parseInt( $.curCSS( elem, "top",  true ), 10 ) || 0,
                curLeft   = parseInt( $.curCSS( elem, "left", true ), 10)  || 0,
                props     = {
                    top:  (options.top  - curOffset.top)  + curTop,
                    left: (options.left - curOffset.left) + curLeft
                };
            
            if ( 'using' in options ) {
                options.using.call( elem, props );
            } else {
                curElem.css( props );
            }
        };
    
        $.fn.offset = function( options ) {
            var elem = this[ 0 ];
            if ( !elem || !elem.ownerDocument ) { return null; }
            if ( options ) { 
                return this.each(function() {
                    $.offset.setOffset( this, options );
                });
            }
            return _offset.call( this );
        };
    }

}(jQuery));
