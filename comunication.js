require('dotenv').config();

const ws = require('ws');
const {spawn} = require("child_process");
const fs = require('fs');
const path = require('path');

const VOLUMEDIRECTORY = path.join(__dirname,'Volume'); //volume for this project
const DATADIRECTORY = path.join(VOLUMEDIRECTORY,'Data');//project files
const UPLOADDIRECTORY = path.join(VOLUMEDIRECTORY,'Uploads');//uploaded files |chats? is this neccesary?
const MODELDIRECTORY = path.join(VOLUMEDIRECTORY,'Models');//python code for models
const ENVIRONMENTSDIRECTORY = path.join(VOLUMEDIRECTORY,'Environments');//python environments
const CACHEDIRECTORY = path.join(VOLUMEDIRECTORY,'Cache');//hugginface cache dir


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

function SpawnProcess(){
    let oc = CreateVenvString();
    const shell = PLATFORM == 'WINDOWS' ? true : '/bin/bash';

    const proc = spawn(oc,[PYTHONMAIN],{
        env : process.env,
        shell : shell,
        detached : false,
        stdio : 'inherit'
    })
   
    proc.on('message',(msg)=>{
        console.log(msg);
    })


    let resolve;
    let reject;

    const prm = new Promise((res,rej)=>{
        resolve = res;
        reject = rej;
    })

    proc.on('spawn',()=>{
    
        SelfSpawn(resolve,reject,proc)
    
    })
    proc.on('exit',()=>{
        reject();
    })
    //make a websocket to the main.py



    return {
        websocket : prm,
        process : proc
    };
}

function SelfSpawn(resolve,reject,proc){
    let counter = 0;

    const sock = new ws.WebSocket(`ws://localhost:${PYTHONPORT}`)
    
    
    //error vs close
    sock.on('error',(e)=>setTimeout(() => {
        if(counter >= 10) return reject(e);
        
        counter++;
        console.log("trying to establish a connection with python main")
        sock.close();
        
        SelfSpawn(resolve,reject,proc);

    }, 1000))

    sock.on('open',()=>resolve(sock))

}


module.exports = {
    SpawnProcess
}