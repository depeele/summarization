/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:
 *                              'changeStatus', active:boolean
 */
self.on('message', function(msg) {
    switch (msg.action)
    {
    case 'changeStatus':
        /*
        console.log('selector:message: changeStatus, '
                    +   'active: '+ (msg.active ? 'true' : 'false'));
        // */

        changeStatus(msg.active);
        break;

    default:
        consolg.log('selector:message: unknown message [ '+ msg.action +' ]');
        break;
    }
});

/** @brief  Change the current activation status
 *  @param  newStatus   The new (boolean) status;
 */
function changeStatus(newStatus)
{
    active = newStatus;
    if (! active)
    {
        resetMatchedElement();
    }
}

var $matched    = null,     // The currently matched element
    dataName    = 'annotation_selector',
    active      = false;    // Current activation status

/** @brief  Reset the currently active element. */
function resetMatchedElement()
{
    if ($matched)
    {
        var data    = $matched.data(dataName);

        // Restore original information
        $matched.css('background-color', data.bgColor)
                .removeData(dataName)
                .unbind('click.annotator');
        $matched = null;
    }
}

/* On mouse-enter, if we're active, highlight the target element for annotation
 * and add a click handler.
 */
$('*').mouseenter(function() {
    var $el = $(this);

    if ((! active) || $el.hasClass('annotated'))    { return; }

    resetMatchedElement();

    var $ancestor   = $el.closest("[id]");
    $matched        = $el.first();

    // Remember original information
    $matched.data(dataName, {bgColor: $el.css('background-color')});

    $matched
        .css('background-color', 'yellow')
        .bind('click.annotator', function(e) {
            e.stopPropagation();
            e.preventDefault();

            /* Trigger a 'show' with an annotation anchor comprised of:
             *  [ url, ancestorId, elementText ]
             */
            self.port.emit('show', [document.location.toString(),
                                    $ancestor.attr('id'),
                                    $matched.text()]);
        });
});


// On mouse-out, reset any currently matched element.
$('*').mouseout(function() {
    resetMatchedElement();
});
