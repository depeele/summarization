#!/usr/bin/env node
var fs      = require('fs');
var $       = require('jquery');
var prog    = process.argv.shift();
if (prog.indexOf('node') >= 0)
{
    prog = process.argv.shift();
}

function processFile(data, hOut)
{
    var $body   = $('body');
    $(data).appendTo($body);

    var $doc    = $body.find('document');
    var $sect   = $body.find('section');
    var $p      = $body.find('p');
    var $s      = $body.find('[data-type=sentence]');
    var $w      = $body.find('[data-type=word]');
    var $ws     = $body.find('[data-type=ws]');
    var $punc   = $body.find('[data-type=punc]');

    // Assign unique identifiers for each level
    $sect.each(function(idex) { $(this).attr('data-id', 'sect'+  idex); });
    $p.each(function(idex)    { $(this).attr('data-id', 'p'+     idex); });
    $s.each(function(idex)    { $(this).attr('data-id', 's'+     idex); });
    $w.each(function(idex)    { $(this).attr('data-id', 'w'+     idex); });
    $ws.each(function(idex)   { $(this).attr('data-id', 'ws'+   idex); });
    $punc.each(function(idex) { $(this).attr('data-id', 'punc'+ idex); });

    fs.writeSync(hOut, $body.html(), 0);
}

process.argv.forEach(function(fileIn, idex, ar) {
    console.log("Input file[ %s ]\n", fileIn);

    var data    = fs.readFileSync(fileIn, 'utf8');
    var hOut    = fs.openSync(fileIn +'.out', 'w');

    processFile(data, hOut);

    fs.closeSync(hOut);
});
