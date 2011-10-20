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

        events: {
            'doc:ready':                            '_renderNotes',

            'sentence:expanded .sentence':          '_adjustPositions',
            'sentence:collapsed .sentence':         '_adjustPositions',
            'sentence:expansionExpanded .sentence': '_adjustPositions',
            'sentence:expansionCollapsed .sentence':'_adjustPositions'
        },

        initialize: function() {
            this.$el = $(this.el);

            // Bind to changes to our underlying model
            var notes   = this.model.get('notes');

            notes.bind('add',    _.bind(this._noteAdded,   this));
            notes.bind('remove', _.bind(this._noteRemoved, this));

            rangy.init();

            /* Bind to mousedown, mouseup and dblclick at the document level.
             *
             * :NOTE: Do NOT bind 'click' since it will be fired following
             *        mousedown when selecting (at least in Chrome).  Instead,
             *        we bind to 'mousedown' and 'mouseup'.
             */
            $(document).bind( ['mousedown.viewDoc',
                               'mouseup.viewDoc',
                               'dblclick.viewDoc'].join(' '),
                             _.bind(this.setSelection, this));
        },

        /** @brief  Override so we can unbind events bound in initialize().
         */
        remove: function() {
            $(document).unbind('.viewDoc');

            return Backbone.View.prototype.remove.call(this);
        },

        /** @brief  (Re)render the contents of the document item. */
        render:     function() {
            var self    = this;

            self.$el.attr('id', self.model.cid);
            self.$el.html( self.template( self.model.toJSON() ) );

            // Store a reference to this view instance
            self.$el.data('View:Doc', self);

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

            return self;
        },

        /** @brief  On mouseup, check to see if we have a rangy selection.
         *          If we do, generate a Model.Ranges instance representing the
         *          selection and instantiate a View.Selection to present it.
         *  @param  e       The triggering event;
         */
        setSelection: function(e) {
            var self        = this,
                opts        = self.options;

            if (! opts.$notes)
            {
                return;
            }

            /*
            console.log('View::Doc:setSelection()[%s]: type[ %s ]',
                        self.model.cid,
                        (e ? e.type : '--'));
            // */

            /* :NOTE: Do NOT bind 'click' since it will be fired following
             *        mousedown when selecting (at least in Chrome).  Instead,
             *        we bind to 'mousedown' and 'mouseup' and if we see a
             *        'mouseup' following a 'mousedown', establish a selection.
             */
            if (e)
            {
                if ( (e.type === 'mouseup') && (! self._mousedownE) )
                {
                    // 'mouseup' without a 'mousedown' -- IGNORE
                    return;
                }

                // Did this event occurred within a '.note' element?
                var $note   = $(e.target).parents('.note');
                if ($note.length > 0)
                {
                    // Yes -- IGNORE
                    return;
                }

                if (e.type === 'mousedown')
                {
                    // Remember this 'mousedown' event
                    self._mousedownE = e;
                    return;
                }

                /**************************************************
                 * This is either a 'mouseup' event following a
                 * 'mousedown' OR a 'dblclick' event.  In either
                 * case, continue to check for a current selection.
                 */
            }
            self._mousedownE = null;

            /*
            console.log('View::Doc:setSelection()[%s]: type[ %s ] -- ACT',
                        self.model.cid,
                        (e ? e.type : '--'));
            // */

            var sel         = rangy.getSelection();
            if (sel.rangeCount < 1)
            {
                return;
            }

            /**********************************************************
             * Limit selection to token boundaries
             * (i.e. word, whitespace, punctuation).
             */
            var range       = sel.getRangeAt(0),        // rangy range
                $startT     = $(range.startContainer).parent(),
                $endT       = $(range.endContainer).parent(),
                $startS     = $startT.parents('.sentence'),
                $endS       = $endT.parents('.sentence'),
                ranges      = new app.Model.Ranges();

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
                    $startT = $startS.children().first();
                }

                if ($endS.length < 1)
                {
                    /* The ending container is NOT within a sentence.  Adjust
                     * to end with the last sentence.
                     */
                    $endS = self.$s.last();
                    $endT = $endS.children().last();
                }
            }

            /* Determine the contiguous sentences involved ending the range
             * at the first un-expanded sentence and then create a Model.Range
             * entry for each sentence between $startS.$startT and $endS.$endT
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
                // NOT expanded.  If we have at least one, stop
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
                var $newStart   = _.first($selectable),
                    $newEnd     = _.last($selectable);

                /* If we have a new start, contract the beginning of the
                 * range to the first character of the first selectable
                 * sentence.
                 */
                if ($newStart[0] !== $startS[0])
                {
                    $startT = $newStart.find('.content').children().first();
                }

                /* If we have a new end, contract the end of the range to
                 * the last character of the last selectable sentence.
                 */
                if ($newEnd[0] !== $endS[0])
                {
                    $endT = $newEnd.find('.content').children().last();
                }

                /* Create an independent app.Model.Range for each involved
                 * sentence.
                 */
                var last    = $selectable.length;
                $.each($selectable, function(idex, s) {
                    var $s          = $(s),
                        $tokens     = $s.find('.content').children(),
                        rangeModel  = new app.Model.Range({
                                        sentenceId: $s.attr('id')
                                      });

                    if (idex === 0)
                    {
                        rangeModel.setStart( $tokens.index($startT) );

                        /* Careful!  If there is only one sentence, don't
                         * loose the ending offset.
                         */
                        rangeModel.setEnd((idex >= (last - 1)
                                            ? $tokens.index($endT)
                                            : $tokens.length));
                    }
                    else if (idex >= (last - 1))
                    {
                        rangeModel.setOffsets(0, $tokens.index($endT));
                    }
                    else
                    {
                        rangeModel.setOffsets(0, $tokens.length);
                    }

                    ranges.add(rangeModel);
                });
            }

            if ( (ranges.length === 1) && ranges.at(0).isEmpty() )
            {
                // There is no sentence selection
                ranges.remove( ranges.at(0) );
            }

            if (self.selection)
            {
                // Remove any current Selection View.
                self.selection.remove();
                self.selection = null;
            }

            if (ranges.length > 0)
            {
                /* Create a new Selection View using the generated ranges
                 * model.
                 */
                self.selection = new app.View.Selection( {ranges: ranges} );
                opts.$notes.append( self.selection.render().el );
            }

            // De-select any rangy ranges
            sel.removeAllRanges();

            /*
            console.log('View.Doc::setSelection(): '
                        + ranges.length +' ranges');
            // */
        },

        /**********************************************************************
         * "Private" methods.
         *
         */

        /** @brief  Render any notes associated with this document.
         *  @param  e       The triggering event;
         *
         */
        _renderNotes: function(e) {
            var self    = this,
                opts    = self.options,
                notes   = self.model.get('notes');
            notes.each(function(note) {
                /* Invoke the routing that is normally triggered when a new
                 * note is added.
                 */
                self._noteAdded(note, notes);
            });

            return self;
        },

        /** @brief  Rendering has changed in such a way that overlays MAY need
         *          to be repositioned.  Find all overlays that FOLLOW the
         *          triggering element and notify them.
         *  @param  e       The triggering event;
         *
         */
        _adjustPositions: function(e) {
            var self    = this,
                opts    = self.options,
                $s      = $(e.target),
                fromDex = self.$s.index( $s ),
                // .overlay .range elements from all FOLLOWING sentences
                $ranges = self.$s.filter( function(idex) {
                                            return (idex >= fromDex); });

            /*
            console.log('View::Doc:_adjustPositions()[%s]: %d ranges',
                        self.model.cid,
                        $ranges.length);
            // */

            if ($ranges.length > 0)
            {
                $ranges.trigger('overlay:position');
            }

            return self;
        },

        /** @brief  A note has been added to our underlying model.
         *  @param  note    The Model.Note instance being added;
         *  @param  notes   The containing collection (Model.Notes);
         *  @param  options Any options used with add();
         */
        _noteAdded: function(note, notes, options) {
            var self    = this,
                opts    = self.options;

            /* Create a new View.Note to associate with this new model
             *
             * This should only occur when a user clicks on the 'add-note'
             * range-control associated with an active selection.  In this
             * case, we need to check the value of app.options.quickTag.  If it
             * is false, activate editing on the first comment of the new note.
             */
            var view    = new app.View.Note({model: note, hidden: true});
            opts.$notes.append( view.render().el );

            //setTimeout(function() {
                view.show( (app.options.get('quickTag') !== true
                                ? function() {  view.editComment(); }
                                : undefined) );
            //}, 100);
        },

        /** @brief  A note has been removed from our underlying model.
         *  @param  note    The Model.Note instance being removed;
         *  @param  notes   The containing collection (Model.Notes);
         *  @param  options Any options used with remove();
         */
        _noteRemoved: function(note, notes, options) {
            var self    = this;

            /* The associated View.Note instance should notice the deletion of
             * it's underlying model and remove itself.
             */
        }
    });

 }).call(this);
