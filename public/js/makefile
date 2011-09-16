YUI_COMP	= yui-compressor

all: preloadImages.min.js summary-06-full.min.js summary-07-full.min.js

SHARED 	= jquery.js			\
	  rangy.js			\
	  rangy/serializer.js		\
	  rangy/cssclassapplier.js	\
	  jquery.utils.js		\
	  jquery.tmpl.js		\
	  jquery.json.js		\
	  jstorage.js			\
	  jquery.hoverIntent.js		\
	  jquery.delegateHoverIntent.js	\
	  jquery.user.js		\
	  jquery-ui.js			\
	  ui.checkbox.js

SRC_06	= $(SHRED)			\
	  jquery.notes.js		\
	  ui.notes.js			\
	  jquery.summary-06.js

SRC_07	= $(SHRED)			\
	  jquery.note.js		\
	  ui.note.js			\
	  ui.sentence.js		\
	  ui.contentOverlay.js		\
	  jquery.summary-07.js

summary-06-full.js: $(SRC_06)
	cat $(SRC_06) > $@

summary-07-full.js: $(SRC_07)
	cat $(SRC_07) jquery.summary-07.js > $@

#----------------------------------------------------------------------------
clean:
	rm -f preloadImages.min.js			\
	      summary-06-full.js summary-06-full.min.js	\
	      summary-07-full.js summary-07-full.min.js

#----------------------------------------------------------------------------
%.min.js : %.js
	$(YUI_COMP) $< -o $@
