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
var changeExt = require('../lib/Utils.js').changeExt;
var uuid = require('../lib/Utils.js').uuid;
var genManifest = require('../lib/Utils.js').genManifest;
var async = require('../lib/Utils.js').async;

var readFile = require('../lib/Utils.js').readFile;
var writeFile = require('../lib/Utils.js').writeFile;
var copyFile = require('../lib/Utils.js').copyFile;
var access = require('../lib/Utils.js').access;
var readdir = require('../lib/Utils.js').readdir;

var renderStyle = require('../lib/Utils.js').renderStyle;
var applyTemplate = require('../lib/Utils.js').applyTemplate;

// =============================================================================

var CwdDir = process.cwd();
var ExeDir = __dirname;

var DefaultTemplates = {};
var templates = fs.readdirSync(joinPath(ExeDir, '../template'));
templates.forEach(t => {
    DefaultTemplates[t] = joinPath(ExeDir, '../template', t);
});

var EpubPath = CwdDir;
var OutputPath;

var BuildPath = joinPath(EpubPath, '_build');
var TemplatePath = joinPath(ExeDir, '../template/duokan');
var DefaultTemplatePath = DefaultTemplates['default'];


// 暂时固定模板文件
var TemplateFile = {
    stylesheet : "style.less",     // 样式文件
    cover : 'cover.xhtml',         // 封面
    preface : 'preface.xhtml',     // 前言
    copyright : 'copyright.xhtml', // 版权
    chapter : 'chapter.xhtml',     // 内容
};


var EpubMetaDataPath;

/*

书籍模板数据


*/
var EpubMetadata;

/*

书籍信息相关

Metadata = {
    title :: String
    author :: String
    publisher :: String
    language :: String
    rights :: String
    cover :: FilePath
    stylesheet :: FilePath
}

*/
var Metadata;

/*

书籍的全部资源

data Item = {
    uid :: String,
    path :: String,
    mime :: String,
}

type Manifest = [Item]

*/
var Manifest;

/*

一个文件一个Chapter

data Chapter = {
    title: String,
    level: Int,
}

type Toc = [Chapter]

*/
var Toc = [];


var ResourceDirs;
var ResourceFiles;


// =============================================================================

var tocTemplateCompiled;
var contentTemplateCompiled;

var coverTemplateCompiled;
var copyrightTempalteCompiled;
var prefaceTemplateCompiled;

var chapterTemplateCompiled;

var styleTemplate;

var templateFile = async(function*(stylefile, chapters) {
    
    // 合并样式
    info('[[样式文件]]');

    let tplStyleFile = joinPath(TemplatePath, TemplateFile.stylesheet);
    let styleContent = yield renderStyle(tplStyleFile);
    let epbStyleFile = joinPath(EpubPath, stylefile);
    styleContent += yield renderStyle(epbStyleFile);
    
    info(stylefile);
    Manifest.push(genManifest(changeExt(stylefile, 'css')));

    let styleFile = changeExt(stylefile, 'css');
    styleFile = joinPath(BuildPath, styleFile);
    
    debug(styleFile);
    yield writeFile(styleFile, styleContent);
    
    // 处理markdown
    // 关系到toc的问题
    info('[[文本文件]]');
    
    // console.log(chapters);

    for (let chpFile of chapters) {
        // debug(chpFile);

        let chpContent = yield readFile(joinPath(EpubPath, chpFile));

        let md = markdown(chpContent.toString());
        let xhtmlContent = md.makeHtml();
        let xhtmlHeaders = md.getHeaders();
        let xhtmlFile = changeExt(chpFile, 'xhtml');

        Toc.push({ file: xhtmlFile, headers: xhtmlHeaders });
        // console.log(xhtmlHeaders);

        Manifest.push(genManifest(xhtmlFile));
        
        xhtmlFile = joinPath(BuildPath, xhtmlFile);
        
        xhtmlContent = yield applyTemplate(joinPath(TemplatePath, 'chapter.xhtml'), {
            metadata: { stylesheet: '../' + changeExt(stylefile, 'css') },
            content: xhtmlContent,
        });

        debug(xhtmlFile);
        yield writeFile(xhtmlFile, xhtmlContent);
    }
    
    // console.dir(Manifest);
});


// =============================================================================


var load = async(function*() {
    let ifExist = yield access(EpubMetaDataPath);
    if (! ifExist) {
        throw new Error("元数据文件不存在！！");
    }
    
    info('加载元数据...' + EpubMetaDataPath);
    
    var epubMetadataContent = yield readFile(EpubMetaDataPath);
    var epubMetadata = yaml.safeLoad(epubMetadataContent);
    if (!epubMetadata)
        return false;

    EpubMetadata = yaml.safeLoad(epubMetadataContent);
    Metadata = EpubMetadata.metadata || EpubMetadata.info;
    Manifest = EpubMetadata.manifest = [];
    Toc = EpubMetadata.tocs = [];

    EpubMetadata.metadata = Metadata;

    Metadata.book_id = Metadata.book_id || uuid();
    Metadata.resource_id = Metadata.resource_id || uuid();

    Metadata.rights = Metadata.rights ? Metadata.rights : "";

    ResourceDirs = EpubMetadata.resource || [];
    ResourceFiles = [];
    
    for (let dir of ResourceDirs) {
        let rdir = joinPath(EpubPath, dir);
        let ifExist = yield access(rdir);
        if (! ifExist)
            continue;
        let rfiles = yield readdir(rdir);
        
        ResourceFiles = ResourceFiles.concat(rfiles.map((f => path.join(dir, f))));
    }
    
    return true;
});


var build = async(function*() {
    if (!EpubMetadata)
        yield load();

    // -------------------------------------------------------------------------
    // Resource { static files path }
    // -------------------------------------------------------------------------
    info('[资源文件]');

    // TODO: 检测重复文件，避免拷贝
    for (let file of ResourceFiles) {
        info("资源文件...", file);
        Manifest.push(genManifest(file));
        yield copyFile(joinPath(BuildPath, file), joinPath(EpubPath, file));
    }

    if (Metadata.cover) {
        Manifest.push(genManifest(Metadata.cover));
        yield copyFile(joinPath(BuildPath, Metadata.cover), joinPath(EpubPath, Metadata.cover));
    }

    // -------------------------------------------------------------------------
    // Template
    // -------------------------------------------------------------------------
    
    yield templateFile(Metadata.stylesheet, EpubMetadata.catalog);

    Metadata.stylesheet = changeExt(Metadata.stylesheet, 'css');

    // -------------------------------------------------------------------------
    // BOOK
    // -------------------------------------------------------------------------

    // console.log(DefaultTemplates);

    info('[[CONTENT.OPF]]');
    let content_opf = yield applyTemplate(joinPath(DefaultTemplatePath, 'content.opf'), EpubMetadata);
    let content_opf_path = joinPath(BuildPath, 'content.opf');
    debug(content_opf_path);
    yield writeFile(content_opf_path, pd.xml(content_opf));

    info('[[TOC.NCX]]');
    let toc_ncx = yield applyTemplate(joinPath(DefaultTemplatePath, 'toc.ncx'), EpubMetadata);
    let toc_ncx_path = joinPath(BuildPath, 'toc.ncx');
    debug(toc_ncx_path);
    yield writeFile(toc_ncx_path, pd.xml(toc_ncx));

    // cover preface copyright
    let cover_xhtml = yield applyTemplate(joinPath(TemplatePath, 'cover.xhtml'), EpubMetadata);
    let cover_xhtml_path = joinPath(BuildPath, 'cover.xhtml');
    debug(cover_xhtml_path);
    yield writeFile(cover_xhtml_path, cover_xhtml);

    let copyright_xhtml = yield applyTemplate(joinPath(TemplatePath, 'copyright.xhtml'), EpubMetadata);
    let copyright_xhtml_path = joinPath(BuildPath, 'copyright.xhtml');
    debug(copyright_xhtml_path);
    yield writeFile(copyright_xhtml_path, copyright_xhtml);

    let preface_xhtml = yield applyTemplate(joinPath(TemplatePath, 'preface.xhtml'), EpubMetadata);
    let preface_xhtml_path = joinPath(BuildPath, 'preface.xhtml');
    debug(preface_xhtml_path);
    yield writeFile(preface_xhtml_path, preface_xhtml);

    info('编译完成');
});


var pack = async(function*() {
    if (!EpubMetadata)
        yield load();

    let fileName = joinPath(BuildPath, 'output.epub');
    let epubAchive = new EpubAchive(fileName);

    let filePath;

    info('[打包EPUB]');

    filePath = joinPath(DefaultTemplatePath, 'META-INF/container.xml');
    epubAchive.addFile('META-INF/container.xml', yield readFile(filePath));

    var templateFiles = ['content.opf', 'toc.ncx', 'cover.xhtml', 'preface.xhtml', 'copyright.xhtml'];

    for (let tfile of templateFiles) {
        filePath = joinPath(BuildPath, tfile);
        epubAchive.addFile(tfile, yield readFile(filePath));
    }

    // static files
    if (Metadata.cover) {
        filePath = joinPath(BuildPath, Metadata.cover);
        epubAchive.addFile(Metadata.cover, yield readFile(filePath));
    }

    if (Metadata.stylesheet) {
        let stylesheet = changeExt(Metadata.stylesheet, 'css');
        filePath = joinPath(BuildPath, stylesheet);
        epubAchive.addFile(stylesheet, yield readFile(filePath));
    }

    for (let rfile of ResourceFiles) {
        filePath = joinPath(BuildPath, rfile);
        epubAchive.addFile(rfile, yield readFile(filePath));
    }

    for (let cfile of EpubMetadata.catalog) {
        cfile = changeExt(cfile, 'xhtml');
        filePath = joinPath(BuildPath, cfile);
        epubAchive.addFile(cfile, yield readFile(filePath));
    }


    epubAchive.writeZip();
});

// function pack() {
//     var fileName = path.resolve(epubPath, '../') + '/' + path.basename(epubPath) + '.epub';
//     var epubAchive = new EpubAchive(fileName);
//     var EpubMetadata = yaml.safeLoad(fs.readFileSync(epubPath+'metadata.yaml', 'utf8'));
    
//     var resource = epubMetadata.resource;
    
//     if (resource.image) {
//         let paths = _.isArray(resource.image) ? resource.image : [resource.image],
//             files = [];
    
//         for (let file of paths) {
//             file = _.endsWith(file, '/') ? file : file+'/';
//             let dirFiles = _.chain(fs.readdirSync(epubPath+file)).map(x => file+x).value();
//             files = files.concat(dirFiles);
//         }
    
//         for (let file of files) {
//             epubAchive.addFile(file, fs.readFileSync(epubPath+file));        
//         }
//     }
    
//     if (resource.font) {
    
//     }
    
//     if (resource.video) {
    
//     }
    
//     var catalog = epubMetadata.catalog;
//     for (var filePath of catalog) {
//         let file = filePath.replace(/\w*$/, "xhtml");
//         epubAchive.addFile(file, fs.readFileSync(epubPath+file));
//     }
    
//     var metadata = epubMetadata.metadata;
    
//     var styleFile = metadata.stylesheet;
//     if (styleFile) {
//         let file = styleFile.replace(/\w*$/, "css");
//         epubAchive.addFile(file, fs.readFileSync(epubPath+file));
//     }

//     if (metadata.cover)
//         epubAchive.addFile(metadata.cover, fs.readFileSync(epubPath+metadata.cover));
    
//     epubAchive.addFile('content.opf', fs.readFileSync(epubPath+'content.opf'));
//     epubAchive.addFile('toc.ncx', fs.readFileSync(epubPath+'toc.ncx'));
    
//     epubAchive.addFile('preface.xhtml', fs.readFileSync(epubPath+'preface.xhtml'));
//     epubAchive.addFile('copyright.xhtml', fs.readFileSync(epubPath+'copyright.xhtml'));
//     epubAchive.addFile('cover.xhtml', fs.readFileSync(epubPath+'cover.xhtml'));
    
//     epubAchive.addFile('META-INF/container.xml', fs.readFileSync(path.join(templatePath, 'META-INF/container.xml')));
    
//     epubAchive.writeZip();
// }


// =============================================================================
// 解析运行参数
// =============================================================================

var argv = require('minimist')(process.argv.slice(2));



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

var argv_ = argv._;
var argv_0 = argv_[0];
if (argv_0) {
    EpubPath = path.isAbsolute(argv_0) ? argv_0 : joinPath(CwdDir, argv_0);
} else {
    EpubPath = CwdDir;
}

if (argv.b) {
    if (path.isAbsolute(argv.b))
        BuildPath = argv.b;
    else
        BuildPath = joinPath(CwdDir, argv.b);
} else {
    BuildPath = joinPath(EpubPath, '_build');
}

var o = argv_[1];
if (o)
   OutputPath = ""; 

EpubMetaDataPath = joinPath(EpubPath, 'metadata.yaml');



debug("当前路径:", CwdDir);
debug("程序路径:", ExeDir);
debug("模板路径:", TemplatePath);
debug("编译路径:", BuildPath);
debug("输出路径:", OutputPath);
debug("元数据路径:", EpubMetaDataPath);


let catchCallback = _.bind(warn, null, '编译出错: ');

if (argv.c || argv.p) {
    if (argv.c)
        build().catch(catchCallback);
    if (argv.p)
        pack().catch(catchCallback);
} else {
    build().then(pack).catch(catchCallback);
}


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
 * 
 * 进度：
 *   
 * 
 */
