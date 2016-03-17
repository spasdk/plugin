/**
 * @author Stanislav Kalashnik <darkpark.main@gmail.com>
 * @license GNU GENERAL PUBLIC LICENSE Version 3
 */

'use strict';

var //path       = require('path'),
    util       = require('util'),
    exec       = require('child_process').exec,
    notifier   = require('node-notifier'),
    chokidar   = require('chokidar');
    //watchList  = {},
    //doneList   = {};
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

    this.wamp = require('spa-plugin-wamp');

    this.debug = require('debug')('plugin:' + config.name);
    this.debug('init');

    this.name  = config.name;
    this.entry = config.entry;

    // merge base and user configs
    this.config = config.config;

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

            function localTask ( id, body ) {
                var groupName = self.name + ':' + id,
                    finalName = self.task(id + ':' + profileName, body);

                // group alias
                self.tasks[groupName] = self.tasks[groupName] || [];
                self.tasks[groupName].push(finalName);

                return finalName;
            }

            function localNotify ( data ) {
                return self.notify(data, profileName);
            }

            function localDebug () {
                Array.prototype.unshift.call(arguments, 'profile:' + profileName);
                self.debug.apply(self, arguments);
            }

            self.profiles.push({
                name:   profileName,
                data:   profile,
                task:   localTask,
                debug:  localDebug,
                //watch:  localWatch,
                notify: localNotify
            });

            localTask('config', function () {
                localNotify({
                    title: 'config',
                    //info: 'delete ' + profile.data.target,
                    info: util.inspect(self.config[profileName], {depth: 3, colors: true})
                });
            });
        });
    }

    this.debug('profiles: ' + Object.keys(this.config).join(', '));
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
    /*watch: function ( config ) {
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
    },*/


    /**
     * Add new plugin top-level watch task.
     *
     * @param {Array} glob globs that indicate which files to watch for changes
     * @param {string} task task name to exec
     *
     * @return {Object} chokidar instance
     */
    watch: function ( glob, task ) {
        var self = this;

        function handler ( name ) {
            self.debug('change: ' + name, 'run: ' + task);
            self.app.runner.run(task);
        }

        return chokidar.watch(glob, {ignoreInitial: true})
            .on('change', handler)
            .on('unlink', handler)
            .on('add',    handler);
    },


    /*unwatch: function ( name ) {
        var taskId  = this.name + ':' + name,
            watcher = watchList[taskId],
            done    = doneList[taskId];

        if ( watcher && done ) {
            watcher.close();
            watcher = null;
            done();
        }
    },*/


	/**
     * Print info in webui, show popup and play sound.
     *
     * @param {Object} message message to show
     * @param {string} [message.type=info] notification type (info|warn|fail)
     * @param {string|Array} message.info message to show in webui
     * @param {string} [message.icon] file name to use as an icon in popup window
     * @param {string} message.title popup window header
     * @param {string|Array} message.message message body to show in popup window
     * @param {string} profileName name of profile to get config from
     */
    notify: function ( message, profileName ) {
        var self = this,
            config, webuiConfig, popupConfig, soundConfig;

        profileName = profileName || 'default';
        config = this.config[profileName].notifications;

        if ( !config ) {
            // notifications are fully disabled
            return;
        }

        // sanitize
        message.type = ['info', 'warn', 'fail'].indexOf(message.type) === -1 ? 'info' : message.type;
        message.tags = Array.isArray(message.tags) ? message.tags : [];
        message.tags = message.tags.concat([this.name, profileName, message.type]);

        // extract type configs
        webuiConfig = config.webui[message.type];
        popupConfig = config.popup[message.type];
        soundConfig = config.sound[message.type];

        if ( profileName  ) { this.debug('profile:' + profileName); }
        if ( message.info ) { this.debug(message.info); }
        if ( message.data ) { this.debug(message.data); }
        if ( message.tags ) { this.debug(message.tags); }

        if ( webuiConfig ) {
            this.wamp.message({
                info: message.info,
                data: message.data,
                tags: message.tags
            });

            // prepare
            //data.info = Array.isArray(data.info) ? data.info : data.info.split('\n');
            // print
            //log(this.title[data.type], data.info);
        }

        if ( popupConfig && popupConfig.show && message.info ) {
            // add plugin name to the title
            message.title = util.format('%s: %s (profile: %s)', self.name, message.title, profileName);
            // user can redefine the default icon
            message.icon = message.icon || popupConfig.icon;
            // prepare text
            //data.message = Array.isArray(data.message) ? data.message.join('\n') : data.message;
            message.message = message.info;
            // show
            notifier.notify(message);
        }

        if ( soundConfig && soundConfig.play && soundConfig.file ) {
            exec('aplay "' + soundConfig.file + '"');
        }
    }

};


// correct constructor name
Plugin.prototype.constructor = Plugin;


// public
module.exports = Plugin;
