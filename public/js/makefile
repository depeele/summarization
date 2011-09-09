YUI_COMP	= yui-compressor

all: preloadImages.min.js summary-06-full.min.js

SRCS	= jquery.js			\
	  rangy.js			\
	  rangy/serializer.js		\
	  rangy/cssclassapplier.js	\
	  jquery.utils.js		\
	  jquery.tmpl.js		\
	  jquery.json.js		\
	  jstorage.js			\
	  jquery.delegateHoverIntent.js	\
	  jquery.user.js		\
	  jquery.notes.js		\
	  jquery-ui.js			\
	  ui.checkbox.js		\
	  ui.notes.js			\
	  jquery.summary-06.js

summary-06-full.js: $(SRCS)
	cat $(SRCS) > $@

#----------------------------------------------------------------------------
clean:
	rm -f preloadImages.min.js summary-06-full.js summary-06-full.min.js

#----------------------------------------------------------------------------
%.min.js : %.js
	$(YUI_COMP) $< -o $@
