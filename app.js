/*****************************************************************************
 * Module dependencies.
 *
 */

var fs      = require('fs');
var express = require('express');

var app = module.exports = express.createServer();

/*****************************************************************************
 * Configuration
 *
 */

global.config = JSON.parse(fs.readFileSync(__dirname+ '/config.json', 'utf-8'));

/****************************
 * Express.js Configuration
 *
 */
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'ejs');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.compiler({ src: __dirname + '/public', enable: ['less'] }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

/*****************************************************************************
 * Routes
 *
 */
app.get('/', function(req, res){
  res.render('index', {
    title: 'Express'
  });
});

app.get('/samples/:id', function(req, res){
  var   path    = 'samples/'+ req.params.id;
  res.sendfile(path, function(err) {
    if (err)    { next(err); }
    else        { console.log(">>> transferred %s", path); }
  });
});

/*****************************************************************************
 * Start the server
 *
 */
app.listen(config.server.port, config.server.host); //3000);
console.log("Express server listening on %s:%d in %s mode",
            app.address().address, app.address().port, app.settings.env);
