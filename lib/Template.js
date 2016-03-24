"use strict";
// jshint esnext: true, node: true

const fs = require('fs');
const vm = require("vm");
const jsdom = require('jsdom');
const jquery = fs.readFileSync('./jquery.js');


var execFile = function(path, context) {
    context = context || {};
    var data = fs.readFileSync(path);
    vm.runInNewContext(data, context, path);
    return context;
};


var jsdomHook = function(html, callback) {
    return new Promise((resolve, reject) => {
        jsdom.env({
            html: html,
            src: [jquery],
            parsingMode: 'xml',
            done: function(err, window) {
                if (err)
                    reject(err);

                execFile(callback, { window: window, $: window.$ });

                callback(window.$);

                var _html = window.document.documentElement.outerHTML;
                var _head = [
                    '<?xml version="1.0" encoding="utf-8" standalone="no"?>',
                    '<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.1//EN" "http://www.w3.org/TR/xhtml11/DTD/xhtml11.dtd">'
                ].join('\n');

                resolve(_head+_html);
            }
        });
    });
};




var test_html = fs.readFileSync('../test/test.html').toString();

jsdomHook(test_html, function($) {
    $('title').html('HHHHH');
}).then(function(ss) {
    console.log(ss);
}).catch(function(ss) {
    console.error("!!!!", ss);
});


