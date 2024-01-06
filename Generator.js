const {Worker, workerData} = require('worker_threads');
const {spawn} = require('child_process');
const os = require('os');

const path = require('path')
const fs = require('fs');

const DATADIRECTORY = path.join(__dirname,'Volume','Data');
const VENVDIRECTORY = path.join(__dirname,'Volume','Environments')

/**
 * 
 * Pipeline that controls content Generation
 * 
 * Content is generated on a one time basis.
 * 
 * Proccesses are spawned, sent data, before being returned
 * 
 * return data type example
 * 
 * {
 *  error : true
 * }
 * 
 * {
 *  error : false, data : any
 * }
 * 
 * Models contain python files with the appropriate structure
 */


//zips the options into a key[name] value[or default] pairs
function ZipChatOptions(options){
    const pckg = {}
    for(const opt of options){
        pckg[opt.name] = opt.value == undefined ? opt.default : opt.value;
    }
    return pckg;
}

function GetConfig(){
    const RawConfig = fs.readFileSync(path.join(__dirname,'Volume','config.json'))
    const config = JSON.parse(RawConfig);
    return config;
}






function Generator(){
    const waitlist = [];
    const WorkingObject = {busy : false};
    let Serverloc = ''
    let Platform = '';

    function SetServerloc(astr){
        Serverloc = astr;
    }
    function SetPlatform(astr){
        Platform = astr;
    }

    function GenerateResponse(value){
        try{
            if(typeof value == 'string'){
                const parsed = JSON.parse(value);
                //parsed should be an array | do strict type checking later
                if(!Array.isArray(parsed)) return GenerateError("Response is not an array")
                return {error : false, message : parsed};
            }
        }catch(e){
            return GenerateError(e.toString())
        }
    }
    function GenerateReport(value){
        return {error : false, message : [{
            from : 'Cmd',
            time : new Date(),
            text : value
        }]}
    }

    function GenerateError(value){
        return {error : true,message : [{
            from : 'Model',
            time : new Date(),
            text : "Python Bad Response : " + value
        }]};
    }
    
    function PackageObject(aresponse,amodel,ahistory){
        const obj = {
            model : amodel,
            history : ahistory,
            response : aresponse
        };

        return obj;
    }

    //activate the virtual environment and run python code in it
    function CreateVenvString(prmo){
        const venvloc = path.join(VENVDIRECTORY,prmo.model.env);
        //comand to activate venv
        let venvpath;

        if(Platform && Platform == 'Windows'){
            //setup windows specific directory
            venvpath = path.join(venvloc,'Scripts','activate.bat');
        }else{
            //we are inside a linux distro
            venvpath = `source ${path.join(venvloc,'bin','activate')}`;
        }
        const cmdstring = `${venvpath} && python`
        console.log(cmdstring)
        return cmdstring
    }

    function ToWorker(prmo){
        const encoder = new TextEncoder();
        const workerbytes = encoder.encode(JSON.stringify(prmo.history)).toString();
        const afilepath = path.join(__dirname,'Volume','Models',prmo.model.source)
        //ziped options 
        const ziped = ZipChatOptions(prmo.model.options);
        const variables = encoder.encode(JSON.stringify(ziped)).toString();
        //console.log(afilepath,workerbytes,Serverloc,variables);
        const ActString = CreateVenvString(prmo);
        const proc = spawn(ActString,[afilepath,workerbytes,Serverloc,variables],{
            env : {
                'HF_HOME' : DATADIRECTORY
            },
            shell : true
        })
        

        proc.on('spawn',()=>{
            const astr = `The Childs PID is ${proc.pid}`;
            const feedback = JSON.stringify(GenerateReport(astr));
            const tobuf = Buffer.from(feedback);
            prmo.response.write(tobuf);
        })

        //errors/ console messages
        proc.stderr.on('data',(err)=>{

            const bufstr = err.toString();
            const feedback = JSON.stringify(GenerateReport(bufstr));
            const tobuf = Buffer.from(feedback);
            prmo.response.write(tobuf);

        })

        //when python process use print()
        //intended user data
        proc.stdout.on('data',(msg)=>{
            
            const bufstr = msg.toString();
            const feedback = JSON.stringify(GenerateResponse(bufstr));
            const tobuf = Buffer.from(feedback);
            //console.log(feedback);
            prmo.response.write(tobuf);
            

        })

        //process exits
        proc.stderr.on('end',(msg)=>{
            const feedback = JSON.stringify(GenerateReport("Process Ended"));
            const tobuf = Buffer.from(feedback);
            prmo.response.write(tobuf);
            prmo.response.end();
            WorkingObject.busy = false;
            PopWaitlist()
        })
        //proc.addListener('exit',(code)=>{
        //    console.log('NO MESSAGE');
        //    prmo.reject("exit code " + code)
        //    kill(proc)
        //});
        
    }

    async function PopWaitlist(){
        if(WorkingObject.busy || !waitlist.length) return;

        const item = waitlist.shift();
        ToWorker(item)
    }

    /**
     * 
     * @param amodel This is an object from config. Refer to config.json
     * @param ahistory Refer to app.tsx, this is a message array
     */
    async function generate(aresponse,amodel,ahistory){
        //send data to pipeline.
        const prmo = PackageObject(aresponse,amodel,ahistory)
        
        waitlist.push(prmo);

        if(!WorkingObject.busy) PopWaitlist()
    }

    return {
        generate,
        SetServerloc,
        SetPlatform
    }
}

module.exports = {
    Generator
}