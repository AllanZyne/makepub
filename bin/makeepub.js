#!/usr/bin/env node
"use strict";

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const xmlbuilder = require('xmlbuilder');

const markdown = require('../lib/Markdown.js');
const EpubAchive = require('../lib/EpubAchive.js');

const { print, info, debug, warn } = require('../lib/Utils.js');
const { joinPath, changeExt, getFileType } = require('../lib/Utils.js');

const async = require('../lib/Async.js').async;
const { readFile, writeFile, copyFile, access, readdir } = require('../lib/Async.js');
const input = require('../lib/Async.js').input;

var Manifest = require('../lib/Book.js').Manifest;
const parseBook = require('../lib/Book.js').parseBook;

const { renderStyle, xhtmlTemplate, imageXhtmlTemplate, fileTemplate } = require('../lib/Template.js');


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

var Metadata, Tocs, Spines;

var SearchFiles = {};
var ResourceFiles = [];

// =============================================================================

function fileRelative(fileFrom, fileTo) {
    return path.relative(path.dirname(fileFrom), fileTo);
}

var searchFile = async(function*(file) {
    let filePath = joinPath(EpubPath, file);
    if (! (yield access(filePath))) {
        let _filePath = SearchFiles[file];
        if (! _filePath)
            throw new Error(`【错误】无法找到文件‘${filePath}’！`);
        return _filePath;
    }
    return filePath;
});


// =============================================================================

// load config
var load = async(function*() {
    let fExist = yield access(BookPath);
    if (! fExist) {
        throw new Error("【错误】BOOK文件不存在！！");
    }

    info('解析BOOK文件...' + BookPath);

    let content = yield readFile(BookPath);
    let bookData = parseBook(content);

    Metadata = bookData.metadata;
    Tocs = bookData.toc;
    Spines = bookData.spine;

    // 完整性检测
    if ((! Metadata.title) || (! Metadata.title.length))
        throw new Error("【错误】没有设置标题！");

    if ((! Metadata.author) || (! Metadata.author.length))
        throw new Error("【错误】没有设置作者！");

    // TODO: use default cover image  不是必要的？
    if ((! Metadata.coverImage) || (! Metadata.coverImage.length))
        throw new Error("【错误】没有设置CoverImage！");

    // 资源路径
    if (Metadata.resoucepath) {
        for (let dir of Metadata.resoucepath) {
            let rdir = joinPath(EpubPath, dir);
            let exist = yield access(rdir);
            // console.log(rdir);
            if (! exist)
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
    if (Metadata.coverImage) {
        if (! (yield access(joinPath(EpubPath, Metadata.coverImage)))) {
            let _cover = SearchFiles[Metadata.cover];
            if (! _cover)
                throw new Error("【错误】CoverImage：‘" + Metadata.coverImage + "’ 不存在！");
            Metadata.coverImage = _cover;
        }
        ResourceFiles.push(Metadata.coverImage);
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
        let file = spine.image || spine.markdown || spine.file;
        spine._file = joinPath(EpubPath, file);
        let exist = yield access(spine._file);
        if (! exist)
            throw new Error("【错误】Spine 文件‘" + file + "’不存在！");
        if (spine.template) {
            spine._template = joinPath(EpubPath, spine.template);
            exist = yield access(spine._template);
            if (! exist)
                throw new Error("【错误】Spine 模板文件‘" + spine.template + "’不存在！");
        }
    }

    if (Spines.template) {
        Spines._template = joinPath(EpubPath, Spines.template);
        let exist = yield access(Spines._template);
        if (! exist)
            throw new Error("【错误】Spine 模板文件‘" + Spines.template + "’不存在！");
    }

    info('校验完成');
    // TODO: validate toc

});

// var init = async(function*() {
//     console.log('新建电子书');
//     let title = yield input('标题：');
//     let author = yield input('作者：');
//     let lang = yield input('语言：');
//     let coverImage = yield input('封面图片：');
//     let template = yield input('模板：');


// });

// init();
// return;

var build = async(function*() {

    if (! Metadata)
        yield load();

    // -------------------------------------------------------------------------
    // Resource { static files path }
    // -------------------------------------------------------------------------

    // info('[[资源文件]]');

    for (let file of ResourceFiles) {
        let fileExt = path.extname(file);
        if (fileExt !== '.less')
            Manifest.addFile(file);
        yield copyFile(joinPath(BuildPath, file), joinPath(EpubPath, file));
    }

    // -------------------------------------------------------------------------
    // StyeSheet
    // -------------------------------------------------------------------------

    info('[[样式文件]]');

    for (let styleFile of Spines.stylesheet) {
        let fileExt = path.extname(styleFile);
        // TODO: validate css (href..., etc)
        if (fileExt === '.less') {  // TODO: convert to .css

        }
        yield copyFile(joinPath(BuildPath, styleFile), joinPath(EpubPath, styleFile));
    }

    // -------------------------------------------------------------------------
    // Spines
    // -------------------------------------------------------------------------

    info('[[书脊文件]]');

    // cover
    let coverSpine = {
        file: 'cover.xhtml',
        image: Metadata.coverImage
    };
    Spines.unshift(coverSpine);

    for (let spine of Spines) {
        Manifest.addFile(spine.file);

        if (spine.image) {
            let imageFile = fileRelative(spine.file, spine.image);
            let xhtmlContent = imageXhtmlTemplate(imageFile);
            spine.buildFile = joinPath(BuildPath, spine.file);
            yield writeFile(spine.buildFile, xhtmlContent);
        } else if (spine.markdown) {
            info('markdown:', spine.markdown);
            let content = yield readFile(spine._file);
            let md = markdown(content.toString());
            let mdContent = md.makeHtml();

            let stylesheet = spine.stylesheet || Spines.stylesheet;
            stylesheet = stylesheet.map(f => fileRelative(spine.file, f));

            let xhtmlContent;

            let template = spine._template || Spines._template;
            if (template) {
                let data = {
                    metadata: Metadata,
                    stylesheet: stylesheet,
                    markdown: mdContent,
                    file: spine.file,
                };
                // print(stylesheet);
                // print(data);
                xhtmlContent = yield fileTemplate(template, data);
            } else {
                xhtmlContent = xhtmlTemplate(mdContent, stylesheet);
            }

            spine.buildFile = joinPath(BuildPath, spine.file);
            yield writeFile(spine.buildFile, xhtmlContent);

            if (Tocs.autogenerate) {
                let headers = md.getHeaders();
                for (let h of headers) {
                    let nav = {};
                    nav.indent = h[0];
                    nav.href = spine.file + '#' + h[1];
                    nav.text = h[2];
                    Tocs.push(nav);
                }
            }
        } else if (spine.file.match('xhtml')) {
            // TODO: validate xhtml
            // Manifest.addFile(spine.file);
        } else {
            throw new Error("【错误】无法解析Spine文件‘" + spine.file + "’！");
        }
    }

    // -------------------------------------------------------------------------
    // TOC.NCX
    // -------------------------------------------------------------------------
    {
        info('[[TOC.NCX]]');

        console.dir(Tocs);

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
            // print(toc.indent, nextIndent);
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
                    navPoint = navPoint.up().ele('navPoint');
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
    if (! Metadata)
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



*/
