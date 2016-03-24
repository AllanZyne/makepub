"use strict";
// jshint esnext: true, node: true

const fs = require('fs');


function parse(content) {
    let lines = content.replace(/\r?\n/g, '\n').split('\n');
    let n = 0, len = lines.length;

    while ((n < len) && (! lines[n++].match(/^\[INFO\]$/)))
        continue;

    let info = {}, result;

    while ((n < len) && (result = lines[n++].match(/^\s*\.(\w+)\s*(.*)$/))) {
        info[result[1]] = result[2];
    }
    n--;

    console.log(info);
    console.log(n);

    while ((n < len) && (! lines[n++].match(/^\[SPINE\]$/)))
        continue;

    let g_conf = {}, spines = [];

    while ((n < len) && (result = lines[n++].match(/^\s*\.(\w+)\s*(.*)$/))) {
        g_conf[result[1]] = result[2];
    }
    n--;

    console.log(g_conf);
    console.log(n);

    while (n < len) {
        if ((result = lines[n++].match(/^\s*-\s*(.*)$/))) {
            let item = {};
            item.file = result[1];

            while ((n < len) && (result = lines[n++].match(/^\s*\.(\w+)\s*(.*)$/))) {
                item[result[1]] = result[2];
            }
            n--;

            spines.push(item);
        }
    }

    return {
        info: info,
        spines: spines
    };
}

var dir = 'D:\\Workspace\\epubtools\\test\\文学少女4 背负污名的天使\\BOOK';
var content = fs.readFileSync(dir);

parse(content.toString());



