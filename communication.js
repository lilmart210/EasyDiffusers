require('dotenv').config();

const {spawn, exec, ChildProcess} = require("child_process");
const path = require('path');


const PLATFORM = process.env.PLATFORM //WINDOWS | LINUX
const VOLUMEDIRECTORY = path.join(__dirname,'Volume'); //volume for this project
const ENVIRONMENTSDIRECTORY = path.join(VOLUMEDIRECTORY,'Environments');//python environments
const MODELDIRECTORY = path.join(VOLUMEDIRECTORY,'Models');
const CACHEDIRECTORY = path.join(VOLUMEDIRECTORY,"CACHE");


/**
 * 
 * Instantiate a python proccess that will handle communication from the front end
 * 
 */

//Get Virtual Machine path for python
function GetVMPath(config){
    let venvpath = path.join(ENVIRONMENTSDIRECTORY,config.env);

    if(PLATFORM == 'WINDOWS'){
        venvpath = path.join(venvpath,'Scripts','activate.bat');
    }else if(PLATFORM == 'LINUX'){
        venvpath = `. ${path.join(venvpath,'bin','activate')}`
    }
    return `${venvpath}`;
}

function CreateVenvString(config){
    const venvpath = GetVMPath(config);

    const cmdstring = `${venvpath} && python`
    return cmdstring
}

function scriptpath(config){
    return config.source;
}

async function SpawnProcess(config,...args){
    let oc = CreateVenvString(config);
    const shell = PLATFORM == 'WINDOWS' ? true : '/bin/bash';
    const pymain = scriptpath(config);

    //the child process will make a websocket connection to main and do stuff
    
    const proc = spawn(oc,[pymain,...args],{
        env : {
            ...process.env,
            "HF_HOME" : CACHEDIRECTORY
        },
        shell : shell,
        detached : false,
        stdio : ['ignore','pipe','pipe'],

        cwd : MODELDIRECTORY
    })
    proc.stdout.on('data', (data) => {
        console.log(`stdout: ${data}`);
    });
    
    proc.stderr.on('data', (data) => {
        console.error(`stderr: ${data}`);
    });

    return proc;
}
/**
 * 
 * @param {ChildProcess} child 
 */
function Kill(child){
    const shell = PLATFORM == 'WINDOWS' ? true : '/bin/bash';
    const cmd = PLATFORM == 'WINDOWS' ? `taskkill /pid ${child.pid}` : `kill -9 ${child.pid}`;
    
    child.kill('SIGTERM')
    child.kill('SIGKILL')
    
}

module.exports = {
    SpawnProcess,
    Kill
}