'use strict';

var fs = require('fs');

var log = require('gulplog');
var stdout = require('mute-stdout');
var chalk = require('chalk');

var exit = require('../../shared/exit');
var tildify = require('../../shared/tildify');

var logTasks = require('../../shared/log/tasks');
var logEvents = require('../^4.0.0/log/events');
var logSyncTask = require('../^4.0.0/log/sync-task');
var logTasksSimple = require('../^4.0.0/log/tasks-simple');
var registerExports = require('../../shared/register-exports');

var copyTree = require('../../shared/log/copy-tree');
var getTask = require('../^4.0.0/log/get-task');
var requireOrImport = require('../../shared/require-or-import');

function execute(env) {
  var opts = env.config.flags;

  var tasks = opts._;
  var toRun = tasks.length ? tasks : ['default'];

  if (opts.tasksSimple || opts.tasks || opts.tasksJson) {
    // Mute stdout if we are listing tasks
    stdout.mute();
  }

  var gulpInst = require(env.modulePath);
  logEvents(gulpInst);
  logSyncTask(gulpInst, opts);

  // This is what actually loads up the gulpfile
  requireOrImport(env.configPath, function(err, exported) {
    // Before import(), if require() failed we got an unhandled exception on the module level.
    // So console.error() & exit() were added here to mimic the old behavior as close as possible.
    if (err) {
      console.error(err);
      exit(1);
    }

    registerExports(gulpInst, exported);

    // Always unmute stdout after gulpfile is required
    stdout.unmute();

    var tree;
    if (opts.tasksSimple) {
      tree = gulpInst.tree();
      return logTasksSimple(tree.nodes);
    }
    if (opts.tasks) {
      tree = gulpInst.tree({ deep: true });
      if (env.config.description && typeof env.config.description === 'string') {
        tree.label = env.config.description;
      } else {
        tree.label = 'Tasks for ' + chalk.magenta(tildify(env.configPath));
      }

      return logTasks(tree, opts, getTask(gulpInst));
    }
    if (opts.tasksJson) {
      tree = gulpInst.tree({ deep: true });
      if (env.config.description && typeof env.config.description === 'string') {
        tree.label = env.config.description;
      } else {
        tree.label = 'Tasks for ' + tildify(env.configPath);
      }

      var output = JSON.stringify(copyTree(tree, opts));

      if (typeof opts.tasksJson === 'boolean' && opts.tasksJson) {
        return console.log(output);
      }
      return fs.writeFileSync(opts.tasksJson, output, 'utf-8');
    }
    try {
      log.info('Using gulpfile', chalk.magenta(tildify(env.configPath)));
      var runMethod = opts.series ? 'series' : 'parallel';
      gulpInst[runMethod](toRun)(function(err) {
        if (err) {
          exit(1);
        }
      });
    } catch (err) {
      log.error(chalk.red(err.message));
      log.error('To list available tasks, try running: gulp --tasks');
      exit(1);
    }
  });
}

module.exports = execute;
