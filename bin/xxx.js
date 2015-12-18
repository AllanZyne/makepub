
function* epubFiles() {    


    debug('[[CATALOG]]');
    // Markdown
    var catalog = epubMetadata.catalog;
    if (! catalog) {
        throw new Error("metadata.yaml 中没有定义 catalog");
    }
    
    var topics = epubMetadata.topics = {};   // for toc.ncx

    // console.log(epubMetadata.catalog);
    var toc = [0, 0, 0, 0, 0, 0, 0];

    for (let filePath of catalog) {
        if (! fs.existsSync(epubPath+filePath)) {
            warn(`"${filePath}"文件不存在：${epubPath+filePath}`);
            continue;
        }
        let content = fs.readFileSync(epubPath+filePath).toString(),
            ext = filePath.match(/\w*$/)[0];
        
        switch (ext) {
            case 'md':
                // print(content);
                var md = markdown(content, epubMetadata.markdown);
                
                epubMetadata.content = md.makeHtml();
                content = applyTemplate(path.join(templatePath, 'chapter.xhtml'), epubMetadata);
                if (! content)
                    continue;
                
                var _topics = _.get(topics, filePath, []);
                topics[filePath] = _topics;
                
                content = content.replace(/<h([1-6])(.*?)>(.*?)<\/h\1>/gm, function(wholeMatch, level, attrs, title) {
                    var id;
                    level = parseInt(level);
                    id = 'toc';
                    for (var i = 1; i <= 6; i++) {
                        if (i < level) {
                            id += '-' + toc[i];
                        } else if (i == level) {
                            id += '-' + (++toc[i]);
                            for (var j = i; j >= 1; j--)
                                if (!toc[j])
                                    console.log("错误的标题:'", title, "'");
                        } else {
                            toc[i] = 0;
                        }
                    }

                    // _topics.push([level, title, filePath, id]);
                    _topics.push({
                        level : level,
                        text : title,
                        file : filePath,
                        src : filePath.replace(/\w*$/, "xhtml") + '#' + id,
                        id : id
                    });

                    return `<h${level} id="${id}">${title}</h${level}>`;
                });

                break;
        }
        let file = filePath.replace(/\w*$/, "xhtml");
        yield [file, new Buffer(content)];

        manifest.push(genManifest(file, filePath));
    }
    
    debug('[[COVER/COPYRIGHT/PREFACE]]');
    var content = applyTemplate(path.join(templatePath, 'cover.xhtml'), epubMetadata);
    yield ['cover.xhtml', new Buffer(pd.xml(content))];
    
    content = applyTemplate(path.join(templatePath, 'copyright.xhtml'), epubMetadata);
    yield ['copyright.xhtml', new Buffer(pd.xml(content))];
    
    content = applyTemplate(path.join(templatePath, 'preface.xhtml'), epubMetadata);
    yield ['preface.xhtml', new Buffer(pd.xml(content))];


    debug('[[CONTENT.OPF]]');
    content = applyTemplate(path.join(templatePath, 'content.opf'), epubMetadata);
    yield ['content.opf', new Buffer(pd.xml(content))];


    debug('[[TOC.NCX]]');
    content = applyTemplate(path.join(templatePath, 'toc.ncx'), epubMetadata);
    if (! content)
     return;

    yield ['toc.ncx', new Buffer(pd.xml(content))];

}




/**
 * 
 * yaml -> 
 * 
 */
// function build(build_dir) {
//     var it = epubFiles();
//     
//     function handle(value) {
//         if (_.isArray(value)) {
//             info(epubPath + value[0]);
//             fs.writeFileSync(path.join(build_dir, value[0]), value[1]);            
//             return;
//         }  
//         
//         // less
//         return value.css;
//     }
//     
//     function next(result) {
//         if (result.done)
//             return result.value;
//         
//         return result.value.then(
//             (value) => next(it.next(handle(value))),
//             (error) => next(it.throw(error))
//         );
//     }
//     
//     next(it.next());
// }