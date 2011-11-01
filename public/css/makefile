YUI_COMP	= yui-compressor
LESSC		= lessc

all: theme/jquery-ui.min.css						\
	summary-06.min.css summary-07.min.css summary-08.min.css	\
	summary-09.min.css summary-09-b.min.css summary-10.min.css

summary-06.css: summary-06.less reset.css sprites-16.css

summary-07.css: mixins.less summary-07.less reset.css sprites-16.css

summary-08.css: mixins.less summary-08.less reset.css sprites-16.css

summary-09.css: mixins.less summary-09.less reset.css sprites-16.css

summary-09-b.css: mixins.less summary-09-b.less reset.css sprites-16.css

summary-10.css: mixins.less summary-10.less reset.css sprites-16-10.css

#----------------------------------------------------------------------------
clean:
	rm -f summary-06.css   summary-06.min.css 	\
	      summary-07.css   summary-07.min.css	\
	      summary-08.css   summary-08.min.css	\
	      summary-09.css   summary-09.min.css	\
	      summary-09-b.css summary-09-b.min.css	\
	      summary-10.css  				\
	      sprites-16.css   sprites-16-10.css	\
	      theme/jquery-ui.min.css

#----------------------------------------------------------------------------
%.css : %.less
	$(LESSC) $< -o $@

%.min.css : %.css
	$(YUI_COMP) $< -o $@
