

// META-INF/container.xml
// 
// 

// OPF


// var _ = require('underscore');
// var fs = require('fs');

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


var EpubAchive = require('./EpubAchive');

var e = new EpubAchive();
