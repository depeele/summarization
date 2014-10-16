/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:
 *                              'focus' (no data)
 */
self.on('message', function(msg) {
    console.log('editor/annotation.js: message[ '+ msg.action +' ]');

    switch (msg.action)
    {
    case 'focus':
        inputFocus();
        break;
    }
});

/** @brief  Focus on the input/annotation box.
 */
function inputFocus()
{
    $input.val('');
    $input.focus();
}

var $input  = $('#annotation-box');
$input.on('keydown', function(e) {
    //console.log('editor/annotation: which[ '+ e.which +' ]');

    if (e.which === 13)
    {
        self.postMessage({action:'post', text:$input.val()});

        $input.val('');
        e.preventDefault();
        e.stopPropagation();
    }
});

