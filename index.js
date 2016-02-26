/**
 * @author Stanislav Kalashnik <darkpark.main@gmail.com>
 * @license GNU GENERAL PUBLIC LICENSE Version 3
 */

'use strict';

var //path       = require('path'),
    util       = require('util'),
    exec       = require('child_process').exec,
    notifier   = require('node-notifier'),
    chokidar   = require('chokidar'),
    watchList  = {},
    doneList   = {};
    //extend     = require('extend'),
    //app        = require('spasdk/lib/app');
    //rootConfig = require('../config'),
    //padSize    = 8;


/**
 * @constructor
 *
 * @param {Object} config init parameters
 * @param {string} config.name gulp task set name
 * @param {string} config.entry task name used as the main entry
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
        Object.keys(this.config).forEach(function ( profileName ) {
            var profile = self.config[profileName];
                //tasks   = self.tasks;
                //watcher, watcherDone;

            function localTask ( id, body ) {
                var groupName = self.name + ':' + id,
                    finalName = self.task(id + ':' + profileName, body);

                /*var mainName = self.name + ':' + id,
                 taskName = mainName  + ':' + profileName;

                 // task itself
                 tasks[taskName] = body;
                 // group alias
                 tasks[mainName] = tasks[mainName] || [];
                 tasks[mainName].push(taskName);*/

                // group alias
                self.tasks[groupName] = self.tasks[groupName] || [];
                self.tasks[groupName].push(finalName);

                return finalName;
            }

            function localWatch ( config ) {
                var groupName, finalName;

                config.name = config.name || profileName;

                groupName = self.name + ':' + config.name;
                finalName = self.watch(config);

                // group alias
                self.tasks[groupName] = self.tasks[groupName] || [];
                self.tasks[groupName].push(finalName);

                return finalName;
            }

            function localNotify ( data ) {
                return self.notify(data, profileName);
            }

            self.profiles.push({
                name: profileName,
                data: profile,
                task: localTask,
                //watch: function ( watchName, watchPaths, taskName ) {
                watch: localWatch,
                    // auto-rebuild is set
                    /*if ( watchPaths && watchPaths.length ) {
                        localTask(watchName ? 'watch:' + watchName : 'watch', function ( done ) {
                            var fn = function ( name ) {
                                console.log('change:', name);
                                self.app.runner.run(taskName);
                            };

                            watcher = chokidar.watch(watchPaths, {ignoreInitial: true});
                            watcher
                                .on('change', fn)
                                .on('unlink', fn)
                                .on('add', fn);

                            watcherDone = done;
                        });

                        localTask(watchName ? 'unwatch:' + watchName : 'unwatch', function () {
                            if ( watcher ) {
                                watcher.close();
                                watcher = null;
                                watcherDone();
                            }
                        });
                    }*/
                //},
                notify: localNotify
            });

            localTask('config', function () {
                self.debug('config:\n' + util.inspect(self.config[profileName], {depth: 3, colors: true}));
            });
        });
    }

    //console.log(this);
    this.debug('profiles: ' + Object.keys(this.config).join(', '));
    //debug('tasks: ' + Object.keys(this.tasks).length);
}


Plugin.prototype = {
	/**
     * Link to the application instance.
     *
     * @type {Object}
     */
    app: require('spasdk/lib/app'),


    /**
     * Add new plugin top-level general task.
     *
     * @param {string} id task name
     * @param {function} body task method
     *
     * @return {string} full task name
     */
    task: function ( id, body ) {
        var name = this.name + ':' + id;

        this.tasks[name] = body;

        return name;
    },


    /**
     * Add new plugin top-level watch/unwatch task.
     *
     * @param {Object} config init parameters
     * @param {string} config.name watch task name
     * @param {string} config.glob files to watch
     * @param {string} config.task task name to exec
     */
    watch: function ( config ) {
        var self = this,
            watcher, watcherDone;

        this.task(config.name ? config.name + ':watch' : 'watch', function ( done ) {
            var fn = function ( name ) {
                self.debug('change: ' + name, 'run: ' + config.task);
                self.app.runner.run(config.task);
            };

            watcher = chokidar.watch(config.glob, {ignoreInitial: true})
                .on('change', fn)
                .on('unlink', fn)
                .on('add', fn);

            watcherDone = done;
        });

        // group alias
        //this.tasks[groupName] = this.tasks[groupName] || [];
        //this.tasks[groupName].push(finalName);

        this.task(config.name ? config.name + ':unwatch' : 'unwatch', function () {
            if ( watcher ) {
                watcher.close();
                watcher = null;
                watcherDone();
            }
        });
    },


    unwatch: function ( name ) {
        var taskId  = this.name + ':' + name,
            watcher = watchList[taskId],
            done    = doneList[taskId];

        if ( watcher && done ) {
            watcher.close();
            watcher = null;
            done();
        }
    },


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
    }

};


// correct constructor name
Plugin.prototype.constructor = Plugin;


// public
module.exports = Plugin;
