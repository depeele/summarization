#!/usr/bin/env node
var fs      = require('fs');
var $       = require('jquery');
var _       = require('underscore');
var prog    = process.argv.shift();
if (prog.indexOf('node') >= 0)
{
    prog = process.argv.shift();
}

function el2keyword(el)
{
    var $el     = $(el),
        keyword = {
        id:     $el.data('id'),
        name:   $el.text(),
        value:  $el.data('value')
    };

    return keyword;
}

function el2token(el, key)
{
    var $el         = $(el),
        rank        = $el.data('rank'),
        value       = $el.data('value'),
        token       = {
        id:         $el.data('id'),
        type:       $el.data('type'),
        content:    $el.text()
    };

    if (rank)       { token.rank  = rank; }
    if (value)      { token.value = value; }
    if (! token.id) { token.id    = 't'+ key; }

    return token;
}

function el2sentence(el, key)
{
    var $el         = $(el),
        rank        = $el.data('rank'),
        sentence    = {
        id:         $el.data('id'),
        tokens:     _.map($el.find('> span'), el2token)
    };

    if (rank)           { sentence.rank = rank; }
    if (! sentence.id)  { sentence.id   = 's'+ key; }

    return sentence;
}

function el2paragraph(el, key)
{
    var $el         = $(el),
        rank        = $el.data('rank'),
        paragraph   = {
        id:         $el.data('id'),
        sentences:  _.map($el.find('[data-type=sentence]'), el2sentence)
    };

    if (rank)           { paragraph.rank = rank; }
    if (! paragraph.id) { paragraph.id   = 'p'+ key; }

    return paragraph;
}

function el2section(el, key)
{
    var $el     = $(el),
        rank        = $el.data('rank'),
        section = {
        id:         $el.data('id'),
        paragraphs: _.map($el.find('> p'), el2paragraph)
    };

    if (rank)           { section.rank = rank; }
    if (! section.id)   { section.id   = 'sect'+ key; }

    return section;
}

function processFile(fileIn)
{
    console.log("Input file[ %s ]\n", fileIn);

    var data    = fs.readFileSync(fileIn, 'utf8'),
        hOut    = fs.openSync(fileIn.replace('.xml', '.json'), 'w'),
        $body   = $('body');
    $(data).appendTo($body);

    var $doc    = $body.find('document'),
        doc     = {
        type:       'text/html',
        url:        $doc.attr('src'),
        title:      $doc.find('title:first').text(),
        author:     $doc.find('author:first').text(),
        published:  $doc.find('time[pubdate]:first').attr('datetime'),
        keywords:   _.map($doc.find('keywords').children(), el2keyword),
        sections:   _.map($doc.find('section'), el2section)
    };

    fs.writeSync(hOut, JSON.stringify(doc), 0);

    fs.closeSync(hOut);
}

process.argv.forEach(function(fileIn, idex, ar) {
    processFile(fileIn);
});

module.exports  = {
    processFile:    processFile
};
