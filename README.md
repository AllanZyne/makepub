Epub的制作工具
=======================

转markdown格式


     makeepub for duokan
     
     makeepub [options] <epubdir> [out_file（默认与文件夹同名.epub）]
     
     -b <builddir>  _build     编译路径 
     -t <theme>     duokan     使用的主题（默认）
     -m <path> metadata路径(默认=out_dir)
     
     -c 只编译，不打包
     -p 只打包，不编译
     
     
     -a 全部更新，默认只更新改动文件
     -j <N>  多线程编译
