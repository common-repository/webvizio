const path = require('path');
const webpack = require('webpack');
module.exports = {
    entry: './webvizio.js',
    output: {
        filename: '../../js/webvizio.min.js',
    },
    devtool: false,
    mode: 'production',
};
