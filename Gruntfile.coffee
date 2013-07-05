module.exports = (grunt) ->

  grunt.initConfig
    'auto-release': options:
      checkTravisBuild: false
    'bump': options:
      pushTo: 'upstream'

  grunt.loadTasks 'tasks'
  grunt.loadNpmTasks 'grunt-npm'
  grunt.loadNpmTasks 'grunt-bump'

  grunt.registerTask 'release', 'Bump the version and publish to NPM.', (type) ->
    grunt.task.run [
      "bump:#{type||'patch'}"
      'npm-publish'
    ]
