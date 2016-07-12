"use strict";

// -----------------------------------------------------------------------------

var colors = require('colors/safe');

colors.setTheme({
    silly: 'rainbow',
    input: 'grey',
    verbose: 'cyan',
    prompt: 'grey',
    info: 'grey',
    data: 'grey',
    help: 'cyan',
    warn: 'yellow',
    debug: 'green',
    error: 'red'
});

var _ = require("lodash");

function prettyPrint() {
    var output = [];

    _.forEach(arguments, function(param) {
        if (_.isPlainObject(param)) {
            output.push(JSON.stringify(param));
        } else {
            output.push(param);
        }
    });

    return output.join(" ");
}

function error() {
    console.error(colors.error(prettyPrint.apply(this, arguments)));
}

function print() {
    console.log.apply(console, arguments);
}

function info() {
    console.info(colors.info(prettyPrint.apply(this, arguments)));
}

function warn() {
    console.error(colors.warn(prettyPrint.apply(this, arguments)));
}

function debug() {
    console.error(colors.debug(prettyPrint.apply(this, arguments)));
}

exports.error = error;
exports.print = print;
exports.info = info;
exports.warn = warn;
exports.debug = debug;

// -----------------------------------------------------------------------------

function uuid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
                   .toString(16)
                   .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

exports.uuid = uuid;

// -----------------------------------------------------------------------------

// function* dirWalk(root) {
//     var files = [];

//     (function _dirWalk(root, dir) {
//         fs.readdirSync(root).forEach(function(file) {
//             var stats = fs.statSync(root + file);
//             if (stats.isDirectory())
//                 _dirWalk(root+file+'/', dir+file+'/');
//             else
//                 files.push(dir+file);
//         });
//     })(root, "");

//     for (var i = 0, len = files.length; i < len; i++) {
//         yield files[i];
//     }
// }

// -----------------------------------------------------------------------------

var path = require("path");

function joinPath() {
    let r = path.join.apply(null, arguments);
    return path.resolve(r);
}

exports.joinPath = joinPath;

function changeExt(file, ext) {
    return file.replace(/\..*?$/g, '.'+ext);
}

exports.changeExt = changeExt;

// -----------------------------------------------------------------------------

var mime = require('mime');
var ManifestIdCounter = {};

function genManifest(file, originalFile) {
    let fileMime = mime.lookup(file);
    let fileType = fileMime.split('/')[0];
    let fileId = _.get(ManifestIdCounter, fileType, 0);
    ManifestIdCounter[fileType] = fileId + 1;

    originalFile = originalFile || file;

    return {
        id: fileType + fileId,
        href: file.replace(/\\/g, '/'),
        file: originalFile.replace(/\\/g, '/'),
        type: fileMime
    };
}

exports.genManifest = genManifest;

function getFileType(file) {
    let fileMime = mime.lookup(file);
    return fileMime.split('/')[0];
}

exports.getFileType = getFileType;

// -----------------------------------------------------------------------------

// http://stackoverflow.com/questions/18638900/javascript-crc32
function makeCRCTable() {
    let c;
    let crcTable = [];
    for(let n =0; n < 256; n++){
        c = n;
        for(let k =0; k < 8; k++){
            c = ((c&1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1));
        }
        crcTable[n] = c;
    }
    return crcTable;
}
var crcTable = makeCRCTable();
function crc32(str) {
    let crcTable = crcTable;
    let crc = 0 ^ (-1);

    for (let i = 0; i < str.length; i++ ) {
        crc = (crc >>> 8) ^ crcTable[(crc ^ str.charCodeAt(i)) & 0xFF];
    }

    return (crc ^ (-1)) >>> 0;
    // crc = (crc ^ (-1)) >>> 0;
    // return ('00000000' + crc.toString(16)).slice(-8);
}

exports.crc32 = crc32;
