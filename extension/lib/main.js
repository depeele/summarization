var widgets         = require('widget'),
    pageMod         = require('page-mod'),
    panels          = require('panel'),
    notifications   = require('notifications'),
    privateBrowsing = require('private-browsing'),
    tabs            = require('tabs'),
    simpleStorage   = require('simple-storage'),
    data            = require('self').data,
    annotatorIsOn   = false,
    selectors       = [],
    matchers        = [],
    widget          = null;

if (! simpleStorage.storage.annotations)
{
    // Initialize our annotations store
    simpleStorage.storage.annotations = [];
}

/** @brief  Handle the simpleStorage 'OverQuote' event.
 */
simpleStorage.on('OverQuota', function() {
    notifications.notify({
        title:  'Storage space exceeded',
        text:   'Removing older annotations'
    });

    while (simpleStorage.quotaUsage > 1)
    {
        simpleStorage.storage.annotations.shift();
    }
});

/** @brief  Change the state of our widget/button
 *  @param  active  Is the new state active (true) or not (false);
 */
function changeStatus( active )
{
    annotatorIsOn = active;

    widget.contentURL = (active
                            ? data.url('widget/pencil-on.png')
                            : data.url('widget/pencil-off.png'));
    notifyStatusChange();
}

/** @brief  Can we currently annotate?
 *
 *  This checks if annotation has been toggled on AND we are not currently in
 *  "private-browsing" mode.
 *
 *  @return true | false
 */
function canAnnotate()
{
    return (annotatorIsOn && (! privateBrowsing.isActive));
}

/** @brief  Handle a click on the widget/button to toggle the activation status
 *          of our add-on.
 */
function toggleStatus()
{
    if (privateBrowsing.isActive)
    {
        return false;
    }

    changeStatus( !annotatorIsOn );
    return canAnnotate();
}

/** @brief  Notify all page-mod workers (selectors and matchers) of our current
 *          activation status.
 */
function notifyStatusChange()
{
    var active  = canAnnotate();

    selectors.forEach(function(selector) {
        // Trigger the event handler: data/selector.js:on('message')
        selector.postMessage({action:'changeStatus', active:active});
    });
    matchers.forEach(function(matcher) {
        // Trigger the event handler: data/matcher.js:on('message')
        matcher.postMessage({
            action:     'changeStatus',
            active:     active,
            annotations:simpleStorage.storage.annotations});
    });
}

/** @brief  Notify all page-mod workers (matchers) of any change to our
 *          annotations.
 */
function notifyMatchers()
{
    matchers.forEach(function(matcher) {
        // Trigger the event handler: data/selector.js:on('message')
        matcher.postMessage({
            action:      'update',
            annotations: simpleStorage.storage.annotations
        });
    });
}

/** @brief  Remove the identified worker from the worker queue.
 *  @param  worker  The worker to remove;
 *  @param  workers The worker queue;
 *  @param  events  If provided, a hash of eventName/handler items that
 *                  should be removed via worker.port.removeListener();
 */
function detachWorker(worker, workers, events)
{
    var idex    = workers.indexOf(worker);
    if (idex >= 0)
    {
        //console.log("detachWorker #", idex);
        if (events)
        {
            for (var name in events)
            {
                worker.port.removeListener(name, events[name]);
            }
        }

        workers.splice(idex, 1);
    }
}

/** @brief  Add a new annotation to our annotations store
 *  @param  text    The annotation text;
 *  @param  anchor  Anchor information [ url, ancestorId, anchorText ];
 */
function addAnnotation(text, anchor)
{
    /*
    console.log("Add a new annotation: ",
                    "anchor.url[", anchor[0], "], ",
                    "anchor.ancestorId[", anchor[1], "], ",
                    "anchor.anchorText[", anchor[2] ,"], ",
                    "text[", text, "]");
    // */

    var annotation  = new Annotation(text, anchor);
    simpleStorage.storage.annotations.push(annotation);

    notifyMatchers();


    var count   = simpleStorage.storage.annotations.length,
        text    = 'There '+      (count === 1 ? 'is' : 'are')
                + ' now '
                + count
                + ' annotation'+ (count === 1 ? ''   : 's');

    notifications.notify({
        title:  'Annotation added',
        text:   text
    });
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

    console.log("New Annotation: ",
                    "text[",      this.annotationText, "], ",
                    "url[",        this.url,           "], ",
                    "ancestorId[", this.ancestorId,    "], ",
                    "anchorText[", this.anchorText,    "]");
}

/** @brief  The main function for our add-on.
 */
exports.main = function() {
        /* Create a page-mode worker to highlight DOM elements that may be
         * annotated:
         *  data/jquery.min.js
         *  data/selector.js
         */
    var selector    = pageMod.PageMod({
                        include:            ['*'],
                        contentScriptWhen:  'ready',
                        contentScriptFile:  [
                            data.url('jquery.min.js'),
                            data.url('selector.js')
                        ],
                        onAttach:           function(worker) {
                            worker.postMessage({
                                action: 'changeStatus',
                                on:     canAnnotate()
                            });
                            //console.log("attachWorker #", selectors.length);

                            selectors.push(worker);

                            /* Handle a 'show' message, generated via
                             *  data/selector.js when a highlighted element
                             *  is clicked.  'data' is an array
                             *  (annotationAnchor) comprised of:
                             *      [ url, ancestorId, elementText ]
                             */
                            var events  = {
                                show: function(data) {
                                    annotationEditor.annotationAnchor = data;

                                    // Trigger the annotationEditor's 'onShow'
                                    annotationEditor.show();
                                }
                            };

                            for (var name in events)
                            {
                                worker.port.on(name, events[name]);
                            }
                            worker.on('detach', function() {
                                detachWorker(this, selectors, events);
                            });
                        }
                      }),
        /* Create an annotation editor panel that will be presented when the
         * user clicks on a highlighted DOM element to allow them to enter an
         * annotation:
         *  data/editor/annotation.html
         *  data/editor/annotation.css
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
                      }),
        /* Create a page-mode worker to indicate any DOM elements that have
         * been annotated:
         *  data/jquery.min.js
         *  data/matcher.js
         */
        matcher     = pageMod.PageMod({
                        include:            ['*'],
                        contentScriptWhen:  'ready',
                        contentScriptFile:  [
                            data.url('jquery.min.js'),
                            data.url('matcher.js')
                        ],
                        onAttach:           function(worker) {
                            worker.postMessage({
                                action:      'changeStatus',
                                on:          canAnnotate(),
                                annotations: simpleStorage.storage.annotations
                            });
                            matchers.push(worker);

                            /* Handle a 'show' message, generated via
                             *  data/selector.js when a highlighted element
                             *  is clicked.
                             */
                            var events  = {
                                show:   function(annotation) {
                                    annotationPanel.annotation = annotation;
                                    annotationPanel.show();
                                },
                                hide:   function() {
                                    annotationPanel.hide();
                                    annotationPanel.annotation = null;
                                }
                            };

                            for (var name in events)
                            {
                                worker.port.on(name, events[name]);
                            }
                            worker.on('detach', function() {
                                detachWorker(this, matchers, events);
                            });
                        }
                      });
        /* Create an annotation panel that will be used to present information
         * about a specific annotation when ther user clicks on it.
         *  data/panel/annotation.html
         *  data/panel/annotation.css
         *  data/panel/annotation.js
         */
        annotationPanel
                    = panels.Panel({
                        width:              200,
                        height:             180,
                        contentURL:         data.url('panel/annotation.html'),
                        contentScriptFile:  [
                            data.url('jquery.min.js'),
                            data.url('panel/annotation.js')
                        ],
                        onShow:             function() {
                            if (! this.annotation)  { return; }

                            this.postMessage({
                                action:     'show',
                                annotation: this.annotation
                            });
                        }
                      });

    /* Create the widget/button to toggle our activation status
     *  data/widget/widget.js
     *  data/widget/pencil-on.png
     *  data/widget/pencil-off.png
     */
    widget = widgets.Widget({
        id:                 'toggle-switch',
        label:              'Annotator',
        contentURL:         data.url('widget/pencil-off.png'),
        contentScriptWhen:  'ready',
        contentScriptFile:  data.url('widget/widget.js'),
        panel:              annotationList  
    });

    /* On left-click of our widget/button, toggle our activation status
     *  'left-click' is triggered via:
     *      data/widget/widget.js
    widget.port.on('left-click', function() {
        var active  = toggleStatus();

        console.log((active ? '' : 'de') +'activate');
    });
     */

    /* On right-click of our widget/button, present our annotation list
     *  'right-click' is triggered via:
     *      data/widget/widget.js
    widget.port.on('right-click', function() {
        console.log('show annotation list');
        annotationList.show();
    });
     */

    /* Let 'widget.panel' handle any left-click so the panel will remain
     * attached to the widget.
     *
     * On right-click of our widget/button, toggle our state.
     *  'right-click' is triggered via:
     *      data/widget/widget.js
     */
    widget.port.on('right-click', function() {
        var active  = toggleStatus();

        console.log((active ? '' : 'de') +'activate');
    });

    // When the user enters private-browsing mode, turn off annotation
    privateBrowsing.on('start', function() {
        changeStatus( false );
    });

    privateBrowsing.on('stop', function() {
        if (canAnnotate())
        {
            changeStatus( true );
        }
    });
};
