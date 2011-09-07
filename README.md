You can test using either a simple web server, pointing to this top-level
directory as the web root OR via node.js.

node.js
=======
To use node.js as the server that provides access o this web-app:
	- [install node.js](http://nodejs.org/);
	- [install npm](http://npmjs.org/);
		curl http://npmjs.org/install.sh | sh
	- import/update required node packages;
		`npm update`
	- update config.json if desired;
	- start the node-based server:
		`node app.js`
