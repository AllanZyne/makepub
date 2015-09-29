// jshint esnext: true, node: true
"use strict";

var fs = require('fs');

var _ = require('underscore');
var yaml = require('js-yaml');
var less = require('less');
var showdown  = require('showdown');

// var converter = new showdown.Converter();

// var path = 'learnyouahaskell/chapter/';




// metadata = {
// 	title      : "",
// 	creator    : "",
// 	identifier : "",
// 	language   : "",
// 	date : "",
// 	publisher : "",
// 	rights : "",
// };

// manifest = {
// 	ncx : "",
// 	cover : "",
// 	content : "",
// 	cover_image : "",
// 	css : "",
// };


// spine = {
	
// };




// var demo = function(converter) {
//   return [
//     { type: 'lang', regex: '\\@', replace: '@' }
//   ];
// };


// var text = fs.readFileSync("test.md").toString();
// var html = converter.makeHtml(text);

// console.log(html);

// var path = '';




// function dirWalk(root, callback) {
// 	fs.readdirSync(root).forEach(function(file) {
// 		var stats = fs.statSync(root + file);
// 		if (stats.isDirectory())
// 			dirWalk(root + file + '/', callback);
// 		else
// 			callback(root, file);
// 	});
// }

// dirWalk(path, console.log);

// META-INF/container.xml
// 
// 

// OPF




// var data = fs.readFileSync('template/content.opf').toString();
// var compiled = _.template(data);

// var content_opf = compiled({
// 	OPF : {
// 		title : "My title",

// 	}
// });

// console.log(content_opf);


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

var epubPath = "learnyouahaskell/";
var epubTemplate = "duokan";
var templatePath = 'template/' + epubTemplate + '/';

function templateRules() {
	var rule_path = 'template/' + epubTemplate + '/templateRule.txt';
	var rule_content = fs.readFileSync(rule_path);

}

function applyTemplate(filePath, data) {
	var template = fs.readFileSync(filePath);
	var compiled = _.template(template.toString());
	// console.log(data);
	return compiled(data);
}


function* epubFiles() {
	
	var epubMetadata;

	yield ["META-INF/container.xml", fs.readFileSync(templatePath+"META-INF/container.xml")];

	try {
		epubMetadata = yaml.safeLoad(fs.readFileSync(epubPath+'metadata.yaml', 'utf8'));
	} catch (e) {
		console.error(e);
		return;
	}
 
 	var manifest = epubMetadata.manifest || [];
 	epubMetadata.manifest = manifest;


	// console.log(epubMetadata);

	var converter = new showdown.Converter();

	var xhtmlCounter = 0;
	var imageCounter = 0;
	var cssCounter = 0;
	var otherCounter = 0;

	for (let path of dirWalk(epubPath)) {
		let ext = path.match(/\w+$/);

		let info = {
			path : path,
			href : path,
		};
		
		if (ext) {
			let content, html, err, css;
			switch (ext[0]) {
				case "md":
					info.media_type = 'application/xhtml+xml';
					info.id = "xhtml_" + xhtmlCounter++;
					info.headers = [];
					info.href = path.replace(/\w+$/, "xhtml");

					content = fs.readFileSync(epubPath+path);
					html = converter.makeHtml(content.toString());
					html.replace(/<(h[1-6])\b.*?>(.*?)<\/\1>/g, function(_, level, title) {
						console.log(parseInt(level.match(/\d/g)[0]), title);

						info.headers.push({
							level: parseInt(level.match(/\d/g)[0]),
							text: title,
						});
					});

					yield [info.href, new Buffer(html)];
					break;
				case "xhtml":
					info.media_type = 'application/xhtml+xml';
					info.id = "xhtml_" + xhtmlCounter++;
					info.headers = [];

					content = fs.readFileSync(epubPath+path);
					html = content.toString();
					html.replace(/<(h[1-6])\b.*?>(.*?)<\/\1>/g, function(_, level, title) {
						console.log(level.match(/\d/g), title);

						info.headers.push({
							level: parseInt(level.match(/\d/)[0]),
							text: title,
						});
					});

					yield [path, content];
					break;
				case "less":
					info.media_type = 'text/css';
					info.id = 'stylesheet_' + cssCounter++;
					info.href = path.replace(/\w+$/, "css");

					content = fs.readFileSync(epubPath+path);

					less.render(content.toString(), function (e, output) {
						if (e)
							err = e;
						else
							css = output.css;
					});

					if (err) {
						console.error(err);
						return;
					} else
						err = undefined;

					yield [info.href, new Buffer(css)];
					break;
				case 'png':
					info.media_type = 'image/png';
					info.id = 'image_' + imageCounter++;

					yield [path, fs.readFileSync(epubPath+path)];
					break;
				case 'jpg':
					info.media_type = 'image/jpg';
					info.id = 'image_' + imageCounter++;

					yield [path, fs.readFileSync(epubPath+path)];
					break;
				case 'gif':
					info.media_type = 'image/gif';
					info.id = 'image_' + imageCounter++;

					yield [path, fs.readFileSync(epubPath+path)];
					break;
				case 'css':
					info.media_type = 'text/css';
					info.id = 'stylesheet_' + cssCounter++;

					yield [path, fs.readFileSync(epubPath+path)];
					break;
				default:
					info.media_type = 'unknown';
					info.id = 'unknown_' + otherCounter++;

					yield [path, fs.readFileSync(epubPath+path)];
			}
		}

		manifest.push(info);
	}

	var content = applyTemplate(templatePath+'content.opf', epubMetadata);
	if (! content)
		return;
	// console.log(content)
	yield ['content.opf', new Buffer(content)];

	content = applyTemplate(templatePath+'toc.ncx', epubMetadata);
	if (! content)
		return;
console.log(content)

	// var data = fs.readFileSync(templatePath + 'content.opf').toString();
	// var compiled = _.template(data);



	// var content_opf = compiled(epubMetadata);

	
	// yield {name:"113", content: "afas"};
	// yield {name:"114", content: "afas"};
}


// var EpubAchive = require('./EpubAchive');

// var epubFile = new EpubAchive();


for (let file of epubFiles()) {
	// console.log(file[0]);
	//epubFile.addFile(file.name, file.content);
}

// epubFile.writeZip('my_book.zip');

