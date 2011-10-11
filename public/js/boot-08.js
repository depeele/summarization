/** @file
 *
 *  General client-side application initialization.
 *
 *  Requires:
 *      req.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {

// Define the application object
var app             = this.app = (this.app || {Option:{},   Model:{},
                                               View:{},     Controller:{},
                                               Helper:{}});
app.Option.mode    = 'development';

/** @brief  Boot the application once all dependencies are loaded. */
function bootApp()
{
    var $       = jQuery.noConflict();

    app.Option.docId = (window.location.search
                            ? window.location.search
                                .replace(/^\?(?:\/?samples\/?)?([^\.\/]+)(?:\.json|\.xml)?$/, '$1')
                            : '0001a');

    $(document).ready(function() {
        /* Startup the application (js/jquery.summary-08.js)
         * attaching to the DOM element with id 'app-Summary'
         */
        app.main = new $.Summary({
            el:     $('#app-Summary'),
            doc:    'samples/'+ app.Option.docId +'.json'
        });
    });
}

/******************************************************************************
 * Load dependencies and, once loading is complete, invoke bootApp().
 *
 */
if (app.Option.mode === 'development')
{
    // Development dependencies
    Req.assets = {
        'preloadImages':{ src: 'js/preloadImages.js' },

        'underscore':   { src: 'js/underscore.js' },

        'jquery':       {
            src:    'js/jquery.js',
    
            // script.onload handler that runs as soon as the script has loaded
            onload: function () {
                // be strict about jQuery usage.
                //var $ = jQuery.noConflict();
    
                // Setup an easy-to-use Req.js plugin for jQuery ($.Req)
                $.fn.Req = function(){
                    var args = arguments, t = this;
                    if (t.length)
                    {
                        Req.apply(null, $.map(args, function(a) {
                            return $.isFunction(a)
                                    ? function(){a.call(t);}
                                    : a;
                        }) );
                    }
                    return t;
                };
            }
        },
        'utils':        { src: 'js/jquery.utils.js',  req:['jquery']},

        'backbone':     { src: 'js/backbone.js',
                          req: ['underscore', 'jquery']},
        'backbone.localStorage':
                        { src: 'js/backbone.js',      req:['backbone']},

        // Backbone models
        'model.user':   { src: 'js/model/user.js',    req:['backbone']},
        'model.comment':{ src: 'js/model/comment.js', req:['backbone']},
        'model.range':  { src: 'js/model/range.js',   req:['backbone']},
        'model.note':   { src: 'js/model/note.js',
                          req: [ 'model.comment', 'model.range' ]},
        'model.sentence':
                        { src: 'js/model/sentence.js',req:['backbone']},
        'model.paragraph':
                        { src: 'js/model/paragraph.js',
                                                      req:['model.sentence']},
        'model.section':{ src: 'js/model/section.js', req:['model.paragraph']},
        'model.doc':    { src: 'js/model/doc.js',     req:['model.section']},

        // Backbone helpers
        'helper.click': { src: 'js/helper/click.js',
                          req: ['backbone', 'jquery']},

        // Backbone views
        'view.sentence':{ src: 'js/view/sentence.js',
                          req: ['backbone',
                                'model.sentence',
                                'helper.click',
                                'jquery']},
        'view.paragraph':
                        { src: 'js/view/paragraph.js',
                          req: ['model.paragraph',
                                'view.sentence',
                                'helper.click',
                                'jquery']},
        'view.section': { src: 'js/view/section.js',
                          req: ['model.section', 'view.paragraph', 'jquery']},
        'view.doc':     { src: 'js/view/doc.js',
                          req: ['model.doc', 'view.section', 'jquery']},

        'view.range':   { src: 'js/view/range.js',
                          req: ['model.range', 'jquery', 'rangy']},

        'view.selection':
                        { src: 'js/view/selection.js',
                          req: ['view.range', 'jquery']},

        // Rangy and plugins
        'rangy':        { src: 'js/rangy.js' },
        'rangy.serializer':
                        { src: 'js/rangy/serializer.js',req: ['rangy'] },

        // jQuery-ui and widgets
        'jquery-ui':    { src: 'js/jquery-ui.js',       req: ['jquery'] },
    
        'ui.checkbox':  { src: 'js/ui.checkbox.js',     req: ['jquery-ui'] },
    
        // Final suummary app
        'summary':      { src: 'js/jquery.summary-08.js',
                          req: [ 'model.user', 'model.comment', 'model.note',
                                 'view.doc', 'view.selection',
                                 'jquery', 'utils',
                                 'rangy.serializer',
                                 'ui.checkbox'
                          ] }
    };
}
else
{
    // Non-Development/Production dependencies
    Req.assets = {
        'preloadImages':{ src: 'js/preloadImages.min.js' },
        'summary':      { src: 'js/summary-08-full.min.js' }
    };
}

Req('preloadImages', function() {
        // Preload global images/sprites
        preloadImages('css/images/loading.gif', 'css/images/icons-16.png');
    },
    'summary',
    bootApp
);

 }).call(this);
