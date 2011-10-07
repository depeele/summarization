/** @file
 *
 *  Backbone View for a document.
 *
 *  Requires:
 *      backbone.js
 *      view/section.js
 *      jquery.js
 */
/*jslint nomen:false,laxbreak:true,white:false,onevar:false */
/*global Backbone:false */
(function() {
    var app         = this.app || (module ? module.exports : this);
    if (! app.View)     { app.View  = {}; }
    if (! app.Model)    { app.Model = {}; }

    var $           = jQuery.noConflict();
    app.View.Doc    = Backbone.View.extend({
        tagName:    'article',
        template:   _.template($('#template-doc').html()),

        initialize: function() {
            this.$el = $(this.el);

            rangy.init();

            $(document).bind('mouseup.doc', _.bind(this.setSelection, this));
        },

        /** @brief  Override so we can unbind events bound in initialize().
         */
        remove: function() {
            $(document).unbind('.doc');

            return Backbone.View.prototype.remove.call(this);
        },

        /** @brief  (Re)render the contents of the document item. */
        render:     function() {
            var self    = this;

            self.$el.attr('id', self.model.cid);
            self.$el.html( self.template( self.model.toJSON() ) );

            self.$sections = self.$el.find('.sections:first');

            // Append a view of each section
            self.model.get('sections').each(function(model) {
                var view    = new app.View.Section({model:model});

                self.$sections.append( view.render().el );
            });

            self.$s = self.$el.find('.sentence');

            // Give each sentence an indexed-based id
            self.$s.each(function(idex) {
                var $s  = $(this);
                $s.attr('id', 'sentence-'+ idex);
            });

            self.model.get('notes').each(function(model) {
                // :TODO: Render this note
            });

            return self;
        },

        /** @brief  On mouseup, check to see if we have a rangy selection.
         */
        setSelection: function() {
            var self        = this;
            var sel         = rangy.getSelection();
            var range       = sel.getRangeAt(0);
            var $start      = $(range.startContainer);
            var $end        = $(range.endContainer);
            var $startS     = $start.parents('.sentence');
            var $endS       = $end.parents('.sentence');
            var ranges      = new app.Model.Ranges();

            if (($startS.length > 0) || ($endS.length > 0))
            {
                /* Since start OR end is within a sentence, ensure both ends
                 * are within sentences.
                 */
                if ($startS.length < 1)
                {
                    /* The starting container is NOT within a sentence.  Adjust
                     * to start with the first sentence.
                     */
                    $startS = self.$s.first();
                }

                if ($endS.length < 1)
                {
                    /* The ending container is NOT within a sentence.  Adjust
                     * to end with the last sentence.
                     */
                    $endS = self.$s.last();
                }
            }

            if ($startS[0] !== $endS[0])
            {
                /* This range crosses sentence boundaries.
                 *
                 * Determine the contiguous sentences involved ending the range
                 * at the first un-expanded sentence.
                 */
                var end         = self.$s.index( $endS ),
                    $selectable = [],
                    $s;
                for ( var idex = self.$s.index( $startS );
                        (idex <= end) && ($s = self.$s.eq(idex) );
                            idex++)
                {
                    if ($s.hasClass('expanded') || $s.hasClass('expansion'))
                    {
                        $selectable.push( $s );
                    }
                    else if ($selectable.length > 0)
                    {
                        break;
                    }
                }

                if ($selectable.length > 0)
                {
                    /* We have one or more selectable sentences.  See if we
                     * need to contract the start or end of the range.
                     */

                    var $newStart   = _.first($selectable);
                    var $newEnd     = _.last($selectable);
                    var $content;

                    /* If we have a new start, contract the beginning of the
                     * range to the first character of the first selectable
                     * sentence.
                     */
                    if ($newStart[0] !== $startS[0])
                    {
                        $content = $newStart.find('.content');
                        range.setStart($content.get(0).childNodes[0], 0);
                    }

                    /* If we have a new end, contract the end of the range to
                     * the last character of the last selectable sentence.
                     */
                    if ($newEnd[0] !== $endS[0])
                    {
                        $content = $newEnd.find('.content');
                        range.setEnd($content[0].childNodes[0],
                                     $content.text().length);
                    }

                    // Establish the new range.
                    sel.setSingleRange( range );

                    /* Finally, create an independent range for each involved
                     * sentence.
                     */
                    var last    = $selectable.length;
                    $.each($selectable, function(idex, s) {
                        var $s          = $(s);
                        var $content    = $s.find('.content');
                        var sRange      = new app.Model.Range({
                                            sentenceId: $s.attr('id')
                                          });

                        if (idex === 0)
                        {
                            sRange.setStart(range.startOffset);

                            /* Careful!  If there is only one sentence, don't
                             * loose the ending offset.
                             */
                            sRange.setEnd((idex >= (last - 1)
                                            ? range.endOffset
                                            : $content.text().length) );
                        }
                        else if (idex >= (last - 1))
                        {
                            sRange.setOffsets(0, range.endOffset);
                        }
                        else
                        {
                            sRange.setOffsets(0, $content.text().length);
                        }

                        ranges.add(sRange);
                    });
                }
                else
                {
                    /* There are no selectable sentences in the range.
                     * De-select all
                     */
                    sel.removeAllRanges();
                }
            }
            // IFF we have start and end sentences...
            else if (($startS.length > 0) && ($endS.length > 0))
            {
                // Use the simple range for this single sentence.
                ranges.add({
                    sentenceId: $startS.attr('id'),
                    offsetStart:range.startOffset,
                    offsetEnd:  range.endOffset
                });
            }

            if ( (ranges.length === 1) && ranges.at(0).isEmpty() )
            {
                // There is no sentence selection
                ranges.remove( ranges.at(0) );
            }

            // Remember the selection information
            if (self.ranges)    { delete self.ranges; }
            self.ranges = ranges;

            /*
            console.log('view.doc::setSelection(): '
                        + ranges.length +' ranges');
            // */
        }
    });

 }).call(this);
