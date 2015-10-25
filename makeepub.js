// jshint esnext: true, node: true
"use strict";


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
        
        less.render(content.toString(), {
            filename: path.resolve(epubPath+styleSheet),
        }, function (err, output) {
            if (err) throw err;
            content = output.css;
        });
        
        styleSheetFile = styleSheet.replace(/\w*$/, "css");
        styleSheetContent = content;
    }

    metadata.stylesheet = styleSheetFile;
    yield [styleSheetFile, new Buffer(styleSheetContent)];

    manifest.push(genManifest(styleSheetFile, styleSheet));

    // Markdown
    var catalog = epubMetadata.catalog;
    if (! catalog) {
        throw new Error("metadata.yaml 中没有定义 catalog");
    }

    // console.log(epubMetadata.catalog);

    for (let filePath of catalog) {
        let content = fs.readFileSync(epubPath+filePath),
            ext = filePath.match(/\w*$/)[0];

        switch (ext) {
            case 'md':
                var md = markdown(content.toString());
                epubMetadata.content = md.makeHtml();
                content = applyTemplate(templatePath+'chapter.xhtml', epubMetadata);
                
                break;
        }

        let file = filePath.replace(/\w*$/, "xhtml");
        yield [file, new Buffer(content)];

        manifest.push(genManifest(file, filePath));
    }



    // for (let path of dirWalk(epubPath)) {
    //  let content = fs.readFileSync(epubPath+path),
    //      ext = path.match(/\w+$/);
        
    //  if (ext) {
    //      let content, html, err, css;
    //      switch (ext[0]) {
    //          case "md":
    //              info.media_type = 'application/xhtml+xml';
    //              info.id = "xhtml_" + xhtmlCounter++;
    //              info.headers = [];
    //              info.href = path.replace(/\w+$/, "xhtml");

    //              content = fs.readFileSync(epubPath+path);
    //              html = converter.makeHtml(content.toString());
    //              html.replace(/<(h[1-6])\b.*?>(.*?)<\/\1>/g, function(_, level, title) {
    //                  console.log(parseInt(level.match(/\d/g)[0]), title);

    //                  info.headers.push({
    //                      level: parseInt(level.match(/\d/g)[0]),
    //                      text: title,
    //                  });
    //              });

    //              yield [info.href, new Buffer(html)];
    //              break;
    //          case "xhtml":
    //              info.media_type = 'application/xhtml+xml';
    //              info.id = "xhtml_" + xhtmlCounter++;
    //              info.headers = [];

    //              content = fs.readFileSync(epubPath+path);
    //              html = content.toString();
    //              html.replace(/<(h[1-6])\b.*?>(.*?)<\/\1>/g, function(_, level, title) {
    //                  console.log(level.match(/\d/g), title);

    //                  info.headers.push({
    //                      level: parseInt(level.match(/\d/)[0]),
    //                      text: title,
    //                  });
    //              });

    //              yield [path, content];
    //              break;
    //          case "less":
    //              info.media_type = 'text/css';
    //              info.id = 'stylesheet_' + cssCounter++;
    //              info.href = path.replace(/\w+$/, "css");

    //              content = fs.readFileSync(epubPath+path);

    //              less.render(content.toString(), function (e, output) {
    //                  if (e)
    //                      err = e;
    //                  else
    //                      css = output.css;
    //              });

    //              if (err) {
    //                  console.error(err);
    //                  return;
    //              } else
    //                  err = undefined;

    //              yield [info.href, new Buffer(css)];
    //              break;
    //          case 'png':
    //              info.media_type = 'image/png';
    //              info.id = 'image_' + imageCounter++;

    //              yield [path, fs.readFileSync(epubPath+path)];
    //              break;
    //          case 'jpg':
    //              info.media_type = 'image/jpg';
    //              info.id = 'image_' + imageCounter++;

    //              yield [path, fs.readFileSync(epubPath+path)];
    //              break;
    //          case 'gif':
    //              info.media_type = 'image/gif';
    //              info.id = 'image_' + imageCounter++;

    //              yield [path, fs.readFileSync(epubPath+path)];
    //              break;
    //          case 'css':
    //              info.media_type = 'text/css';
    //              info.id = 'stylesheet_' + cssCounter++;

    //              yield [path, fs.readFileSync(epubPath+path)];
    //              break;
    //          default:
    //              info.media_type = 'unknown';
    //              info.id = 'unknown_' + otherCounter++;

    //              yield [path, fs.readFileSync(epubPath+path)];
    //      }
    //  }

    //  manifest.push(info);
    // }

    var content = applyTemplate(templatePath+'content.opf', epubMetadata);
    yield ['content.opf', new Buffer(pd.xml(content))];

    // content = applyTemplate(templatePath+'toc.ncx', epubMetadata);
    // if (! content)
    //  return;

    // yield ['toc.ncx', new Buffer(pd.xml(content))];

}




try {
    for (let file of epubFiles()) {
        // var path = epubPath + file[0];
        // var dir = (epubPath + file[0]).match(/(.*)\/.*/)[1];
        // console.log(path);
        // console.log(dir);

        info(epubPath + file[0]);
        fs.writeFile(epubPath + file[0], file[1]);

        //epubFile.addFile(file.name, file.content);
    }
} catch(e) {
    // console.error(e);
    throw e;
}

// epubFile.writeZip('my_book.zip');

/**
 * 
 * TODO：
 * 1. xml格式化
 *   - yaml 中的结尾换行符去掉
 * 2. 项目目录中文件的选择
 *   - 图书目录与文件链接
 *   - 图书资源目录
 * 3. uid 自动生成
 *
 * 4. 打包程序和转换程序相互独立
 * 5. 转换程序对保留的文件用auto-diff-merge的方式更新
 *
 * 
 * 666. 函数的异常的处理
 *
 *
 *  makeepub [-t <default>] [--debug | -D ] <ebook_dir> 
 *
 * -t 模板名
 * -D 在目录下生成epub文件信息
 * 
 * 
 */
