/** @file
 *
 *  Provide a sprite-based checkbox.
 *
 *  Requires:
 *      ui.core.js
 *      ui.widget.js
 */
/*jslint nomen:false, laxbreak:true, white:false, onevar:false */
/*global jQuery:false */
(function($) {

$.widget("ui.checkbox", {
    version: "0.1.1",

    /* Remove the strange ui.widget._trigger() class name prefix for events
     * so we can bind to events like 'change' instead of 'checkboxchange'.
     *
     * If you need to know which widget the event was triggered from, either
     * bind directly to the widget or look at the event object.
     */
    widgetEventPrefix:    '',

    options: {
        // Defaults
        css:            'checkbox',         // General CSS class
        cssOn:          'on',               // CSS class when    checked
        cssOff:         'off',              // CSS class when un-checked
        titleOn:        'click to turn off',// Title when    checked
        titleOff:       'click to turn on', // Title when un-checked

        useElTitle:     true,               // Include the title of the source
                                            // element (or it's associated
                                            // label) in the title of this
                                            // checkbox.

        hideLabel:      false               // Hide the associated label?  If
                                            // not, clicking on the title will
                                            // be the same as clicking on the
                                            // checkbox.
    },

    /** @brief  Initialize a new instance.
     *
     *  Valid options are:
     *      css             General space-separated CSS class(es) for the
     *                      checkbox [ 'checkbox' ];
     *      cssOn           Space-separated CSS class(es) when checked
     *                      [ 'on' ];
     *      cssOff          Space-separated CSS class(es) when un-checked
     *                      [ 'off' ];
     *      titleOn         Title when checked
     *                      [ 'click to turn off' ];
     *      titleOff        Title when un-checked
     *                      [ 'click to turn on' ];
     *
     *      useElTitle      Include the title of the source element (or it's
     *                      associated label) in the title of this checkbox (as
     *                      a prefix to 'titleOn' or 'titleOff')
     *                      [ true ];
     *
     *      hideLabel       Hide the associated label?  If not, clicking on the
     *                      title will be the same as clicking on the checkbox
     *                      [ false ].
     *
     *  @triggers:
     *      'enabled'               when element is enabled;
     *      'disabled'              when element is disabled;
     *      'change' / 'checked'    when element is checked;
     *      'change' / 'unchecked'  when element is unchecked.
     */
    _create: function() {
        var self    = this;
        var opts    = this.options;

        opts.enabled = (opts.enabled === undefined
                            ? (self.element.attr('disabled') ? false : true)
                            : opts.enabled);
        opts.checked = (opts.checked === undefined
                            ? (self.element.attr('checked')  ? true  : false)
                            : opts.checked);
        opts.title   = '';

        // Remember the original value
        self.element.data('value.uicheckbox', opts.checked);

        var name     = self.element.attr('name');
        var id       = self.element.attr('id');

        // Try to locate the associated label
        self.$label  = false;

        if (id)
        {
            self.$label = $('label[for='+ id +']');
        }
        if ( ((! self.$label) || (self.$label.length < 1)) && name)
        {
            self.$label = $('label[for='+ name +']');
        }

        if (opts.useElTitle === true)
        {
            opts.title = self.element.attr('title');
            if ( ((! opts.title) || (opts.title.length < 1)) &&
                 (self.$label.length > 0) )
            {
                // The element has no 'title', use the text of the label.
                opts.title = self.$label.text();
            }
        }

        var title   = opts.title
                    + (opts.checked
                            ? opts.titleOn
                            : opts.titleOff);

        // Create a new element that will be placed just after the current
        self.$el    = $('<div />')
                        .addClass(opts.css)
                        .addClass('ui-state-default');

        var iconCss = [ (opts.enabled ? ''          : 'disabled'),
                        (opts.checked ? opts.cssOn  : opts.cssOff) ];
        self.$icon  = $('<span />')
                        .addClass( iconCss.join(' ') );
        if (title && (title.length > 0))
        {
            self.$icon.attr('title', title);
        }

        self.$icon.appendTo( self.$el );

        // Insert the new element after the existing and remove the existing.
        self.$el.insertAfter(self.element);

        // Hide the original element.
        self.element.hide();

        if (self.$label && (self.$label.length > 0))
        {
            // We have a label for this field.
            if (opts.hideLabel === true)
            {
                // Hide it.
                self.$label.hide();
            }
            else
            {
                // Treat a click on the label as a click on the item.
                self.$label.click(function(e) {
                    e.preventDefault();
                    e.stopPropagation();

                    self.$el.trigger('click',[e]);
                    return false;
                });
            }
        }

        // Interaction events
        self._bindEvents();
    },

    /************************
     * Private methods
     *
     */
    _bindEvents: function() {
        var self    = this;

        var _mouseenter = function(e) {
            if (self.options.enabled === true)
            {
                self.$el.addClass('ui-state-hover');
            }
        };

        var _mouseleave = function(e) {
            self.$el.removeClass('ui-state-hover');
        };

        var _focus      = function(e) {
            if (self.options.enabled === true)
            {
                self.$el.addClass('ui-state-focus');
            }
        };

        var _blur       = function(e) {
            self.$el.removeClass('ui-state-focus');
        };

        var _click      = function(e) {
            self.toggle();
        };

        self.$el.bind('mouseenter.uicheckbox', _mouseenter)
                .bind('mouseleave.uicheckbox', _mouseleave)
                .bind('focus.uicheckbox',      _focus)
                .bind('blur.uicheckbox',       _blur)
                .bind('click.uicheckbox',      _click);
    },

    /************************
     * Public methods
     *
     */
    isChecked: function() {
        return this.options.checked;
    },
    isEnabled: function() {
        return this.options.enabled;
    },
    val: function() {
        return (this.isEnabled() && this.isChecked()
                    ? this.element.val()
                    : null);
    },

    enable: function()
    {
        if (! this.options.enabled)
        {
            this.options.enabled = true;
            this.$el.removeClass('ui-state-disabled');

            this._trigger('enabled');
        }
    },

    disable: function()
    {
        if (this.options.enabled)
        {
            this.options.enabled = false;
            this.$el.addClass('ui-state-disabled');

            this._trigger('disabled');
        }
    },

    toggle: function()
    {
        if (this.options.checked)
        {
            this.uncheck();
        }
        else
        {
            this.check();
        }
    },

    check: function()
    {
        //if (this.options.enabled && (! this.options.checked))
        if (! this.options.checked)
        {
            this.options.checked = true;

            this.$icon
                    .removeClass(this.options.cssOff)
                    .addClass(this.options.cssOn)
                    .attr('title', this.options.title + this.options.titleOn);

            //this.element.click();
            this._trigger('change', null, 'check');
        }
    },

    uncheck: function()
    {
        //if (this.options.enabled && this.options.checked)
        if (this.options.checked)
        {
            this.options.checked = false;

            this.$icon
                    .removeClass(this.options.cssOn)
                    .addClass(this.options.cssOff)
                    .attr('title', this.options.title + this.options.titleOff);

            //this.element.click();
            this._trigger('change', null, 'uncheck');
        }
    },

    /** @brief  Reset the input to its original (creation or last direct set)
     *          value.
     */
    reset: function()
    {
        // Remember the original value
        if (this.element.data('value.uicheckbox'))
        {
            this.check();
        }
        else
        {
            this.uncheck();
        }
    },

    /** @brief  Has the value of this input changed from its original?
     *
     *  @return true | false
     */
    hasChanged: function()
    {
        return (this.options.checked !== this.element.data('value.uicheckbox'));
    },

    destroy: function() {
        if (this.$label)
        {
            this.$label.show();
        }

        this.$el.unbind('.uicheckbox');

        this.$el.remove();

        this.element.show();
    }
});


}(jQuery));
