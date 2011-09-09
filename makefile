all:
	@cd public/js; make
	@cd public/css; make

clean:
	@cd public/js; make clean
	@cd public/css; make clean
