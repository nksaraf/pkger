"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const tslib_1 = require("tslib");
const fs_extra_1 = tslib_1.__importDefault(require("fs-extra"));
const utils_1 = require("./utils");
const progressEstimator = require('progress-estimator');
async function createProgressEstimator() {
    await fs_extra_1.default.ensureDir(utils_1.paths.progressEstimatorCache);
    return progressEstimator({
        // All configuration keys are optional, but it's recommended to specify a storage location.
        storagePath: utils_1.paths.progressEstimatorCache,
    });
}
exports.createProgressEstimator = createProgressEstimator;
