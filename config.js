/**
 * Common configuration for plugins.
 *
 * @author Stanislav Kalashnik <darkpark.main@gmail.com>
 * @license GNU GENERAL PUBLIC LICENSE Version 3
 */

'use strict';

var path = require('path');


// root SPA config
// to be extended in other plugins
module.exports = {
    // directory to look for source files
    source: 'src',

    // directory to store output files
    target: 'app',

    // base port
    //port: 8000,

    // info channels
    notifications: {
        webui: {
            info: true,
            warn: true,
            fail: true
        },
        popup: {
            info: {show: false, icon: path.join(__dirname, 'media', 'info.png')},
            warn: {show: true,  icon: path.join(__dirname, 'media', 'warn.png')},
            fail: {show: true,  icon: path.join(__dirname, 'media', 'fail.png')}
        },
        sound: {
            info: {play: false, file: path.join(__dirname, 'media', 'info.wav')},
            warn: {play: false, file: path.join(__dirname, 'media', 'warn.wav')},
            fail: {play: false, file: path.join(__dirname, 'media', 'fail.wav')}
        }
    }
};
