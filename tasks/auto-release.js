module.exports = function(grunt) {

  var exec = require('child_process').exec;
  var http = require('https');
  var GITHUB_REPO_REGEXP = /github\.com\/([\w-\.]+)\/([\w-\.]+)/;

  grunt.registerTask('auto-release', '', function(type) {

    var match = grunt.file.read('package.json').match(GITHUB_REPO_REGEXP);
    var opts = this.options({
      githubUser: match[1],
      githubRepo: match[2],
      branch: grunt.option('auto-release-branch') || 'master',
      remote: grunt.option('auto-release-remote') || 'upstream',
      checkTravisBuild: true,
      releaseTask: 'release'
    });

    var finish = this.async();
    var queue = [];
    var next = function(value) {
      if (!queue.length) {
        return finish();
      }

      queue.shift()(value);
    };

    var runCmd = function(cmd, msg, fn) {
      queue.push(function() {
        if (msg) {
          grunt.verbose.write(msg + '...');
        }

        exec(cmd, function(err, output) {
          if (err) {
            return grunt.fatal(err.message.replace(/\n$/, '.'));
          }

          if (msg) {
            grunt.verbose.ok();
          }

          if (fn) {
            output = fn(output);
          }

          next(output);
        });
      });
    };

    var run = function(fn) {
      queue.push(fn);
    };

    var runIf = function(condition, fn) {
      if (condition) {
        run(fn);
      }
    };

    runCmd('git checkout ' + opts.branch, 'Switching to ' + opts.branch);
    runCmd('git pull ' + opts.remote + ' ' + opts.branch, 'Pulling from ' + opts.remote);
    runCmd('git show -s --format=%H HEAD', null, function(sha) {
      return sha.replace('\n', '');
    });

    runIf(opts.checkTravisBuild, function(latestCommit) {
      grunt.verbose.write('Fetching status from GitHub/Travis...');

      var options = {
        hostname: 'api.github.com',
        path: '/repos/' + opts.githubUser + '/' + opts.githubRepo + '/statuses/' + latestCommit,
        headers: {
          'User-Agent': 'vojta'
        }
      };

      http.get(options, function(response) {
        var buffer = '';

        response.on('data', function(data) {
          buffer += data.toString();
        });

        response.on('end', function() {
          grunt.verbose.ok();

          var response = JSON.parse(buffer);

          if (!response.length) {
            return grunt.fatal('There is no Travis build for ' + opts.githubUser + '/' + opts.githubRepo + '/' + latestCommit);
          }

          if (response[0].state === 'success') {
            grunt.log.ok('Travis build for ' + opts.githubUser + '/' + opts.githubRepo + '/' + latestCommit + ' was successfull.');
            return next();
          }

          grunt.fatal('Travis build for ' + opts.githubUser + '/' + opts.githubRepo + '/' + latestCommit + ' failed (' + response[0].state + ').');
        });
      });
    });

    runCmd('git describe --tags --abbrev=0', 'Getting the previous tag', function(tag) {
      var latestTag = tag.replace('\n', '');

      runCmd('git log --grep="^feat|^fix" -E --oneline ' + latestTag + '..HEAD | wc -l', 'Checking for new changes since ' + latestTag + '...', function(output) {
        var newChangesCount = parseInt(output, 10);

        if (!newChangesCount) {
          grunt.log.ok('Nothing to release since ' + latestTag + '.');
        } else {
          grunt.log.ok('There are ' + newChangesCount + ' new changes to release.');

          grunt.task.run([opts.releaseTask]);
        }
      });
    });


    // kick it off
    next();
  });
};
