import Helper as H
import time

from diffusers import StableDiffusionPipeline
from diffusers import DDPMScheduler
import torch
from PIL import Image
import random
import torch
import torchaudio
from zonos.model import Zonos
from zonos.conditioning import make_cond_dict


def GenImg(text):
    model = Zonos.from_pretrained("Zyphra/Zonos-v0.1-hybrid", device="cuda")
    # model = Zonos.from_pretrained("Zyphra/Zonos-v0.1-transformer", device="cuda")

    wav, sampling_rate = torchaudio.load("assets/exampleaudio.mp3")
    speaker = model.make_speaker_embedding(wav, sampling_rate)

    cond_dict = make_cond_dict(text=text, speaker=speaker, language="en-us")
    conditioning = model.prepare_conditioning(cond_dict)

    codes = model.generate(conditioning)

    wavs = model.autoencoder.decode(codes).cpu()
    torchaudio.save("sample.wav", wavs[0], model.autoencoder.sampling_rate)

def TellUser(socket,pipe,step,total,stepleft,kwargs):
    H.Update(socket,f"step :{step}/{total}")
    
    return kwargs

def Main(ws,messages : list,chat : int,params : dict,projectfiles : list):
    """
        params is in key value format
        documentation is in helper.py
    """    
    #parameters for the chat
    steps = params.get("steps",20)
    negatives = params.get("negatives","")
    guidance_scale = params.get("guidance scale",4.5)
    frames = params.get("fps",24)
    count = params.get("count",1)
    offload = params.get("offload",False)

    last = messages[-1]["msg"]["text"]
    text = last

    #current time in ms
    date = H.Time()
    

    H.Update(ws,"generating message")

    mycall = lambda p,x,y,z : TellUser(ws,p,x,steps,y,z)
    last_images = H.GetMessageFiles(chat,messages[-1])
    
    img = last_images[0] if len(last_images) > 0 else None 

    if(len(last_images) < 1):
        H.SendChat(chat,date,"",files=[])
        H.GetFrom(ws,date)    
        H.Update(ws,"Missing Images")
        return 

    vids = GenImg(text,img,steps,mycall,guidance_scale,negatives,frames,count,offload)
    

    H.SendChat(chat,date,"",files=vids,fps=frames,videos=True)

    H.GetFrom(ws,date)    
    H.Update(ws,"done generating message, closing")


    print("closing")



if __name__ == '__main__':
    H.Loop(Main)