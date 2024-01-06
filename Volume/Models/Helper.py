import requests
import json
import sys
from datetime import datetime
from io import BytesIO

"""
This module contains helper functions for communicating 
between the js parent and the python process
"""

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
        model : (selected from config.json),
        history : [
            {
                from : 'User' | 'Model' | 'Cmd',
                time : string,
                text? : string,
                ImageSrc? : string,
                VideoSrc? : string,
                AudioSrc? : string
            }...
        ]
    }
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


