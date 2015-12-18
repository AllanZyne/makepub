#!/usr/bin/env node
"use strict";

// jshint esnext: true, node: true

var fs = require('fs');
var path = require('path');
var _ = require('lodash');
var yaml = require('js-yaml');

var pd = require('pretty-data').pd;

var markdown = require('../lib/Markdown.js');
var EpubAchive = require('../lib/EpubAchive.js');

var print = require('../lib/Utils.js').print;
var info = require('../lib/Utils.js').info;
var debug = require('../lib/Utils.js').debug;
var warn = require('../lib/Utils.js').warn;
var joinPath = require('../lib/Utils.js').joinPath;
var uuid = require('../lib/Utils.js').uuid;
var genManifest = require('../lib/Utils.js').genManifest;
var async = require('../lib/Utils.js').async;

var readFile = require('../lib/Utils.js').readFile;
var writeFile = require('../lib/Utils.js').writeFile;
var copyFile = require('../lib/Utils.js').copyFile;
var access = require('../lib/Utils.js').access;
var readdir = require('../lib/Utils.js').readdir;

var renderStyle = require('../lib/Utils.js').renderStyle;

// =============================================================================

var CwdDir = process.cwd();
var ExeDir = __dirname;

var DefaultTemplates = {};
var templates = fs.readdirSync(joinPath(ExeDir, '../template'));
templates.forEach(t => {
    DefaultTemplates[t] = joinPath(ExeDir, t);
});

var EpubPath = CwdDir;
var OutputPath;

var BuildPath = joinPath(EpubPath, '_build');
var TemplatePath = joinPath(ExeDir, '../template/duokan');

// 暂时固定模板文件
var TemplateFile = {
    stylesheet : "style.less",     // 样式文件
    cover : 'cover.xhtml',         // 封面
    preface : 'preface.xhtml',     // 前言
    copyright : 'copyright.xhtml', // 版权
    chapter : 'chapter.xhtml',     // 内容
};


var EpubMetaDataPath;


// =============================================================================

var templateFile = async(function*(stylefile, chapters) {
    
    // 合并样式
    let tplStyle = joinPath(TemplatePath, TemplateFile.stylesheet);
    let cssContent = yield renderStyle(tplStyle);
    let epbStyle = joinPath(EpubPath, stylefile);
    cssContent += yield renderStyle(epbStyle);
    
    console.log(cssContent);
    
    // 前言
    
    
    // 版权
    
    
    // 处理markdown
    
    
});






var build = async(function*() {
    let ifExist = yield access(EpubMetaDataPath);
    if (! ifExist) {
        throw new Error("元数据文件不存在！！");
    }
    
    info('加载元数据...' + EpubMetaDataPath);
    
    var epubMetadataContent = yield readFile(EpubMetaDataPath);
    var epubMetadata = yaml.safeLoad(epubMetadataContent);
    
    // -------------------------------------------------------------------------
    // Metadata { title, creator, uuid, copyright ... }
    // -------------------------------------------------------------------------
    var metadata = epubMetadata.metadata || epubMetadata.info;

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
    
    info('复制资源文件');
    debug(resourceDirs);
    
    for (let dir of resourceDirs) {
        let rdir = joinPath(EpubPath, dir);
        let ifExist = yield access(rdir);
        if (! ifExist)
            continue;
        let rfiles = yield readdir(rdir);
        
        resourceFiles = resourceFiles.concat(rfiles.map((f => path.join(dir, f))));
    }
    
    for (let file of resourceFiles) {
        info("资源文件...", file);
        yield copyFile(joinPath(BuildPath, file), joinPath(EpubPath, file));
    }

    info('[[样式文件]]');
    
    yield templateFile(metadata.stylesheet);
//     
//     let styleSheet = metadata.stylesheet,
//         styleSheetFile,
//         styleSheetContent;
// 
//     styleSheetContent = yield renderStyle(joinPath(TemplatePath, TemplateFile.stylesheet));
// 
//     print(styleSheetContent);    
// 
// 
//     if (! styleSheet) {
//         info("使用默认的样式文件");
// 
//         styleSheet = 'default.css';
//         styleSheetFile = styleSheet;
//         if (! fs.existsSync(joinPath(TemplatePath, styleSheet))) {
//             throw new Error('无法找到默认的样式文件！');
//         }
//         styleSheetContent = fs.readFileSync(joinPath(TemplatePath, styleSheet));
//     } else {
//         let content = fs.readFileSync(joinPath(EpubPath, styleSheet));
//     
//         styleSheetFile = styleSheet.replace(/\w*$/, "css");
//         styleSheetContent = yield less.render(content.toString(), {
//             filename: path.resolve(joinPath(EpubPath, styleSheet)),
//         });
//     }
// 
//     metadata.stylesheet = styleSheetFile;
//     yield [styleSheetFile, new Buffer(styleSheetContent)];
// 
//     manifest.push(genManifest(styleSheetFile, styleSheet));
    
});


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

var argv = require('minimist')(process.argv.slice(2));

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



debug("当前路径:", CwdDir);
debug("程序路径:", ExeDir);
debug("模板路径:", TemplatePath);
debug("编译路径:", BuildPath);
debug("输出路径:", OutputPath);
debug("元数据路径:", EpubMetaDataPath);


build().then(info, warn);


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
 * 
 * 
 * 进度：
 *   mkdirp
 * 
 * 
 */
