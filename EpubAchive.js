// jshint esnext: true, node: true
"use strict";

var crc = require('crc');
var zlib = require('zlib');

/*

FileRecord {
	signature:4,
	version:2,
	flags:2,
	compresion:2,
	fileTime:2,
	fileDate:2,
	crc32:4,
	compressSize:4,
	uncompressSize:4,
	fileNameLength:2,
	extraFieldLength:2,
	filename,
	data
}
*/


const SIG_FILE = 0x04034B50;
const SIG_DIR  = 0x02014B50;
const SIG_EOCD = 0x06054B50;


class ZipRecord {
	constructor(fileName, data, deflate=true) {
		this.version = 0x000A;
		this.flags = 0x0000;
		
		var now = new Date();
		this.fileTime = now.getHours() << 11 
			| now.getMinutes() << 5
			| now.getSeconds() >> 1;
		this.fileDate = (now.getFullYear() - 1980 & 0x7f) << 25
			| (now.getMonth() + 1) << 21
			| now.getDay() << 16 ;

		this.fileNameLength = fileName.length;
		this.extraFieldLength = 0x0000;
		this.fileName = fileName;

		this.uncompressSize = data.length;

		if (! deflate) {
			this.compresion = 0x0000;
		} else {
			this.compresion = 0x0008;
			data = zlib.deflateRawSync(data);
		}
		
		this.crc32 = crc.crc32(data);
		this.compressSize = data.length;
		this.data = data;

		this.versionMadeBy = 0x031E;
		this.commentLength = 0x0000;
		this.diskNumberStart = 0x0000;
		this.internalAttributes = 0x0000;
		this.externalAttributes = 0x81A40000;
	}


	writeFileRecord(buf) {
		buf = buf || new Buffer();
	
		this.headerOffset = buf.length;

		buf.writeUIntLE(SIG_FILE, 0, 4);
		buf.writeUIntLE(this.version, 0, 2);
		buf.writeUIntLE(this.flags, 0, 2);
		buf.writeUIntLE(this.compresion, 0, 2);
		buf.writeUIntLE(this.fileTime, 0, 2);
		buf.writeUIntLE(this.fileDate, 0, 2);
		buf.writeUIntLE(this.crc32, 0, 4);
		buf.writeUIntLE(this.compressSize, 0, 4);
		buf.writeUIntLE(this.uncompressSize, 0, 4);
		buf.writeUIntLE(this.fileNameLength, 0, 2);
		buf.writeUIntLE(this.extraFieldLength, 0, 4);
		buf.write(this.fileName);
		buf.write(this.data);

		return buf;
	}

	writeDirectoryRecord(buf) {
		buf = buf || new Buffer();
	
		buf.writeUIntLE(SIG_DIR, 0, 4);
		buf.writeUIntLE(this.versionMadeBy, 0, 2);
		buf.writeUIntLE(this.version, 0, 2);
		buf.writeUIntLE(this.flags, 0, 2);
		buf.writeUIntLE(this.compresion, 0, 2);
		buf.writeUIntLE(this.fileTime, 0, 2);
		buf.writeUIntLE(this.fileDate, 0, 2);
		buf.writeUIntLE(this.crc32, 0, 4);
		buf.writeUIntLE(this.compressSize, 0, 4);
		buf.writeUIntLE(this.uncompressSize, 0, 4);
		buf.writeUIntLE(this.fileNameLength, 0, 2);
		buf.writeUIntLE(this.extraFieldLength, 0, 4);
		buf.writeUIntLE(this.commentLength, 0, 2);
		buf.writeUIntLE(this.diskNumberStart, 0, 2);
		buf.writeUIntLE(this.internalAttributes, 0, 2);
		buf.writeUIntLE(this.externalAttributes, 0, 4);
		buf.writeUIntLE(this.headerOffset, 0, 4);
		buf.write(this.fileName);

		return buf;
	}
}


var MimetypeEntry = new ZipRecord('mimetype', new Buffer('application/epub+zip'), false);


class EpubAchive {
	constructor(archivePath) {
		this._archivePath = archivePath;
		console.log('constructor');
		
		this.zipEntries = [MimetypeEntry];

	}

	addFile(filePath, content) {
		console.log('addFile');
		var entry = new ZipRecord(filePath, content);
		this.zipEntries.push(entry);
	}

	writeBuffer() {
		var buffer = new Buffer();

		this.zipEntries.forEach(function(entry) {
			entry.writeFileRecord(buffer);
		});

		var directoryOffset = buffer.length;

		this.zipEntries.forEach(function(entry) {
			entry.writeDirectoryRecord(buffer);
		});

		var directorySize = buffer.length-directoryOffset;

		var diskNumber = 0x0000;
		var startDiskNumber = 0x0000;
		var entriesOnDisk = this.zipEntries.length;
		var entriesOnDirectory = this.zipEntries.length;
		var commentLength = 0x0000;

		buffer.writeUIntLE(SIG_EOCD, 0, 4);
		buffer.writeUIntLE(diskNumber, 0, 2);
		buffer.writeUIntLE(startDiskNumber, 0, 2);
		buffer.writeUIntLE(entriesOnDisk, 0, 2);
		buffer.writeUIntLE(entriesOnDirectory, 0, 2);
		buffer.writeUIntLE(directorySize, 0, 4);
		buffer.writeUIntLE(directoryOffset, 0, 4);
		buffer.writeUIntLE(commentLength, 0, 2);

		return buffer;
	}

	writeZip(archivePath, callback) {
		console.log('writeZip');



	}
}




module.exports = EpubAchive;
