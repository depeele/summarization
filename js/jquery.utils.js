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

        var dateStr     = '';
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
        dateStr += $.padString(hour, 2,
                               "<span style='visibility:hidden;'>1</span>")
                + ':'+ $.padString(date.getMinutes())
                + ' '+ meridian;

        if (timeOnly !== true)
        {
            dateStr += ', '+ date.getFullYear()
                    +  '-'+  $.padString((date.getMonth() + 1))
                    +  '-'+  $.padString(date.getDate())
                    +  ' ';
        }


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

}(jQuery));
