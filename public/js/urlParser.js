/** @file
 *
 *  Provide simple url parsing.
 */
(function(context) {
    
/**
 *  Retrieve all search variables.
 *  @method getSearchVars
 * 
 *  @return An Object of key/value pairs {Object};
 */
context.getSearchVars = function() {
    var search = window.location.search.slice(1);
    var parts  = search.split('&');
    var vars   = {};
    for (var i = 0; i < parts.length; i++) {
        var pair = parts[i].split('=');
        var key  = decodeURIComponent(pair[0]);
        var val  = decodeURIComponent(pair[1]);
        
        vars[key] = val;
        
    }
    return vars;
};

/**
 *  Retrieve the value of a single search variable.
 *  @method getSearchVar
 *  @param  name    The name of the desired variable {String};
 * 
 *  @return The value if located {String | undefined};
 */
context.getSearchVar = function(name) {
    var search = window.location.search.slice(1);
    var parts  = search.split('&');
    var val;
    
    name = name.toLowerCase();
    for (var i = 0; i < parts.length; i++) {
        var pair = parts[i].split('=');
        if (decodeURIComponent(pair[0]).toLowerCase() == name) {
            val = decodeURIComponent(pair[1]);
            break;
        }
    }
    
    return val;
};

}(this));