/**
 * @author Stanislav Kalashnik <darkpark.main@gmail.com>
 * @license GNU GENERAL PUBLIC LICENSE Version 3
 */

'use strict';

var path       = require('path'),
    util       = require('util'),
    exec       = require('child_process').exec,
    notifier   = require('node-notifier'),
    chokidar   = require('chokidar'),
    //extend     = require('extend'),
    app        = require('spasdk/lib/app'),
    pkgData    = require(path.join(process.cwd(), 'package.json'));
    //rootConfig = require('../config'),
    //padSize    = 8;


/**
 * @constructor
 *
 * @param {Object} config init options
 * @param {string} config.name gulp task set name
 * @param {string} config.entry task name used as the main entry
 * @param {Object} config.context link to a gulp plugin module
 * @param {Object} config.config plugin module config
 */
function Plugin ( config ) {
    var self = this;
        //name = pad(config.name);

    this.wamp = require('spa-plugin-wamp');

    this.debug = require('debug')('plugin:' + config.name);
    this.debug('init');

    this.name  = config.name;
    this.entry = config.entry;

    // colored name
    // according to type
    //this.title = {
    //    info: name,
    //    warn: name,
    //    fail: name
    //};

    // max pad title size
    //padSize = Math.max(padSize, this.name.length);

    // merge base and user configs
    this.config = config.config; //require(path.join(path.dirname(config.context.id), 'config'));
    //this.config = loadConfig(
    //    path.join(path.dirname(config.context.id), 'config'),
    //    path.join(cwd, 'gulpfile.js'),
    //    this.name
    //);

    this.tasks = {};

    if ( this.entry ) {
        // main task
        this.tasks[this.name] = [this.name + ':' + this.entry];
    }

    // wrapped profiles
    this.profiles = [];

    // plugin is not disabled
    if ( this.config && typeof this.config === 'object' ) {
        // wrap profiles
        Object.keys(this.config).forEach(function ( name ) {
            var profile = self.config[name],
                tasks   = self.tasks,
                addTask = function ( action, method ) {
                    var mainName = self.name + ':' + action,
                        taskName = mainName  + ':' + name;

                    // task itself
                    tasks[taskName] = method;
                    // group alias
                    tasks[mainName] = tasks[mainName] || [];
                    tasks[mainName].push(taskName);

                    return taskName;
                },
                watcher, watcherDone;

            self.profiles.push({
                name: name,
                data: profile,
                task: addTask,
                watch: function ( watchName, watchPaths, taskName ) {
                    // auto-rebuild is set
                    if ( watchPaths && watchPaths.length ) {
                        addTask(watchName ? 'watch:' + watchName : 'watch', function ( done ) {
                            var fn = function ( name ) {
                                console.log('change:', name);
                                app.runner.run(taskName);
                            };

                            watcher = chokidar.watch(watchPaths, {ignoreInitial: true});
                            watcher
                                .on('change', fn)
                                .on('unlink', fn)
                                .on('add', fn);

                            watcherDone = done;
                        });

                        addTask(watchName ? 'unwatch:' + watchName : 'unwatch', function () {
                            if ( watcher ) {
                                watcher.close();
                                watcher = null;
                                watcherDone();
                            }
                        });
                    }
                },
                notify: function ( data ) {
                    // forward
                    self.notify(data, name);
                }
            });

            addTask('config', function () {
                //log(pad(self.name).inverse, util.inspect(self.config[name], {depth: 3, colors: true}));
                self.debug('config:\n' + util.inspect(self.config[name], {depth: 3, colors: true}));
            });
        });
    }

    //console.log(this);
    this.debug('profiles: ' + Object.keys(this.config).join(', '));
    //debug('tasks: ' + Object.keys(this.tasks).length);
}


/*function loadConfig ( baseFile, userFile, pluginName ) {
    var baseConfig = require(baseFile),
        userConfig = require(userFile)[pluginName],
        result     = null;

    // task set is not marked for deletion with null/false
    if ( userConfig !== null && userConfig !== false ) {

        // merge user general config with the package base config
        result = extend(true, {}, baseConfig, userConfig);

        // remove profiles marked for deletion with null/false
        Object.keys(result).forEach(function ( name ) {
            if ( !result[name] ) {
                delete result[name];
            }
        });

        // extend profiles
        Object.keys(result).forEach(function ( name ) {
            // not the default profile
            if ( name !== 'default' ) {
                // merge this profile with the default one
                result[name] = extend(
                    true, {}, result.default, result[name]
                );
            }
        });

        // apply "auto" port
        Object.keys(result).forEach(function ( name ) {
            if ( result[name].port === 'auto' ) {
                result[name].port = rootConfig.default.port++;
            }
        });
    }

    return result;
}*/


/*function pad ( str ) {
    return str + (new Array(Math.max(padSize - str.length + 1, 0))).join(' ');
}*/


/*function log ( title, message ) {
    message = Array.isArray(message) ? message : message.split('\n');

    // make nice console output
    message.forEach(function ( line ) {
        //gutil.log(title, line.reset);
        console.log(title, line.reset);
    });
}*/


Plugin.prototype = {
	/**
     * Project info from package.json.
     *
     * @type {Object}
     */
    package: pkgData,


	/**
     * Print info in console, show popup and play sound.
     *
     * @param {Object} data message to show
     * @param {string} [data.type=info] notification type (info|warn|fail)
     * @param {string|Array} data.info message to show in console
     * @param {string} [data.icon] file name to use as an icon in popup window
     * @param {string} data.title popup window header
     * @param {string|Array} data.message message body to show in popup window
     * @param {string} profile name of profile to get config from
     */
    notify: function ( data, profile ) {
        var self   = this,
            config, console, popup, sound;

        profile = profile || 'default';
        config  = this.config[profile].notifications;

        if ( !config ) {
            // notifications are fully disabled
            return;
        }

        // sanitize
        data.type = ['info', 'warn', 'fail'].indexOf(data.type) === -1 ? 'info' : data.type;
        //data.info = data.info || data.message;
        data.tags = data.tags || [];

        // extract type configs
        console = config.console[data.type];
        popup   = config.popup[data.type];
        sound   = config.sound[data.type];

        this.wamp.message({
            info: data.info,
            data: data.message,
            tags: data.tags.concat([this.name, profile, data.type])
        });

        if ( console && data.info ) {
            // prepare
            //data.info = Array.isArray(data.info) ? data.info : data.info.split('\n');
            // print
            //log(this.title[data.type], data.info);
            this.debug(data.info);
        }

        if ( popup && popup.show && data.message ) {
            // add plugin name to the title
            data.title = util.format('%s: %s (profile: %s)', self.name, data.title, profile);
            // user can redefine the default icon
            data.icon = data.icon || popup.icon;
            // prepare text
            data.message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
            // show
            notifier.notify(data);
        }

        if ( sound && sound.play && sound.file ) {
            exec('aplay "' + sound.file + '"');
        }
    },


    task: function ( action, method ) {
        this.tasks[this.name + ':' + action] = method;
    }
};


// correct constructor name
Plugin.prototype.constructor = Plugin;


// public
module.exports = Plugin;
