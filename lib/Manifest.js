"use strict";

const mime = require('mime');
const _ = require('lodash');

var Manifest = {
    _itemsTypeSet: {},
    _itemFileSet: {},
    _manifest: []
};

Manifest.addFile = function(file, fullscreen) {
    file = file.replace(/\\/g, '/');

    if (this._itemFileSet[file])
        return;

    let fileMime = mime.lookup(file);
    let fileType = fileMime.split('/')[0];
    let item = {
        href: file,
        type: fileType,
        mime: fileMime,
        fullscreen: fullscreen,
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


module.exports = Manifest;
