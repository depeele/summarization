var widgets         = require('widget'),
    pageMod         = require('page-mod'),
    panels          = require('panel'),
    tabs            = require('tabs'),
    simpleStorage   = require('simple-storage'),
    data            = require('self').data,
    annotatorIsOn   = false,
    selectors       = [];

if (! simpleStorage.storage.annotations)
{
    // Initialize our annotations store
    simpleStorage.storage.annotations = [];
}

/** @brief  Handle a click on the widget/button to toggle the activation status
 *          of our add-on.
 */
function toggleActivation()
{
    annotatorIsOn = !annotatorIsOn;
    notifySelectors();
    return annotatorIsOn;
}

/** @brief  Notify all page-mod workers (selectors) of our current activation
 *          status.
 */
function notifySelectors()
{
    selectors.forEach(function(selector) {
        // Trigger the event handler: data/selector.js:on('message')
        selector.postMessage({action:'changeStatus', on:annotatorIsOn});
    });
}

/** @brief  Remove the identified worker from the worker queue.
 *  @param  worker  The worker to remove;
 *  @param  workers The worker queue;
 */
function detachWorker(worker, workers)
{
    var idex    = workers.indexOf(worker);
    if (idex >= 0)
    {
        workers.splice(idex, 1);
    }
}

/** @brief  Add a new annotation to our annotations store
 *  @param  text    The annotation text;
 *  @param  anchor  Anchor information [ url, ancestorId, anchorText ];
 */
function addAnnotation(text, anchor)
{
    console.log("Add a new annotation:");
    console.log(anchor);
    console.log(text);

    var annotation  = new Annotation(text, anchor);
    simpleStorage.storage.annotations.push(annotation);

    console.log('There are now '
                + simpleStorage.storage.annotations.length
                +' annotations');
}

/** @brief  An Annotation object.
 *  @param  text    The annotation text;
 *  @param  anchor  Anchor information [ url, ancestorId, anchorText ];
 */
function Annotation(text, anchor)
{
    this.annotationText = text;
    this.url            = anchor[0];
    this.ancestorId     = anchor[1];
    this.anchorText     = anchor[2];

    console.log('New Annotation: '
                +   'text[ '+       this.annotationText +' ], '
                +   'url[ '+        this.url            +' ], '
                +   'ancestorId[ '+ this.ancestorId     +' ], '
                +   'anchorText[ '+ this.anchorText     +' ]');
}

/** @brief  The main function for our add-on.
 */
exports.main = function() {
        /* Create the widget/button to toggle our activation status
         *  data/widget/widget.js
         */
    var widget      = widgets.Widget({
                        id:                 'toggle-switch',
                        label:              'Annotator',
                        contentURL:         data.url('widget/pencil-off.png'),
                        contentScriptWhen:  'ready',
                        contentScriptFile:  data.url('widget/widget.js')
                      }),
        /* Create a page-mode worker to highlight DOM elements that may be
         * annotated:
         *  data/jquery.min.js
         *  data/selector.js
         */
        selector    = pageMod.PageMod({
                        include:            ['*'],
                        contentScriptWhen:  'ready',
                        contentScriptFile:  [
                            data.url('jquery.min.js'),
                            data.url('selector.js')
                        ],
                        onAttach:           function(worker) {
                            worker.postMessage({
                                action: 'changeStatus',
                                on:     annotatorIsOn
                            });
                            selectors.push(worker);

                            /* Handle a 'show' message, generated via
                             *  data/selector.js when a highlighted element
                             *  is clicked.  'data' is an array
                             *  (annotationAnchor) comprised of:
                             *      [ url, ancestorId, elementText ]
                             */
                            worker.port.on('show', function(data) {
                                annotationEditor.annotationAnchor = data;

                                // Trigger the annotationEditor's 'onShow'
                                annotationEditor.show();
                            });
                            worker.port.on('detach', function(data) {
                                detachWorker(this, selectors);
                            });
                        }
                      }),
        /* Create an annotation editor panel that will be presented when the
         * user clicks on a highlighted DOM element to allow them to enter an
         * annotation:
         *  data/editor/annotation.html
         *  data/editor/annotation.js
         */
        annotationEditor
                    = panels.Panel({
                        width:              250,
                        height:             250,
                        contentURL:         data.url('editor/annotation.html'),
                        contentScriptFile:  [
                            data.url('jquery.min.js'),
                            data.url('editor/annotation.js')
                        ],
                        /* Handle a postMessage() from the annotation editor
                         *  data/editor/annotation.js
                         * communicating the text of an annotation.
                         *
                         * msg: {action:'post', text:value}
                         */
                        onMessage:          function(msg) {
                            if (msg && (msg.action === 'post') && msg.text)
                            {
                                // Save the annotation
                                addAnnotation(msg.text, this.annotationAnchor);
                            }

                            annotationEditor.hide();
                        },
                        /* Handle a 'show' trigged by selector when the user
                         * clicks on a highlighted element causing the worker
                         * to post a 'show' message.
                         *  user-click
                         *      => worker.on('click')
                         *          self.port.emit('show')
                         *      => selector.on('show')
                         *          annotationEditor.show()
                         *      => onShow()
                         */
                        onShow:             function() {
                            this.postMessage({action:'focus'});
                        }
                      }),
        /* Create an annotation list panel that will be used to present the
         * list of stored annotations when the user right-clicks on our
         * widget/button.
         *  data/list/annotation.html
         *  data/list/annotation.css
         *  data/list/annotation.js
         */
        annotationList  
                    = panels.Panel({
                        width:              450,
                        height:             450,
                        contentURL:         data.url('list/annotation.html'),
                        contentScriptFile:  [
                            data.url('jquery.min.js'),
                            data.url('list/annotation.js')
                        ],
                        /* Handle a postMessage() from the annotation list
                         *  data/list/annotation.js
                         * communicating a url to visit.
                         *
                         * msg: {action:'visit', url:value}
                         */
                        onMessage:          function(msg) {
                            if (msg && (msg.action === 'visit') && msg.url)
                            {
                                // Open the url in a new tab
                                tabs.open(msg.url);
                            }
                        },
                        /* Handle a 'show' trigged by widget when the user
                         * right-clicks on our widget/button:
                         *  user-right-click
                         *      => data/widget/widget.js:on('click')
                         *          self.port.emit('right-click')
                         *      => widget.port.on('right-click')
                         *          annotationlist.show()
                         *      => onShow()
                         */
                        onShow:             function() {
                            this.postMessage({
                                action:      'view',
                                annotations: simpleStorage.storage.annotations
                            });
                        }
                      });

    /* On left-click of our widget/button, toggle our activation status
     *  'left-click' is triggered via:
     *      data/widget/widget.js
     */
    widget.port.on('left-click', function() {
        var active  = toggleActivation();

        console.log((active ? '' : 'de') +'activate');
        widget.contentURL = (active
                                ? data.url('widget/pencil-on.png')
                                : data.url('widget/pencil-off.png'));
    });

    /* On right-click of our widget/button, present our annotation list
     *  'right-click' is triggered via:
     *      data/widget/widget.js
     */
    widget.port.on('right-click', function() {
        console.log('show annotation list');
        annotationList.show();
    });
};
