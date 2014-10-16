/*****************************************************************************
 * Module dependencies.
 *
 */

var fs              = require('fs');
var Express         = require('express');
var BodyParser      = require('body-parser');
var MethodOverride  = require('method-override');
var ErrorHandler    = require('errorhandler');
var Layouts         = require('express-ejs-layouts');
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
  
app.use(Layouts);
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
 * Errors
 *
 */
function NotFound(msg, err) {
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
var sampleSendFileOpts  = {
        root:       __dirname +'/samples/',
        dofiles:    'deny'
    };

app.get('/', function(req, res){
  console.log("route( / )");
  res.render('index', {
    title: 'Summarization Viewer'
  });
});

/* Map the URL '/samples/:id'
 *          to './samples/:id'
 */
app.get('/samples/:id', function(req, res, next){
  var path  = req.params.id;

  res.sendFile(path, sampleSendFileOpts, function(err) {
    if (err && err.code !== 'ECONNABORT') {
        next(new NotFound("Cannot locate sample '"+ path +"'", err));
        
    } else {
        console.log(">>> transferred samples/%s", path);
    }
  });
});

/* Map the URL '/samples/duc02/:set/:id'
 *          to './samples/duc02/keywords/single/:set/%id
 */
app.get('/samples/duc02/:set/:id', function(req, res, next){
  var path  = 'duc02/keywords/single/'
            + req.params.set +'/'+ req.params.id;

  res.sendFile(path, sampleSendFileOpts, function(err) {
    if (err && err.code !== 'ECONNABORT') {
        next(new NotFound("Cannot locate sample '"+ path +"'", err));

    } else {
        console.log(">>> transferred samples/%s", path);
    }
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
              
  console.log(">>> The Earthquake example is at:");
  console.log("  http://%s:%s/?duc02/d061j/AP880911-0016.html",
              server.address().address, server.address().port);
});
