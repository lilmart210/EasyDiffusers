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
import signal
import cv2
import numpy as np
import io;
import imageio



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
#where do i set the cache for huggingface?

args = sys.argv

SERVER_LOCATION = args[1]
SOCKET_LOCATION = args[2]
TOKEN = args[3] #authentication token
IDENTIFIER = args[4] #token to identify what chat was associated with this python proc

async def Run(func):
    loop = asyncio.get_running_loop()

    def handler(sig,frame):
        loop.stop()
    
    signal.signal(signal.SIGINT, handler)
    signal.signal(signal.SIGTERM, handler)

    try:
        await asyncio.gather(func())
    except asyncio.CancelledError:
        print("Task was cancelled")

def Loop(proc):
    with connect(SOCKET_LOCATION) as ws:
        data = GetData(ws)
        #config id project
        #configuration is unchanged name,source,options,env
        #id is the chatid number\chatid
        #project is the project 'selected project' id,name,owner,directory

        #Chat messages and configuration
        config = data["config"]
        chat = data["id"]
        project = data.get('project',{})

        params = ZipConfig(config)
        messages = GetChatMessages(chat)
        #messages = data["msgs"]
        
        #files = data["files"]#project files
        files = []
        if(project):
            files = GetProjectFiles(project)
        #{name:string,source:string,options:env,files:[{name :string,text : string}]}
        projectfiles = {
            **project,
            "files" : files,
        }
        

        proc2 = lambda : proc(ws,messages,chat,params,projectfiles)
        #run async to enable shutdown
        #asyncio.run(Run(proc2))
        proc2()

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

def GetChatMessages(chat: int):
    auth = {
        "Authorization" : f"Bearer {TOKEN}",
    }
    body = {
        "id" : chat
    }
    
    addr = f"{SERVER_LOCATION}/message/get"

    response = requests.post(addr,headers=auth,json = body)

    return response.json()


def GetMessageFiles(chat : int, msg : dict,text = False):
    f : list = msg["files"]
    arr = []

    auth = {
        "Authorization" : f"Bearer {TOKEN}",
    }
    for i in range(len(f)): 
        addr = f"{SERVER_LOCATION}/file/{chat}/{f[i]['id']}"

        response = requests.get(addr,headers=auth,stream=True)
        if(not text):
            img = Image.open(BytesIO(response.content))
            arr.append(img)
        else:
            decoded_content = response.text
            arr.append(decoded_content)

    return arr

def GetData(ws):
    """Gets the data from the server to begin initialization, initializes socket"""
    #authenticate
    ws.send(TOKEN)
    #remove the heartbeat listenener
    ws.send(json.dumps({"msg" : "remove heartbeat"}))
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

def SendChat(chat : int,date : int, msg : str,role : str = 'ai',files = [],videos = False,fps =24):
    """Sends a permanent chat message, does not terminate the session"""

    auth = {
        "Authorization" : f"Bearer {TOKEN}",
    }
    body = {
        "chat" :  chat,
        "date" : date,
        "role" : role,
        "text" : msg
    }
    
    addr = f"{SERVER_LOCATION}/message"

    response = requests.post(addr,headers=auth,json = body)
    print("sent chat")
    if(response.status_code != 200) :
        return print("could not send chat")
    js = response.json()
    if(not(videos) and len(files)):
        SendImage(js["id"],files)
    
    if(videos and len(files)):
        SendVideo(js["id"],files,fps=fps)

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

def SendVideo(chat: int, files: list, type="MP4", mime="video/mp4", name="file.mp4", fps=24):
    addr = f"{SERVER_LOCATION}/message/{chat}"

    auth = {
        "Authorization": f"Bearer {TOKEN}",
    }

    myfiles = {}
    for i, avideo in enumerate(files):
        # Create a video buffer in memory
        out_buffer = makevideo(avideo,fps)

        # Prepare the in-memory video for upload
        myfiles[f'file-{str(i)}'] = (name, out_buffer, mime)

    r = requests.post(url=addr, headers=auth, files=myfiles, verify=False)


    return r

def makevideo(video_frames,fps):
    if isinstance(video_frames[0], np.ndarray):
        video_frames = [(frame * 255).astype(np.uint8) for frame in video_frames]
    elif isinstance(video_frames[0],Image.Image):
        video_frames = [np.array(frame) for frame in video_frames]
    
    video_bytes = io.BytesIO()
    imageio.mimwrite(video_bytes, video_frames,format='mp4', fps=fps, codec='h264')
    video_bytes.seek(0)

    return video_bytes


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


