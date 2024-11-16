require('dotenv').config();

const ws = require('ws');
const os = require('os');

const {Worker, workerData} = require('worker_threads');
const {spawn} = require("child_process");
const fs = require('fs');
const path = require('path');

const DATADIRECTORY = path.join(__dirname,'Volume','Data');
const VENVDIRECTORY = path.join(__dirname,process.env.PYTHON_VIRTUAL_ENV)
const PLATFORM = process.env.PLATFORM //WINDOWS | LINUX
const PYTHONMAIN = `"${path.join(__dirname,'main.py')}"`;
const PYTHONPORT = process.env.PYTHON_PORT;

/**
 * 
 * Instantiate a python proccess that will handle communication from the front end
 * 
 */

//Get Virtual Machine path for python
function GetVMPath(){
    let venvpath = VENVDIRECTORY;
    if(PLATFORM == 'WINDOWS'){
        venvpath = path.join(venvpath,'Scripts','activate.bat');
    }else if(PLATFORM == 'LINUX'){
        venvpath = `. ${path.join(venvpath,'bin','activate')}`
    }
    return `"${venvpath}"`;
}

function CreateVenvString(){
    const venvpath = GetVMPath();

    const cmdstring = `${venvpath} && python`
    return cmdstring
}

async function SpawnProcess(){
    let oc = CreateVenvString();
    const shell = PLATFORM == 'WINDOWS' ? true : '/bin/bash';

    const proc = spawn(oc,[PYTHONMAIN],{
        env : process.env,
        shell : shell,
        detached : false,
        stdio : 'inherit'
    })

    let resolve;
    let reject;

    const prm = new Promise((res,rej)=>{
        resolve = res;
        reject = rej;
    })

    proc.on('spawn',()=>SelfSpawn(resolve,reject))
    //make a websocket to the main.py



    return prm;
}

function SelfSpawn(resolve,reject){
    let counter = 0;

    const sock = new ws.WebSocket(`ws://localhost:${PYTHONPORT}`)

    sock.on('error',(e)=>setTimeout(() => {
        if(counter >= 10) return reject(e);
        
        counter++;
        console.log("trying to establish a connection with python main")
        sock.close();
        SelfSpawn(resolve,reject);

    }, 1000))

    sock.on('open',()=>resolve(sock))

}


module.exports = {
    SpawnProcess
}