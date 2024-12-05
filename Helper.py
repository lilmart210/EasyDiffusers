import requests
import json
import sys
from datetime import datetime
from io import BytesIO
from websockets.sync.client import connect
import asyncio
import time
from PIL import Image
from io import BytesIO


"""
This module contains helper functions for communicating 
between the js parent and the python process
"""
"""
messages return type is 
    config : {
        options : [
            {
                name : "a name" | string,
                value : "a value" | string | number | bool | undefined,
                default : "default value" | string | number | bool
            },
            ...
        ],
        ...
    },
    msgs : [
        {
            files : [
                chat : number,
                file : string,
                id : number
            ],
            msg : {
                chat : number,
                date : number,
                id : number,
                owner : string,
                role : 'user' | 'ai' | 'system' || string,
                text : string
            }
        }
    ],
    id : number // this is the chat id


"""
"""
Project files type

[
    {
        name : string,
        text : string
    },
    ...
]
"""


args = sys.argv

SERVER_LOCATION = args[1]
SOCKET_LOCATION = args[2]
TOKEN = args[3] #authentication token
IDENTIFIER = args[4] #token to identify what chat was associated with this python proc
def Loop(proc):
    with connect(SOCKET_LOCATION) as ws:
        data = GetData(ws)
        #Chat messages and configuration
        config = data["config"]
        messages = data["msgs"]
        chat = data["id"]
        files = data["files"]#project files
        params = ZipConfig(config)
        #missing project files
        
        proc(ws,messages,chat,params,files)

def GetProjectFiles(project):
    auth = {
        "Authorization" : f"Bearer {TOKEN}",
    }
    body = {
        "id" : project["id"]
    }
    
    addr = f"{SERVER_LOCATION}/project/get/files"

    response = requests.post(addr,headers=auth,json = body)
    return response.json()

def GetMessageFiles(chat : int, msg : dict):
    f : list = msg["files"]
    arr = []

    auth = {
        "Authorization" : f"Bearer {TOKEN}",
    }
    for i in range(len(f)): 
        addr = f'{SERVER_LOCATION}/file/{chat}/{f[i]["id"]}'

        response = requests.get(addr,headers=auth,stream=True)
        img = Image.open(BytesIO(response.content))
        arr.append(img)
    
    return arr

def GetData(ws):
    """Gets the data from the server to begin initialization, initializes socket"""
    #authenticate
    ws.send(TOKEN)
    #get chat history and config
    ws.send(json.dumps({"msg" : "python","token" : IDENTIFIER}))
    #do something with this
    data = ws.recv()
    data = json.loads(data)

    return data

def ZipConfig(config):
    opts : dict = config["options"]
    res = {}
    for obj in opts:
        res[obj["name"]] = obj["value"] if "value" in obj != None else obj["default"]

    return res



def Update(ws,msg : str = ""):
    """Sends an update from the message to the front end. Does not terminate the session"""
    ws.send(json.dumps({
        "msg" : "Update",
        "data" : msg,
        "token" : IDENTIFIER
    }))

def SendChat(chat : int,date : int, msg : str,files = []):
    """Sends a permanent chat message, does not terminate the session"""

    auth = {
        "Authorization" : f"Bearer {TOKEN}",
    }
    body = {
        "chat" :  chat,
        "date" : date,
        "role" : "ai",
        "text" : msg
    }
    
    addr = f"{SERVER_LOCATION}/message"

    response = requests.post(addr,headers=auth,json = body)
    print("sent chat")
    if(response.status_code != 200) :
        return print("could not send chat")
    js = response.json()
    if(len(files)):
        SendImage(js["id"],files)

def GetFrom(ws,date : int):
    ws.send(json.dumps({"msg" : "Get From","token" : IDENTIFIER,"date" : date}))

def SendImage(chat : int,files : list,type="PNG",mime="image/png",name="file.png"):
    addr = f"{SERVER_LOCATION}/message/{chat}"

    auth = {
        "Authorization" : f"Bearer {TOKEN}",
    }

    myfiles = {}
    for i,aimg in enumerate(files):
        memdata = BytesIO()
        aimg.save(memdata,type,quality=100)
        memdata.seek(0)

        myfiles[f'file-{str(i)}'] = (name,memdata,mime)
    r = requests.post(url=addr,headers=auth,files=myfiles,verify=False)

def Time():
    ms = int(round(time.time() * 1000))
    return ms

def BStojson(val):
    data = val.split(',')
    data = [int(x) for x in data]
    data = bytearray(data)
    data = json.loads(data)
    return data

def PostImages(images : str,aloc : str) -> list[str]:
    """converts image to png and posts to server Returns array of File locations"""
    myfiles = {}
    for i,aimg in enumerate(images):
        memdata = BytesIO()
        aimg.save(memdata,"PNG",quality=100)
        memdata.seek(0)

        myfiles[f'file-{str(i)}'] = ('file.png',memdata,'image/png')
    r = requests.post(url=f'https://{aloc}/upload',files=myfiles,verify=False)
    
    filelocs = r.json()
    return filelocs


def ParseArgs(args):
    """parses args given at run time
    (data,location,myvar)
    (json,string,json)
    (Ts Example) data -> {
        [
            {
                from : 'User' | 'Model' | 'Cmd',
                time : string,
                text? : string,
                ImageSrc? : string,
                VideoSrc? : string,
                AudioSrc? : string
            }...
        ]
    (example) location -> 192.168.0.1:877 || mywebsite.com
    (example) myvar : {hi : 10,you :"hi"}

    data has been filtered to exclude messages from 'Cmd'
    """
    data = BStojson(sys.argv[1])
    location = sys.argv[2]
    myvar = BStojson(sys.argv[3])
    return (data,location,myvar)

def Log(msg):
    print(msg,file=sys.stderr,flush=True)

def PostAudio():
    pass

def PostVide():
    pass


