// jshint esnext: true, node: true
"use strict";

var shJScript = require('./shBrushHaskell.js').Brush;

var code = `
surface :: Shape -> Float
surface (Circle _ _ r) = pi * r ^ 2
surface (Rectangle x1 y1 x2 y2) = (abs $ x2 - x1) * (abs $ y2 - y1)
`;

var brush = new shJScript();

brush.init({ toolbar: false });
// sys.puts(brush.getHtml(code));


console.log(brush.getHtml(code));
