#!/usr/bin/env node
"use strict";

// jshint esnext: true, node: true

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
    debug: 'green',
    error: 'red'
});

var argv = require('minimist')(process.argv.slice(2));

var markdown = require('../lib/Markdown.js');
var EpubAchive = require('../lib/EpubAchive.js');


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

function warn() {
    console.error(colors.warn.apply(null, arguments));
}

function debug() {
    console.error(colors.debug.apply(null, arguments));
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
    if (! fs.existsSync(filePath)) {
        warn(`模板文件${filePath}不存在！`);
        return;
    }
    
    var template = fs.readFileSync(filePath);
    var compiled = _.template(template.toString());
    // console.log(data);
    return compiled(data);
}

function joinPath() {
    var r = path.join.apply(null, arguments);
    return path.resolve(r);
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

// =============================================================================
// Epub Path
// =============================================================================

var CwdDir = process.cwd();
var ExeDir = __dirname;

var DefaultTemplates = {};
var templates = fs.readdirSync(joinPath(ExeDir, '../template'));
templates.forEach(t => {
    DefaultTemplates[t] = joinPath(ExeDir, t);
});

print(DefaultTemplates);

var EpubPath = CwdDir;
var OutputPath;

var BuildPath = joinPath(EpubPath, '_build');
var TemplatePath = joinPath(ExeDir, '../template/duokan');

var EpubMetaDataPath;

function* epubFiles() {    
    info('load metadata...' + EpubMetaDataPath);
    
    var epubMetadataContent = yield fs.readFileSync(EpubMetaDataPath, 'utf8');
    var epubMetadata = yaml.safeLoad(epubMetadataContent);

    // -------------------------------------------------------------------------
    // Metadata { title, creator, uuid, copyright ... }
    // -------------------------------------------------------------------------
    var metadata = epubMetadata.metadata;

    metadata.book_id = metadata.book_id || uuid();
    metadata.resource_id = metadata.resource_id || uuid();

    metadata.rights = metadata.rights ? markdown(_.trim(metadata.rights)).makeHtml() : "";

    // -------------------------------------------------------------------------
    // Manifest { id, href, media-type ... }
    // -------------------------------------------------------------------------
    var manifest = epubMetadata.manifest = [];
 
    // -------------------------------------------------------------------------
    // Resource { static files path }
    // -------------------------------------------------------------------------
    
    var resourceDirs = epubMetadata.resource || [];
    var resourceFiles = [];
    
    info('copy resource...');
    debug(resourceDirs);
    
    for (let dir of resourceDirs) {
        let rdir = joinPath(EpubPath, dir);
        info('copy', dir);
        debug('copy', rdir);
        
        let dirFiles = fs.readdirSync(rdir);
        dirFiles = dirFiles.map(f => joinPath(dir, f));
        resourceFiles = resourceFiles.concat(dirFiles);
    }

    for (let file of resourceFiles) {
        manifest.push(genManifest(file));
    }

    return;

    debug('[[STYLESHEET]]');
    // -------------------------------------------------------------------------
    // Style Sheet
    // -------------------------------------------------------------------------
    var styleSheet = metadata.stylesheet,
        styleSheetFile,
        styleSheetContent;

    if (! styleSheet) {
        info("使用默认的样式文件");

        styleSheet = 'default.css';
        styleSheetFile = styleSheet;
        if (! fs.existsSync(path.join(templatePath, styleSheet))) {
            throw new Error('无法找到默认的样式文件！');
        }
        styleSheetContent = fs.readFileSync(path.join(templatePath, styleSheet));
    } else {
        let content = fs.readFileSync(epubPath+styleSheet);
    
        styleSheetFile = styleSheet.replace(/\w*$/, "css");
        styleSheetContent = yield less.render(content.toString(), {
            filename: path.resolve(epubPath+styleSheet),
        });
    }

    metadata.stylesheet = styleSheetFile;
    yield [styleSheetFile, new Buffer(styleSheetContent)];

    manifest.push(genManifest(styleSheetFile, styleSheet));

    debug('[[CATALOG]]');
    // Markdown
    var catalog = epubMetadata.catalog;
    if (! catalog) {
        throw new Error("metadata.yaml 中没有定义 catalog");
    }
    
    var topics = epubMetadata.topics = {};   // for toc.ncx

    // console.log(epubMetadata.catalog);
    var toc = [0, 0, 0, 0, 0, 0, 0];

    for (let filePath of catalog) {
        if (! fs.existsSync(epubPath+filePath)) {
            warn(`"${filePath}"文件不存在：${epubPath+filePath}`);
            continue;
        }
        let content = fs.readFileSync(epubPath+filePath).toString(),
            ext = filePath.match(/\w*$/)[0];
        
        switch (ext) {
            case 'md':
                // print(content);
                var md = markdown(content, epubMetadata.markdown);
                
                epubMetadata.content = md.makeHtml();
                content = applyTemplate(path.join(templatePath, 'chapter.xhtml'), epubMetadata);
                if (! content)
                    continue;
                
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
    
    debug('[[COVER/COPYRIGHT/PREFACE]]');
    var content = applyTemplate(path.join(templatePath, 'cover.xhtml'), epubMetadata);
    yield ['cover.xhtml', new Buffer(pd.xml(content))];
    
    content = applyTemplate(path.join(templatePath, 'copyright.xhtml'), epubMetadata);
    yield ['copyright.xhtml', new Buffer(pd.xml(content))];
    
    content = applyTemplate(path.join(templatePath, 'preface.xhtml'), epubMetadata);
    yield ['preface.xhtml', new Buffer(pd.xml(content))];


    debug('[[CONTENT.OPF]]');
    content = applyTemplate(path.join(templatePath, 'content.opf'), epubMetadata);
    yield ['content.opf', new Buffer(pd.xml(content))];


    debug('[[TOC.NCX]]');
    content = applyTemplate(path.join(templatePath, 'toc.ncx'), epubMetadata);
    if (! content)
     return;

    yield ['toc.ncx', new Buffer(pd.xml(content))];

}

/**
 * 
 * yaml -> 
 * 
 */
function build(build_dir) {
    var it = epubFiles();
    
    function handle(value) {
        if (_.isArray(value)) {
            info(epubPath + value[0]);
            fs.writeFileSync(path.join(build_dir, value[0]), value[1]);            
            return;
        }  
        
        // less
        return value.css;
    }
    
    function next(result) {
        if (result.done)
            return result.value;
        
        return result.value.then(
            (value) => next(it.next(handle(value))),
            (error) => next(it.throw(error))
        );
    }
    
    next(it.next());
}

function pack() {
    var fileName = path.resolve(epubPath, '../') + '/' + path.basename(epubPath) + '.epub';
    var epubAchive = new EpubAchive(fileName);
    var epubMetadata = yaml.safeLoad(fs.readFileSync(epubPath+'metadata.yaml', 'utf8'));
    
    var resource = epubMetadata.resource;
    
    if (resource.image) {
        let paths = _.isArray(resource.image) ? resource.image : [resource.image],
            files = [];
    
        for (let file of paths) {
            file = _.endsWith(file, '/') ? file : file+'/';
            let dirFiles = _.chain(fs.readdirSync(epubPath+file)).map(x => file+x).value();
            files = files.concat(dirFiles);
        }
    
        for (let file of files) {
            epubAchive.addFile(file, fs.readFileSync(epubPath+file));        
        }
    }
    
    if (resource.font) {
    
    }
    
    if (resource.video) {
    
    }
    
    var catalog = epubMetadata.catalog;
    for (var filePath of catalog) {
        let file = filePath.replace(/\w*$/, "xhtml");
        epubAchive.addFile(file, fs.readFileSync(epubPath+file));
    }
    
    var metadata = epubMetadata.metadata;
    
    var styleFile = metadata.stylesheet;
    if (styleFile) {
        let file = styleFile.replace(/\w*$/, "css");
        epubAchive.addFile(file, fs.readFileSync(epubPath+file));
    }

    if (metadata.cover)
        epubAchive.addFile(metadata.cover, fs.readFileSync(epubPath+metadata.cover));
    
    epubAchive.addFile('content.opf', fs.readFileSync(epubPath+'content.opf'));
    epubAchive.addFile('toc.ncx', fs.readFileSync(epubPath+'toc.ncx'));
    
    epubAchive.addFile('preface.xhtml', fs.readFileSync(epubPath+'preface.xhtml'));
    epubAchive.addFile('copyright.xhtml', fs.readFileSync(epubPath+'copyright.xhtml'));
    epubAchive.addFile('cover.xhtml', fs.readFileSync(epubPath+'cover.xhtml'));
    
    epubAchive.addFile('META-INF/container.xml', fs.readFileSync(path.join(templatePath, 'META-INF/container.xml')));
    
    epubAchive.writeZip();
}


// =============================================================================
// 解析运行参数
// =============================================================================

if (argv.b) {
    BuildPath = path.isAbsolute(argv.b) ? argv.b : joinPath(CwdDir, argv.b);
}

if (argv.t) {
    let t = argv.t;
    if (DefaultTemplates.hasOwnProperty(t))
        TemplatePath = DefaultTemplates[t];
    else
        TemplatePath = path.isAbsolute(t) ? t : joinPath(CwdDir, t);
}
    
if (argv.m) {
    let m = argv.m;
    EpubMetaDataPath = path.isAbsolute(m) ? m : joinPath(CwdDir, m);
}

var argvs = argv._;
var s = argvs[0];
if (s) {
    EpubPath = path.isAbsolute(s) ? s : joinPath(CwdDir, s);
}


var o = argvs[1];
if (o)
   OutputPath = ""; 
    
    
    

EpubMetaDataPath = joinPath(EpubPath, 'metadata.yaml');

build();


function help() {
print(`
 * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * 
 * makeepub for duokan
 * 
 * makeepub [options] <epubdir> [out_file（默认与文件夹同名.epub）]
 * 
 * -b <builddir>  _build     编译路径 
 * -t <theme>     duokan     使用的主题（默认）
 * -m <path> metadata路径(默认=out_dir)
 *
 * -c 只编译，不打包
 * -p 只打包，不编译
 * 
 *
 * -a 全部更新，默认只更新改动文件
 * -j <N>  多线程编译
 * 
 *  * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
`);
process.exit();
}


// if (argv._.length > 0) {
//     epubPath = path.join(process.cwd(), argv._[0]);
    
//     if (_.endsWith(epubPath, '\\')) {
//         epubPath = epubPath.slice(epubPath.length-1);
//     }
//     if (! _.endsWith(epubPath, '/'))
//         epubPath += '/';
//     epubPath = epubPath.replace(/\\/g, '/');
    
//     print(__dirname);
    
//     try {
//     print(epubPath);
//     convert();
//     } catch (e) {
//         print(e);
//     }
//     pack();
// } else {
//     print("輸入制作epub的文件夾名");
// }


/**
 * makeepub for duokan
 * 
 * makeepub [options] <source_dir> [out_file（默认与文件夹同名.epub）]
 * 
 * -b <build_dir> _build     编译路径 
 * -t <theme>     duokan     使用的主题（默认）
 * -m <path> metadata路径(默认=out_dir)
 *
 * -c 只编译，不打包
 * -p 只打包，不编译
 * 
 *
 * -a 全部更新，默认只更新改动文件
 * -j <N>  多线程编译
 * 
 */
