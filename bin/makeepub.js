#!/usr/bin/env node
"use strict";

// jshint esnext: true, node: true

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const yaml = require('js-yaml');
const mime = require('mime');
const xmlbuilder = require('xmlbuilder');

const pd = require('pretty-data').pd;

const markdown = require('../lib/Markdown.js');
const EpubAchive = require('../lib/EpubAchive.js');

const print = require('../lib/Utils.js').print;
const info = require('../lib/Utils.js').info;
const debug = require('../lib/Utils.js').debug;
const warn = require('../lib/Utils.js').warn;
const joinPath = require('../lib/Utils.js').joinPath;
const changeExt = require('../lib/Utils.js').changeExt;
const uuid = require('../lib/Utils.js').uuid;
const genManifest = require('../lib/Utils.js').genManifest;
const getFileType = require('../lib/Utils.js').getFileType;
const async = require('../lib/Utils.js').async;

const readFile = require('../lib/Utils.js').readFile;
const writeFile = require('../lib/Utils.js').writeFile;
const copyFile = require('../lib/Utils.js').copyFile;
const access = require('../lib/Utils.js').access;
const readdir = require('../lib/Utils.js').readdir;

const renderStyle = require('../lib/Utils.js').renderStyle;
const applyTemplate = require('../lib/Utils.js').applyTemplate;


// =============================================================================

const CwdDir = process.cwd();
const ExeDir = __dirname;

var DefaultTemplates = {};
var templates = fs.readdirSync(joinPath(ExeDir, '../template'));
templates.forEach(t => {
    DefaultTemplates[t] = joinPath(ExeDir, '../template', t);
});

var EpubPath;
var OutputPath;

var BuildPath;
var TemplatePath;
var DefaultTemplatePath = joinPath(ExeDir, '../template/default');

// 暂时固定模板文件
var TemplateFile = {
    stylesheet : "style.less",     // 样式文件
    chapter : 'chapter.xhtml',     // 内容
};

var EpubMetaDataPath;

/*
书籍模板数据
*/
var EpubMetadata;

/*
书籍的基本信息
*/
var Metadata = {
    title: null,
    author: '佚名',
    publisher: null,
    language: 'zh-CN',
    copyrights: null,
    cover: null,
    resoucepath: [],
    template: "duokan",
    stylesheet: [],
    book_id: 'urn:uuid:' + uuid(),
    resource_id: 'urn:uuid:' + uuid(),
    version: '0.0.1',
    page_direction: null,
};

/*
书籍的全部资源
*/
var Manifest = {
    _itemsTypeSet: {},
    _itemFileSet: {},
    _manifest: []
};

Manifest.addFile = function(file) {
    file = file.replace(/\\/g, '/');

    if (this._itemFileSet[file])
        return;

    let fileMime = mime.lookup(file);
    let fileType = fileMime.split('/')[0];
    let item = {
        href: file,
        type: fileType,
        mime: fileMime
    };
    let items = _.get(this._itemsTypeSet, fileType, []);
    items.push(item);

    this._itemsTypeSet[fileType] = items;
    this._itemFileSet[file] = item;
};

Manifest.generateId = function() {
    let manifest = [];
    let itemTypes = _.keys(this._itemsTypeSet).sort();
    let typeCounters = {};

    for (let itemType of itemTypes) {
        let items = this._itemsTypeSet[itemType];
        let padLength = items.length.toString().length;
        // console.log(items);
        _.sortBy(items, 'href').forEach((item) => {
            let count = _.get(typeCounters, itemType, 0);
            typeCounters[itemType] = count + 1;
            item.id = itemType + _.padLeft(count, padLength, '0');
            manifest.push(item);
        });
    }

    this._manifest = manifest;

    return manifest;
};

Manifest.getId = function(file) {
    if (! this._manifest)
        throw new Error("【错误】应该先调用Manifest.generateId()！");
    file = file.replace(/\\/g, '/');
    let item = this._itemFileSet[file];
    if (! item)
        throw new Error(`【错误】无法得到文件‘${file}’的id！`);
    return item.id;
};


var Spines = [];

/*

*/
var Tocs = [];

var ResourceDirs = [];
var ResourceFiles = [];


// =============================================================================

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

function imageXhtmlTemplate(image_file) {
    return xhtmlTemplate(`<p><img src="${image_file}"/></p>`);
}

function fileRelative(fileFrom, fileTo) {
    return path.relative(path.dirname(fileFrom), fileTo);
}

// =============================================================================

// load config
var load = async(function*() {
    let ifExist = yield access(EpubMetaDataPath);
    if (! ifExist) {
        throw new Error("【错误】元数据文件不存在！！");
    }

    info('加载元数据...' + EpubMetaDataPath);

    let content = yield readFile(EpubMetaDataPath);
    let lines = content.toString().replace(/\r?\n/g, '\n').split('\n');
    let n = 0, len = lines.length, result;

    while ((n < len) && (! lines[n++].match(/^\[metadata\]$/)))
        continue;

    while ((n < len) && (result = lines[n++].match(/^\s*\.([\w_]+)\s*(.*)$/))) {
        let key = result[1],
            val = _.trim(result[2]);
        if (val.length)
            Metadata[key] = val;
    }
    n--;

    if ((! Metadata.title) || (! Metadata.title.length))
        throw new Error("【错误】没有设置标题！");

    // if ((! Metadata.author) || (! Metadata.author.length))
        // throw new Error("【错误】没有设置标题！");

    // TODO: use default cover image
    if ((! Metadata.cover) || (! Metadata.cover.length))
        throw new Error("【错误】没有设置CoverImage！");

    if (_.isString(Metadata.resoucepath)) {
        let resoucePath = Metadata.resoucepath.replace(/\s+/g, '|').replace(/\\/g, '/').split('|');
        Metadata.resoucepath = resoucePath;
    }
    ResourceDirs = Metadata.resoucepath;

    if (_.isString(Metadata.stylesheet)) {
        let stylesheet = Metadata.stylesheet.replace(/\s+/g, '|').replace(/\\/g, '/').split('|');
        Metadata.stylesheet = stylesheet;
    }

    // TODO: check Metadata value !!


    // console.log(Metadata);
    // console.log(n);

    while ((n < len) && (! lines[n++].match(/^\[spine\]$/)))
        continue;

    while ((n < len) && (result = lines[n++].match(/^\s*-\s*(.*)$/))) {
        let item = {};
        item.file = result[1].replace(/\\/g, '/');

        while ((n < len) && (result = lines[n++].match(/^\s*\.([\w_]+)\s*(.*)$/))) {
            item[result[1]] = result[2];
        }
        n--;

        Spines.push(item);
    }

    // console.log(Spines);
    // console.log(n);

    while ((n < len) && (! lines[n++].match(/^\[toc\]$/)))
        continue;

    while ((n < len) && (result = lines[n++].match(/^(\s*)-\s*\[(.*)\]\((.*)\)$/))) {
        let nav = {};
        nav.indent = result[1].length;
        nav.text = result[2];
        nav.href = result[3].replace(/\\/g, '/');

        Tocs.push(nav);
    }

    // console.log(Tocs);
    // console.log(n);

    ResourceFiles = [];

    for (let dir of ResourceDirs) {
        let rdir = joinPath(EpubPath, dir);
        let ifExist = yield access(rdir);
        if (! ifExist)
            continue;
        let rfiles = yield readdir(rdir);

        ResourceFiles = ResourceFiles.concat(rfiles.map((file => path.join(dir, file).replace(/\\/g, '/') )));
    }

    ResourceFiles.forEach(function(file) {
        ResourceFiles[path.basename(file)] = file;
    });

    // console.log(ResourceFiles);
    // console.log(n);

    // check if file exists

    if (! (yield access(joinPath(EpubPath, Metadata.cover)))) {
        let _cover = ResourceFiles[Metadata.cover];
        if (! _cover)
            throw new Error("【错误】CoverImage：‘" + Metadata.cover + "’ 不存在！");
        Metadata.cover = _cover;
    }

    for (let i in Metadata.stylesheet) {
        let styleFile = Metadata.stylesheet[i];
        if (! (yield access(joinPath(EpubPath, styleFile)))) {
            let _styleFile = ResourceFiles[styleFile];
            if (! _styleFile)
                throw new Error("【错误】样式文件‘" + styleFile + "’不存在！");
            Metadata.stylesheet[i] = _styleFile;
        }
    }

    for (let spine of Spines) {
        if (spine.fullscreen) {
            let spineFile = spine.fullscreen;
            if (! (yield access(joinPath(EpubPath, spineFile)))) {
                let _spineFile = ResourceFiles[spineFile];
                if (! _spineFile)
                    throw new Error("【错误】Spine文件‘" + spineFile + "’不存在！");
                spine.file = _spineFile;
            }
        } else if (spine.markdown) {
            let spineFile = spine.markdown;
            if (! (yield access(joinPath(EpubPath, spineFile)))) {
                let _spineFile = ResourceFiles[spineFile];
                if (! _spineFile)
                    throw new Error("【错误】Spine文件‘" + spineFile + "’不存在！");
                spine.file = _spineFile;
            }
        } else {
            let spineFile = spine.file;
            if (! (yield access(joinPath(EpubPath, spineFile)))) {
                let _spineFile = ResourceFiles[spineFile];
                if (! _spineFile)
                    throw new Error("【错误】Spine文件‘" + spineFile + "’不存在！");
                spine.file = _spineFile;
            }
        }
    }

    console.log(Metadata);

    EpubMetadata = true;
});

var build = async(function*() {
    if (!EpubMetadata)
        yield load();

    // -------------------------------------------------------------------------
    // Resource { static files path }
    // -------------------------------------------------------------------------

    info('[[资源文件]]');

    for (let file of ResourceFiles) {
        let fileExt = path.extname(file);
        if (fileExt !== '.less')
            Manifest.addFile(file);
    }

    // -------------------------------------------------------------------------
    // StyeSheet
    // -------------------------------------------------------------------------

    info('[[样式文件]]');

    for (let styleFile of Metadata.stylesheet) {
        let fileExt = path.extname(styleFile);
        // TODO: validate css (href..., etc)
        if (fileExt === '.less') {  // TODO: convert to .css

        }
    }

    // -------------------------------------------------------------------------
    // Spines
    // -------------------------------------------------------------------------

    info('[[书脊文件]]');

    // cover
    let coverSpine = {
        file: 'cover.xhtml',
        fullscreen: Metadata.cover
    };
    Spines.unshift(coverSpine);

    for (let spine of Spines) {
        if (spine.fullscreen) {
            let imageFile = fileRelative(spine.file, spine.fullscreen);
            let xhtmlContent = imageXhtmlTemplate(imageFile);
            Manifest.addFile(spine.file);
            spine.buildFile = joinPath(BuildPath, spine.file);
            yield writeFile(spine.buildFile, xhtmlContent);
        } else if (spine.markdown) {

        } else if (spine.file.match('xhtml')) {
            // TODO: validate xhtml
            Manifest.addFile(spine.file);
        } else {
            throw new Error("【错误】无法解析Spine文件‘" + spine.file + "’！");
        }
    }

    // -------------------------------------------------------------------------
    // TOC.NCX
    // -------------------------------------------------------------------------
    {
        info('[[TOC.NCX]]');

        let toc_ncx = xmlbuilder.create('ncx').dec('1.0', 'utf-8', true).att({
            'xmlns': 'http://www.daisy.org/z3986/2005/ncx/',
            'version': '2005-1'
        });

        let head = toc_ncx.ele('head');

        head.ele('meta', {
            name: 'dtb:uid',
            content: Metadata.book_id
        });
        head.ele('meta', {
            name: 'dtb:depth',
            content: '1'
        });
        head.ele('meta', {
            name: 'dtb:totalPageCount',
            content: '0'
        });
        head.ele('meta', {
            name: 'dtb:maxPageNumber',
            content: '0'
        });

        toc_ncx.ele('docTitle').ele('text').txt(Metadata.title);

        let navMap = toc_ncx.ele('navMap');
        let navPoint = navMap.ele('navPoint');
        for (let i = 0, len = Tocs.length; i < len; i++) {
            let toc = Tocs[i];
            navPoint.att({ id: `toc${i+1}`, playOrder: i+1});
            navPoint.ele('navLabel').ele('text').txt(toc.text);
            navPoint.ele('content', { src: toc.href });

            let nextIndent = _.get(Tocs, `${i+1}.indent`);
            if (_.isNumber(nextIndent)) {
                let deltaIndent = nextIndent - toc.indent;
                if (deltaIndent > 0) {
                    navPoint = navPoint.ele('navPoint');
                } else if (deltaIndent === 0) {
                    navPoint = navPoint.up().ele('navPoint');
                } else {
                    while (deltaIndent++) {
                        navPoint = navPoint.up();
                    }
                }
            }
        }

        let tocFile = joinPath(BuildPath, 'toc.ncx');
        let tocContent = toc_ncx.end({
              pretty: true,
              indent: '  ',
              newline: '\n',
              allowEmpty: false
        });

        Manifest.addFile('toc.ncx');

        yield writeFile(tocFile, tocContent);
    }


    Manifest.generateId();

    // console.log(Manifest._manifest);

    // -------------------------------------------------------------------------
    // CONTENT.OPF
    // -------------------------------------------------------------------------
    {
        info('[[CONTENT.OPF]]');

        let content_opf = xmlbuilder.create('package').dec('1.0', 'utf-8', true).att({
            'xmlns': 'http://www.idpf.org/2007/opf',
            'unique-identifier' : 'pub-id',
            'xml:lang': Metadata.language,
            'version': '3.0'
        });

        let content_opf_metadata = content_opf.ele('metadata');
        content_opf_metadata.att({
            'xmlns:dc': 'http://purl.org/dc/elements/1.1/',
            'xmlns:opf': 'http://www.idpf.org/2007/opf'
        });

        // title
        content_opf_metadata.ele('dc:title', { id: 'title' }, Metadata.title);
        content_opf_metadata.ele('meta', {
            refines: '#title',
            property: 'dcterms:title'
        }, Metadata.title);

        // creator
        content_opf_metadata.ele('dc:creator', { id: 'creator' }, Metadata.author);
        content_opf_metadata.ele('meta', {
            refines: '#creator',
            property: 'dcterms:creator'
        }, Metadata.creator);

        // language
        content_opf_metadata.ele('dc:language', { id: 'pub-lang' }, Metadata.language);
        content_opf_metadata.ele('meta', {
            refines: '#pub-lang',
            property: 'dcterms:language'
        }, Metadata.language);

        // uid
        content_opf_metadata.ele('dc:identifier', { id: 'pub-id' }, Metadata.book_id);
        content_opf_metadata.ele('meta', {
            refines: '#pub-id',
            property: 'dcterms:identifier'
        }, Metadata.book_id);

        // cover
        content_opf_metadata.ele('meta', {
            name: 'cover',
            content: Manifest.getId(coverSpine.file)
        });

        // manifest
        let content_opf_manifest = content_opf.ele('manifest');
        for (let item of Manifest._manifest) {
            content_opf_manifest.ele('item', {
                'id': item.id,
                'href': item.href,
                'media-type': item.mime,
            });
        }

        // spine
        let content_opf_spine = content_opf.ele('spine', {
            toc : Manifest.getId('toc.ncx')
        });
        if (Metadata.page_direction)
            content_opf_spine.att('page-progression-direction', Metadata.page_direction);

        for (let spine of Spines) {
            let itemref = content_opf_spine.ele('itemref', {
                'idref': Manifest.getId(spine.file),
                'linear': 'yes'
            });
            if (spine.fullscreen) {
                itemref.att('properties', 'duokan-page-fullscreen');
            }
        }

        // guide
        let content_opf_guide = content_opf.ele('guide');
        content_opf_guide.ele('reference', {
            type: 'cover',
            title: Manifest.getId(coverSpine.file),
            href: coverSpine.file
        });

        let content_opf_path = joinPath(BuildPath, 'content.opf');
        let content_opf_content = content_opf.end({
              pretty: true,
              indent: '  ',
              newline: '\n',
              allowEmpty: false
        });
        yield writeFile(content_opf_path, content_opf_content);
    }

    info('编译完成');
});


var pack = async(function*() {
    if (!EpubMetadata)
        yield load();

    info('[打包EPUB]');

    let fileName = joinPath(BuildPath, 'output.epub');
    let epubAchive = new EpubAchive(fileName);

    let filePath = joinPath(DefaultTemplatePath, 'container.xml');
    epubAchive.addFile('META-INF/container.xml', yield readFile(filePath));

    for (let file of ResourceFiles) {
        epubAchive.addFile(file, yield readFile(file));
    }

    for (let spine of Spines) {
        let filePath = spine.buildFile ? spine.buildFile : spine.file;
        epubAchive.addFile(spine.file, yield readFile(filePath));
    }

    var templateFiles = ['content.opf', 'toc.ncx'];

    for (let file of templateFiles) {
        filePath = joinPath(BuildPath, file);
        epubAchive.addFile(file, yield readFile(filePath));
    }

    epubAchive.writeZip();
});


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

EpubMetaDataPath = joinPath(EpubPath, 'BOOK');



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
 * makeepub [options] [epub_dir]
 *
 * Options
 * ------------------------------------------------
 *
 * -b <build_dir>  _build     编译路径
 * -t <theme>      duokan     使用的主题
 * -m <path>                  metadata路径
 *
 * -c 只编译，不打包
 * -p 只打包，不编译
 *
 * -a 全部更新，默认只更新改动文件
 * -j <N>  多线程编译
 *
 *  * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
`);
process.exit();
}


/*

!!!
===========
自定义脚本
主题

!!
============

!
============


*/
