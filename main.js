
const {spawn} = require('child_process');
const path = require('path');
const {createCompletion,loadModel} = require('gpt4all');
const express = require('express');
const os = require('os');
const {Worker} = require('worker_threads');
const fs = require('fs');
const multer = require('multer')
const crypto = require('crypto')
const mime = require('mime-types')
const cors = require('cors')
const https = require('https')
const dotenv = require('dotenv')
dotenv.config()

const interfaces = os.networkInterfaces();
const Source = require('./Generator');

const Generator = Source.Generator();
const DATADIRECTORY = path.join(__dirname,'Volume','Data');


function getRandomNumbers() {
    const typedArray = new Uint8Array(10);
    const randomValues = crypto.getRandomValues(typedArray);
    return randomValues.join('');
}

const SAVEDIRECTORY = path.join(__dirname,'Volume','Uploads');

const upload = multer.diskStorage({
    destination : (req,file,cb)=>{
        cb(null,SAVEDIRECTORY)
    },
    filename : (req,file,cb)=>{
        const atime = new Date()
        const ext = mime.extension(file.mimetype);

        cb(null,`${getRandomNumbers()}.${ext}`)
    }
})
const storage = multer({storage : upload})


const app = express();
const port = 7377;
const pagepath = path.join(__dirname,'FrontEnd','dist','index.html'); 
app.use(express.static(path.dirname(pagepath)));
app.use(express.json());
app.use(cors({
    allowedHeaders : '*',
    methods : '*',
    origin : '*'
}))

//print out the ip's that are on the computer
const intfs = Object.keys(interfaces)
let address = '';

for(const intf of intfs){
    const pckgs = interfaces[intf];
    
    for(const pckg of pckgs){
        if(!(pckg.family == 'IPv4') || pckg.internal) continue;

        console.log(`listening on https://${pckg.address}:${port}`);
        address = `${pckg.address}:${port}`
    }
}

const SERVERLOCATION = process.env.SERVERLOCATION
const PLATFORM = process.env.PLATFORM || ''

Generator.SetPlatform(PLATFORM);

if(SERVERLOCATION){
    console.log("Overwriting ServerLocation")
    address = SERVERLOCATION;
}

Generator.SetServerloc(address);

function GetConfig(){
    const RawConfig = fs.readFileSync(path.join(__dirname,'Volume','config.json'))
    const config = JSON.parse(RawConfig);
    return config;
}


//loaded configuration file
app.get('/configuration',(req,res)=>{
    //json
    res.send(GetConfig())
})

//returns what is cached
app.get('/models',(req,res)=>{
    const adir = fs.readdirSync(DATADIRECTORY,{encoding : 'utf-8',withFileTypes : true});
    const names = adir.filter(itm=>itm.isDirectory()).map(itm=>itm.name.split('--').slice(1).join('/'));
    res.send(names);
})

//a.i. response
app.post('/Generate',async (req,res)=>{
    //from config.json
    const model = req.body.model
    //chat history
    const history = req.body.history;

    //a message response
    //const response = await Generator.generate(res,model,history);
    res.flushHeaders();
    Generator.generate(res,model,history);
    //res.send(response)
})

app.post('/upload',storage.any(),async (req,res)=>{
    //gets uploaded here, returns url of image
    const files = req.files
    const names = files.map((itm)=>`https://${address}/file/${itm.filename}`);
    res.send(names)
})

app.get('/file/:aname',(req,res)=>{
    const fname = req.params.aname
    console.log(fname);
    try{
        res.sendFile(path.join(SAVEDIRECTORY,fname));
    } catch(e){
        res.sendStatus(404)
    }  
})


app.post('/regenerate',(req,res)=>{

    
});



async function run(){
    const key = fs.readFileSync(path.join(__dirname,'example.com.key'));
    const cert = fs.readFileSync(path.join(__dirname,'example.com.crt'));
    
    const server = https.createServer({
        key : key,
        cert : cert
    },app)

    console.log("this exmaple has a certificate")
    console.log("its self-cert tho, but https non-the-less")

    server.listen(port);
    //app.listen(port)
}

run()


