const dotenv = require('dotenv')
dotenv.config()

const {spawn, ChildProcess, exec,execSync} = require('child_process');
const path = require('path');
const express = require('express');
const os = require('os');
const {Worker} = require('worker_threads');
const fs = require('fs');
const multer = require('multer')
const crypto = require('crypto')
const mime = require('mime-types')
const cors = require('cors')
const https = require('https')
const bcrypt = require('bcrypt')
const knex = require('knex')
const jwt = require('jsonwebtoken')
const ws = require('ws');
const Source = require('./Generator');
const comjs = require("./communication");

const interfaces = os.networkInterfaces();



const Generator = Source.Generator();
const VOLUMEDIRECTORY = path.join(__dirname,'Volume'); //volume for this project
const DATADIRECTORY = path.join(VOLUMEDIRECTORY,'Data');//project files
const UPLOADDIRECTORY = path.join(VOLUMEDIRECTORY,'Uploads');//uploaded files |chats? is this neccesary?
const MODELDIRECTORY = path.join(VOLUMEDIRECTORY,'Models');//python code for models
const ENVIRONMENTSDIRECTORY = path.join(VOLUMEDIRECTORY,'Environments');//python environments
const CACHEDIRECTORY = path.join(VOLUMEDIRECTORY,'Cache');//hugginface cache dir
const CONFIG = path.join(VOLUMEDIRECTORY,'config.json');

const TOKEN_SECRET = process.env.TOKEN_SECRET || "development";

function getRandomNumbers() {
    const typedArray = new Uint8Array(10);
    const randomValues = crypto.getRandomValues(typedArray);
    return randomValues.join('');
}

const app = express();
/**
 * @type {ws.WebSocketServer}
 */
const wss = new ws.WebSocketServer({noServer : true});

const port = 7377;
const upload = multer.diskStorage({
    destination : (req,file,cb)=>{
        const adir = req.UPLOAD.chat ? UPLOADDIRECTORY : DATADIRECTORY;
        
        const fdir = path.join(adir,req.UPLOAD.directory);
        
        
        cb(null,fdir)  
    },
    filename : async (req,file,cb)=>{
        const ext = mime.extension(file.mimetype);
        const oname = file.originalname;

        const aname = req.UPLOAD.chat ? `${getRandomNumbers()}.${ext}` : oname;
        //two different file uploads
        //insert file into files table if a chat message
        if(req.UPLOAD.chat){
            //chat is actually message id...bad name
            //create name and add to files
            await DB('files')
            .insert({
                chat : req.CHAT.id,
                file : aname
            })
        }

        cb(null,aname)
    }
})

/**
 * 
 * @param {Express.Request} req 
 * @param {Express.Multer.File} file 
 * @param {*} cb 
 */
async function filefilter(req,file,cb){
    
    cb(null,true);//pass all files
}

const storage = multer({storage : upload,fileFilter : filefilter})

/**
 * finds location of files on body if any
 * @param {Express.Request} req 
 * @param {Express.Multer.File} file 
 * @param {Function} cb 
 */
async function FileParams(req,res,next){

    //req.AUTH.email
    //req.AUTH.admin
    //.chat or .project for files table upload vs projectfilesupload
    //this may have to go into params....
    const chat = req.CHAT && req.CHAT.chat;
    const project = req.params.project;
    const email = req.AUTH.email;
    //location will be chat(id)_email

    if(project == undefined && chat == undefined) return res.sendStatus(404);
    //project and chat cannot BOTH be defined
    if(project != undefined && chat != undefined) return res.sendStatus(403);
    ////location,owner(email),date,chat(id)

    //req.CHAT = {id,owner,date,directory}
    //create a save path for the file and insert it into the records.
    if(chat != undefined){
        //get chat
        const [entry] = await DB('chats')
        .select('*')
        .where({id : chat});

        req.UPLOAD = {
            directory : entry.directory,
            chat : true
        }
    }else{
        //find project file directory
        const [entry] = await DB('projects')
        .where({id : project,owner : email})
        .select('directory')
        req.UPLOAD = {
            directory : entry.directory,
            chat : false
        }
    }
    //go next if valid
    next()

}

app.use(express.json());
app.use(express.urlencoded()) //deprecated? is this neccesary?
app.use(cors({
    allowedHeaders : '*',
    methods : '*',
    origin : '*',
    exposedHeaders : '*'
}))

//print out the ip's that are on the computer
const intfs = Object.keys(interfaces)
let address = '';

for(const intf of intfs){
    const pckgs = interfaces[intf];
    
    for(const pckg of pckgs){
        if(!(pckg.family == 'IPv4')) continue;

        console.log(`listening on http://${pckg.address}:${port}`);
        address = `${pckg.address}:${port}`
    }
}


const SERVERLOCATION = process.env.SERVERLOCATION
const PLATFORM = process.env.PLATFORM || ''

/**
 * Set up the sql server for basic login and registration
 */

/**
 * @type {knex.Knex}
 */
let DB;
if(process.env.PRODUCTION_DATABASE){
    DB = knex({
        client : 'mysql2',
        connection : {
            host : '0.0.0.0',
            user : 'easydiff',
            password : 'strattest',
            database : 'easydiff'
        }
    })
}else{
    DB = knex({
        client : 'sqlite3',
        connection : {
            filename : path.join(VOLUMEDIRECTORY,"development.sqlite3")
        },
        useNullAsDefault : true
    })
}

/**
 * 
 * design
 * Every user have their own data file
 * This data file contains all uploaded and generated media
 * uploaded files will be renamed 
 * 
 * Database Checks
 * 
 * Neccsesary tables
 * users -> who is in/allowed
 * projects -> storages
 * projectFiles -> files uploaded to a project
 * chats -> current chats
 * messeges -> chat messages
 * files -> files in a chat
 * 
 */
async function DatabaseCheck(){
    const User = DB.schema.createTable("users",(table)=>{
        table.string("email").primary();
        table.string("password"); //hashed value
        table.boolean("admin"); //idk what i would use this one for
    });
    
    const Projects = DB.schema.createTable("projects",(table)=>{
        table.increments('id').primary();
        table.string('name').notNullable();
        table.string('owner');
        table.string('directory').notNullable();

        table.foreign('owner').references('email').inTable('users');

    })
    //we might not need this. Project files are 
    /**
    const projectfiles = DB.schema.createTable("projectfiles",(table)=>{
        table.string('name').primary();
        table.string('project').notNullable();
        table.string('location').notNullable();

        table.foreign('project').references('id').inTable('projects');
        table.primary(['name','project']);
    })*/
    const chats = DB.schema.createTable("chats",(table)=>{
        table.increments('id').primary();
        table.string('owner').notNullable();
        table.string('date').notNullable();
        table.string('directory').notNullable();
        table.string('name').notNullable();

        table.foreign('owner').references('email').inTable('users');

    })
    const messages = DB.schema.createTable("messages",(table)=>{
        table.increments('id').primary();
        table.string('owner').notNullable();
        table.string('date').notNullable();
        table.integer('chat').notNullable();
        table.string('role').notNullable();//ai,user
        table.string('text').notNullable();
        table.foreign('chat').references('id').inTable('chats');
    })

    //these are files for messages
    const files = DB.schema.createTable("files",(table)=>{
        table.increments('id');
        table.integer('chat').notNullable();
        table.string('file').notNullable();

        table.foreign('chat').references('id').inTable('chats');
    })
    


    const resolved = Promise.all([User,Projects,chats,messages,files]);

    return await resolved.then(()=>{
        console.log("Database checks passed")
    }).catch((e)=>{
        //failed to create table or table already exists
        console.log("failed to create tables",e);
    })
}

const configschema = [{
    name : "anime",
    source : "anime.py",
    options : [
        {
            name : "inference",
            default : 20,
            type : "select",
            selection : [5,10,20,40,100,200]
        },
        {
            name : "count",
            default : 1,
            max : 4,
            min : 1,
            type : "number"
        },
        {
            name : "cpu",
            default : true,
            type : "boolean"
        },
        {
            name : "negatives",
            default : "extra arms",
            type : "string"
        }
    ],
    allowImages : false,
    env : "default"
}]
async function SetupWorkingEnvironment(){
    //create volume folder
    //create volume > models folder
    //put Helpy.py into models folder
    //put config.json into volume folder
    //make a python venv X, don't do this.
    //create a data folder, for huggingface home.
    const defaultev = !fs.existsSync(path.join(ENVIRONMENTSDIRECTORY,"default"));
    

    !fs.existsSync(VOLUMEDIRECTORY) && fs.mkdirSync(VOLUMEDIRECTORY,{recursive : true})
    !fs.existsSync(DATADIRECTORY) && fs.mkdirSync(DATADIRECTORY,{recursive : true})
    !fs.existsSync(MODELDIRECTORY) && fs.mkdirSync(MODELDIRECTORY,{recursive : true})
    !fs.existsSync(CACHEDIRECTORY) && fs.mkdirSync(CACHEDIRECTORY,{recursive : true})
    !fs.existsSync(UPLOADDIRECTORY) && fs.mkdirSync(UPLOADDIRECTORY,{recursive : true})
    !fs.existsSync(ENVIRONMENTSDIRECTORY) && fs.mkdirSync(ENVIRONMENTSDIRECTORY,{recursive : true});

    if(!fs.existsSync(CONFIG)){
        const localconfig = fs.readFileSync(path.join(__dirname,'config.json'),{encoding : 'utf-8'});
        fs.writeFileSync(CONFIG,localconfig,{encoding : 'utf-8'});
    } 

    if(!fs.existsSync(path.join(MODELDIRECTORY,'Helper.py'))){
        const data = fs.readFileSync(path.join(__dirname,'Helper.py'),{encoding : 'utf-8'});
        fs.writeFileSync(path.join(MODELDIRECTORY,'Helper.py'),data,{encoding : 'utf-8'});
    }
    if(!fs.existsSync(path.join(MODELDIRECTORY,'anime.py'))){
        const data = fs.readFileSync(path.join(__dirname,'anime.py'),{encoding : 'utf-8'});
        fs.writeFileSync(path.join(MODELDIRECTORY,'anime.py'),data,{encoding : 'utf-8'});
    }

    if(defaultev){
        console.log("The Default environment doesn't exists, creating it");
        //RUN python -m venv Volume/Environments/default
        const evpath = path.join(ENVIRONMENTSDIRECTORY,"default");
        
        let pippath = path.join(evpath,"bin","pip");        
        const winpippath = path.join(evpath,"Scripts","pip.exe");

        if(comjs.isWindows()){
            pippath = winpippath;
        }

        const cm = `python -m venv ${evpath}`

        console.log("Installing Pip Dependencies");
        //create the environment and do stuff
        
        //pip install the requirements
        const req = path.join(__dirname,'requirements.txt');
        
        const c1 = `${pippath} install -r "${req}"`
        
        const fc = `${cm} && ${c1}`
        
        try{
            execSync(fc);
        }catch(e){
            console.log(`Error when installing packages, ${e}`)
        }

        console.log("Finished creating environment");


    }

    

}

// authentication
/**
 * Authenticates the user
 * @param {express.Request<{}, any, any, qs.ParsedQs, Record<string, any>>} req 
 * @param {express.Response<any, Record<string, any>, number>} res 
 * @param {Function} next 
 */
async function AuthReq(req,res,next){
    const TokenHeader = req.headers.authorization;
    if(!TokenHeader) return res.status(403).json({message : "auth header is invalid"});

    const [type,token] = TokenHeader.split(" ");
    if(type != 'Bearer') return res.status(403).json({message : "auth schema is invalid"});

    //check if jwt token is valid. Set who this is as req.AUTH = {user};
    try {
        const verified = jwt.verify(token,TOKEN_SECRET,{});
        
        req.AUTH = {
            email : verified.email,
            admin : verified.admin
        }

        if(req.is_socket_request){
            return true;
        }else{
            return next();
        }
        
    }catch(e){
        if(req.is_socket_request){
            return false;
        }else{
            return res.status(401).json({message : "invalid"});
        }
    }
    
}

/**
 * Authenticates the user
 * @param {express.Request<{}, any, any, qs.ParsedQs, Record<string, any>>} req 
 * @param {express.Response<any, Record<string, any>, number>} res 
 * @param {Function} next 
 */
async function LoginAuth(req,res,next){
    //find the ha
    const authheader = req.headers.authorization;
    if(!authheader) return res.status(401).send("bad header");

    const [auth,encodedcredentials] = authheader.split(" ");
    if(auth != 'Basic') return res.status(401).json({message : "bad credentials"});

    //const credentials = Buffer.from(encodedcredentials, 'base64').toString('utf-8');
    const credentials = encodedcredentials;
    const [email, password] = credentials.split(':');

    const user = await DB('users')
    .where('email','=',email)
    .select('*')
    .then((rows)=>{
        if(rows.length < 1){
            return '';
        }else{
            return rows[0];
        }
    }).catch((e)=>{
        console.error("error on database",e);
        return '';
    })

    if(!user) return res.status(401).json({message : "no"});

    //compare the password
    const valid = bcrypt.compareSync(password,user.password);
    if(!valid) return res.status(401).send({message : "invalid password"});

    const token = jwt.sign({email : user.email,admin : user.admin},TOKEN_SECRET,{expiresIn: '1d'});


    res.status(200).json({token : token,admin : user.admin});
}

async function RegisterAuth(req,res,next){
    //submit email, password and email
    const authheader = req.headers.authorization;
    if(!authheader) return res.status(401).send("bad header");

    const [auth,encodedcredentials] = authheader.split(" ");
    if(auth != 'Basic') return res.status(401).json({message : "bad credentials"});

    //const credentials = Buffer.from(encodedcredentials, 'base64').toString('utf-8');
    const credentials = encodedcredentials;
    const [email, password] = credentials.split(':');

    const salt = bcrypt.genSaltSync(10);
    const password_hash = bcrypt.hashSync(password,salt);

    const result = await DB('users')
    .insert({email : email,password : password_hash,admin : false})
    .then((rows)=>{
        return !!rows.length;
    })
    .catch((e)=>{
        console.log("error " + e);
        return false;
    })

    if(result){
        return res.status(200).json({message : "created user"});
    }else{
        return res.status(401).send({message : "could not create user"});
    }
}

app.use(express.static(path.join(__dirname,'build')));

app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname,'build','index.html'));
})
//routes
app.post('/login',LoginAuth);
app.post('/register',RegisterAuth);
app.post('/verify',AuthReq,(req,res)=>{
    res.sendStatus(200);
});

/**
 * Route for files
 */
//files used in the application
app.get('/file/',AuthReq,(req,res)=>{

})
app.post('/file/delete',AuthReq,async (req,res)=>{
    const msgid = req.body.msg;


    res.sendStatus(200);
});
/**
 * Route for projects and project files
 */
//get all projects for user
app.get('/project',AuthReq,async (req,res)=>{
    try{
        const entries = await DB('projects')
        .where({owner : req.AUTH.email})

        res.send(JSON.stringify(entries));

    }catch(e){
        console.log("bad project",e);
        res.sendStatus(500);
    }
})
//get all files for project
app.get('/project/files/:id',AuthReq,async(req,res)=>{
    try{
        const projid = req.params.id;
        req.body.id = projid;
        const [entry] = await DB('projects')
        .select('*')
        .where({id : projid,owner : req.AUTH.email})

        const adir = path.join(DATADIRECTORY,entry.directory);
        const entities = fs.readdirSync(adir,{encoding : 'utf-8',withFileTypes : true});
        const files = entities.filter((itm)=>itm.isFile()).map((itm)=>({
            name : itm.name
        }));

        res.send(JSON.stringify(files));

    }catch(e){
        console.log("proj files", e);
        res.sendStatus(500);
    }
})
//get all file data for a project
app.post('/project/get/files',AuthReq,async(req,res)=>{
    try{
        const pid = req.body.id;
        const [entry] = await DB('projects')
        .select('*')
        .where({id : pid,owner : req.AUTH.email})

        const adir = path.join(DATADIRECTORY,entry.directory);
        const entities = fs.readdirSync(adir,{encoding : 'utf-8',withFileTypes : true});
        const files = entities.filter((itm)=>itm.isFile())
        const data = files.map((itm)=>fs.readFileSync(path.join(adir,itm.name),{encoding : 'utf-8'}));
        await Promise.all(data);
        const arr = [];
        for(let i = 0;i<data.length;i++){
            arr.push({
                name : files[i].name,
                text : data[i]
            })
        }

        res.send(arr);
    }catch(e){
        console.log("could not get files",e);
        res.sendStatus(500);
    }
})
app.post('/project/file',AuthReq,async(req,res)=>{
    try{
        const pid = req.body.id;
        const [entry] = await DB('projects')
        .select('*')
        .where({id : pid,owner : req.AUTH.email})

        const name = req.body.name;
        if(!name) return res.sendStatus(404);

        const aname = path.join(DATADIRECTORY,entry.directory,name);

        res.sendFile(aname);
    }catch(e){
        console.log("could not get file",e);
    }
});
//upload a file to a project
app.post('/project/upload/:project',AuthReq,FileParams,storage.any(),async(req,res)=>{
    res.sendStatus(200);
});
//files used for projects
app.post('/project/create',AuthReq,async (req,res)=>{
    const name = req.body.name;
    const email = req.AUTH.email;

    const adir = getRandomNumbers();
    try{

        fs.mkdirSync(path.join(DATADIRECTORY,adir),{recursive : false});

        await DB('projects')
        .insert({
            name : name,
            owner : email,
            directory : adir
        })
    
        res.sendStatus(200);
    }catch(e){
        console.log("proj create",e);
        res.sendStatus(500);
    }
})
//delete a project file
app.post('/project/file/delete',AuthReq,async (req,res)=>{
    const projid = req.body.id;
    const email = req.AUTH.email;

    try{
        const [entry] = await DB('projects')
        .select('*')
        .where({
            owner : email,
            id : projid
        })
    
        const fn = req.body.name;
        const dir = entry.directory;
        const fpath = path.join(DATADIRECTORY,dir,fn);

        fs.rmSync(fpath,{force : false});
        res.sendStatus(200);
    }catch(e){
        res.sendStatus(501);
        console.log("delete proj",e);
    }

})
//delete project and its files
app.post('/project/delete',AuthReq,async (req,res)=>{
    const projid = req.body.id;
    const email = req.AUTH.email;

    try{
        const [entry] = await DB('projects')
        .select('*')
        .where({
            owner : email,
            id : projid
        })
    
        const dir = entry.directory;
        const fpath = path.join(DATADIRECTORY,dir);
        
        fs.rmSync(fpath,{force : false,recursive : true});

        //remove the entry from the database
        await DB('projects')
        .select('*')
        .where({
            owner : email,
            id : projid
        })
        .del();
        
        res.sendStatus(200);
    }catch(e){
        res.sendStatus(500);
        console.log("delete projec files",e);
    }
})
/**
 * Route for messages
 */
app.post('/message/get',AuthReq,async (req,res)=>{
    //this returns message with files
    try{
        const msgid = req.body.id;
        const date = req.body.date;

        //get all messages for that chat
        let msgs;
    
        if(date != undefined){
            msgs = await DB('messages')
            .select("*")
            .where({chat : msgid})
            .andWhere('date','>=',date);
        }else {            
            msgs = await DB('messages')
            .select("*")
            .where({chat : msgid})
        }

        msgs = msgs.map((itm)=>({...itm,date : Number(itm.date)}))

        //get all the files for that message | files (chat) is mislabeled. Should be message
        const prms = msgs.map((itm)=>DB('files').select('*').where({chat : itm.id}))
        const files = await Promise.all(prms);
        //console.log(await DB('messages'))
        //console.log(JSON.stringify(msgs));
        //zip the files if any along with the message
        const zipped = msgs.map((itm,i)=>({files : files[i],msg : itm}));
        const sorted = zipped.toSorted((a,b)=>a.msg.date - b.msg.date);
        //sort them and then send
        //console.log("s",sorted);
        res.send(JSON.stringify(sorted));


    }catch(e){
        console.log("could not fetch message",e);
        res.sendStatus(500);
    }
})

//update a message(not a file?) todo
app.post('/message/update',AuthReq,async(req,res)=>{
    try{
        const mid = req.body.id;
        let role = req.body.role;
        let text = req.body.text;

        if(mid == undefined) return res.sendStatus(404);
        const pckg = {};

        if(role != undefined && role == 'ai' || role == 'user' || role == 'system'){
            pckg['role'] = role;
        }
        if(text != undefined && typeof text == 'string'){
            pckg["text"] = text;
        }

        await DB('messages')
            .select("*")
            .where({id : mid})
            .update(pckg)

        res.sendStatus(200);



    }catch(e){
        console.log("failed to update message",e);
    }
})

//delete a message and its files
app.post('/message/delete',AuthReq,async (req,res)=>{
    try{
        const msgid = req.body.id;
        const email = req.AUTH.email;

        const entry = await DB('messages')
        .select('*')
        .where({owner : email,id : msgid});

        if(!entry.length) return res.sendStatus(403);
        
        //this could be probablimatic
        //this deletes every file out the chat...
        //chat is actuallt msg id, bad name
        await DB('files')
        .where({chat : msgid})
        .del();

        await DB('messages')
        .where({owner : email,id : msgid})
        .del();

        res.sendStatus(200);
    }catch(e){
        console.log("could not delete message",e);
        res.sendStatus(500);
    }
})

//upload message
app.post('/message',AuthReq,async (req,res)=>{
    //save message if a message was sent
    try{
        const chat = req.body.chat //chat id
        const date = req.body.date //number time (stored as string)
        const email = req.AUTH.email //email 
        const role = req.body.role;
        const text = req.body.text;

        const [entry] = await DB('messages')
        .insert({owner : email,date : date,chat : chat,role:role,text : text})
        .returning('*')

        req.CHAT = entry;

        return res.status(200).send(JSON.stringify({
            id : entry.id,
            date : date
        }))
    }catch(e){
        console.log("error when uploading message",e);
        res.sendStatus(500);
    }
})

//upload message file
app.post('/message/:id',AuthReq,async (req,res,next)=>{
    try{
        //save message if a message was sent
        const chat = req.params.id //chat id
        const email = req.AUTH.email //email 

        const [entry] = await DB('messages')
        .select('*')
        .where({owner : email,id : chat})

        req.CHAT = entry;

        next()
    }catch(e){
        console.log("error uploading file message",e);
        res.sendStatus(500);
    }
},FileParams,storage.any(),(req,res)=>{
    res.sendStatus(200);
})
//upload message file ai
app.post('/ai/message/:id',AuthReq,async (req,res,next)=>{
    try{
        //save message if a message was sent
        const chat = req.params.id //chat id
        const email = req.AUTH.email //email 

        const [entry] = await DB('messages')
        .select('*')
        .where({owner : email,id : chat})
        req.AI = true
        req.CHAT = entry;

        next()
    }catch(e){
        console.log("error uploading file message",e);
        res.sendStatus(500);
    }
},FileParams,storage.any(),(req,res)=>{
    res.sendStatus(200);
})
/**
 * Route for chats
*/

app.post('/chats/create',AuthReq,async (req,res)=>{
    //owner date directory
    const adir = getRandomNumbers();
    const adate = req.body.date;
    const chatname = req.body.name;

    try{
        //create the folder
        fs.mkdirSync(path.join(UPLOADDIRECTORY,adir),{recursive : false});

        await DB('chats')
        .insert({
            owner : req.AUTH.email,
            date : adate,
            directory : adir,
            name : chatname
        })
        res.sendStatus(200);
    }catch(e){
        console.log("create chat",e);
        res.sendStatus(500);
    }
})
app.post('/chats/delete',AuthReq,async (req,res)=>{
    const chatid = req.body.id;
    //delete the chat, delete the file
    try{
        const [entry] = await DB('chats')
        .select('*')
        .where({
            id : chatid,
            owner : req.AUTH.email
        })
        //delete the folder
        fs.rmSync(path.join(UPLOADDIRECTORY,entry.directory),{force : false,recursive : true});


        await DB('chats')
        .where({
            id : chatid
        })
        .del()
        await DB('messages')
        .where({
            chat : chatid
        })
        .del()

        res.sendStatus(200);
    }catch(e){
        res.sendStatus(500);
        console.log("couldn't delete chat",e);
    }
})
app.get('/chats',AuthReq,async (req,res)=>{

    const entries = await DB('chats')
    .select('*')
    .where({
        owner : req.AUTH.email
    })

    res.send(JSON.stringify(entries));
})
app.get('/config',AuthReq,(req,res)=>{
    res.sendFile(CONFIG);
})

app.get('/file/:chatid/:fileid',AuthReq,async (req,res)=>{
    const owner = req.AUTH.email;
    const chatid = req.params.chatid;
    const fileid = req.params.fileid;

    try{
        //make sure the person viewing owns the file
        const ownership = await DB('chats')
        .select('*')
        .where({owner : owner,id : chatid})

        if(!ownership.length) return res.sendStatus(403);
        const chatowner = ownership[0]
        //send the file
        const [afile] = await DB('files')
        .select('*')
        .where({id : fileid})

        const fp = path.join(UPLOADDIRECTORY,chatowner.directory,afile.file);
        res.sendFile(fp);
    }catch(e){
        console.log("tried to get a file that does not exists",e);
        res.sendStatus(500);
    }
})

const PythonProccess = {

}


wss.on('connection',(asock)=>{

    const HeartBeat = ()=>{
        asock.MyHeartBeat = true;

        let time = setInterval(()=>{
            if(!asock.MyHeartBeat){
                clearInterval(time);
                asock.close();
            }else{
                asock.MyHeartBeat = false;
                asock.send(JSON.stringify({msg : "heartbeat"}));
            }
        },2000)
        asock.HeartTime = time;
    }

    asock.on('close',()=>{
        if(asock.HeartTime != undefined) clearInterval(asock.HeartTime);
        
        //do we need to resolve when problems arrise on python backend here
    })
    asock.on('message',async (data,isbin)=>{
        //first message must be authentication token.
        //it is binary
        const msg = Buffer.from(data).toString();
        //try to authenticate
        if(!asock.Authenticated){
            try {
                const verified = jwt.verify(msg,TOKEN_SECRET,{});
                asock.AUTH = {
                    email : verified.email
                }
                asock.Authenticated = true;
                asock.TOKEN = msg;
                
                HeartBeat();

                return;
            }catch(e){
                asock.close();
                console.log("no token",e);
            }
        }

        let json;

        try{
            json = JSON.parse(msg);
        }catch(e){
            //we should handle bad messages...  
            //recieved a bad message
            console.log("could parse json",e);
        }

        if(!json) return;
        if(json.msg == 'remove heartbeat'){
            clearInterval(asock.HeartTime);
        }
        
        //json should adhere to this principle
        if(json.msg == "start"){            
            const chatid = json.chatid;
            const config = json.config;
            const env = config.env;
            const model = config.source;
            const project = json.project;

            //start a python session
            const token = getRandomNumbers();
            
            PythonProccess[token] = {
                client : asock,
                chatid : chatid,
                config : config,
                project : project
            }
            const wsloc = `ws://localhost:${port}`
            const sloc = `http://localhost:${port}`;

            const proc = await comjs.SpawnProcess(config,sloc,wsloc,asock.TOKEN,token);
            
            PythonProccess[token].process = proc;

            proc.on('error',(e)=>{
                console.log("Socket Error",e);
                EndMessage(token);//alert the user this has ended
            })

            proc.on('close',()=>{
                EndMessage(token);
            })
            
            asock.send(JSON.stringify({msg : "start",token : token}));
        }else if(json.msg == "end"){
            const token = json.token;

            EndMessage(token);
        }else if(json.msg == "python"){
            const token = json.token;
            const pckg = PythonProccess[token]
            if(!pckg) return console.log("tried to get a process that was Killed");
            const id = pckg.chatid;
            const config = pckg.config;
            const project = pckg.project;

            const retpack = {
                config : config,
                id : id,
                project : project
            };

            //this returns message with files
            try{

                //send chat history
                asock.send(JSON.stringify(retpack))

            }catch(e){
                console.log("could not fetch message for python socket",e);
                return
            }
        }else if(json.msg == "Get From"){
            //update the front end that there are new changes
            const token = json.token;
            const date = json.date;
            const pckg = PythonProccess[token]
            if(!pckg) return;//can't get package on killed process
            pckg.client.send(JSON.stringify({
                msg : "Get From",
                date : date
            }))
        }else if(json.msg == "Update"){
            const token = json.token;
            const pckg = PythonProccess[token]
            if(!pckg) return ; //cant update a killed process
            pckg.client.send(JSON.stringify({
                msg : "Update",
                data : json.data
            }))
        }else if(json.msg == 'heartbeat'){
            asock.MyHeartBeat = true;
        }

    })
})
function EndMessage(token){
    const pckg = PythonProccess[token];
    if(!pckg) return;
    /**@type {ChildProcess} */
    const child = pckg.process;
    comjs.Kill(child);
    
    const sock = pckg.client;

    sock.send(JSON.stringify({
        msg : 'end'
    }))
    
    delete PythonProccess[token]
}


async function run(){

    await DatabaseCheck();
    await SetupWorkingEnvironment();


    const server = app.listen(port);
    
    server.on('upgrade',async (req,sock,head)=>{
        //connect
        wss.handleUpgrade(req,sock,head,(ws)=>{
            ws.Authenticated = false;
            wss.emit('connection',ws,req);
        })
    })

}

run()


