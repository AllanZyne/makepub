"use strict";
// jshint esnext: true, node: true

// ----------------------------------------------------------------------------

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

var pd = require('pretty-data').pd;
var xml_pd = pd.xml;
var json_pd = pd.json;
var css_pd = pd.css;


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

// ----------------------------------------------------------------------------

function uuid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
                   .toString(16)
                   .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

exports.uuid = uuid;

// ----------------------------------------------------------------------------

function* dirWalk(root) {
    var files = [];

    (function _dirWalk(root, dir) {
        fs.readdirSync(root).forEach(function(file) {
            var stats = fs.statSync(root + file);
            if (stats.isDirectory())
                _dirWalk(root+file+'/', dir+file+'/');
            else
                files.push(dir+file);
        });
    })(root, "");

    for (var i = 0, len = files.length; i < len; i++) {
        yield files[i];
    }
}

// ----------------------------------------------------------------------------

var fs = require("fs");


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

exports.applyTemplate = applyTemplate;


function readFile(file, options) {
    return new Promise((resolve, reject) => {
        fs.readFile(file, options, function(err, result) {
            if (err)   reject(err);
            else       resolve(result);
        });
    });
}

exports.readFile = readFile;

function __writeFile(file, data, options) {
    return new Promise((resolve, reject) => {
        fs.writeFile(file, data, options, function(err) {
            if (err)   reject(err);
            else       resolve();
        });
    });
}

var writeFile = async(function*(file, data, options) {
    yield mkdirp(path.dirname(file));
    yield __writeFile(file, data, options);
});

exports.writeFile = writeFile;

function access(path, mode) {
    return new Promise((resolve, reject) => {
         fs.access(path, mode, function(err) {
             if (err)   resolve(false);
             else       resolve(true);
         });
    });
}

exports.access = access;

function readdir(path) {
    return new Promise((resolve, reject) => {
         fs.readdir(path, function(err, files) {
             if (err)   reject(err);
             else       resolve(files);
         });
    });
}

exports.readdir = readdir;

var copyFile = async(function*(dst, src) {
    let c = yield readFile(src);
    yield writeFile(dst, c);
});

exports.copyFile = copyFile;

var __mkdirp = function(file, callback) {
    fs.mkdir(file, function(err) {
        if (! err) {
            callback(null);
        } else if (err.code == 'ENOENT') {
            __mkdirp(path.dirname(file), function(err) {
                if (err)
                    callback(err);
                else
                    __mkdirp(file, callback);
            });
        } else {
            fs.stat(file, function(err, result) {
                if (err || (! result.isDirectory()))
                    callback(err || new Error('file exits'));
                else
                    callback(null);
            });
        }
    });
};

var mkdirp = function(path) {
    return new Promise((resolve, reject) => {
        __mkdirp(path, (err) => {if (err) reject(err); else resolve(true);});
    });
};

exports.mkdirp = mkdirp;

// ----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------

var mime = require('mime');
var ManifestIdCounter = {};

function genManifest(file, originalFile) {
    let fileMime = mime.lookup(file);
    let fileType = fileMime.slice(0, fileMime.search('/'));
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

// ----------------------------------------------------------------------------

function async(fn) {
	return function() {
		var args = arguments;
		var ctx = this;

		function spawn(genF) {
			return new Promise(function(resolve, reject) {
				var gen = genF.apply(ctx, args);

				function step(nextF) {
					try {
						var next = nextF();
					} catch (e) {
						return reject(e);
					}

					if (next.done) {
						return resolve(next.value);
					}

					Promise.resolve(next.value).then(
						v => step(() => gen.next(v)),
						e => step(() => gen.throw(e))
					);
				}

				step(() => gen.next() );
			});
		}

		return spawn(fn);
	}
}


exports.applyTemplate = applyTemplate;

exports.async = async;

// ----------------------------------------------------------------------------

var less = require('less');

var renderStyle = async(function*(file) {
    let c = yield readFile(file);
    let r = yield less.render(c.toString(), {
        filename: file
    });
    return pd.css(r.css);
});

exports.renderStyle = renderStyle;





