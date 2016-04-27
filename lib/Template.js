"use strict";

const fs = require('fs');
const path = require('path');
const vm = require("vm");
const jsdom = require('jsdom');
const util = require('util');

const less = require('less');
const _ = require("lodash");
const pd = require('pretty-data').pd;

const async = require('./Async.js').async;
const readFile = require('./Async.js').readFile;

// ----------------------------------------------------------------------------

var jquery = fs.readFileSync(path.join(__dirname, 'jquery.js'));
var xhtml_head = [
    '<?xml version="1.0" encoding="utf-8" standalone="no"?>',
    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
].join('\n');

var jsdomHook = async(function*(html, scripts) {
    if (! util.isArray(scripts))
        scripts = [scripts];
    for (let i in scripts)
        scripts[i] = yield readFile(scripts[i]);
    scripts.unshift(jquery);

    return new Promise((resolve, reject) => {
        jsdom.env({
            html: html,
            src: scripts,
            parsingMode: 'xml',
            virtualConsole: jsdom.createVirtualConsole().sendTo(console),
            done: function(err, window) {
                if (err) {
                    reject(err);
                } else {
                    var xhtml_html = window.document.documentElement.outerHTML;
                    resolve(xhtml_head+xhtml_html);
                }
            }
        });
    });
});

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

var compiledCache = {};

function applyTemplate(filePath, data) {
    console.log('applyTemplate', filePath);

    return new Promise((resolve, reject) => {
        let compiled = compiledCache[filePath];
        if (compiled) {
            try {
                resolve(compiled(data));
            } catch(err) {
                reject(err);
            }
        } else {
            readFile(filePath).catch(reject).then((content) => {
                let compiled = _.template(content.toString());
                compiledCache[filePath] = compiled;
                try {
                    resolve(compiled(data));
                } catch (err) {
                    // console.log('ApplyTemplate Error\n', err);
                    reject(err);
                }
            });
        }
    });
}

// ----------------------------------------------------------------------------

var renderStyle = async(function*(file) {
    let c = yield readFile(file);
    let r = yield less.render(c.toString(), {
        filename: file
    });
    return pd.css(r.css);
});



exports.renderStyle = renderStyle;
exports.xhtmlTemplate = xhtmlTemplate;
exports.imageXhtmlTemplate = imageXhtmlTemplate;
exports.jsdomHook = jsdomHook;
exports.applyTemplate = applyTemplate;
