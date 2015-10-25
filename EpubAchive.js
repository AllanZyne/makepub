// jshint esnext: true, node: true
"use strict";

var crc = require('crc');
var zlib = require('zlib');
var fs = require('fs');


const SIG_FILE_ENTRY = 0x04034B50;
const SIG_DIR_ENTRY  = 0x02014B50;
const SIG_EOCD = 0x06054B50;


class ZipRecord {
	constructor(fileName, data, deflate) {
		if (deflate !== false)
			deflate = true;

		this.version = 0x000A;
		this.flags = 0x0000;
		
		var now = new Date();
		this.fileTime = now.getHours() << 11 
			| now.getMinutes() << 5
			| now.getSeconds() >> 1;
		this.fileDate = (now.getFullYear() - 1980 & 0x7f) << 9
			| (now.getMonth() + 1) << 5
			| now.getDate();

		fileName = new Buffer(fileName);
		this.fileName = fileName;
		this.fileNameLength =  fileName.length;
		this.extraFieldLength = 0x0000;
		// console.log('fileNameLength', this.fileNameLength);
		this.uncompressSize = data.length;
		this.crc32 = crc.crc32(data);

		if (! deflate) {
			this.compresion = 0x0000;
		} else {
			this.compresion = 0x0008;
			data = zlib.deflateRawSync(data);
		}
		
		
		console.log('crc32', (this.crc32).toString(16));
		this.compressSize = data.length;
		this.data = data;

		this.versionMadeBy = 0x031E;
		this.commentLength = 0x0000;
		this.diskNumberStart = 0x0000;
		this.internalAttributes = 0x0000;
		this.externalAttributes = 0x81A40000;
		// this.headerOffset = 0x0000;

		this.fileEntrySize = 4*4 + 2*7 + this.fileNameLength + this.compressSize;
		this.dirEntrySize = 4*6 + 2*11 + this.fileNameLength;
	}

	get size() {
		return this.fileEntrySize + this.dirEntrySize;
	}

	writeFileRecord(buf, offset) {
		// console.log('offset', offset);

		offset = buf.writeUIntLE(SIG_FILE_ENTRY, offset, 4);
		// console.log('SIG_FILE_ENTRY offset', offset);
		offset = buf.writeUIntLE(this.version, offset, 2);
		// console.log('version offset', offset);
		offset = buf.writeUIntLE(this.flags, offset, 2);
		// console.log('compresion offset', offset);
		offset = buf.writeUIntLE(this.compresion, offset, 2);
		// console.log('fileTime offset', offset);
		offset = buf.writeUIntLE(this.fileTime, offset, 2);
		// console.log('fileDate offset', offset);
		offset = buf.writeUIntLE(this.fileDate, offset, 2);
		// console.log('crc32 offset', offset);
		offset = buf.writeUIntLE(this.crc32, offset, 4);
		// console.log('compressSize offset', offset);
		offset = buf.writeUIntLE(this.compressSize, offset, 4);
		offset = buf.writeUIntLE(this.uncompressSize, offset, 4);
		offset = buf.writeUIntLE(this.fileNameLength, offset, 2);
		offset = buf.writeUIntLE(this.extraFieldLength, offset, 2);
		// console.log('fileName offset', offset);
		this.fileName.copy(buf, offset);
		this.data.copy(buf, offset+this.fileNameLength);
		
		return this.fileEntrySize;
	}

	writeDirectoryRecord(buf, offset) {

		offset = buf.writeUIntLE(SIG_DIR_ENTRY, offset, 4);
		offset = buf.writeUIntLE(this.versionMadeBy, offset, 2);
		offset = buf.writeUIntLE(this.version, offset, 2);
		offset = buf.writeUIntLE(this.flags, offset, 2);
		offset = buf.writeUIntLE(this.compresion, offset, 2);
		offset = buf.writeUIntLE(this.fileTime, offset, 2);
		offset = buf.writeUIntLE(this.fileDate, offset, 2);
		offset = buf.writeUIntLE(this.crc32, offset, 4);
		offset = buf.writeUIntLE(this.compressSize, offset, 4);
		offset = buf.writeUIntLE(this.uncompressSize, offset, 4);
		offset = buf.writeUIntLE(this.fileNameLength, offset, 2);
		offset = buf.writeUIntLE(this.extraFieldLength, offset, 2);
		offset = buf.writeUIntLE(this.commentLength, offset, 2);
		offset = buf.writeUIntLE(this.diskNumberStart, offset, 2);
		offset = buf.writeUIntLE(this.internalAttributes, offset, 2);
		offset = buf.writeUIntLE(this.externalAttributes, offset, 4);
		offset = buf.writeUIntLE(this.headerOffset, offset, 4);
		this.fileName.copy(buf, offset);

		return this.dirEntrySize;
	}
}


var MimetypeEntry = new ZipRecord('mimetype', new Buffer('application/epub+zip'), false);
MimetypeEntry.headerOffset = 0x0000;

class EpubAchive {
	constructor(archivePath) {
		this._archivePath = archivePath;
		
		this.zipEntries = [MimetypeEntry];
		this.entryOffset = MimetypeEntry.fileEntrySize;
		this.fileSize = MimetypeEntry.size + 4*3+2*5;
	}

	addFile(filePath, content) {
		var entry = new ZipRecord(filePath, content);
		entry.headerOffset = this.entryOffset;
		this.zipEntries.push(entry);
		this.fileSize += entry.size;
		this.entryOffset += entry.fileEntrySize;
	}

	writeBuffer() {
		var buffer = new Buffer(this.fileSize),
			fileOffset = 0,
			directoryOffset = this.entryOffset;

		console.log('fileSize', this.fileSize);
		console.log('fileOffset', fileOffset);
		console.log('directoryOffset', directoryOffset);

		this.zipEntries.forEach(function(entry, index) {
			fileOffset += entry.writeFileRecord(buffer, fileOffset);
			directoryOffset += entry.writeDirectoryRecord(buffer, directoryOffset);
		});
 
 		console.log('fileOffset', fileOffset);
		console.log('directoryOffset', directoryOffset);

		var directorySize = directoryOffset - fileOffset;
		fileOffset = directoryOffset;
		directoryOffset = this.entryOffset;
		var diskNumber = 0x0000;
		var startDiskNumber = 0x0000;
		var entriesOnDisk = this.zipEntries.length;
		var entriesOnDirectory = this.zipEntries.length;
		var commentLength = 0x0000;

		fileOffset = buffer.writeUIntLE(SIG_EOCD, fileOffset, 4);
		fileOffset = buffer.writeUIntLE(diskNumber, fileOffset, 2);
		fileOffset = buffer.writeUIntLE(startDiskNumber, fileOffset, 2);
		fileOffset = buffer.writeUIntLE(entriesOnDisk, fileOffset, 2);
		fileOffset = buffer.writeUIntLE(entriesOnDirectory, fileOffset, 2);
		fileOffset = buffer.writeUIntLE(directorySize, fileOffset, 4);
		fileOffset = buffer.writeUIntLE(directoryOffset, fileOffset, 4);
		fileOffset = buffer.writeUIntLE(commentLength, fileOffset, 2);

		return buffer;
	}

	writeZip(archivePath, callback) {
		var buffer = this.writeBuffer();
		return fs.writeFile(archivePath, buffer, callback);
	}
}




module.exports = EpubAchive;
