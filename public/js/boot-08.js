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
var app             = this.app = (this.app || {config:{},     options:{},
                                               Model:{},      View:{},
                                               Controller:{}, Helper:{}});
app.config  = {
    mode:       'development',
    animSpeed:  200,
    table:      {
        options:    {name:'app.options', id:'mine'},
        notes:      {name:'app.notes.08'}
    }
};

/** @brief  Boot the application once all dependencies are loaded. */
function bootApp()
{
    var $       = jQuery.noConflict();

    app.config.docId = (window.location.search
                            ? window.location.search
                                .replace(/^\?(?:\/?samples\/?)?([^\.\/]+)(?:\.json|\.xml)?$/, '$1')
                            : '0001a');

    $(document).ready(function() {
        /* Startup the application (js/jquery.summary-08.js)
         * attaching to the DOM element with id 'app-Summary'
         */
        app.main = new $.Summary({
            el:     $('#app-Summary'),
            doc:    'samples/'+ app.config.docId +'.json'
        });
    });
}

/******************************************************************************
 * Load dependencies and, once loading is complete, invoke bootApp().
 *
 */
if (app.config.mode === 'development')
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

        // Rangy and plugins
        'rangy':        { src: 'js/rangy.js' },


        // Backbone and storage
        'backbone':     { src: 'js/backbone.js',
                          req: ['underscore', 'jquery']},
        'backbone.localStorage':
                        { src: 'js/backbone.localStorage.js',
                          req: ['backbone']},

        // Backbone models
        'model.options':{ src: 'js/model/options.js',
                          req: ['backbone.localStorage']},
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

        // Backbone views
        'view.sentence':{ src: 'js/view/sentence.js', req: ['model.sentence']},
        'view.paragraph':
                        { src: 'js/view/paragraph.js',
                          req: ['model.paragraph', 'view.sentence']},
        'view.section': { src: 'js/view/section.js',
                          req: ['model.section', 'view.paragraph']},

        'view.range':   { src: 'js/view/range.js',
                          req: ['model.range', 'rangy']},
        'view.selection':
                        { src: 'js/view/selection.js', req: ['view.range']},
        'view.comment': { src: 'js/view/comment.js',
                          req: ['model.comment']},
        'view.note':    { src: 'js/view/note.js',
                          req: ['view.selection', 'view.comment',
                                'model.note']},

        'view.doc':     { src: 'js/view/doc.js',
                          req: ['model.doc',
                                'view.section', 'view.selection', 'view.note']},

        // jQuery-ui and widgets
        'jquery-ui':    { src: 'js/jquery-ui.js',       req: ['jquery'] },
    
        'ui.checkbox':  { src: 'js/ui.checkbox.js',     req: ['jquery-ui'] },
    
        // Final suummary app
        'summary':      { src: 'js/jquery.summary-08.js',
                          req: [ 'jquery', 'utils',
                                 'rangy',
                                 'ui.checkbox',
                                 'model.options', 'model.user',
                                 'view.note', 'view.doc'
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
