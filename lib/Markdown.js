// jshint esnext: true, node: true
"use strict";

/*

var markdown = requre('Markdown');

var md = markdown(<string>, <options>);

md.map().plugin().toHtml()

md.toHtml();


MD_ENTITY:
- BLOCK
    - HEADER
    - PARAGRAPH
    - BLOCKQUOTE
    - LIST
    - CODEBLOCK
    - HRULE
- INLINE
    - LINKS
    - EMPHASIS
    - CODE
    - IMAGE
- HTML


*/


function identity(x) { return x; }
function returnFalse(x) { return false; }

class HookCollection {
    chain(hookname, func) {
        var original = this[hookname];
        if (!original)
            throw new Error("unknown hook " + hookname);

        if (original === identity)
            this[hookname] = func;
        else
            this[hookname] = function (text) {
                var args = Array.prototype.slice.call(arguments, 0);
                args[0] = original.apply(null, args);
                return func.apply(null, args);
            };
    }

    set(hookname, func) {
        if (!this[hookname])
            throw new Error("unknown hook " + hookname);
        this[hookname] = func;
    }

    addNoop(hookname) {
        this[hookname] = identity;
    }

    addFalse(hookname) {
        this[hookname] = returnFalse;
    }
}


class Markdown {
    constructor(text, options) {
        var pluginHooks = this.hooks = new HookCollection();

        pluginHooks.addNoop("BLOCK");
        pluginHooks.addNoop("HEADER");
        pluginHooks.addNoop("PARAGRAPH");
        pluginHooks.addNoop("BLOCKQUOTE");
        pluginHooks.addNoop("LIST");
        pluginHooks.addNoop("CODEBLOCK");
        pluginHooks.addNoop("HRULE");
        pluginHooks.addNoop("INLINE");
        pluginHooks.addNoop("LINKS");
        pluginHooks.addNoop("EMPHASIS");
        pluginHooks.addNoop("CODE");
        pluginHooks.addNoop("IMAGE");
        pluginHooks.addNoop("HTML");


        text = text.replace(/\r\n/g, "\n"); // DOS to Unix
        text = text.replace(/\r/g, "\n"); // Mac to Unix

        this.text = text;
        this.options = options;

        this._deTab();

    }

    toHtml() {
        console.log(this.text);
        return this.text;
    }

    map(entity, callback) {
        this.hook.chain(entity, callback);

        return this;
    }

    _deTab() {
        var text = this.text;

        if (!/\t/.test(text))
                return text;

        var spaces = ["    ", "   ", "  ", " "],
        skew = 0,
        v;

        this.text = text.replace(/[\n\t]/g, function (match, offset) {
            if (match === "\n") {
                skew = offset + 1;
                return match;
            }
            v = (offset - skew) % 4;
            skew = offset + 1;
            return spaces[v];
        });
    }
}



module.exports = function(text, options) {

    return new Markdown(text, options);
};

