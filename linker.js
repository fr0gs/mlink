'use strict';

const clone = require('git-clone');
const exec = require('child_process').exec;
const fs = require('fs');
const paths = require('global-paths');
const sudo = require('sudo-prompt');
const util = require('./mlink-util.js');


/**
 * Creates a skeleton configuration object
 * to serve as an example.
 */
function createInitConfig() {
    let sampleObject = {
        "base_modules_path": "~/gits/test",
        "modules": [
            {
                "mlink": {
                    "url": "https://github.com/fr0gs/mlink",
                    "path": "~/gits/test/mlink"
                }
            }
        ]
    }
    let json = JSON.stringify(sampleObject, null, 2);

    if (fs.existsSync('mlink.config.json')) 
        throw new Error('mlink.config.json already exists');

    return fs.writeFileSync('mlink.config.json', json);
}


/**
 * Helper function that creates the links between
 * global module -> repository
 * local module -> global module
 * @param {string} global - the global path where module was installed.
 * @param {string} repo - the local path where the repository is cloned/installed.
 * @param {string} local - the local path of the module (./node_modules/abc)
 */
function createLink(global, repo, local) {
    console.log(`[+] Create link from ${global} -> ${repo}`);

    // Create the global module -> local repository link.
    // This needs sudo since we are copying files in a
    // sensitive directory.
    sudo.exec(`npm link ${repo}`, {}, (error, stdout, stderr) => {
            if (error) throw error;
        }
    );

    // Create the local node_modules/module -> global module linkModules.
    console.log(`[+] Create link from ${local} -> ${global}`);
    fs.symlinkSync(global, local);
}


/**
 * Removes the two created links when executing 
 * npm link/npm link <module> 
 * @param {object} config - the configuration object.
 * @param {string} npm_global_prefix - the npm global prefix (i.e /usr)
 */
function removeLinks(config = {}, npm_global_prefix, project_path) {
    if (util.isEmptyObject(config)) {
        throw new Error("The mlink.config.json file is empty");
    }
    const NPM_GLOBAL_PATH = `${npm_global_prefix}/lib/node_modules`;
    const BASE_MODULES_PATH = config['base_modules_path'];

    if (paths().indexOf(NPM_GLOBAL_PATH) != -1) {
        const modules = config['modules'];
        Object.keys(modules).forEach((module) => {
            const global_module_path = `${NPM_GLOBAL_PATH}/${module}`;
            const local_module_path = `${project_path}/node_modules/${module}`;
            const repo_module_path = `${modules[module].path}`;

            if (fs.existsSync(local_module_path)) {
                const stats = fs.lstatSync(local_module_path);
                if (stats.isSymbolicLink()) {
                    console.log(`[+] Remove local link from ${local_module_path} -> ${global_module_path}`);
                    fs.unlinkSync(local_module_path);
                }
            }

            if (fs.existsSync(global_module_path)) {
                console.log(`[+] Remove global link from ${global_module_path} -> ${repo_module_path}`);
                sudo.exec(`rm -rf ${global_module_path}`, {}, (err, stdo, stdedd) => { if (err) throw err });
            }
        });
        exec("npm install", (error, stdout, stderr) => {
            if (error) throw new Error('Could not execute npm install')
        });
    }
    else throw new Error(`${npm_global_prefix}/lib/node_modules does not exist`);
}

/**
 * Removes the necessary links equivalent to 
 * executing npm link/npm link <module>. 
 * @param {object} config - the configuration object.
 * @param {string} npm_global_prefix - the npm global prefix (i.e /usr)
 */
function linkModules(config = {}, npm_global_prefix, project_path) {
    if (util.isEmptyObject(config)) {
        throw new Error("The mlink.config.json file is empty");
    }
    else {
        const NPM_GLOBAL_PATH = `${npm_global_prefix}/lib/node_modules`;
        const BASE_MODULES_PATH = config['base_modules_path'];

        if (paths().indexOf(NPM_GLOBAL_PATH) != -1) {
            const modules = config['modules'];
            Object.keys(modules).forEach((module) => {
                const global_module_path = `${NPM_GLOBAL_PATH}/${module}`;
                const local_module_path = `${project_path}/node_modules/${module}`;
                const repo_module_path = `${modules[module].path}` || undefined;
                const repo_module_url = `${modules[module].url}` || undefined;

                // If ./node_modules/module exists, either normal or symlink, remove it.
                if (fs.existsSync(local_module_path)) {
                    console.log(`[+] Path ${local_module_path} already exists, removing it.`);
                    util.deleteFolderRecursive(local_module_path);
                }

                // If there is a url specified.
                if (repo_module_url !== null) {
                    // if there is path, clone the url in paths.
                    if (repo_module_path !== null) {
                        //Clone the url in the path.
                        clone(repo_module_url, repo_module_path, () => {
                            console.log(`[+] Successfully cloned ${repo_module_url} in path: ${repo_module_path}`);
                            createLink(global_module_path, repo_module_path, local_module_path);
                            console.log("-------------------------");
                        })
                    }
                    else {
                        if (!fs.existsSync(BASE_MODULES_PATH)) fs.mkdirSync(dir);
                        clone(repo_module_url, path.join(BASE_MODULES_PATH, module), () => {
                            console.log(`[+] Successfully cloned ${repo_module_url}`);
                            createLink(global_module_path, repo_module_path, local_module_path);
                            console.log("-------------------------");
                        })
                    }
                }
                else {
                    if (fs.existsSync(repo_module_path)) {
                        createLink(global_module_path, repo_module_path, local_module_path);
                        console.log("-------------------------");
                    }
                    else throw new Error(`${repo_module_path} does not exist`);
                }
            });
        }
        else throw new Error(`${npm_global_prefix}/lib/node_modules does not exist`);
    }
}


module.exports = {
    createInitConfig,
    linkModules,
    removeLinks
}