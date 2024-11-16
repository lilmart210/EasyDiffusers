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
const bcrypt = require('bcrypt')
const knex = require('knex')
const jwt = require('jsonwebtoken')
const ws = require('ws');

const interfaces = os.networkInterfaces();
dotenv.config()


const Source = require('./Generator');


const Generator = Source.Generator();
const DATADIRECTORY = path.join(__dirname,'Volume','Data');
const SAVEDIRECTORY = path.join(__dirname,'Volume','Uploads');
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
const wss = ws.WebSocketServer({noServer : true});

const port = 7377;
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

app.use(express.json());
app.use(express.urlencoded())
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
            password : 'easydiff',
            database : 'easydiff'
        }
    })
}else{
    DB = knex({
        client : 'sqlite3',
        connection : {
            filename : path.join(__dirname,"development.sqlite3")
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
        table.foreign('owner').references('email').inTable('users');

    })
    const projectfiles = DB.schema.createTable("projectfiles",(table)=>{
        table.string('name').primary();
        table.string('project').notNullable();
        table.string('location').notNullable();

        table.foreign('project').references('id').inTable('projects');
        table.primary(['name','project']);
    })
    const chats = DB.schema.createTable("chats",(table)=>{
        table.increments('id').primary();
        table.string('owner').notNullable();
        table.string('date').notNullable();

        table.foreign('owner').references('email').inTable('users');

    })
    const messages = DB.schema.createTable("messages",(table)=>{
        table.increments('id').primary();
        table.string('owner').notNullable();
        table.string('date').notNullable();
        table.integer('chat').notNullable();

        table.foreign('chat').references('id').inTable('chats');
    })

    const files = DB.schema.createTable("files",(table)=>{
        table.increments('id');
        table.string('location').notNullable();
        table.string('owner');
        table.string('date').notNullable();

        table.foreign('owner').references('email').inTable('users');
        
    })


    const resolved = Promise.all([User,Projects,projectfiles,chats,messages,files]);

    return await resolved.then(()=>{
        console.log("Database checks passed")
    }).catch((e)=>{
        //failed to create table or table already exists
        console.log("failed to create tables",e);
    })

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

    const token = jwt.sign({email : user.email,admin : user.admin},TOKEN_SECRET);


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

app.use(express.static(path.join(__dirname,'FrontEnd','dist')));

app.get('/',(req,res)=>{
    res.sendFile(path.join(__dirname,'FrontEnd','dist','index.html'));
})
//routes
app.post('/login',LoginAuth);
app.post('/register',RegisterAuth);
app.post('/verify',AuthReq,(req,res)=>{
    res.sendStatus(200);
});

/**
 * AuthReq adds these to the request
 *  req.AUTH = {
            email : verified.email,
            admin : verified.admin
        }
 */

/**
 * Chat commands are websocket commands
 */
//creates a new chat
app.post('/chat',AuthReq,async (req,res)=>{
    const adate = req.body.date;
    if(!adate) return res.status()
    
    const res = await DB('chats')
    .insert({owner : req.AUTH.email,date : adate})
    .then((rows)=>{
        const msg = rows.length > 0 ? 'inserted' : 'could not insert'
        return msg;
    }).catch(()=>{
        return 'failed to insert';
    })
    
    res.statusMessage(res).send(200);

});
//get chat and its messages
app.get('/chat/:id',AuthReq,(req,res)=>{

})

//handle file uploads and fetching


//get all user chats
app.get('/chatlist',AuthReq,(req,res)=>{
    const res = DB('chats')
    .select('*')
    .where({owner : req.AUTH.email})
    .then((rows)=>{
        return rows;
    })
    .catch(()=>{
        return null;
    })
    if(!res) return res.statusMessage('failed to fetch').sendStatus(500);

    res.statusCode(200).send(res);
})

wss.on('connection',(asock)=>{
    asock.on('message',(data,isbin)=>{
        //it is binary
        const msg = Buffer.from(data).toString();
        let json;
        try{
            json = JSON.parse(msg);
        }catch(e){
            //recieved a back message
        }
        if(!json) return;
        //json should adhere to this principle
        console.log(json);

    })
})


async function run(){

    await DatabaseCheck();


    const server = app.listen(port);
    
    server.on('upgrade',async (req,sock,head)=>{
        //set socket flag
        req.is_socket_request = true;
        //authenticate    
        const isvald = await AuthReq(req);
        //destroy if not auth
        if(!isvald) return sock.destroy();

        //connect
        wss.handleUpgrade(req,sock,head,(ws)=>{
            wss.emit('connection',ws,req);
        })
    })

}

run()


