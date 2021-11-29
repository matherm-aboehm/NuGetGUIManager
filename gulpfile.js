/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const gulp = require('gulp');
const path = require('path');
const fs = require('fs');

const ts = require('gulp-typescript');
const typescript = require('typescript');
const sourcemaps = require('gulp-sourcemaps');
const del = require('del');
const runSequence = require('run-sequence');
const es = require('event-stream');
const vsce = require('vsce');
const nls = require('vscode-nls-dev');
const { promisify } = require('util');
const events = require('events');
const stream = require('stream');
const { getTsBuildInfoEmitOutputFilePath } = require('typescript');

const tsProject = ts.createProject('./tsconfig.json', { typescript });

const inlineMap = true;
const inlineSource = false;
const outDest = 'out';
const packageId = 'nosa.nugetmanager';

const languages = [
	{ folderName: 'jpn', id: 'ja' },
	{ folderName: 'deu', id: 'de' }
];

const cleanTask = function () {
	return del(['out/**', 'package.nls.*.json', 'nugetmanager*.vsix']);
};

const internalCompileTask = function () {
	return doCompile(false);
};

const internalNlsCompileTask = function () {
	return doCompile(true);
};

const addI18nTask = function (cb) {
	if (fs.existsSync('package.nls.json')) {
		var r = gulp.src(['package.nls.json'])
			.pipe(nls.createAdditionalLanguageFiles(languages, 'i18n'))
			.pipe(nls.bundleMetaDataFiles(packageId, outDest))
			.pipe(nls.bundleLanguageFiles())
			.pipe(gulp.dest('.'));
		r.on('finish', cb);
	}
	else {
		cb();
	}
};

const buildTask = gulp.series(cleanTask, internalNlsCompileTask, addI18nTask);

const doCompile = function (buildNls) {
	var r = tsProject.src()
		.pipe(sourcemaps.init())
		.pipe(tsProject(ts.reporter.defaultReporter())).js
		.pipe(buildNls ? nls.rewriteLocalizeCalls() : es.through())
		.pipe(buildNls ? nls.createAdditionalLanguageFiles(languages, 'i18n', outDest) : es.through())
		.pipe(buildNls ? nls.bundleMetaDataFiles(packageId, outDest) : es.through())
		.pipe(buildNls ? nls.bundleLanguageFiles() : es.through());

	if (inlineMap && inlineSource) {
		r = r.pipe(sourcemaps.write());
	} else {
		r = r.pipe(sourcemaps.write("../out", {
			// no inlined source
			includeContent: inlineSource,
			// Return relative source map root directories per file.
			sourceRoot: "../src"
		}));
	}

	return r.pipe(gulp.dest(outDest));
};

const watchTask = function () {
	gulp.watch('package.nls.json', addI18nTask);
	gulp.watch(['src/**/*.ts', '!src/**/*.d.ts', 'i18n/**/*.i18n.json'], internalNlsCompileTask);
};

const vscePublishTask = function () {
	return vsce.publish();
};

const vscePackageTask = function () {
	return vsce.createVSIX();
};

gulp.task('default', buildTask);

gulp.task('clean', cleanTask);

gulp.task('compile', gulp.series(cleanTask, internalCompileTask));

gulp.task('build', buildTask);

gulp.task('watch', gulp.series(buildTask, watchTask));

gulp.task('publish', gulp.series(buildTask, vscePublishTask));

gulp.task('package', gulp.series(buildTask, vscePackageTask));