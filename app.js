/*****************************************************************************
 * Module dependencies.
 *
 */

var fs              = require('fs');
var Express         = require('express');
var BodyParser      = require('body-parser');
var MethodOverride  = require('method-override');
var ErrorHandler    = require('errorhandler');
var engines         = require('consolidate-build');
var app             = module.exports = Express();

/*****************************************************************************
 * Configuration
 *
 */

var config = JSON.parse(fs.readFileSync(__dirname+ '/config.json', 'utf-8'));

/****************************
 * Express.js Configuration
 *
 */
app.set('port', process.env.PORT || config.server.port);
app.set('host', process.env.IP   || config.server.host);
app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
  
app.use(BodyParser.json());
app.use(BodyParser.urlencoded({extended:true}));
app.use(MethodOverride());
app.use(Express.static(__dirname + '/public'));

//app.engine('ejs',  engines.ejs);
//app.engine('less', engines.less);

if (app.get('env') === 'development') {
  app.use(ErrorHandler({ dumpExceptions: true, showStack: true })); 
  
} else {
  app.use(ErrorHandler()); 
}

/*****************************************************************************
 * Routes
 *
 */
app.get('/', function(req, res){
  console.log("route( / )");
  res.render('index', {
    title: 'Summarization Viewer'
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
app.listen(app.get('port'), app.get('host'), function() {
  var server  = this;
  console.log("Express server listening on %s:%d in %s mode",
              server.address().address, server.address().port,
              app.get('env'));
});