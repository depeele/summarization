/*****************************************************************************
 * Module dependencies.
 *
 */

var Fs      = require('fs'),
    express = require('express'),
    app     = module.exports = express.createServer();

/*****************************************************************************
 * Configuration
 *
 */

global.config = JSON.parse(Fs.readFileSync(__dirname+ '/config.json', 'utf-8'));

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
 * Errors
 *
 */
function NotFound(msg, err)
{
    this.name = 'NotFound';
    this.code = 404;
    this.err  = err;

    Error.call(this, msg);
    Error.captureStackTrace(this, arguments.callee);
}
NotFound.prototype.__proto__ = Error.prototype;

/*****************************************************************************
 * Routes
 *
 */
app.get('/', function(req, res){
  res.render('index', {
    title: 'Summarization Viewer'
  });
});

/* Map the URL '/samples/:id'
 *          to './samples/:id'
 */
app.get('/samples/:id', function(req, res, next){
  var   path    = 'samples/'+ req.params.id;
  res.sendfile(path, function(err) {
    if (err)
    {
        next(new NotFound("Cannot locate sample '"+ path +"'", err));
    }
    else
    {
        console.log(">>> transferred %s", path);
    }
  });
});

/* Map the URL '/samples/duc02/:set/:id'
 *          to './samples/duc02/keywords/single/:set/%id
 */
app.get('/samples/duc02/:set/:id', function(req, res, next){
  var   path    = 'samples/duc02/keywords/single/'
                + req.params.set +'/'+ req.params.id;
  res.sendfile(path, function(err) {
    if (err)
    {
        next(new NotFound("Cannot locate sample '"+ path +"'", err));
    }
    else
    {
        console.log(">>> transferred %s", path);
    }
  });
});

/*****************************************************************************
 * Start the server
 *
 */
app.listen(config.server.port, config.server.host); //3000);
console.log("Express server listening on %s:%d in %s mode",
            config.server.host, config.server.port, app.settings.env);

console.log(">>> The Earthquake example is at:");
console.log("  http://%s:%s/?duc02/d061j/AP880911-0016.html",
             config.server.host, config.server.port);
