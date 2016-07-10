"use strict";

const fs = require('fs');
const path = require('path');
const vm = require("vm");
const jsdom = require('jsdom');
const util = require('util');

const less = require('less');
const _ = require("lodash");
const pd = require('pretty-data').pd;

const { async, readFile } = require('./Async.js');
var jquery = path.join(__dirname, 'jquery.js');

// ----------------------------------------------------------------------------

function xhtmlTemplate(xhtml_body, css_files) {
    let head_css = '';
    if (css_files) {
        head_css = '\n';
        for (let css_file of css_files) {
            head_css += `  <link rel="stylesheet" type="text/css" href="${css_file}"/>\n`;
        }
    }
    return `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title></title>${head_css}
</head>
<body>
  ${xhtml_body}
</body>
</html>`;
}

function imageXhtmlTemplate(image_file, css_files) {
    return xhtmlTemplate(`<p><img src="${image_file}"/></p>`, css_files);
}

// ----------------------------------------------------------------------------

function jQueryHtml(html) {
    return new Promise((resolve, reject) => {
        jsdom.env('<main>'+html+'</main>', [jquery], function(err, window) {
            if (err)
                reject(err);
            else {
                resolve(window.$('main'));
            }
        });
    });
}

function xhtml_header(links) {
    let link_html = '';
    if (links) {
        link_html = '\n';
        for (let link of links) {
            link_html += `  <link rel="stylesheet" type="text/css" href="${link}"/>\n`;
        }
    }
            return `<?xml version="1.0" encoding="utf-8" standalone="no"?>
<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">
<html xmlns="http://www.w3.org/1999/xhtml">
<head>
  <title></title>${link_html}
</head>
<body>`;
}

var templateData = async(function*(data) {
    data.xhtml_header = xhtml_header(data.stylesheet);
    data.xhtml_footer = '</body>\n</html>';
    data.$markdown = yield jQueryHtml(data.markdown);
});

var compiledCache = {};

var fileTemplate = async(function*(filePath, data) {
    let compiled = compiledCache[filePath];
    if (! compiled) {
        let content = yield readFile(filePath);
        compiled = _.template(content.toString());
        compiledCache[filePath] = compiled;
    }
    let tplData = yield templateData(data);

    return compiled(tplData);
});

// ----------------------------------------------------------------------------

var renderStyle = async(function*(file) {
    let c = yield readFile(file);
    let r = yield less.render(c.toString(), {
        filename: file
    });
    return pd.css(r.css);
});

// ----------------------------------------------------------------------------

exports.renderStyle = renderStyle;
exports.xhtmlTemplate = xhtmlTemplate;
exports.imageXhtmlTemplate = imageXhtmlTemplate;
exports.fileTemplate = fileTemplate;
