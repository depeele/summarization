/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:
 *                              'update',       annotations:[]
 *                              'changeStatus', active:bool, annotations:[]
 */
self.on('message', function(msg) {
    switch (msg.action)
    {
    case 'update':
        /*
        console.log('matcher:message: update, '
                    +   msg.annotations.length +' annotation'
                    +   (msg.annotations.length === 1 ? '' : 's'));
        // */

        update(msg.annotations);
        break;

    case 'changeStatus':
        /*
        console.log('matcher:message: changeStatus, '
                    +   'active: '+ (msg.active ? 'true' : 'false') +', '
                    +   msg.annotations.length +' annotation'
                    +   (msg.annotations.length === 1 ? '' : 's'));
        // */

        changeStatus(msg.active, msg.annotations);
        break;

    default:
        consolg.log('matcher:message: unknown message [ '+ msg.action +' ]');
        break;
    }
});

var active      = false,    // Current activation status
    dataName    = 'annotations_matcher';

/** @brief  Change the current activation status
 *  @param  newStatus   The (new) status;
 *  @param  annotations The (new) annotations;
 */
function changeStatus(newStatus, annotations)
{
    active = newStatus;
    if (active)
    {
        // Add our style-sheet
    }
    else
    {
        // Remove our style-sheet
    }

    update(annotations);
}

/** @brief  Update the presentation of any annotations matching the current
 *          page.
 *  @param  annotations     The set of annotations;
 */
function update(annotations)
{
    // Remove any current anchors
    removeAnchors();

    if (! active)   { return; }

    var url = document.location.toString();
    annotations.forEach(function(annotation) {
        if (annotation.url === url)
        {
            createAnchor(annotation);
        }
    });
}

/** @brief  Create an anchor element for the given annotation.
 *  @param  annotation  The annotation;
 */
function createAnchor(annotation)
{
    var $ancestor   = $('#'+ annotation.ancestorId),
        $anchor     = $ancestor
                        .parent()
                            .find(':contains('+ annotation.anchorText +')')
                                .last(),
        data        = {
            border:     $anchor.css('border'),
            annotation: annotation
        };

    /* Add the 'annotated' CSS class, modify the border, add data, and bind
     * events
     */
    $anchor
        .addClass('annotated')
        .css('border', '3px dashed yellow')
        .data(dataName, annotation)
        .bind('mouseenter.matcher', function(e) {
            self.port.emit('show', annotation);

            e.stopPropagation();
            e.preventDefault();
        })
        .bind('mouseleave.matcher', function(e) {
            self.port.emit('hide');
        });
}

/** @brief  Remove all annotation anchors.
 */
function removeAnchors()
{
    var $anchors    = $('.annotated');

    /* Reset the border, remove the 'annotated' CSS class, our data, and unbind
     * our event handlers.
     */
    $anchors.each(function() {
        var $anchor = $(this),
            data    = $anchor.data(dataName);

        $anchor
            .css('border', (data.border ? data.border : ''))
            .removeClass('annotated')
            .removeData(dataName)
            .unbind('.matcher');
    });
}
