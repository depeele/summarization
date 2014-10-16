/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:
 *                              'view', annotations:[]
 */
self.on('message', function(msg) {
    switch (msg.action)
    {
    case 'show':
        render(msg.annotation.annotationText);
        break;
    }
});


var $annotation = $('#annotation');

/** @brief  Render the panel with the given text.
 *  @param  text    The text to render.
 */
function render(text)
{
    $annotation.text(text);
}
