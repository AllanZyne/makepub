"use strict";

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const mime = require('mime');

const uuid = require('./Utils.js').uuid;
const changeExt = require('./Utils.js').changeExt;

const EpubPath = require('./Storage.js').EpubPath;

// ----------------------------------------------------------------------------

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

let parseBook = function(content) {
    var Metadata = {
        title: null,
        author: '佚名',
        publisher: null,
        language: 'zh-CN',
        cover: null,
        resoucepath: null,
        template: "duokan",
        stylesheet: null,
        book_id: 'urn:uuid:' + uuid(),
        resource_id: 'urn:uuid:' + uuid(),
        version: null,
        page_direction: null  // ltr(letf-to-right)  rtl(right-to-left)
    };
    var Spines = [];
    var Tocs = [];

    content = content.toString().replace(/\r?\n/g, '\n');
    content = content.replace(/^\s*#.*\n/g, '');

    let lines = content.split('\n');
    let n = 0, len = lines.length, result;

    function skipBlankLine() {
        while ((n < len) && (lines[n++].match(/^\s*$/)))
            continue;
        n--;
    }

    // -------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------

    while ((n < len) && (! lines[n++].match(/^\[metadata\]$/i)))
        continue;

    skipBlankLine();

    while ((n < len) && (result = lines[n++].match(/^\s*\.([\w_-]+)\s*(.*)$/))) {
        let key = result[1],
            val = _.trim(result[2]);
        if (val.length)
            Metadata[key] = val;
        skipBlankLine();
    }
    n--;

    if (Metadata.resouce_path) {
        let resoucePath = Metadata.resouce_path.replace(/\s+/g, '|').replace(/\\/g, '/').split('|');
        Metadata.resouce_path = resoucePath;
    }

    if (Metadata.stylesheet) {
        let stylesheet = Metadata.stylesheet.replace(/\s+/g, '|').replace(/\\/g, '/').split('|');
        Metadata.stylesheet = stylesheet;
    }

    // console.log(Metadata);
    // console.log(n);

    // -------------------------------------------------------------------------
    // Spines
    // -------------------------------------------------------------------------

    while ((n < len) && (! lines[n++].match(/^\[spine\]$/i)))
        continue;

    skipBlankLine();

    while ((n < len) && (result = lines[n++].match(/^\s*\.([\w_-]+)\s*(.*)$/))) {
        let key = result[1],
            val = _.trim(result[2]);
        if (val.length)
            Spines[key] = val;
        skipBlankLine();
    }
    n--;

    while ((n < len) && (result = lines[n++].match(/^\s*-\s*(.*)$/))) {
        let item = {};
        let itemFile = result[1].replace(/\\/g, '/');

        while ((n < len) && (result = lines[n++].match(/^\s*\.([\w_]+)\s*(.*)$/))) {
            let key = result[1], val = _.trim(result[2]);
            item[key] = val.length ? val : true;
        }
        n--;

        if (itemFile.match(/\.(md|mdown|markdn|markdown)$/)) {
            item.file = changeExt(itemFile, 'xhtml');
            item.markdown = itemFile;
        } else if (itemFile.match(/\.(jpg|png|bmp|gif)$/)) {
            item.file = changeExt(itemFile, 'xhtml');
            item.image = itemFile;
        } else {
            item.file = itemFile;
        }

        Spines.push(item);
        skipBlankLine();
    }

    // console.log(Spines);
    // console.log(n);

    // -------------------------------------------------------------------------
    // Tocs
    // -------------------------------------------------------------------------

    while ((n < len) && (! lines[n++].match(/^\[toc\]$/i)))
        continue;

    skipBlankLine();

    while ((n < len) && (result = lines[n++].match(/^(\s*)-\s*\[(.*)\]\((.*)\)$/))) {
        let nav = {};
        nav.indent = result[1].length;
        nav.text = result[2];
        nav.href = result[3].replace(/\\/g, '/');

        Tocs.push(nav);
        skipBlankLine();
    }

    // console.log(Tocs);
    // console.log(n);
    return {
        metadata: Metadata,
        toc: Tocs,
        spine: Spines,
    };
};

exports.Manifest = Manifest;
exports.parseBook = parseBook;
