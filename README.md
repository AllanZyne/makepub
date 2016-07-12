Epub的制作工具
=======================

<em style="color: red">（尚未完成）</em>

一个专门为[多看阅读客户端](http://www.duokan.com/product)优化的制作ePub工具。

主要支持通过Markdown格式制作ePub，同时对Markdown扩展了部分语法以生成多看公开的私有样式（参见：[ 多看电子书规范扩展开放计划](http://www.miui.com/thread-1960799-1-1.html)）。

TODO
-----------------------

- !! 资源路径的自动修正
- ! 辅助生成 BOOK
- ! 辅助生成 template
- ! READ.md
- duokan：用 jQuery 去特化 <img> 等，而不是 markdown
- 减少 node 的依赖
- 提交到 npm
- 持续集成
- ......................
- 只更新改动？
- 多线程？似乎没有必要
- ......................
- makemobi？

功能（特色）
-----------------------

- 支持添加自定义js脚本再加工
- 支持转换less文件
- Markdown相关
  - 支持多看的全屏插图页、富文本脚注、交互图
  - 支持代码语法高亮
  - 支持TeX转MathML（多看似乎支持MathML）

安装
------------------------

```sh
> git clone https://github.com/DrsExplorer/epubtools.git
> cd epubtools
> npm install
> npm link
```

开始制作
-----------------------

....
....
....


命令帮助
-----------------------


     makeepub for duokan
     
     makeepub [options] <epubdir> [out_file（默认与文件夹同名.epub）]
     
     -b <builddir>  _build     编译路径 
     -t <theme>     duokan     使用的主题（默认）
     -m <path> metadata路径(默认=out_dir)
     
     -c 只编译，不打包
     -p 只打包，不编译
     
     
     -a 全部更新，默认只更新改动文件
     -j <N>  多线程编译
