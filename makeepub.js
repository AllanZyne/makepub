var _ = require('underscore');
var fs = require('fs');
var showdown  = require('showdown');

var converter = new showdown.Converter();

// var path = 'learnyouahaskell/chapter/';


// var demo = function(converter) {
//   return [
//     { type: 'lang', regex: '\\@', replace: '@' }
//   ];
// };


// var text = fs.readFileSync("test.md").toString();
// var html = converter.makeHtml(text);

// console.log(html);

var path = 'learnyouahaskell/';




function dirWalk(root, callback) {
	fs.readdirSync(root).forEach(function(file) {
		var stats = fs.statSync(root + file);
		if (stats.isDirectory())
			dirWalk(root + file + '/', callback);
		else
			callback(root, file);
	});
}

dirWalk(path, console.log);

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


/*

mimetype
META-INF/
	container.xml
Content/
	title.xhtml
	content.xhtml
Style/
	stylesheet.css
Images/
	xxxx.png
Fonts/
	xxxx.ttf

content.opf
toc.ncx
cover.png

*/

// var AdmZip = require('adm-zip');
// var zip = new AdmZip();
// zip.addFile('mimetype', new Buffer('application/epub+zip', 'ascii'), "", 0x81A40000);

// zip.addFile('META-INF/container.xml', new Buffer(content_opf, 'utf8'), "", 0x81A40000)

// zip.addLocalFile("LICENSE", "LICENSE");

// zip.writeZip('./my_book.zip');


// var EpubAchive = require('./EpubAchive');

// var epubFile = new EpubAchive();

// epubFile.addFile('test.txt', new Buffer('AAAAAAAA'));

// epubFile.writeZip('my_book.zip');

