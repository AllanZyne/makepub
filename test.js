// jshint esnext: true, node: true
"use strict";

var fs = require('fs');
var pd = require('pretty-data').pd; 
var colors = require('colors/safe');

var markdown = require('./lib/Markdown.js');


var md = markdown(fs.readFileSync('test.md').toString());
var html = md.makeHtml();

html = `
<?xml version="1.0" encoding="utf-8" standalone="no"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">

<html xmlns="http://www.w3.org/1999/xhtml">
<head>
    <title></title>
    <link href="shCoreEclipse.css" rel="stylesheet" type="text/css" />
</head>
<body>
${html}
</body>
</html>
`;

fs.writeFileSync('test.html', html);

console.log(md);
