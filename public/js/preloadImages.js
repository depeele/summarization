/** @file
 *
 *  A simple plugin that adds preloadImages() to this.
 */
(function(context) {
var _imageCache = [];

/** @brief  Given an argument list of image urls, load them all but don't
 *          display.
 *  @param  arguments   A list of image urls.
 *
 *  Images are stored globally in '_imageCache' but are not immediately
 *  rendered.
 */
context.preloadImages = function() {
    var nArgs   = arguments.length;
    for (var idex = nArgs; idex--;)
    {
        var img = document.createElement('img');
        img.src = arguments[idex];
        _imageCache.push(img);
    }
};


 }(this));
