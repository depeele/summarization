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

}(jQuery));
