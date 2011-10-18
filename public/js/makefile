YUI_COMP	= yui-compressor

all: preloadImages.min.js summary-06-full.min.js summary-07-full.min.js	\
	summary-08-full.min.js summary-09-full.min.js

SHARED 	= jquery.js			\
	  jquery.utils.js		\
	  rangy.js

JQUI	= jquery-ui.js			\
	  ui.checkbox.js

COMMON	= rangy/serializer.js		\
	  rangy/cssclassapplier.js	\
	  jquery.tmpl.js		\
	  jquery.json.js		\
	  jstorage.js			\
	  jquery.hoverIntent.js		\
	  jquery.delegateHoverIntent.js	\
	  jquery.user.js		\
	  $(JQUI)

BACKBONE= underscore.js			\
	  $(SHARED)			\
	  backbone.js			\
	  backbone.localStorage.js

BB_MODELS=model/options.js		\
	  model/user.js			\
	  model/comment.js		\
	  model/range.js		\
	  model/note.js			\
	  model/sentence.js		\
	  model/paragraph.js		\
	  model/section.js		\
	  model/doc.js			\
	  model/options.js

BB_VIEWS= view/sentence.js		\
	  view/paragraph.js		\
	  view/section.js		\
	  view/range.js			\
	  view/selection.js		\
	  view/comment.js		\
	  view/note.js			\
	  view/doc.js

SRC_06	= $(SHRED)			\
	  $(COMMON)			\
	  jquery.notes.js		\
	  ui.notes.js			\
	  jquery.summary-06.js

SRC_07	= $(SHRED)			\
	  $(COMMON)			\
	  jquery.note.js		\
	  ui.note.js			\
	  ui.sentence.js		\
	  ui.contentOverlay.js		\
	  jquery.summary-07.js

SRC_08	= $(BACKBONE)			\
	  $(BB_MODELS)			\
	  $(BB_VIEWS)			\
	  $(JQUI)			\
	  jquery.summary-08.js

SRC_09	= $(BACKBONE)			\
	  $(BB_MODELS)			\
	  $(BB_VIEWS)			\
	  $(JQUI)			\
	  jquery.summary-09.js

summary-06-full.js: $(SRC_06)
	cat $(SRC_06) > $@

summary-07-full.js: $(SRC_07)
	cat $(SRC_07) jquery.summary-07.js > $@

summary-08-full.js: $(SRC_08)
	cat $(SRC_08) jquery.summary-08.js > $@

summary-09-full.js: $(SRC_09)
	cat $(SRC_09) jquery.summary-09.js > $@

#----------------------------------------------------------------------------
clean:
	rm -f preloadImages.min.js			\
	      summary-06-full.js summary-06-full.min.js	\
	      summary-07-full.js summary-07-full.min.js	\
	      summary-08-full.js summary-08-full.min.js	\
	      summary-09-full.js summary-09-full.min.js

#----------------------------------------------------------------------------
%.min.js : %.js
	$(YUI_COMP) $< -o $@
