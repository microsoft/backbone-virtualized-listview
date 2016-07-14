var fs = require('fs');
var os = require('os');
var http = require('http');
var path = require('path');
var childProcess = require('child_process');
var resolve = require('resolve');
var gulp = require('gulp');
var gutil = require('gulp-util');
var eslint = require('gulp-eslint');
var democase = require('gulp-democase');
var excludeGitignore = require('gulp-exclude-gitignore');
var webpack = require('webpack');
var del = require('del');
// coveralls
var coveralls = require('gulp-coveralls');
// coveralls-end
var jsdoc = require('gulp-jsdoc3');

function webpackBuild(configFilePath) {
  return function (cb) {
    webpack(require(configFilePath), function (err, stats) {
      gutil.log(stats.toString({ colors: true }));
      cb(err || stats.hasErrors() && new Error('webpack compile error'));
    });
  };
}

function getSeleniumFilePath() {
  var SELENIUM_NAME = 'selenium-server-standalone-2.53.0.jar';
  return path.resolve(os.tmpdir(), SELENIUM_NAME);
}

gulp.task('download-selenium', function (cb) {
  var filePath = getSeleniumFilePath();
  fs.stat(filePath, function (err) {
    if (!err) {
      return cb(null);
    }
    var file = fs.createWriteStream(filePath);
    var URL = 'http://selenium-release.storage.googleapis.com/2.53/selenium-server-standalone-2.53.0.jar';
    http.get(URL, function (response) {
      response.pipe(file);
    });
    file.on('error', function (err) {
      fs.unlinkSync(filePath);
      cb(err);
    });
    file.on('finish', cb);
  });
});

function startSeleniumServer() {
  var filePath = getSeleniumFilePath();
  return childProcess.spawn('java', ['-jar', filePath], {
    stdio: 'inherit',
    env: { path: path.join(__dirname, 'node_modules', '.bin') },
  });
}

/*
function testWithKarmaCmd(handler) {
  var karmaCmd = path.resolve('./node_modules/.bin/karma');

  if (process.platform === 'win32') {
    karmaCmd += '.cmd';
  }

  childProcess.spawn(karmaCmd, [
    'start',
    '--single-run',
  ], { stdio: 'inherit' }).on('close', handler);
}
*/

function testWithKarmaAPI(handler) {
  var Server = require('karma').Server;
  new Server({
    configFile: path.join(__dirname, 'karma.conf.js'),
    singleRun: true,
  }, handler).start();
}

gulp.task('test:unit', function (cb) {
  var handler = function (code) {
    if (code) {
      cb(new Error('test failure'));
    } else {
      cb();
    }
  };
  testWithKarmaAPI(handler);
});

// coveralls
gulp.task('coveralls', ['test'], function () {
  if (!process.env.CI) {
    return;
  }

  return gulp.src(path.join(__dirname, 'coverage/report-lcov/lcov.info'))
    .pipe(coveralls());
});
// coveralls-end

gulp.task('static', function () {
  return gulp.src(['js/**/*.js', 'demos/**/*.js', 'spec/**/*.js'])
    .pipe(excludeGitignore())
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
});

gulp.task('docs', function (cb) {
  gulp.src(['README.md', './src/**/*.js'], { read: false })
    .pipe(jsdoc(require('./jsdoc.json'), cb));
});

gulp.task('webpack', webpackBuild('./webpack.config'));

gulp.task('demos', function () {
  return gulp.src('./demos').pipe(democase());
});

gulp.task('test:demos', ['download-selenium'], function (done) {
  var pathCli = path.resolve(path.dirname(resolve.sync('webdriverio', {
    basedir: '.',
  })), 'lib/cli');
  var cpSelenium = null;
  var cpWdio = null;

  cpSelenium = startSeleniumServer().on('error', function () {
    if (cpWdio) {
      cpWdio.kill();
    }
    done(new Error('Failed to launch the selenium standalone server. Make sure you have JRE available'));
  });

  cpWdio = childProcess.fork(pathCli, [path.join(__dirname, 'wdio.conf.js')], {
    env: { DEMOCASE_HTTP_PORT: 8081 },
  }).on('close', function (code) {
    cpSelenium.kill();
    if (code) {
      done(new Error('selenium test failue'));
    }
    done();
  });
});

gulp.task('test', ['test:unit']);

gulp.task('prepublish', ['webpack']);

gulp.task('clean:test', function () {
  return del(['coverage']);
});

gulp.task('clean:build', function () {
  return del(['dist']);
});

gulp.task('clean', ['clean:build', 'clean:test']);

gulp.task('default', [
  'static',
  'webpack',
// coveralls
  'coveralls',
// coveralls-end
]);
