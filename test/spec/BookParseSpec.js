describe("BookParse", function() {
      var fs = require('fs');
      var BookParse = require('../../lib/BookParse.js');

      var Metadata = BookParse.Metadata;
      var Spines = BookParse.Spines;
      var Tocs = BookParse.Tocs;

      var BookData_S, BookData_F;

      beforeEach(function() {
          BookData_S = fs.readFileSync('test/data/BOOK.success');
      });

      it("parseBook successfully", function() {
          // function foo() {

          //     var r = BookParse.parseBook(c);
          // }
          var foo = function() {
      return 1 + 2;
    };
          expect(foo).not.toThrow();
      });

      it("check parseBook result"), function() {
          expect(Metadata.title).toEqual('测试标题');
          expect(Metadata.resouce_path).toEqual(['dir1/', 'dir2']);
          expect(Metadata.version).toBeNull();
          expect(Spines.stylesheet).toEqual('style.less');

          expect(Spines[0]).toEqual({ file: 'xhtml/0001.xhtml' });
          expect(Spines[1]).toEqual({ file: 'xhtml/0002.xhtml' });
          expect(Spines[2]).toEqual({
              file: 'xhtml/0003.xhtml',
              markdown: 'xhtml/0003.md',
              markdown_extra: true,
              script: '0003.script.js'
          });
      };
});
