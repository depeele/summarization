/** @brief  Handle a postMessage()
 *  @param  msg     The message data:
 *                      {action: *action*, action-secific-data}
 *                          Valid actions:  'view', annotations:[]
 */
self.on('message', function(msg) {
    switch (msg.action)
    {
    case 'view':
        render(msg.annotations);
        break;
    }
});

var $annotations    = $('#annotation-list');

/** @brief  Render the given set of annotations.
 *  @param  annotations     An array of Annotation records;
 */
function render(annotations)
{
    $annotations.empty();

    //console.log('Present '+ annotations.length +' annotations...');

    annotations.forEach(function(annotation) {
        var $annotation = $('#template .annotation-details').clone();

        /*
        console.log('Annotation: '
                    +   'text[ '+       annotation.annotationText +' ], '
                    +   'url[ '+        annotation.url            +' ], '
                    +   'ancestorId[ '+ annotation.ancestorId     +' ], '
                    +   'anchorText[ '+ annotation.anchorText     +' ]');
        // */

        $annotation.find('.url')
            .text(annotation.url)
            .attr('href', annotation.url)
            .bind('click', function(e) {
                e.stopPropagation();
                e.preventDefault();

                self.postMessage({action:'visit', url:annotation.url});
            });

        $annotation.find('.selection-text')
            .text(annotation.anchorText);

        $annotation.find('.annotation-text')
            .text(annotation.annotationText);

        $annotations.append($annotation);
    });
}
