#!/usr/bin/env node
"use strict";

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const xmlbuilder = require('xmlbuilder');

const markdown = require('../lib/Markdown.js');
const EpubAchive = require('../lib/EpubAchive.js');

const print = require('../lib/Utils.js').print;
const info = require('../lib/Utils.js').info;
const debug = require('../lib/Utils.js').debug;
const warn = require('../lib/Utils.js').warn;

const joinPath = require('../lib/Utils.js').joinPath;
const changeExt = require('../lib/Utils.js').changeExt;
const getFileType = require('../lib/Utils.js').getFileType;

const async = require('../lib/Async.js').async;
const readFile = require('../lib/Async.js').readFile;
const writeFile = require('../lib/Async.js').writeFile;
const copyFile = require('../lib/Async.js').copyFile;
const access = require('../lib/Async.js').access;
const readdir = require('../lib/Async.js').readdir;

var Manifest = require('../lib/Book.js').Manifest;
const parseBook = require('../lib/Book.js').parseBook;

const jsdomHook = require('../lib/Template.js').jsdomHook;
const xhtmlTemplate = require('../lib/Template.js').xhtmlTemplate;
const imageXhtmlTemplate = require('../lib/Template.js').imageXhtmlTemplate;
const renderStyle = require('../lib/Template.js').renderStyle;
const applyTemplate = require('../lib/Template.js').applyTemplate;


// =============================================================================

const CwdDir = process.cwd();
const ExeDir = __dirname;

var EpubPath;
var OutputPath;

var BuildPath;
var TemplatePath;
var DefaultTemplatePath = joinPath(ExeDir, '../template/default');
var BookPath;

var DefaultTemplates = {};
var templates = fs.readdirSync(joinPath(ExeDir, '../template'));
templates.forEach(t => {
    DefaultTemplates[t] = joinPath(ExeDir, '../template', t);
});

var BookData, Metadata, Tocs, Spines;

var SearchFiles = {};
var ResourceFiles = [];

// =============================================================================

function fileRelative(fileFrom, fileTo) {
    return path.relative(path.dirname(fileFrom), fileTo);
}

// =============================================================================

// load config
var load = async(function*() {
    let fExist = yield access(BookPath);
    if (! fExist) {
        throw new Error("【错误】BOOK文件不存在！！");
    }

    info('解析BOOK文件...' + BookPath);

    let content = yield readFile(BookPath);
    BookData = parseBook(content);

    info('解析完成');

    Metadata = BookData.metadata;
    Tocs = BookData.toc;
    Spines = BookData.spine;

    if ((! Metadata.title) || (! Metadata.title.length))
        throw new Error("【错误】没有设置标题！");

    if ((! Metadata.author) || (! Metadata.author.length))
        throw new Error("【错误】没有设置作者！");

    // TODO: use default cover image
    if ((! Metadata.cover) || (! Metadata.cover.length))
        throw new Error("【错误】没有设置CoverImage！");

    // get files
    if (Metadata.resoucepath) {
        for (let dir of Metadata.resoucepath) {
            let rdir = joinPath(EpubPath, dir);
            let ifExist = yield access(rdir);
            // console.log(rdir);
            if (! ifExist)
                continue;
            let rfiles = yield readdir(rdir);
            // console.log(rfiles);
            ResourceFiles = ResourceFiles.concat(
                rfiles.map((file => path.join(dir, file).replace(/\\/g, '/') ))
            );
        }
    }

    ResourceFiles.forEach(function(file) {
        SearchFiles[path.basename(file)] = file;
    });

    // validate file
    if (! (yield access(joinPath(EpubPath, Metadata.cover)))) {
        let _cover = SearchFiles[Metadata.cover];
        if (! _cover)
            throw new Error("【错误】CoverImage：‘" + Metadata.cover + "’ 不存在！");
        Metadata.cover = _cover;
    }

    for (let i in Metadata.stylesheet) {
        let styleFile = Metadata.stylesheet[i];
        if (! (yield access(joinPath(EpubPath, styleFile)))) {
            let _styleFile = SearchFiles[styleFile];
            if (! _styleFile)
                throw new Error("【错误】样式文件‘" + styleFile + "’不存在！");
            Metadata.stylesheet[i] = _styleFile;
        }
    }

    for (let spine of Spines) {
        if (spine.fullscreen) {
            let spineFile = spine.fullscreen;
            if (! (yield access(joinPath(EpubPath, spineFile)))) {
                let _spineFile = SearchFiles[spineFile];
                if (! _spineFile)
                    throw new Error("【错误】Spine文件‘" + spineFile + "’不存在！");
                spine.file = _spineFile;
            }
        } else if (spine.markdown) {
            let spineFile = spine.markdown;
            if (! (yield access(joinPath(EpubPath, spineFile)))) {
                let _spineFile = SearchFiles[spineFile];
                if (! _spineFile)
                    throw new Error("【错误】Spine文件‘" + spineFile + "’不存在！");
                spine.file = _spineFile;
            }
        } else {
            let spineFile = spine.file;
            if (! (yield access(joinPath(EpubPath, spineFile)))) {
                let _spineFile = SearchFiles[spineFile];
                if (! _spineFile)
                    throw new Error("【错误】Spine文件‘" + spineFile + "’不存在！");
                spine.file = _spineFile;
            }
        }
    }

    info('校验完成');
    // TODO: validate toc

});

var build = async(function*() {

    if (! BookData)
        yield load();

    // -------------------------------------------------------------------------
    // Resource { static files path }
    // -------------------------------------------------------------------------

    // info('[[资源文件]]');

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

        let toc_ncx = xmlbuilder.create('ncx').dec('1.0', 'utf-8', false).att({
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

        let content_opf = xmlbuilder.create('package').dec('1.0', 'utf-8', false).att({
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
    if (! BookData)
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
    BookPath = path.isAbsolute(m) ? m : joinPath(CwdDir, m);
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

BookPath = joinPath(EpubPath, 'BOOK');



debug("当前路径:", CwdDir);
// debug("程序路径:", ExeDir);
debug("模板路径:", TemplatePath);
debug("编译路径:", BuildPath);
debug("输出路径:", OutputPath);
debug("BOOK路径:", BookPath);


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
