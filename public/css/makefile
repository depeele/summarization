YUI_COMP	= yui-compressor
LESSC		= lessc

all: summary-06.min.css summary-07.min.css theme/jquery-ui.min.css

summary-06.css: summary-06.less reset.css sprites-16.css

summary-07.css: mixins.less summary-07.less reset.css sprites-16.css

#----------------------------------------------------------------------------
clean:
	rm -f summary-06.css summary-06.min.css \
	      summary-07.css summary-07.min.css	\
	      theme/jquery-ui.min.css

#----------------------------------------------------------------------------
%.css : %.less
	$(LESSC) $< -o $@

%.min.css : %.css
	$(YUI_COMP) $< -o $@
