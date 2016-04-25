"use strict";

const Jasmine = require('jasmine');


let jasmine = new Jasmine();

jasmine.loadConfig({
    spec_dir: "test/spec",
    spec_files: [
        '*[sS]pec.js'
    ],
    helpers: [
        'helpers/*.js'
    ]
});

jasmine.onComplete(function(passed) {
    if(passed) {
        console.log('All specs have passed');
    }
    else {
        console.log('At least one spec has failed');
    }
});

jasmine.execute();
