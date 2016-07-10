"use strict";
/**
 * BOOK <-> JSON
 */

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const mime = require('mime');

const uuid = require('./Utils.js').uuid;
const changeExt = require('./Utils.js').changeExt;


// -----------------------------------------------------------------------------

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

// ----------------------------------------------------------------------------


function normalizeMetadata(metadata) {
    if (metadata['标题'])
        metadata.title = metadata['标题'];
    if (metadata['作者'])
        metadata.author = metadata['作者'];
    if (metadata['制作者'])
        metadata.creator = metadata['制作者'];
    if (metadata['出版社'])
        metadata.publisher = metadata['出版社'];
    if (metadata['出版者'])
        metadata.publisher = metadata['出版者'];
    if (metadata['出版商'])
        metadata.publisher = metadata['出版商'];
    if (metadata['语言'])
        metadata.language = metadata['语言'];
    if (metadata['制作者'])
        metadata.creator = metadata['制作者'];
    if (metadata['封面'])
        metadata.coverImage = metadata['封面'];
    if (metadata['静态资源'])
        metadata.resoucepath = metadata['静态资源'];

    if (metadata.resoucepath) {
        let resoucePath = metadata.resoucepath.split('|').map(s => s.trim());
        metadata.resoucepath = resoucePath;
    } else {
        metadata.resoucepath = [];
    }
}

function normalizeSpine(spine) {
    if (spine['样式文件'])
        spine.stylesheet = spine['样式文件'];
    if (spine['模板'])
        spine.template = spine['模板'];

    if (spine.stylesheet) {
        let stylesheet = spine.stylesheet.split('|').map(s => s.trim());
        spine.stylesheet = stylesheet;
    } else {
        spine.stylesheet = [];
    }
}

function normalizeSpineItem(item, itemFile) {
    normalizeSpine(item);

    if (item['文件'])
        item.file = item['文件'];
    if (item['图片'])
        item.image = item['图片'];

    if (itemFile.match(/\.(md|mdown|markdn|markdown)$/)) {
        item.file = changeExt(itemFile, 'xhtml');
        item.markdown = itemFile;
    } else if (itemFile.match(/\.(jpg|png|bmp|gif)$/)) {
        item.file = changeExt(itemFile, 'xhtml');
        item.image = itemFile;
    } else {
        item.file = itemFile;
    }
}

function normalizeTocs(tocs) {
    if (tocs['自动生成'])
        tocs.autogenerate = tocs['自动生成'];
}

let parseBook = function(content) {
    var Metadata = {
        title: null,
        author: '佚名',
        publisher: null,
        language: 'zh-CN',
        coverImage: null,
        resoucepath: null,
        book_id: 'urn:uuid:' + uuid(),
        resource_id: 'urn:uuid:' + uuid(),
        version: null,
        page_direction: null  // ltr(letf-to-right)  rtl(right-to-left)
    };
    var Spines = [];
    var Tocs = [];

    content = content.toString().replace(/\r?\n/g, '\n');
    // `#` 行注释
    content = content.replace(/^\s*#.*\n/g, '');
    content = content.replace(/#[^#]*$/gm, '');

    let lines = content.split('\n');
    let n = 0, len = lines.length, result;

    function skipBlankLine() {
        while ((n < len) && (lines[n++].match(/^\s*$/)))
            continue;
        n--;
    }

    function matchKeyValue(dic) {
        while ((n < len) && (result = lines[n++].match(/^\s*\.([\w_-]+)\s*(.*)$/))) {
            let key = result[1],
                val = result[2].trim();
            if (val.length)
                dic[key] = val;
            else
                dic[key] = true;
            skipBlankLine();
        }
        n--;
    }

    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------

    while ((n < len) && (! lines[n++].match(/^\[metadata\]$/i)))
        continue;

    skipBlankLine();
    matchKeyValue(Metadata);
    normalizeMetadata(Metadata);

    // console.dir(Metadata);
    // console.log(n);

    // -------------------------------------------------------------------------
    // Spines
    // -------------------------------------------------------------------------

    while ((n < len) && (! lines[n++].match(/^\[spine\]$/i)))
        continue;

    skipBlankLine();
    matchKeyValue(Spines);
    normalizeSpine(Spines);

    while ((n < len) && (result = lines[n++].match(/^\s*-\s*(.*)$/))) {
        let item = {};
        let itemFile = result[1].replace(/\\/g, '/');

        while ((n < len) && (result = lines[n++].match(/^\s*\.([\w_]+)\s*(.*)$/))) {
            let key = result[1], val = _.trim(result[2]);
            item[key] = val.length ? val : true;
        }
        n--;

        // Spines 规范化
        normalizeSpineItem(item, itemFile);

        Spines.push(item);
        skipBlankLine();
    }

    // console.log(Spines);
    // console.log(n);

    // -------------------------------------------------------------------------
    // Tocs 可以省略
    // -------------------------------------------------------------------------

    while ((n < len) && (! lines[n++].match(/^\[toc\]$/i)))
        continue;

    if (n < len) {
        skipBlankLine();
        matchKeyValue(Tocs);
        normalizeTocs(Tocs);

        if (! Tocs.autogenerate) {
            while ((n < len) && (result = lines[n++].match(/^(\s*)-\s*\[(.*)\]\((.*)\)$/))) {
                let nav = {};
                nav.indent = result[1].length;
                nav.text = result[2];
                nav.href = result[3].replace(/\\/g, '/');

                Tocs.push(nav);
                skipBlankLine();
            }
        }
    }

    if (! Tocs.length)
        Tocs.autogenerate = true;

    // console.log(Tocs);
    // console.log(n);

    return {
        metadata: Metadata,
        toc: Tocs,
        spine: Spines,
    };
};

function writeBook(data) {

}


exports.Manifest = Manifest;
exports.parseBook = parseBook;
exports.writeBook = writeBook;
