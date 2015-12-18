// jshint esnext: true, node: true
"use strict";

// var fs = require('fs');
// var path = require('path');
// var _ = require('lodash');
// var yaml = require('js-yaml');
// var less = require('less');
// var pd = require('pretty-data').pd;

// var EpubAchive = require('./lib/EpubAchive.js');

// var colors = require('colors/safe');
// colors.setTheme({
//     silly: 'rainbow',
//     input: 'grey',
//     verbose: 'cyan',
//     prompt: 'grey',
//     info: 'grey',
//     data: 'grey',
//     help: 'cyan',
//     warn: 'yellow',
//     debug: 'blue',
//     error: 'red'
// });

// // -----------------------------------------------------------------------------
// // Helper Functions
// // -----------------------------------------------------------------------------
// function error() {
//     console.error(colors.error.apply(null, arguments));
// }

// function print() {
//     console.log.apply(console, arguments);
// }

// function info() {
//     console.info(colors.info.apply(null, arguments));
// }

// var epubPath = "learnyouahaskell/";
// var templatePath = 'template/';

// var epubAchive = new EpubAchive('learnyouahaskell.epub');

// var epubMetadata = yaml.safeLoad(fs.readFileSync(epubPath+'metadata.yaml', 'utf8'));

// var resource = epubMetadata.resource;

// if (resource.image) {
//     let paths = _.isArray(resource.image) ? resource.image : [resource.image],
//         files = [];

//     for (let path of paths) {
//         path = _.endsWith(path, '/') ? path : path+'/';
//         let dirFiles = _.chain(fs.readdirSync(epubPath+path)).map(x => path+x).value();
//         files = files.concat(dirFiles);
//     }

//     for (let file of files) {
//         epubAchive.addFile(file, fs.readFileSync(epubPath+file));        
//     }
// }

// if (resource.font) {

// }

// if (resource.video) {

// }


// var catalog = epubMetadata.catalog;
// for (var filePath of catalog) {
//     let file = filePath.replace(/\w*$/, "xhtml");
//     epubAchive.addFile(file, fs.readFileSync(epubPath+file));
// }

// var metadata = epubMetadata.metadata;

// var styleSheet = metadata.stylesheet;
// var file = styleSheet.replace(/\w*$/, "css");
// epubAchive.addFile(file, fs.readFileSync(epubPath+file));


// epubAchive.addFile(metadata.cover, fs.readFileSync(epubPath+metadata.cover));


// epubAchive.addFile('content.opf', fs.readFileSync(epubPath+'content.opf'));
// epubAchive.addFile('toc.ncx', fs.readFileSync(epubPath+'toc.ncx'));
// epubAchive.addFile('META-INF/container.xml', fs.readFileSync(epubPath+'META-INF/container.xml'));






// epubAchive.writeZip();


var mkdirp = require('../lib/Utils.js').mkdirp;


mkdirp('test/test/test').then(function() {  
    console.log("true");
}, function() {
    console.log('false');
});




