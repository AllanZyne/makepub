// jshint esnext: true, node: true
"use strict";

/**
 *
 *
 *  makeepub [-t <default>] [--debug | -D ] <ebook_dir> 
 *
 * -t 模板名
 * -D 在目录下生成epub文件信息
 * 
 * 
 */


var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var yaml = require('js-yaml');
var less = require('less');
var pd = require('pretty-data').pd;

var mime = require('mime');

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
    debug: 'blue',
    error: 'red'
});

var markdown = require('./lib/Markdown.js');



// -----------------------------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------------------------
function error() {
    console.error(colors.error.apply(null, arguments));
}

function print() {
    console.log.apply(console, arguments);
}

function info() {
    console.info(colors.info.apply(null, arguments));
}

function uuid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
                   .toString(16)
                   .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}

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


function applyTemplate(filePath, data) {
    var template = fs.readFileSync(filePath);
    var compiled = _.template(template.toString());
    // console.log(data);
    return compiled(data);
}

function nomalizePath(filePath) {
    var _filePath = filePath.replace( );
    return _filePath;
}

var ManifestIdCounter = {};
function genManifest(file, originalFile) {
    let fileMime = mime.lookup(file);
    let fileType = fileMime.slice(0, fileMime.search('/'));
    let fileId = _.get(ManifestIdCounter, fileType, 0);
    ManifestIdCounter[fileType] = fileId + 1;

    originalFile = originalFile || file;

    return {
        id: fileType + fileId,
        href: file,
        file: originalFile,
        type: fileMime
    };
}

// -----------------------------------------------------------------------------
// Epub Functions
// -----------------------------------------------------------------------------

var epubPath = "learnyouahaskell/";
var templatePath = 'template/';


function* epubFiles() {
    
    var epubMetadata = yaml.safeLoad(fs.readFileSync(epubPath+'metadata.yaml', 'utf8'));

    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------
    var metadata = epubMetadata.metadata;

    metadata.book_id = metadata.book_id || uuid();
    metadata.resource_id = metadata.resource_id || uuid();

    metadata.rights = metadata.rights ? markdown(_.trim(metadata.rights)).makeHtml() : "";

    // -------------------------------------------------------------------------
    // Manifest
    // -------------------------------------------------------------------------
    var manifest = epubMetadata.manifest = [];
    var idCounter = {};

    var xhtmlCounter = 0;
    var imageCounter = 0;
    var cssCounter = 0;
    var otherCounter = 0;

    // -------------------------------------------------------------------------
    // Resource
    // -------------------------------------------------------------------------
    var resource = epubMetadata.resource || {};
    
    if (resource.image) {
        let paths = _.isArray(resource.image) ? resource.image : [resource.image],
            files = [];

        for (let path of paths) {
            path = _.endsWith(path, '/') ? path : path+'/';
            let dirFiles = _.chain(fs.readdirSync(epubPath+path)).map(x => path+x).value();
            files = files.concat(dirFiles);
        }

        for (let file of files) {
            // console.log(file);
            manifest.push(genManifest(file));
        }
    }
    
    if (resource.font) {

    }

    if (resource.video) {

    }

    // -------------------------------------------------------------------------
    // Style Sheet
    // -------------------------------------------------------------------------
    var styleSheet = metadata.stylesheet,
        styleSheetFile,
        styleSheetContent;

    if (! styleSheet) {
        styleSheet = 'default.css';
        styleSheetFile = styleSheet;
        styleSheetContent = fs.readFileSync(templatePath+styleSheet);

        info("使用默认的样式文件");
    } else {
        let content = fs.readFileSync(epubPath+styleSheet),
            ext = styleSheet.match(/\w*$/)[0];
        var cssOutput = '';
    
        styleSheetFile = styleSheet.replace(/\w*$/, "css");
        styleSheetContent = yield less.render(content.toString(), {
            filename: path.resolve(epubPath+styleSheet),
        });
    }

    metadata.stylesheet = styleSheetFile;
    yield [styleSheetFile, new Buffer(styleSheetContent)];

    manifest.push(genManifest(styleSheetFile, styleSheet));

    // Markdown
    var catalog = epubMetadata.catalog;
    if (! catalog) {
        throw new Error("metadata.yaml 中没有定义 catalog");
    }

    var topics = epubMetadata.topics = {};

    // console.log(epubMetadata.catalog);
    var toc = [0, 0, 0, 0, 0, 0, 0];

    for (let filePath of catalog) {
        let content = fs.readFileSync(epubPath+filePath),
            ext = filePath.match(/\w*$/)[0];

        switch (ext) {
            case 'md':
                var md = markdown(content.toString(), epubMetadata.markdown);
                epubMetadata.content = md.makeHtml();
                content = applyTemplate(templatePath+'chapter.xhtml', epubMetadata);
                var _topics = _.get(topics, filePath, []);
                topics[filePath] = _topics;

                content = content.replace(/<h([1-6])(.*?)>(.*?)<\/h\1>/gm, function(wholeMatch, level, attrs, title) {
                    var id;
                    level = parseInt(level);
                    id = 'toc';
                    for (var i = 1; i <= 6; i++) {
                        if (i < level) {
                            id += '-' + toc[i];
                        } else if (i == level) {
                            id += '-' + (++toc[i]);
                            for (var j = i; j >= 1; j--)
                                if (!toc[j])
                                    console.log("错误的标题:'", title, "'");
                        } else {
                            toc[i] = 0;
                        }
                    }

                    // _topics.push([level, title, filePath, id]);
                    _topics.push({
                        level : level,
                        text : title,
                        file : filePath,
                        src : filePath.replace(/\w*$/, "xhtml") + '#' + id,
                        id : id
                    });

                    return `<h${level} id="${id}">${title}</h${level}>`;
                });

                break;
        }

        let file = filePath.replace(/\w*$/, "xhtml");
        yield [file, new Buffer(content)];

        manifest.push(genManifest(file, filePath));
    }

    var content = applyTemplate(templatePath+'content.opf', epubMetadata);
    yield ['content.opf', new Buffer(pd.xml(content))];

    content = applyTemplate(templatePath+'toc.ncx', epubMetadata);
    if (! content)
     return;

    yield ['toc.ncx', new Buffer(pd.xml(content))];

}




try {
    var gen = epubFiles();
    var rst = gen.next();
    (function next() {
        if (rst.done)
            return;
        var file = rst.value;
        if (_.isArray(file)) {
            info(epubPath + file[0]);
            fs.writeFile(epubPath + file[0], file[1]);
            rst = gen.next();
            next();
        } else {
            // print(file);
            file.then(function(output) {
                // print(output.css);
                rst = gen.next(output.css);
                next();
            });
        }    
    })();
    
} catch(e) {
    // console.error(e);
    throw e;
}



// epubFile.writeZip('my_book.zip');

